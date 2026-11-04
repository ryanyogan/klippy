import type { Handle, RemixNode } from 'remix/component';

// The one document every page renders inside: head, the stylesheet, the top bar, and a main column.
export function Layout(handle: Handle<{ title: string; children?: RemixNode }>) {
	return () => (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta name="color-scheme" content="light dark" />
				<title>{handle.props.title}</title>
				<link rel="stylesheet" href="/styles.css" />
			</head>
			<body>
				<a class="skip" href="#main">
					Skip to content
				</a>
				<header class="bar">
					<a class="brand" href="/">
						Klippy
					</a>
				</header>
				<main id="main" tabIndex={-1}>
					{handle.props.children}
				</main>
			</body>
		</html>
	);
}
