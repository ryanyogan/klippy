// Adapted from AI Elements (Sources), Copyright 2023 Vercel, Inc., Apache-2.0. See AI-ELEMENTS-LICENSE.txt.
import type { Handle } from 'remix/component';

export type Source = { label: string; href?: string };

// What a reply used: the pages readLink read, and the saved notes, links and files searchNotes found (course E).
// A source with an href is a link; a note or a file is just its title.
export function Sources(handle: Handle<{ items: Source[] }>) {
	return () => {
		const { items } = handle.props;
		return (
			items.length > 0 && (
				<div class="sources">
					Used {items.length === 1 ? '1 source' : `${items.length} sources`}
					<ul>
						{items.map((item) => (
							<li key={item.label}>
								{item.href ? (
									<a href={item.href} rel="noreferrer noopener" target="_blank">
										{item.label}
									</a>
								) : (
									item.label
								)}
							</li>
						))}
					</ul>
				</div>
			)
		);
	};
}
