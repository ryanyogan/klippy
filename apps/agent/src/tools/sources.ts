import { tool } from 'ai';
import { z } from 'zod';
import type { Klippy } from '../agent';
import { queueSource } from '../ingest/sources';
import { linksIn } from './link';

// Save a link to read later: Klippy queues it and an IngestWorkflow fetches it in the background.
// Like readLink, only the exact links in your latest message: a page or a note can't make it save (and so fetch) a URL.
export function saveLinkTool(agent: Klippy, env: Env, question: string) {
	const allowed = linksIn(question);
	return tool({
		description:
			"Save a web page to the user's library so you can answer from it later. Use it only when the user asks to save, keep or remember a link. It returns at once; the page is read in the background.",
		inputSchema: z.object({ url: z.string().describe('The link, exactly as the user wrote it') }),
		execute: async ({ url }) => {
			const href = URL.canParse(url) ? new URL(url).href : '';
			if (!allowed.has(href)) throw new Error(`Only the exact links in the user's message can be saved, and ${url} isn't one of them.`);
			const source = await queueSource(env.DB, { owner: agent.name, kind: 'link', title: href, url: href });
			if (!source) throw new Error("You've saved enough for today. Try again tomorrow.");
			await agent.runWorkflow('INGEST', { sourceId: source.id });
			return { saved: { id: source.id, url: href, status: 'reading it in the background' } };
		},
	});
}
