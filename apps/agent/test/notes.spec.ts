import { applyD1Migrations, env, SELF } from 'cloudflare:test';
import { beforeAll, describe, it, expect, vi } from 'vitest';
import { fakeModel } from './fake-model';

const fake = vi.hoisted(() => ({ model: undefined as ReturnType<typeof fakeModel> | undefined }));
vi.mock('../src/model', () => ({ model: () => fake.model }));

function ask(question: string) {
	return SELF.fetch('https://example.com/ask', {
		method: 'POST',
		headers: { Authorization: 'Bearer test-token' },
		body: JSON.stringify({ question }),
	});
}

function countNotes() {
	return env.DB.prepare('SELECT count(*) AS n FROM notes').first<number>('n');
}

// The model is fake, but the database is a real (local) D1, built by your migrations.
beforeAll(() => applyD1Migrations(env.DB, env.TEST_MIGRATIONS));

describe('notes', () => {
	it('saveNote writes a row, and listNotes reads it back', async () => {
		fake.model = fakeModel({ tool: 'saveNote', input: { body: 'Buy oat milk' } }, 'Saved.');
		expect(await (await ask('Note down: buy oat milk')).json()).toEqual({ answer: 'Saved.' });

		const { results } = await env.DB.prepare('SELECT body FROM notes').all();
		expect(results).toEqual([{ body: 'Buy oat milk' }]);

		fake.model = fakeModel({ tool: 'listNotes', input: {} }, 'You saved one note.');
		await ask('What did I save?');
		const toolMessage = JSON.stringify(fake.model.doGenerateCalls[1].prompt.find((m) => m.role === 'tool'));
		expect(toolMessage).toContain('Buy oat milk');
	});

	it('refuses a note over 1,000 characters: nothing is written', async () => {
		const before = await countNotes();
		fake.model = fakeModel({ tool: 'saveNote', input: { body: 'a'.repeat(1001) } }, 'That was too long.');
		await ask('Save this very long note');
		expect(await countNotes()).toBe(before);
		// The model is told what went wrong, so it can say so.
		expect(JSON.stringify(fake.model.doGenerateCalls[1].prompt)).toContain('too_big');
	});
});
