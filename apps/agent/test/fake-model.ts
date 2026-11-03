import type { LanguageModelV4GenerateResult } from '@ai-sdk/provider';
import { MockLanguageModelV4 } from 'ai/test';

const usage = {
	inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
	outputTokens: { total: 5, text: 5, reasoning: 0 },
};

// One model turn: either a text answer, or a call to one of your tools.
export type Turn = string | { tool: string; input: object };

// A stand-in for Claude that plays the turns you give it, in order. Give one turn to repeat it forever.
export function fakeModel(...turns: Turn[]) {
	const results = turns.map((turn, i): LanguageModelV4GenerateResult =>
		typeof turn === 'string'
			? { content: [{ type: 'text', text: turn }], finishReason: { unified: 'stop', raw: 'end_turn' }, usage, warnings: [] }
			: {
					content: [{ type: 'tool-call', toolCallId: `call-${i}`, toolName: turn.tool, input: JSON.stringify(turn.input) }],
					finishReason: { unified: 'tool-calls', raw: 'tool_use' },
					usage,
					warnings: [],
				},
	);
	return new MockLanguageModelV4({ doGenerate: results.length === 1 ? results[0] : results });
}
