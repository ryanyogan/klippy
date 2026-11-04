import { MessageType } from '@cloudflare/ai-chat/types';
import { WebSocketChatTransport } from 'agents/chat/transport';
import { AgentClient } from 'agents/client';
import { readUIMessageStream, type UIMessage } from 'ai';
import { createInterface } from 'node:readline/promises';

// `pnpm chat alice` talks to the Klippy called "alice". KLIPPY_TOKEN comes from .dev.vars.
const url = new URL(process.env.KLIPPY_URL ?? 'http://localhost:8787');
const name = process.argv[2] ?? 'me';
const token = process.env.KLIPPY_TOKEN ?? '';

// One WebSocket to this Klippy, kept open for the whole chat. A WebSocket can't send headers, so the token rides
// in the query string (the Worker allows that only for the socket, and strips it before the agent sees it).
const agent = new AgentClient({ agent: 'Klippy', name, host: url.host, protocol: url.protocol === 'https:' ? 'wss' : 'ws', query: { token } });
const transport = new WebSocketChatTransport({ agent });

// Start from the conversation this Klippy already has (it lives in the agent, not here).
const history = await fetch(new URL(`/agents/klippy/${name}/get-messages`, url), { headers: { Authorization: `Bearer ${token}` } });
if (!history.ok) throw new Error(`Klippy said ${history.status}: is the Worker running, and is KLIPPY_TOKEN right?`);
let messages: UIMessage[] = await history.json();
console.log(`Talking to Klippy "${name}" (${messages.length} messages so far). /clear to start over, Ctrl+D to quit.`);

const terminal = createInterface({ input: process.stdin, output: process.stdout });
process.stdout.write('you> ');
for await (const text of terminal) {
	if (!text.trim()) { process.stdout.write('you> '); continue; }
	// "/clear" wipes this Klippy's chat history. What it remembered (c-05) stays.
	if (text.trim() === '/clear') {
		agent.send(JSON.stringify({ type: MessageType.CF_AGENT_CHAT_CLEAR }));
		messages = [];
		process.stdout.write('(chat cleared)\nyou> ');
		continue;
	}
	messages = [...messages, { id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text }] }];
	const stream = await transport.sendMessages({ chatId: name, messages, trigger: 'submit-message', messageId: undefined, abortSignal: undefined });
	// The reply arrives in chunks. Each step gives the whole message so far: print only what's new.
	process.stdout.write('klippy> ');
	let printed = 0;
	let reply: UIMessage | undefined;
	for await (reply of readUIMessageStream({ stream })) {
		const text = reply.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('\n');
		process.stdout.write(text.slice(printed));
		printed = text.length;
	}
	if (reply) messages = [...messages, reply];
	process.stdout.write('\nyou> ');
}
agent.close();
