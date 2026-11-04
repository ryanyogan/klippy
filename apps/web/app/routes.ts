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
	// Your saved sources, through your Klippy (f-01: the agent has no public address, so the web app is the way in).
	sources: {
		upload: post('/sources/file'),
		search: get('/sources/search'),
	},
	// For the bits checkpoint grader. Public.
	check: { index: get('/klippy/check') },
	auth: {
		login: get('/login'),
		github: get('/auth/github'),
		callback: get('/auth/github/callback'),
		logout: post('/logout'),
	},
});
