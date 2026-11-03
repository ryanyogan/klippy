import { generateText, isStepCount } from 'ai';
import { model } from './model';
import { getWeather } from './tools/weather';

// Long questions cost money and time. 2,000 characters is plenty for one question.
export const MAX_QUESTION = 2000;

// One question in, one answer out. Both /ask and /klippy/check use it.
export async function ask(env: Env, question: string) {
	const { text, providerMetadata } = await generateText({
		model: model(env),
		system: 'You are Klippy, a friendly personal assistant. Answer in one or two sentences.',
		messages: [{ role: 'user', content: question }],
		maxOutputTokens: 300, // a hard cap on the reply, so one request can't run up a bill
		tools: { getWeather },
		// Step 1: Claude may call a tool. Step 2: it answers with the result. Then stop.
		stopWhen: isStepCount(2),
	});
	// Which model answered: Claude, or the fallback.
	return { answer: text, model: providerMetadata?.cloudflare?.model };
}
