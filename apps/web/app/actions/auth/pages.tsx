import type { Handle } from 'remix/component';
import { routes } from '../../routes.ts';
import { Layout } from '../../ui/layout.tsx';

export function LoginPage(handle: Handle<{ error?: string }>) {
	return () => (
		<Layout title="Sign in · Klippy">
			<section class="signin">
				<h1>Klippy</h1>
				<p class="muted">Your personal agent: it chats, remembers, keeps notes and reminds you.</p>
				{handle.props.error && (
					<p class="notice error" role="alert">
						{handle.props.error}
					</p>
				)}
				<a class="button" href={routes.auth.github.href()}>
					Sign in with GitHub
				</a>
			</section>
		</Layout>
	);
}

export function NotAllowedPage(handle: Handle<{ login: string }>) {
	return () => (
		<Layout title="Not allowed · Klippy">
			<h1>This Klippy isn't yours</h1>
			<p>
				GitHub says you're <strong>@{handle.props.login}</strong>, and that account isn't on this Klippy's list. Nothing was
				saved.
			</p>
			<a href={routes.auth.login.href()}>Back to sign-in</a>
		</Layout>
	);
}
