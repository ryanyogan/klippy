import type { StepResult, ToolSet } from 'ai';

// One JSON line per chat turn (f-04). Workers Logs indexes every field of a logged object, so you can filter, group and
// sum them in the dashboard's Query Builder. Log the SHAPE of a turn, never its content: no message text, no tool inputs
// or outputs (they hold notes and pages), no URLs, no tokens. The agent's name is the only id.
export function logTurn(agent: string, started: number, steps: StepResult<ToolSet>[], ended?: 'aborted') {
	const last = steps.at(-1);
	const usage = steps.reduce(
		(sum, step) => ({
			input: sum.input + (step.usage.inputTokens ?? 0),
			output: sum.output + (step.usage.outputTokens ?? 0),
			cached: sum.cached + (step.usage.inputTokenDetails?.cacheReadTokens ?? 0),
		}),
		{ input: 0, output: 0, cached: 0 },
	);
	console.log({
		event: 'turn',
		agent,
		steps: steps.length,
		finish: ended ?? last?.finishReason, // "aborted": you cancelled it. "stop": answered. "tool-calls": stopped by the step cap, or paused for your y/n
		tools: steps.flatMap((step) => step.toolCalls.map((call) => call.toolName)), // names only
		toolErrors: steps.reduce((n, step) => n + step.content.filter((part) => part.type === 'tool-error').length, 0),
		tokens: { ...usage, total: usage.input + usage.output },
		model: last?.providerMetadata?.cloudflare?.model, // Claude, or the fallback
		ms: Date.now() - started,
	});
}

// A turn Klippy refused before calling the model: why, and whose. Still no content.
export function logRefused(agent: string, reason: 'too-long' | 'rate-limit' | 'budget') {
	console.log({ event: 'turn.refused', agent, reason });
}
