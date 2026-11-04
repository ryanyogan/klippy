import { run } from 'remix/component';

// The browser side: find each island the server rendered (here, the chat) and start it with its props.
// Islands name public URLs (/assets/chat.js#Chat), so loading one is a plain import().
const app = run({
	async loadModule(url, name) {
		const module = await import(url);
		const Component = module[name];
		if (typeof Component !== 'function') throw new Error(`Unknown component: ${url}#${name}`);
		return Component;
	},
});
app.addEventListener('error', (event) => console.error('Island error:', event.error));
await app.ready();
