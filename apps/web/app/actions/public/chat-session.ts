import { MessageType } from 'agents/chat';
import { WebSocketChatTransport } from 'agents/chat/transport';
import { AgentClient } from 'agents/client';
import { readUIMessageStream, type UIMessage, type UIMessageChunk } from 'ai';
import { TypedEventTarget } from 'remix/component';

// The chat with your Klippy, without any UI: one WebSocket to /chat, the messages, and what's in progress.
// The island draws it and calls send() and answer(); every change fires "change". (Remix guide 05: keep application
// logic outside components.) The browser never names the agent or holds the token: the web Worker adds both.
export class ChatSession extends TypedEventTarget<{ change: Event }> {
	messages: UIMessage[];
	busy = false; // a reply is streaming
	offline = false; // the socket dropped; AgentClient reconnects by itself
	problem = ''; // the last thing that went wrong, in plain words
	announced = ''; // the finished reply, for the live region
	readonly answering = new Set<string>(); // tool calls whose Approve/Deny was clicked
	#saved: UIMessage[] | undefined; // the agent's copy of the chat, if it arrived while a reply was streaming
	#agent: AgentClient;
	#transport: WebSocketChatTransport;

	constructor(initial: UIMessage[]) {
		super();
		this.messages = initial;
		this.#agent = new AgentClient({ agent: 'Klippy', basePath: 'chat', host: location.host, protocol: location.protocol === 'https:' ? 'wss' : 'ws' });
		this.#transport = new WebSocketChatTransport({ agent: this.#agent });
		this.#agent.addEventListener('open', () => this.#set({ offline: false }));
		this.#agent.addEventListener('close', () => this.#set({ offline: true }));
		this.#agent.addEventListener('message', (event) => this.#receive(event.data));
	}

	close() {
		this.#agent.close();
	}

	// Send your message. Returns false if it didn't go through (the message is taken back, so you can resend it).
	async send(text: string) {
		const before = this.messages;
		this.messages = [...before, { id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text }] }];
		const sent = await this.#exchange(() =>
			this.#transport.sendMessages({ chatId: 'klippy', messages: this.messages, trigger: 'submit-message', messageId: undefined, abortSignal: undefined }),
		);
		if (!sent) this.#set({ messages: before, problem: "Your message wasn't sent. Check your connection and try again." });
		return sent;
	}

	// Approve or deny a waiting tool call (c-06's needsApproval). The agent runs it, or not, and the same reply continues.
	async answer(toolCallId: string, approved: boolean) {
		const paused = this.messages.find((m) => m.parts.some((p) => 'toolCallId' in p && p.toolCallId === toolCallId));
		this.answering.add(toolCallId);
		const done = await this.#exchange(async () => {
			this.#transport.expectToolContinuation();
			this.#agent.send(JSON.stringify({ type: MessageType.CF_AGENT_TOOL_APPROVAL, toolCallId, approved, autoContinue: true }));
			return this.#transport.reconnectToStream({ chatId: 'klippy' });
		}, paused);
		this.answering.delete(toolCallId); // the buttons come back if it failed, so you can answer again
		if (!done) this.#set({ problem: "Your answer didn't reach Klippy. Try again." });
	}

	// Run one streamed exchange. True if a reply streamed to the end; never leaves "busy" stuck on.
	async #exchange(start: () => Promise<ReadableStream<UIMessageChunk> | null>, paused?: UIMessage) {
		this.#saved = undefined;
		this.#set({ busy: true, problem: '', announced: '' });
		try {
			const stream = await start();
			if (!stream) return false;
			await this.#show(stream, paused);
			return true;
		} catch (error) {
			console.error(error);
			return false;
		} finally {
			// The agent's own copy wins once the reply is done (it knows a denied tool is denied, for example).
			this.#set({ busy: false, messages: this.#saved ?? this.messages });
			this.#saved = undefined;
		}
	}

	// Each step gives the whole reply so far: replace that one message and redraw. `paused` is the reply being continued.
	async #show(stream: ReadableStream<UIMessageChunk>, paused?: UIMessage) {
		const at = paused ? this.messages.indexOf(paused) : this.messages.length;
		let reply: UIMessage | undefined;
		for await (reply of readUIMessageStream({ stream, message: paused, terminateOnError: true })) {
			this.#set({ messages: [...this.messages.slice(0, at), reply, ...this.messages.slice(at + 1)] });
		}
		this.#set({ announced: reply?.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join(' ') ?? '' });
	}

	#receive(raw: unknown) {
		let data: { type?: string; messages?: UIMessage[] };
		try {
			data = JSON.parse(String(raw));
		} catch {
			return; // not one of ours
		}
		// A reply that continues after you approve a tool is announced with these: hand them to the transport.
		if (data.type === MessageType.CF_AGENT_STREAM_RESUMING) this.#transport.handleStreamResuming(data as never);
		if (data.type === MessageType.CF_AGENT_STREAM_RESUME_NONE) this.#transport.handleStreamResumeNone(data as never);
		if (data.type === MessageType.CF_AGENT_STREAM_PENDING) this.#transport.handleStreamPending();
		// The whole chat, as the agent saved it. Between our replies that's a turn Klippy started (a reminder); during one,
		// keep it for when the reply ends, so the stream isn't overwritten halfway.
		if (data.type === MessageType.CF_AGENT_CHAT_MESSAGES && data.messages) {
			if (this.busy) this.#saved = data.messages;
			else this.#set({ messages: data.messages });
		}
	}

	#set(changes: Partial<Pick<ChatSession, 'messages' | 'busy' | 'offline' | 'problem' | 'announced'>>) {
		Object.assign(this, changes);
		this.dispatchEvent(new Event('change'));
	}
}
