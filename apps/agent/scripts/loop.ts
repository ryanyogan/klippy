import Anthropic from '@anthropic-ai/sdk';

// One tool, written the way the Messages API wants it: a name, a description, and a JSON schema for its input.
const tools: Anthropic.Tool[] = [
	{ name: 'get_time', description: 'Get the current date and time (UTC).', input_schema: { type: 'object', properties: {} } },
];

// The loop that generateText ran for you in course B: ask Claude, run the tools it asks for, send back the results.
export async function loop(client: Anthropic, question: string, maxTurns = 5) {
	const messages: Anthropic.MessageParam[] = [{ role: 'user', content: question }];
	for (let turn = 1; turn <= maxTurns; turn++) {
		const response = await client.messages.create({ model: 'claude-haiku-5-5', max_tokens: 1024, tools, messages });
		console.log(`turn ${turn}: stop_reason = ${response.stop_reason}`);
		// "tool_use": Claude wants a tool run. Anything else ("end_turn", "max_tokens", ...) ends the loop.
		if (response.stop_reason !== 'tool_use') {
			return response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('');
		}
		messages.push({ role: 'assistant', content: response.content }); // Claude's turn, tool calls and all
		const results = response.content.flatMap((block) =>
			block.type === 'tool_use' ? [{ type: 'tool_result' as const, tool_use_id: block.id, content: new Date().toISOString() }] : [],
		);
		messages.push({ role: 'user', content: results }); // every result, in one message, matched by id
	}
	return 'Stopped: too many turns.'; // your stopWhen
}

// `pnpm loop "What time is it?"` runs this file, with ANTHROPIC_API_KEY from .dev.vars (Node, not the Worker).
if (import.meta.main) {
	console.log(await loop(new Anthropic(), process.argv.slice(2).join(' ') || 'What time is it?'));
}
