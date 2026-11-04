import { getToolName, type UIMessage } from 'ai';
import { clientEntry, on, type Handle, type SerializableObject } from 'remix/component';
import { Conversation } from '../../ui/conversation.tsx';
import { Message } from '../../ui/message.tsx';
import { PromptInput } from '../../ui/prompt-input.tsx';
import type { ToolPart } from '../../ui/tool.tsx';
import type { ChatSession } from './chat-session.ts';

// The live chat island. The server renders it with your saved messages; in the browser it starts a ChatSession
// (the WebSocket and the protocol) and redraws on every change. This component only draws.
// '/assets/chat.js#Chat' must match build:client in package.json (its --outdir and this file's name).
// Props cross from server to browser as JSON, so `initial` is typed as plain objects: the agent's saved UIMessages.
export const Chat = clientEntry('/assets/chat.js#Chat', function Chat(handle: Handle<{ initial: SerializableObject[] }>) {
	const initial = handle.props.initial as unknown as UIMessage[];
	let session: ChatSession | undefined; // browser only: setup also runs on the server, where there's no WebSocket

	handle.queueTask(async () => {
		const { ChatSession } = await import('./chat-session.ts');
		session = new ChatSession(initial);
		session.addEventListener('change', () => handle.update(), { signal: handle.signal });
		handle.signal.addEventListener('abort', () => session?.close());
		handle.update();
	});

	// Approve / Deny on a card that waits for you. Gone once clicked, so a double click sends nothing twice.
	function actions(part: ToolPart) {
		if (part.state !== 'approval-requested') return null;
		if (!session) return <p class="muted">Starting the chat…</p>;
		if (session.answering.has(part.toolCallId)) return <p class="muted">Sending your answer…</p>;
		const what = getToolName(part) === 'saveNote' ? 'saving this note' : `running ${getToolName(part)}`;
		return (
			<>
				<button class="button" type="button" disabled={session.busy} mix={on('click', () => session?.answer(part.toolCallId, true))}>
					Approve {what}
				</button>
				<button class="button quiet" type="button" disabled={session.busy} mix={on('click', () => session?.answer(part.toolCallId, false))}>
					Deny {what}
				</button>
			</>
		);
	}

	return () => {
		const messages = session?.messages ?? initial;
		return (
			<div class="chat">
				<Conversation empty={messages.length === 0}>
					{messages.map((message) => (
						<Message key={message.id} message={message} actions={actions} />
					))}
				</Conversation>
				{/* Always rendered (a live region must exist before its text changes); visible only while offline. */}
				<p role="status" class={session?.offline ? 'notice' : 'visually-hidden'}>
					{session?.offline ? 'Reconnecting to Klippy…' : ''}
				</p>
				{session?.problem && (
					<p role="alert" class="notice error">
						{session.problem}
					</p>
				)}
				<p role="status" class="visually-hidden">
					{session?.announced}
				</p>
				<PromptInput busy={session?.busy} disabled={!session || session.offline} onSend={(text) => session?.send(text) ?? Promise.resolve(false)} />
			</div>
		);
	};
});
