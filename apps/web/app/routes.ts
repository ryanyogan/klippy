import { get, post, route } from 'remix/routes';

// Every URL the web app answers, in one place. Links and forms build their URLs from this map.
export const routes = route({
	home: get('/'),
	// The chat island's WebSocket. The web Worker passes it on to your Klippy.
	chat: get('/chat'),
	notes: {
		index: get('/notes'),
		destroy: post('/notes/:id/delete'),
	},
	auth: {
		login: get('/login'),
		github: get('/auth/github'),
		callback: get('/auth/github/callback'),
		logout: post('/logout'),
	},
});
