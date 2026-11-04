import { env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import type { Klippy } from '../src/agent';
import { spend, tokensToday } from '../src/budget';
import type { LanguageModelV4StreamPart } from '@ai-sdk/provider';
import { convertArrayToReadableStream, MockLanguageModelV4 } from 'ai/test';
import { fakeModel } from './fake-model';

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } };

const fake = vi.hoisted(() => ({ model: undefined as ReturnType<typeof fakeModel> | undefined }));
vi.mock('../src/model', () => ({ model: () => fake.model }));

const say = (id: string, text: string) => ({ id, role: 'user' as const, parts: [{ type: 'text' as const, text }] });
const lastText = (messages: { role: string; parts: { type: string; text?: string }[] }[]) =>
	messages.at(-1)?.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('');

describe('the daily token budget (f-03)', () => {
	it("adds each turn's tokens, every step, to today's total", async () => {
		// Two steps (a tool call, then the answer), 15 tokens each in the fake model.
		fake.model = fakeModel({ tool: 'getTime', input: { timeZone: 'Europe/Lisbon' } }, 'It is noon.');
		const klippy = env.Klippy.getByName('budget-count');
		await klippy.saveMessages([say('m1', 'What time is it in Lisbon?')]);
		expect(await runInDurableObject(klippy, (agent: Klippy) => tokensToday(agent))).toBe(30);
	});

	it('refuses a turn once the budget is spent, without calling the model', async () => {
		fake.model = fakeModel('You should never see this.');
		const klippy = env.Klippy.getByName('budget-spent');
		await runInDurableObject(klippy, (agent: Klippy) => spend(agent, Number(env.DAILY_TOKEN_BUDGET)));
		await klippy.saveMessages([say('m1', 'Hello?')]);
		const messages = await runInDurableObject(klippy, (agent: Klippy) => agent.messages);
		expect(lastText(messages)).toContain("today's budget");
		expect(fake.model.doStreamCalls).toHaveLength(0);
	});

	it('keeps one Klippy\'s spending off another\'s budget', async () => {
		fake.model = fakeModel('Hi!');
		await runInDurableObject(env.Klippy.getByName('budget-alice'), (agent: Klippy) => spend(agent, 999_999));
		const bob = env.Klippy.getByName('budget-bob');
		await bob.saveMessages([say('m1', 'Hello?')]);
		expect(fake.model.doStreamCalls).toHaveLength(1);
	});
});

// A model whose first step calls getTime and whose second step is cancelled mid-call (as a client cancelling would).
function cancelledOnStep(step: number, controller: AbortController) {
	let calls = 0;
	return new MockLanguageModelV4({
		doStream: async () => {
			if (++calls === step) {
				controller.abort();
				throw new DOMException('The turn was cancelled.', 'AbortError');
			}
			return {
				stream: convertArrayToReadableStream<LanguageModelV4StreamPart>([
					{ type: 'tool-call', toolCallId: 'c1', toolName: 'getTime', input: '{"timeZone":"Europe/Lisbon"}' },
					{ type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_use' }, usage },
				]),
			};
		},
	});
}

describe('the budget holds when a turn is cancelled (fix forward in f-04)', () => {
	it('a turn cancelled after one step still pays for that step, and holds the estimate for the cancelled one', async () => {
		const klippy = env.Klippy.getByName('budget-cancel-2');
		const spent = await runInDurableObject(klippy, async (agent: Klippy) => {
			const controller = new AbortController();
			fake.model = cancelledOnStep(2, controller) as never;
			await agent.saveMessages([say('m1', 'What time is it in Lisbon?')], { signal: controller.signal }).catch(() => {});
			return tokensToday(agent);
		});
		// f-03 charged only in onFinish, which a cancelled turn never reaches: it counted 0 here.
		expect(spent).toBeGreaterThan(15); // step 1's real 15 tokens, plus the held estimate for step 2
	});

	it('a turn cancelled on its very first step is still charged its estimate', async () => {
		const klippy = env.Klippy.getByName('budget-cancel-1');
		const spent = await runInDurableObject(klippy, async (agent: Klippy) => {
			const controller = new AbortController();
			fake.model = cancelledOnStep(1, controller) as never;
			await agent.saveMessages([say('m1', 'Hello?')], { signal: controller.signal }).catch(() => {});
			return tokensToday(agent);
		});
		expect(spent).toBeGreaterThanOrEqual(300); // at least the reply cap
	});
});
