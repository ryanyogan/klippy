import { completeAuth, finishExternalAuth, startExternalAuth } from 'remix/auth';
import { Session } from 'remix/session';
import { redirect } from 'remix/response/redirect';
import { createController } from 'remix/router';
import { github, isAllowed } from '../../auth.ts';
import { routes } from '../../routes.ts';
import { LoginPage, NotAllowedPage } from './pages.tsx';

export default createController(routes.auth, {
	actions: {
		login(context) {
			if (context.auth.ok) return redirect(routes.home.href());
			return context.render(<LoginPage />);
		},
		// Off to GitHub, with a one-time state value in the session (finishExternalAuth checks it on the way back).
		github(context) {
			return startExternalAuth(github, context);
		},
		async callback(context) {
			// GitHub said no, the state didn't match, or the code was stale: show the sign-in page again, with a reason.
			const finished = await finishExternalAuth(github, context).catch(() => null);
			if (!finished) {
				return context.render(<LoginPage error="GitHub sign-in didn't finish. Try again." />, { status: 400 });
			}
			const { id, login, name } = finished.result.profile;
			if (!isAllowed(id)) {
				return context.render(<NotAllowedPage login={login} />, { status: 403 });
			}
			// New session id (no fixation), then remember who this is.
			completeAuth(context).set('user', { id, login, name: name ?? login });
			return redirect(routes.home.href());
		},
		logout(context) {
			context.get(Session).destroy();
			return redirect(routes.auth.login.href());
		},
	},
});
