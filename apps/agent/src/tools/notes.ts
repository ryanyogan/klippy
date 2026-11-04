import { notes } from '@klippy/db';
import { tool } from 'ai';
import { createD1Database } from 'data-table-d1';
import { z } from 'zod';

// A note can be a sentence or a short paragraph, not a book: this caps what one request can store.
export const MAX_NOTE = 1000;

// These tools need your database, so they're made per request from env.DB.
export function noteTools(d1: D1Database) {
	const db = createD1Database(d1);

	const saveNote = tool({
		description:
			'Save a note for the user, word for word. Use it only when the user asks you to remember, save or note something down. It returns the saved note with its id.',
		inputSchema: z.object({
			body: z.string().trim().min(1).max(MAX_NOTE).describe('The note, in the words the user gave'),
		}),
		execute: async ({ body }) => {
			const note = await db.create(notes, { body, created_at: Date.now() }, { returnRow: true });
			return { saved: { id: note.id, body: note.body } };
		},
	});

	const listNotes = tool({
		description:
			"List the user's saved notes, newest first (at most 20). Use it when the user asks what they saved, or asks about something they told you to note down.",
		inputSchema: z.object({}),
		execute: async () => {
			const rows = await db.findMany(notes, { orderBy: ['id', 'desc'], limit: 20 });
			return { notes: rows.map((note) => ({ id: note.id, body: note.body, savedAt: new Date(note.created_at).toISOString() })) };
		},
	});

	return { saveNote, listNotes };
}
