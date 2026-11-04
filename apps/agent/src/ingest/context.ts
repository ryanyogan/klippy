import { generateText, type LanguageModel } from 'ai';
import { contextModel } from '../model';

// The document Claude reads for each chunk is capped at 24,000 characters (about 6,000 tokens), and so is the bill.
const MAX_DOCUMENT = 24_000;
export const MAX_CONTEXT = 300;

// Contextual retrieval (Anthropic, 2024): a chunk like "Revenue grew 3%" is useless alone. One sentence saying which
// document and section it's from makes it findable. The document comes first and is marked for caching, so the calls
// for its other chunks read it from Claude's cache (5 minutes) at a fraction of the price.
export async function contextFor(env: Env, document: string, chunk: string, model: LanguageModel = contextModel(env)) {
	const { text, providerMetadata, usage } = await generateText({
		model,
		maxOutputTokens: 100,
		messages: [
			{
				role: 'user',
				content: [
					{
						type: 'text',
						text: `Here is a document:\n<document>\n${document.slice(0, MAX_DOCUMENT)}\n</document>`,
						providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
					},
					{
						type: 'text',
						text: `Here is one chunk of it:\n<chunk>\n${chunk}\n</chunk>\nWrite one short sentence that says where this chunk sits in the document and what it is about, to help a search find it. Reply with that sentence only.`,
					},
				],
			},
		],
	});
	// Which model answered (Claude, or the Workers AI fallback) and how much of the prompt came from the cache.
	const answeredBy = (providerMetadata?.cloudflare as { model?: string } | undefined)?.model;
	console.log(JSON.stringify({ event: 'context', model: answeredBy, inputTokens: usage.inputTokens, cachedTokens: usage.inputTokenDetails?.cacheReadTokens }));
	return text.trim().slice(0, MAX_CONTEXT);
}
