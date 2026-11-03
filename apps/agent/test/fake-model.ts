import { MockLanguageModelV4 } from 'ai/test';

const usage = {
	inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
	outputTokens: { total: 5, text: 5, reasoning: 0 },
};

// A stand-in for Claude that always answers with the same text.
export function fakeModel(text: string) {
	return new MockLanguageModelV4({
		doGenerate: {
			content: [{ type: 'text', text }],
			finishReason: { unified: 'stop', raw: 'stop' },
			usage,
			warnings: [],
		},
	});
}
