import { applyD1Migrations, env, SELF } from 'cloudflare:test';
import { beforeAll, describe, it, expect, vi } from 'vitest';
import { fakeModel } from './fake-model';

const fake = vi.hoisted(() => ({ model: undefined as ReturnType<typeof fakeModel> | undefined }));
vi.mock('../src/model', () => ({ model: () => fake.model }));

function note(text: string, headers: Record<string, string> = { Authorization: 'Bearer test-token' }) {
	return SELF.fetch('https://example.com/note', { method: 'POST', headers, body: JSON.stringify({ text }) });
}

beforeAll(() => applyD1Migrations(env.DB, env.TEST_MIGRATIONS));

describe('POST /note', () => {
	it('forces saveNote, saves the tidy note, and makes one model call', async () => {
		fake.model = fakeModel({ tool: 'saveNote', input: { body: 'Call Sam about the bike on Friday' } });
		const response = await note('ugh remind me 2 call sam re bike fri');
		expect(await response.json()).toEqual({ saved: { id: expect.any(Number), body: 'Call Sam about the bike on Friday' } });

		const call = fake.model.doGenerateCalls[0];
		expect(call.toolChoice).toEqual({ type: 'tool', toolName: 'saveNote' });
		expect(call.tools?.map((t) => t.name)).toEqual(['saveNote']);
		expect(fake.model.doGenerateCalls).toHaveLength(1);
	});

	it('answers 422 when the note could not be saved', async () => {
		fake.model = fakeModel({ tool: 'saveNote', input: { body: 'a'.repeat(1001) } });
		expect((await note('a long ramble')).status).toBe(422);
	});

	it('needs your token', async () => {
		expect((await note('hi', {})).status).toBe(401);
	});
});
