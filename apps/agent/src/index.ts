export default {
	async fetch(request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/') {
			return new Response('Hi, I am Klippy.');
		}

		return new Response('Not found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
