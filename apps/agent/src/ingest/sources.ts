import { sources } from '@klippy/db';
import { createD1Database } from 'data-table-d1';
import { and, eq, gt } from 'remix/data-table';

// Ingesting costs Workers AI calls (Markdown now, embeddings and context later), so a Klippy may add at most
// 30 sources a day, and a source keeps at most 60,000 characters of text (about 15,000 tokens).
export const MAX_SOURCES_PER_DAY = 30;
export const MAX_BODY = 60_000;

type NewSource = { owner: string; kind: 'note' | 'link' | 'file'; title: string; url?: string; noteId?: number; body?: string };

// Add a source as 'queued', unless this Klippy hit today's cap. Returns its row, or null when over the cap.
export async function queueSource(d1: D1Database, source: NewSource) {
	const db = createD1Database(d1);
	const since = Date.now() - 24 * 60 * 60 * 1000;
	const today = await db.count(sources, { where: and(eq('owner', source.owner), gt('created_at', since)) });
	if (today >= MAX_SOURCES_PER_DAY) return null;
	return db.create(
		sources,
		{
			owner: source.owner,
			kind: source.kind,
			title: source.title.slice(0, 200),
			url: source.url ?? null,
			note_id: source.noteId ?? null,
			body: source.body?.slice(0, MAX_BODY) ?? null,
			status: 'queued',
			created_at: Date.now(),
		},
		{ returnRow: true },
	);
}
