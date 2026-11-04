// Adapted from AI Elements (Message), Copyright 2023 Vercel, Inc., Apache-2.0. See AI-ELEMENTS-LICENSE.txt.
import type { Handle, RemixNode } from 'remix/component';
import { isToolUIPart, type UIMessage } from 'ai';
import { Sources } from './sources.tsx';
import { Tool, type ToolPart } from './tool.tsx';

// One turn: yours on the right, Klippy's on the left. Text and tool cards in order, a "thinking" line, then sources.
// `actions` lets the chat add buttons to a tool card (Approve / Deny); the server-rendered page passes none.
export function Message(handle: Handle<{ message: UIMessage; actions?: (part: ToolPart) => RemixNode }>) {
	return () => {
		const { message, actions } = handle.props;
		// A turn Klippy started itself (a reminder, c-08): show a label, not the instruction it sent itself.
		if ((message.metadata as { nudge?: boolean } | undefined)?.nudge) {
			return <li class="message message-thinking">A reminder is due.</li>;
		}
		const text = message.parts.some((part) => part.type === 'text' && part.text);
		const thinking = !text && message.parts.some((part) => part.type === 'reasoning');
		return (
			<li class="message" data-from={message.role}>
				<span class="visually-hidden">{message.role === 'user' ? 'You:' : 'Klippy:'}</span>
				{/* In the order they happened: text the model wrote before a tool ran stays above that tool's card. */}
				{message.parts.map((part, index) =>
					isToolUIPart(part) ? (
						<Tool key={part.toolCallId} part={part}>
							{actions?.(part)}
						</Tool>
					) : part.type === 'text' && part.text ? (
						<p key={index} class="message-content">
							{part.text}
						</p>
					) : null,
				)}
				{thinking && <p class="message-thinking">Thinking…</p>}
				<Sources urls={sourcesOf(message)} />
			</li>
		);
	};
}

// The pages readLink read in this turn. Only http(s): a model-written "javascript:" link must never become an href.
function sourcesOf(message: UIMessage) {
	const urls = message.parts.flatMap((part) =>
		part.type === 'tool-readLink' && part.state === 'output-available' ? [String((part.input as { url?: unknown }).url)] : [],
	);
	return [...new Set(urls)].filter((url) => /^https?:\/\//.test(url));
}
