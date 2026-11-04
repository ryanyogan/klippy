// Adapted from AI Elements (Conversation), Copyright 2023 Vercel, Inc., Apache-2.0. See AI-ELEMENTS-LICENSE.txt.
import type { Handle, RemixNode } from 'remix/component';

// The list of turns, oldest first. With no turns yet, a friendly empty state instead.
export function Conversation(handle: Handle<{ empty: boolean; children?: RemixNode }>) {
	return () =>
		handle.props.empty ? (
			<p class="conversation-empty">Say hi to Klippy.</p>
		) : (
			<ol class="conversation" aria-label="Your chat with Klippy">
				{handle.props.children}
			</ol>
		);
}
