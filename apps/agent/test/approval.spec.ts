import { applyD1Migrations, env, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fakeModel } from './fake-model';

const fake = vi.hoisted(() => ({ model: undefined as ReturnType<typeof fakeModel> | undefined }));
vi.mock('../src/model', () => ({ model: () => fake.model }));
// An approved note is also ingested in the background: no real embeddings in tests.
vi.mock('../src/retrieval/vectors', () => ({ upsertChunks: async () => 0 }));

beforeAll(() => applyD1Migrations(env.DB, env.TEST_MIGRATIONS));

const say = (id: string, text: string) => ({ id, role: 'user' as const, parts: [{ type: 'text' as const, text }] });
type Part = { type: string; state?: string; toolCallId?: string; text?: string };

async function lastParts(name: string) {
	const response = await SELF.fetch(`https://example.com/agents/klippy/${name}/get-messages`, { headers: { Authorization: 'Bearer test-token' } });
	return (await response.json<{ parts: Part[] }[]>()).at(-1)!.parts;
}

// Ask Klippy to save a note, then answer its question over a WebSocket, as `pnpm chat` does.
async function answer(name: string, approved: boolean) {
	fake.model = fakeModel({ tool: 'saveNote', input: { body: `note from ${name}` } }, 'Saved it.');
	await env.Klippy.getByName(name).saveMessages([say('m1', `Save a note: note from ${name}`)]);
	const pending = (await lastParts(name)).find((part) => part.state === 'approval-requested');
	expect(pending?.type).toBe('tool-saveNote'); // the turn paused, waiting for you

	const socket = (await SELF.fetch(`https://example.com/agents/klippy/${name}?token=test-token`, { headers: { Upgrade: 'websocket' } })).webSocket!;
	socket.accept();
	socket.send(JSON.stringify({ type: 'cf_agent_tool_approval', toolCallId: pending!.toolCallId, approved, autoContinue: true }));
	// Wait until the turn has finished: the model's second answer is in the chat.
	for (let i = 0; i < 50 && !(await lastParts(name)).some((p) => p.text === 'Saved it.'); i++) {
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
	socket.close();
	return env.DB.prepare('SELECT body FROM notes WHERE body = ?').bind(`note from ${name}`).all();
}

describe('saveNote asks first', () => {
	it('saves nothing until you approve, then saves', async () => {
		const { results } = await answer('nina', true);
		expect(results).toEqual([{ body: 'note from nina' }]);
		expect((await lastParts('nina')).find((p) => p.type === 'tool-saveNote')?.state).toBe('output-available');
	});

	it('saves nothing when you say no, and the model is told', async () => {
		const { results } = await answer('omar', false);
		expect(results).toEqual([]);
		expect((await lastParts('omar')).find((p) => p.type === 'tool-saveNote')?.state).toBe('output-denied');
		expect(fake.model!.doStreamCalls).toHaveLength(2); // the turn went on: the model saw the "no" and answered
	});
});
