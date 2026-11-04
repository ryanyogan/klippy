import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { loop } from '../scripts/loop';

// A stand-in for the Anthropic client that plays Claude's replies in order. Tests never call the real API.
function fakeClient(...replies: Partial<Anthropic.Message>[]) {
	const create = vi.fn();
	for (const reply of replies) create.mockResolvedValueOnce(reply);
	return { client: { messages: { create } } as unknown as Anthropic, create };
}

const callTool = { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'toolu_1', name: 'get_time', input: {} }] } as const;
const answer = { stop_reason: 'end_turn', content: [{ type: 'text', text: 'It is noon.' }] } as const;

describe('the hand-written loop', () => {
	it('runs the tool Claude asks for, sends the result back, and stops at end_turn', async () => {
		const { client, create } = fakeClient(callTool as never, answer as never);
		expect(await loop(client, 'What time is it?')).toBe('It is noon.');
		expect(create).toHaveBeenCalledTimes(2);
		// The second call holds the whole conversation: question, Claude's tool call, and the result with the same id.
		const { messages } = create.mock.calls[1][0];
		expect(messages.map((m: Anthropic.MessageParam) => m.role)).toEqual(['user', 'assistant', 'user']);
		expect(messages[2].content).toEqual([expect.objectContaining({ type: 'tool_result', tool_use_id: 'toolu_1' })]);
	});

	it('stops after maxTurns, however many tools Claude asks for', async () => {
		const { client, create } = fakeClient(callTool as never, callTool as never, callTool as never);
		expect(await loop(client, 'Loop forever', 3)).toBe('Stopped: too many turns.');
		expect(create).toHaveBeenCalledTimes(3);
	});
});
