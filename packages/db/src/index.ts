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
