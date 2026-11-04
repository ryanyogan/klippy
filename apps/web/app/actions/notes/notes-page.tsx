import type { Handle } from 'remix/component';
import type { User } from '../../auth.ts';
import { routes } from '../../routes.ts';
import { Layout } from '../../ui/layout.tsx';

type Note = { id: number; body: string; created_at: number };

export function NotesPage(handle: Handle<{ user: User; notes: Note[]; q: string; deleted: boolean }>) {
	return () => {
		const { user, notes, q, deleted } = handle.props;
		return (
			<Layout title="Notes · Klippy" user={user} current="notes">
				<h1>Your notes</h1>
				{deleted && (
					<p class="notice" role="status">
						Note deleted.
					</p>
				)}
				<form method="get" action={routes.notes.index.href()} role="search">
					<label for="q">Search your notes</label>
					<div class="row">
						<input id="q" name="q" type="search" value={q} maxLength={100} />
						<button type="submit">Search</button>
					</div>
				</form>
				{notes.length === 0 ? (
					<p class="muted">{q ? `No notes match "${q}".` : 'No notes yet. Ask Klippy to save one in the chat.'}</p>
				) : (
					<ul class="notes">
						{notes.map((note) => (
							<li key={note.id}>
								<p>
									{note.body}
									<time dateTime={new Date(note.created_at).toISOString()}>{new Date(note.created_at).toUTCString()}</time>
								</p>
								<form method="post" action={routes.notes.destroy.href({ id: String(note.id) })}>
									<button class="danger" type="submit" aria-label={`Delete note: ${note.body.slice(0, 40)}`}>
										Delete
									</button>
								</form>
							</li>
						))}
					</ul>
				)}
			</Layout>
		);
	};
}
