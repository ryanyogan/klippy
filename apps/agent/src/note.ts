import { generateText, isStepCount } from 'ai';
import { model } from './model';
import { noteTools } from './tools/notes';

// POST /note: turn messy text into one tidy note. Here Claude has no choice to make: it must save.
export async function tidyNote(env: Env, text: string) {
	const { saveNote } = noteTools(env.DB);
	const { toolResults } = await generateText({
		model: model(env),
		system: "Rewrite the user's text as one short, clear note and save it. Keep every name, date and number.",
		messages: [{ role: 'user', content: text }],
		maxOutputTokens: 300,
		tools: { saveNote },
		// Force this one tool: no chatting, no other tool. ("required" would force *some* tool.)
		toolChoice: { type: 'tool', toolName: 'saveNote' },
		// The saved note is the answer, so stop after the call: no second model call to say "done".
		stopWhen: isStepCount(1),
	});
	return toolResults[0]?.output; // undefined when the call failed, e.g. a note over 1,000 characters
}
