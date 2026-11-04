import type { Handle } from 'remix/component';
import type { User } from '../auth.ts';
import { Layout } from '../ui/layout.tsx';

export function HomePage(handle: Handle<{ user: User; agent: string; saved: number }>) {
	return () => (
		<Layout title="Klippy" user={handle.props.user}>
			<h1>Hi, {handle.props.user.name}</h1>
			<p class="muted">
				Your Klippy is <code>{handle.props.agent}</code>. It has {handle.props.saved} saved messages.
			</p>
		</Layout>
	);
}
