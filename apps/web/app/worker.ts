import { router } from './router.ts';

// The Worker's whole job: hand each request to the Remix router.
export default {
	fetch(request) {
		return router.fetch(request);
	},
} satisfies ExportedHandler<Env>;
