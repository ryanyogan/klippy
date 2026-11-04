import { applyD1Migrations, env, introspectWorkflow, runInDurableObject, SELF } from 'cloudflare:test';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { chatTools, type Klippy } from '../src/agent';
import { MAX_SOURCES_PER_DAY, queueSource, saveChunks } from '../src/ingest/sources';
import { saveLinkTool } from '../src/tools/sources';

// No real web: the page read is a stand-in that returns Markdown (or fails, when a test says so).
const web = vi.hoisted(() => ({ fail: false }));
vi.mock('../src/ingest/read', () => ({
	readLinkAsMarkdown: async (_env: Env, url: string) => {
		if (web.fail) throw new Error(`${url} answered 500`);
		return { title: 'Oat milk, explained', body: '# Oat milk\n\nIt is made from oats.' };
	},
}));

beforeAll(() => applyD1Migrations(env.DB, env.TEST_MIGRATIONS));

const opts = { toolCallId: 't', messages: [], context: {} };
const source = (id: number) => env.DB.prepare('SELECT owner, kind, title, url, body, status FROM sources WHERE id = ?').bind(id).first();

// Run fn, then wait for the one Workflow it started to finish.
async function andWait(fn: () => Promise<void>, status: 'complete' | 'errored' = 'complete') {
	const introspector = await introspectWorkflow(env.INGEST);
	try {
		await introspector.modifyAll((m) => m.disableRetryDelays());
		await fn();
		const [instance] = await introspector.get();
		await instance.waitForStatus(status);
	} finally {
		await introspector.dispose();
	}
}

describe('ingest', () => {
	it('saveLink queues the link, and the Workflow stores it as Markdown', async () => {
		let id = 0;
		await andWait(() =>
			runInDurableObject(env.Klippy.getByName('lena'), async (klippy: Klippy) => {
				const saveLink = saveLinkTool(klippy, env, 'Save https://example.com/oat-milk for later');
				const result = (await saveLink.execute!({ url: 'https://example.com/oat-milk' }, opts)) as { saved: { id: number } };
				id = result.saved.id;
			}),
		);
		expect(await source(id)).toEqual({
			owner: 'lena', kind: 'link', title: 'Oat milk, explained', url: 'https://example.com/oat-milk', body: '# Oat milk\n\nIt is made from oats.', status: 'ready',
		});
	});

	it('saveLink refuses a link that is not in your message', async () => {
		await runInDurableObject(env.Klippy.getByName('lena'), async (klippy: Klippy) => {
			const saveLink = saveLinkTool(klippy, env, 'Save https://example.com/oat-milk');
			await expect(saveLink.execute!({ url: 'https://evil.example/?notes=secret' }, opts)).rejects.toThrow("isn't one of them");
		});
	});

	it('a page that keeps failing ends as failed, not ready', async () => {
		web.fail = true;
		let id = 0;
		await andWait(
			() =>
				runInDurableObject(env.Klippy.getByName('mo'), async (klippy: Klippy) => {
					const saveLink = saveLinkTool(klippy, env, 'keep https://example.com/down');
					id = ((await saveLink.execute!({ url: 'https://example.com/down' }, opts)) as { saved: { id: number } }).saved.id;
				}),
			'errored',
		);
		web.fail = false;
		expect((await source(id))?.status).toBe('failed');
	});

	it('POST /agents/klippy/<name>/file takes a text file, behind the token', async () => {
		const send = (type: string, token = 'test-token') => {
			const form = new FormData();
			form.set('file', new File(['Pip is my dog. She likes carrots.'], 'pip.txt', { type }));
			return SELF.fetch('https://example.com/agents/klippy/nora/file', { method: 'POST', body: form, headers: { Authorization: `Bearer ${token}` } });
		};
		expect((await send('text/plain', 'wrong')).status).toBe(401);
		expect((await send('image/png')).status).toBe(415);
		let id = 0;
		await andWait(async () => {
			const response = await send('text/plain');
			expect(response.status).toBe(202);
			id = (await response.json<{ id: number }>()).id;
		});
		expect(await source(id)).toMatchObject({ owner: 'nora', kind: 'file', title: 'pip.txt', body: 'Pip is my dog. She likes carrots.', status: 'ready' });
		const { results } = await env.DB.prepare('SELECT owner, position, text FROM chunks WHERE source_id = ?').bind(id).all();
		expect(results).toEqual([{ owner: 'nora', position: 0, text: 'Pip is my dog. She likes carrots.' }]);
	});

	it(`a Klippy can add at most ${MAX_SOURCES_PER_DAY} sources a day`, async () => {
		for (let i = 0; i < MAX_SOURCES_PER_DAY; i++) expect(await queueSource(env.DB, { owner: 'otto', kind: 'note', title: `n${i}`, body: 'x' })).not.toBeNull();
		expect(await queueSource(env.DB, { owner: 'otto', kind: 'note', title: 'one more', body: 'x' })).toBeNull();
	});

	it('a retried chunk step replaces the chunks instead of adding more', async () => {
		const row = await queueSource(env.DB, { owner: 'quinn', kind: 'note', title: 't', body: 'x' });
		await saveChunks(env.DB, row!, ['a', 'b']);
		await saveChunks(env.DB, row!, ['a', 'b']);
		expect(await env.DB.prepare('SELECT count(*) AS n FROM chunks WHERE source_id = ?').bind(row!.id).first('n')).toBe(2);
	});

	it("deleting a note deletes its source and its chunks", async () => {
		const note = await env.DB.prepare('INSERT INTO notes (body, created_at) VALUES (?, ?) RETURNING id').bind('Call Sam', Date.now()).first<number>('id');
		const row = await queueSource(env.DB, { owner: 'pia', kind: 'note', title: 'Call Sam', noteId: note!, body: 'Call Sam' });
		await saveChunks(env.DB, row!, ['Call Sam']);
		await env.DB.prepare('DELETE FROM notes WHERE id = ?').bind(note).run();
		expect(await source(row!.id)).toBeNull();
		expect(await env.DB.prepare('SELECT count(*) AS n FROM chunks WHERE source_id = ?').bind(row!.id).first('n')).toBe(0);
	});

	it('saveLink is a private tool: not built once a page is in the chat, and locked after one is read', async () => {
		await runInDurableObject(env.Klippy.getByName('lena'), async (klippy: Klippy) => {
			expect(chatTools(klippy, env, 'save https://example.com/a', { pageRead: false }, true).saveLink).toBeUndefined();
			const tools = chatTools(klippy, env, 'save https://example.com/a', { pageRead: true }, false);
			await expect(tools.saveLink.execute!({ url: 'https://example.com/a' }, opts)).rejects.toThrow("can't run after reading a page");
		});
	});
});
