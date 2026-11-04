// Adapted from AI Elements (Sources), Copyright 2023 Vercel, Inc., Apache-2.0. See AI-ELEMENTS-LICENSE.txt.
import type { Handle } from 'remix/component';

// The links a reply used. Klippy's sources are the pages readLink read (course E adds documents).
export function Sources(handle: Handle<{ urls: string[] }>) {
	return () =>
		handle.props.urls.length > 0 && (
			<div class="sources">
				Used {handle.props.urls.length === 1 ? '1 source' : `${handle.props.urls.length} sources`}
				<ul>
					{handle.props.urls.map((url) => (
						<li key={url}>
							<a href={url} rel="noreferrer noopener" target="_blank">
								{url}
							</a>
						</li>
					))}
				</ul>
			</div>
		);
}
