import { fetchWeb } from 'agents/webfetch';
import { MAX_BODY } from './sources';

// Read one saved link as Markdown. fetchWeb (from the Agents SDK) refuses private and local addresses and converts
// HTML or a PDF to Markdown with env.AI. No redirects: Klippy reads exactly the page you saved.
export async function readLinkAsMarkdown(env: Env, url: string) {
	const page = await fetchWeb({ url }, { binding: env.AI, maxBytes: 1_000_000, maxRedirects: 0, timeoutMs: 15_000 });
	if (page.status >= 400) throw new Error(`${url} answered ${page.status}`);
	return { title: page.title ?? url, body: page.content.slice(0, MAX_BODY) };
}
