import { get, route } from 'remix/routes';

// Every URL the web app answers, in one place. Links and forms build their URLs from this map.
export const routes = route({
	home: get('/'),
});
