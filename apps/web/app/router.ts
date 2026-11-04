import { cop } from 'remix/middleware/cop';
import { render } from 'remix/middleware/render';
import { session } from 'remix/middleware/session';
import { createRouter, type RouterContext } from 'remix/router';
import controller from './actions/controller.tsx';
import authController from './actions/auth/controller.tsx';
import checkController from './actions/check/controller.tsx';
import notesController from './actions/notes/controller.tsx';
import { loadUser, sessionCookie, sessionStorage } from './auth.ts';
import { routes } from './routes.ts';

export const router = createRouter({
	middleware: [
		cop(), // refuse form posts from other sites (no CSRF tokens needed)
		session(sessionCookie, sessionStorage),
		loadUser, // context.auth: who's signed in, if anyone
		render(), // context.render(<Page />)
	],
});

export type AppContext = RouterContext<typeof router>;

declare module 'remix' {
	interface RouterTypes {
		context: AppContext;
	}
}

router.map(routes, controller);
router.map(routes.auth, authController);
router.map(routes.notes, notesController);
router.map(routes.check, checkController);
