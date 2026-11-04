import { MessageType } from 'agents/chat';
import { WebSocketChatTransport } from 'agents/chat/transport';
import { AgentClient } from 'agents/client';
import { getToolName, readUIMessageStream, type UIMessage, type UIMessageChunk } from 'ai';
import { clientEntry, on, type Handle, type SerializableObject } from 'remix/component';
import { Conversation } from '../../ui/conversation.tsx';
import { Message } from '../../ui/message.tsx';
import { PromptInput } from '../../ui/prompt-input.tsx';
import type { ToolPart } from '../../ui/tool.tsx';

// The live chat. The server renders it with your saved messages; in the browser it opens one WebSocket to /chat,
// and the web Worker passes it to your Klippy. The browser never names the agent or sees the token.
// Props cross from server to browser as JSON, so `initial` is typed as plain objects: the agent's saved UIMessages.
export const Chat = clientEntry('/assets/chat.js#Chat', function Chat(handle: Handle<{ initial: SerializableObject[] }>) {
	let messages = handle.props.initial as unknown as UIMessage[];
	let busy = false; // a reply is streaming
	let offline = false; // the socket dropped; AgentClient reconnects by itself
	let problem = ''; // the last thing that went wrong, in plain words
	let announced = ''; // the polite live region: the finished reply, read once
	const answering = new Set<string>(); // tool calls whose Approve/Deny was clicked
	let agent: AgentClient | undefined;
	let transport: WebSocketChatTransport | undefined;

	// Browser only, after the first render (setup also runs on the server, where there's no WebSocket).
	handle.queueTask(() => {
		if (typeof window === 'undefined') return;
		agent = new AgentClient({ agent: 'Klippy', basePath: 'chat', host: location.host, protocol: location.protocol === 'https:' ? 'wss' : 'ws' });
		transport = new WebSocketChatTransport({ agent });
		agent.addEventListener('open', () => ((offline = false), handle.update()));
		agent.addEventListener('close', () => ((offline = true), handle.update()));
		agent.addEventListener('message', (event) => {
			const data = JSON.parse(String(event.data));
			// A reply that continues after you approve a tool is announced with these: hand them to the transport.
			if (data.type === MessageType.CF_AGENT_STREAM_RESUMING) transport!.handleStreamResuming(data);
			if (data.type === MessageType.CF_AGENT_STREAM_RESUME_NONE) transport!.handleStreamResumeNone(data);
			if (data.type === MessageType.CF_AGENT_STREAM_PENDING) transport!.handleStreamPending();
			// The whole chat, sent when it changes. Between our own replies that means a turn Klippy started (a reminder).
			if (data.type === MessageType.CF_AGENT_CHAT_MESSAGES && !busy) {
				messages = data.messages;
				handle.update();
			}
		});
		handle.signal.addEventListener('abort', () => agent?.close());
	});

	// Show a reply as it streams: each step gives the whole message so far. `message` is the reply being continued.
	async function show(stream: ReadableStream<UIMessageChunk>, message?: UIMessage) {
		const at = message ? messages.indexOf(message) : messages.length;
		let last: UIMessage | undefined;
		for await (last of readUIMessageStream({ stream, message, terminateOnError: true })) {
			messages = [...messages.slice(0, at), last, ...messages.slice(at + 1)];
			handle.update();
		}
		announced = last?.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join(' ') ?? '';
	}

	// Run one exchange with the agent, and say so if it fails: a stuck "answering…" is worse than an error.
	async function exchange(start: () => Promise<{ stream: ReadableStream<UIMessageChunk> | null; message?: UIMessage }>) {
		busy = true;
		problem = '';
		handle.update();
		try {
			const { stream, message } = await start();
			if (stream) await show(stream, message);
		} catch (error) {
			console.error(error);
			problem = "Klippy couldn't answer. Check your connection and try again.";
		} finally {
			busy = false;
			handle.update();
		}
	}

	function send(text: string) {
		messages = [...messages, { id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text }] }];
		return exchange(async () => ({
			stream: await transport!.sendMessages({ chatId: 'klippy', messages, trigger: 'submit-message', messageId: undefined, abortSignal: undefined }),
		}));
	}

	// Approve or deny a tool call (c-06's needsApproval). The agent runs it, or not, and the same reply continues.
	function answer(part: ToolPart, approved: boolean) {
		const message = messages.find((m) => m.parts.some((p) => 'toolCallId' in p && p.toolCallId === part.toolCallId));
		answering.add(part.toolCallId);
		return exchange(async () => {
			transport!.expectToolContinuation();
			agent!.send(JSON.stringify({ type: MessageType.CF_AGENT_TOOL_APPROVAL, toolCallId: part.toolCallId, approved, autoContinue: true }));
			return { stream: await transport!.reconnectToStream({ chatId: 'klippy' }), message };
		});
	}

	// Approve / Deny on a card that waits for you. Disabled once clicked, so a double click sends nothing twice.
	function actions(part: ToolPart) {
		if (part.state !== 'approval-requested') return null;
		const sent = answering.has(part.toolCallId);
		const what = getToolName(part) === 'saveNote' ? 'saving this note' : `running ${getToolName(part)}`;
		return sent ? (
			<p class="muted">Sending your answer…</p>
		) : (
			<>
				<button class="button" type="button" disabled={busy} mix={on('click', () => answer(part, true))}>
					Approve {what}
				</button>
				<button class="button quiet" type="button" disabled={busy} mix={on('click', () => answer(part, false))}>
					Deny
				</button>
			</>
		);
	}

	return () => (
		<div class="chat">
			<Conversation empty={messages.length === 0}>
				{messages.map((message) => (
					<Message key={message.id} message={message} actions={actions} />
				))}
			</Conversation>
			{offline && <p class="notice">Reconnecting to Klippy…</p>}
			{problem && (
				<p role="alert" class="notice error">
					{problem}
				</p>
			)}
			<p role="status" class="visually-hidden">
				{announced}
			</p>
			<PromptInput busy={busy} onSend={send} />
		</div>
	);
});
