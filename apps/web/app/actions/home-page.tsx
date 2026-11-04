import type { Handle } from 'remix/component';
import type { UIMessage } from 'ai';
import type { User } from '../auth.ts';
import { Conversation } from '../ui/conversation.tsx';
import { Layout } from '../ui/layout.tsx';
import { Message } from '../ui/message.tsx';

type History = { messages: UIMessage[] } | { error: string };

export function HomePage(handle: Handle<{ user: User; agent: string; history: History }>) {
	return () => {
		const { user, agent, history } = handle.props;
		return (
			<Layout title="Klippy" user={user} current="chat">
				<h1>Hi, {user.name}</h1>
				<p class="muted">
					Your Klippy is <code>{agent}</code>.
				</p>
				{'error' in history ? (
					<p role="alert" class="notice error">
						{history.error} Your chat can't load until it does.
					</p>
				) : (
					<Conversation empty={history.messages.length === 0}>
						{history.messages.map((message) => (
							<Message key={message.id} message={message} />
						))}
					</Conversation>
				)}
			</Layout>
		);
	};
}
