import { env } from 'cloudflare:workers';
import { createGitHubAuthProvider } from 'remix/auth';
import { createCookie } from 'remix/cookie';
import { auth, createSessionAuthScheme, requireAuth } from 'remix/middleware/auth';
import { redirect } from 'remix/response/redirect';
import { createCookieSessionStorage } from 'remix/session-storage/cookie';
import { isAllowedId } from './allowlist.ts';
import { routes } from './routes.ts';

// Who's signed in. Kept in the session cookie, signed with SESSION_SECRET so nobody can forge one.
export type User = { id: number; login: string; name: string };

// The whole session lives in one signed, httpOnly cookie: no session table needed.
export const sessionCookie = createCookie('__klippy', {
	secrets: [env.SESSION_SECRET],
	httpOnly: true,
	secure: true,
	sameSite: 'lax',
	path: '/',
	maxAge: 60 * 60 * 24 * 7, // a week
});
export const sessionStorage = createCookieSessionStorage();

// GitHub sign-in. read:user is enough: we only need who you are, not your email or repos.
export const github = createGitHubAuthProvider({
	clientId: env.GITHUB_CLIENT_ID,
	clientSecret: env.GITHUB_CLIENT_SECRET,
	redirectUri: new URL(routes.auth.callback.href(), env.APP_ORIGIN),
	scopes: ['read:user'],
});

// Klippy is personal: only the GitHub account ids in ALLOWED_GITHUB_IDS may use it (ids, not logins: see allowlist.ts).
export function isAllowed(id: number) {
	return isAllowedId(id, env.ALLOWED_GITHUB_IDS);
}

// Reads the user from the session on every request, and checks the allowlist again (so removing a name works at once).
export const loadUser = auth({
	schemes: [
		createSessionAuthScheme<User, User>({
			read: (session) => (session.get('user') as User | undefined) ?? null,
			verify: (user) => (isAllowed(user.id) ? user : null),
			invalidate: (session) => session.unset('user'),
		}),
	],
});

// For pages that need a signed-in user: anyone else goes to the sign-in page.
export const requireUser = requireAuth<User>({ onFailure: () => redirect(routes.auth.login.href()) });

// The agent instance is chosen here, on the server, from the signed-in user. The browser never names it.
export function agentName(user: User) {
	return `gh-${user.id}`;
}
