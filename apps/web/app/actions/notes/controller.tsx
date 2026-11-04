import { notes } from '@klippy/db';
import { like } from 'remix/data-table';
import { parseSafe } from 'remix/data-schema';
import { redirect } from 'remix/response/redirect';
import { createController } from 'remix/router';
import { requireUser } from '../../auth.ts';
import { database } from '../../db.ts';
import { routes } from '../../routes.ts';
import { NotesPage } from './notes-page.tsx';
import { NoteId, NotesQuery } from './schema.ts';

export default createController(routes.notes, {
	middleware: [requireUser],
	actions: {
		async index(context) {
			const query = parseSafe(NotesQuery, context.url.searchParams);
			if (!query.success) return new Response('Search is at most 100 characters.', { status: 400 });
			const { q, deleted } = query.value;
			const rows = await database().findMany(notes, {
				where: q ? like('body', `%${q}%`) : undefined,
				orderBy: ['id', 'desc'],
				limit: 50,
			});
			return context.render(<NotesPage user={context.auth.identity} notes={rows} q={q} deleted={deleted === '1'} />);
		},
		async destroy(context) {
			const id = parseSafe(NoteId, context.params.id);
			if (!id.success) return new Response('No such note.', { status: 404 });
			await database().delete(notes, id.value);
			// 303: the browser follows with a GET, so a refresh doesn't post again.
			return redirect(`${routes.notes.index.href()}?deleted=1`, 303);
		},
	},
});
