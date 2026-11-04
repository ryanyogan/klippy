import { sources } from '@klippy/db';
import { AgentWorkflow, type AgentWorkflowEvent, type AgentWorkflowStep } from 'agents/workflows';
import { createD1Database } from 'data-table-d1';
import type { Klippy } from '../agent';
import { readLinkAsMarkdown } from './read';

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
			if (source.kind === 'link' && source.url) {
				// Websites fail now and then: try 3 more times, waiting 5 s, then 10 s, then 20 s.
				const page = await step.do('fetch', { retries: { limit: 3, delay: '5 seconds', backoff: 'exponential' }, timeout: '1 minute' }, () =>
					readLinkAsMarkdown(this.env, source.url!),
				);
				await step.do('store', () => db.update(sources, sourceId, { title: page.title.slice(0, 200), body: page.body }));
			}
			await step.do('ready', () => db.update(sources, sourceId, { status: 'ready' }));
			return { sourceId, status: 'ready' };
		} catch (error) {
			// Out of retries: mark it failed, so Klippy can say so instead of pretending it read the page.
			await step.do('failed', () => db.update(sources, sourceId, { status: 'failed' }));
			throw error;
		}
	}
}
