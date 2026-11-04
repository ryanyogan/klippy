import { sources } from '@klippy/db';
import { AgentWorkflow, type AgentWorkflowEvent, type AgentWorkflowStep } from 'agents/workflows';
import { createD1Database } from 'data-table-d1';
import type { Klippy } from '../agent';
import { chunk } from './chunk';
import { contextFor } from './context';
import { readLinkAsMarkdown } from './read';
import { saveChunks } from './sources';
import { type ChunkRow, upsertChunks } from '../retrieval/vectors';

export type IngestParams = { sourceId: number };

// Ingest one source in durable steps. Each step.do runs once and its result is saved: if the Worker restarts or a
// later step fails, the Workflow picks up after the last finished step instead of starting again.
export class IngestWorkflow extends AgentWorkflow<Klippy, IngestParams> {
	async run(event: AgentWorkflowEvent<IngestParams>, step: AgentWorkflowStep) {
		const db = createD1Database(this.env.DB);
		const { sourceId } = event.payload;
		const source = await step.do('load', () => db.find(sources, sourceId));
		if (!source || source.status !== 'queued') return { skipped: true };

		try {
			// A link is fetched and turned into Markdown. A note or a file already has its text.
			let body = source.body ?? '';
			if (source.kind === 'link' && source.url) {
				// Websites fail now and then: try 3 more times, waiting 5 s, then 10 s, then 20 s.
				const page = await step.do('fetch', { retries: { limit: 3, delay: '5 seconds', backoff: 'exponential' }, timeout: '1 minute' }, () =>
					readLinkAsMarkdown(this.env, source.url!),
				);
				await step.do('store', () => db.update(sources, sourceId, { title: page.title.slice(0, 200), body: page.body }));
				body = page.body;
			}
			// Cut the text into chunks and save them, each with its source and position.
			const count = await step.do('chunk', () => saveChunks(this.env.DB, source, chunk(body)));
			// Contextual retrieval: one sentence of context per chunk, one step each, so a retry never redoes a finished one.
			// A source of one chunk is its own context, so it costs no call.
			for (let position = 0; count > 1 && position < count; position++) {
				await step.do(`context ${position}`, { retries: { limit: 2, delay: '5 seconds', backoff: 'exponential' } }, async () => {
					const row = await this.env.DB.prepare('SELECT id, text FROM chunks WHERE source_id = ? AND position = ?')
						.bind(sourceId, position)
						.first<{ id: number; text: string }>();
					if (!row) return '';
					const context = await contextFor(this.env, body, row.text);
					await this.env.DB.prepare('UPDATE chunks SET context = ? WHERE id = ?').bind(context, row.id).run();
					return context;
				});
			}
			// Embed every chunk and store the vectors in Vectorize (Workers AI is called once for up to 50 chunks).
			await step.do('embed', { retries: { limit: 3, delay: '5 seconds', backoff: 'exponential' } }, async () => {
				const { results } = await this.env.DB.prepare('SELECT id, owner, source_id, context, text FROM chunks WHERE source_id = ? ORDER BY position')
					.bind(sourceId)
					.all<ChunkRow>();
				return upsertChunks(this.env, results);
			});
			await step.do('ready', () => db.update(sources, sourceId, { status: 'ready' }));
			return { sourceId, status: 'ready', chunks: count };
		} catch (error) {
			// Out of retries: mark it failed, so Klippy can say so instead of pretending it read the page.
			await step.do('failed', () => db.update(sources, sourceId, { status: 'failed' }));
			throw error;
		}
	}
}
