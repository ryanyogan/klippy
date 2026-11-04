import * as s from 'remix/data-schema';
import { maxLength, min } from 'remix/data-schema/checks';
import * as coerce from 'remix/data-schema/coerce';
import * as f from 'remix/data-schema/form-data';

// ?q= on the notes page: optional, at most 100 characters.
export const NotesQuery = f.object({
	q: f.field(s.defaulted(s.string().pipe(maxLength(100)), '')),
	deleted: f.field(s.defaulted(s.string(), '')),
});

// The :id in /notes/:id/delete: a whole number from 1 up.
export const NoteId = coerce.number().pipe(min(1));
