import { column as c, table } from 'remix/data-table';

// The same columns as migrations/0001_notes.sql, typed for TypeScript.
export const notes = table({
	name: 'notes',
	columns: {
		id: c.integer().primaryKey(),
		body: c.text(),
		created_at: c.integer(),
	},
});

// The same columns as migrations/0002_sources.sql.
export const sources = table({
	name: 'sources',
	columns: {
		id: c.integer().primaryKey(),
		owner: c.text(),
		kind: c.enum(['note', 'link', 'file']),
		title: c.text(),
		url: c.text().nullable(),
		note_id: c.integer().nullable(),
		body: c.text().nullable(),
		status: c.enum(['queued', 'ready', 'failed']),
		created_at: c.integer(),
	},
});
