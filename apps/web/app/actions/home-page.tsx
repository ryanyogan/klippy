import type { Handle } from 'remix/component';
import { Layout } from '../ui/layout.tsx';

export function HomePage(handle: Handle<{ agentSays: string }>) {
	return () => (
		<Layout title="Klippy">
			<h1>Klippy</h1>
			<p>
				The agent says: <q>{handle.props.agentSays}</q>
			</p>
		</Layout>
	);
}
