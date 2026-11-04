import type { Handle } from 'remix/component';
import type { History } from '../agent.ts';
import type { User } from '../auth.ts';
import { Layout } from '../ui/layout.tsx';
import { Chat } from './public/chat.tsx';

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
					<>
						<Chat initial={history.messages} />
						<noscript>
							<p class="notice">The live chat needs JavaScript. Your saved chat is above.</p>
						</noscript>
					</>
				)}
			</Layout>
		);
	};
}
