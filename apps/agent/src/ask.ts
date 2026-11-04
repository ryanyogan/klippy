import { generateText, isStepCount, type ToolSet } from 'ai';
import { model } from './model';
import { noteTools } from './tools/notes';
import { getTime } from './tools/time';
import { getWeather } from './tools/weather';

// Long questions cost money and time. 2,000 characters is plenty for one question.
export const MAX_QUESTION = 2000;

// Every tool Klippy has. The notes tools need the database, so they're made from env.DB.
export function allTools(env: Env) {
	return { getWeather, getTime, ...noteTools(env.DB) };
}

// One question in, one answer out. Both /ask and /klippy/check use it.
export async function ask(env: Env, question: string, tools: ToolSet = allTools(env)) {
	const { text, providerMetadata } = await generateText({
		model: model(env),
		system: 'You are Klippy, a friendly personal assistant. Answer in one or two sentences.',
		messages: [{ role: 'user', content: question }],
		maxOutputTokens: 300, // a hard cap on the reply, so one request can't run up a bill
		tools,
		// Step 1: Claude may call a tool. Step 2: it answers with the result. Then stop.
		stopWhen: isStepCount(2),
		// Log one line per step, so you can watch the round trip in the `pnpm dev` terminal.
		onStepEnd: (step) => {
			console.log(
				JSON.stringify({
					step: step.stepNumber,
					finish: step.finishReason, // "tool-calls": Claude wants a tool. "stop": it answered.
					toolCalls: step.toolCalls.map((call) => ({ tool: call.toolName, input: call.input })),
					toolResults: step.toolResults.map((result) => ({ tool: result.toolName, output: result.output })),
					text: step.text,
					tokens: step.usage.totalTokens,
				}),
			);
		},
	});
	// Which model answered: Claude, or the fallback.
	return { answer: text, model: providerMetadata?.cloudflare?.model };
}
