import type { Handle, RemixNode } from 'remix/component';
import type { User } from '../auth.ts';
import { routes } from '../routes.ts';

// The one document every page renders inside: head, the stylesheet, the top bar, and a main column.
export function Layout(handle: Handle<{ title: string; user?: User; current?: 'chat' | 'notes'; children?: RemixNode }>) {
	return () => (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta name="color-scheme" content="light dark" />
				<title>{handle.props.title}</title>
				<link rel="stylesheet" href="/styles.css" />
				{/* Starts the islands (the chat). Built by `pnpm build:client` into public/assets. */}
				<script type="module" src="/assets/entry.js"></script>
			</head>
			<body>
				<a class="skip" href="#main">
					Skip to content
				</a>
				<header class="bar">
					<a class="brand" href={routes.home.href()}>
						Klippy
					</a>
					{handle.props.user && (
						<nav aria-label="Main">
							<a href={routes.home.href()} aria-current={handle.props.current === 'chat' ? 'page' : undefined}>
								Chat
							</a>
							<a href={routes.notes.index.href()} aria-current={handle.props.current === 'notes' ? 'page' : undefined}>
								Notes
							</a>
						</nav>
					)}
					{handle.props.user && (
						<form method="post" action={routes.auth.logout.href()}>
							<button class="quiet" type="submit">
								Sign out @{handle.props.user.login}
							</button>
						</form>
					)}
				</header>
				<main id="main" tabIndex={-1}>
					{handle.props.children}
				</main>
			</body>
		</html>
	);
}
