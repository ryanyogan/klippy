import { env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import type { Klippy } from '../src/agent';
import { reserve, settle, spend, tokensToday } from '../src/budget';
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
function cancelledOnStep(step: number, controller: AbortController, call = { toolName: 'getTime', input: '{"timeZone":"Europe/Lisbon"}' }) {
	let calls = 0;
	return new MockLanguageModelV4({
		doStream: async () => {
			if (++calls === step) {
				controller.abort();
				throw new DOMException('The turn was cancelled.', 'AbortError');
			}
			return {
				stream: convertArrayToReadableStream<LanguageModelV4StreamPart>([
					{ type: 'tool-call', toolCallId: 'c1', ...call },
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

describe('reserve and settle (fix forward in f-05)', () => {
	it('keeps the reserve when a step reports no token count', async () => {
		const spent = await runInDurableObject(env.Klippy.getByName('settle-undefined'), (agent: Klippy) => {
			settle(agent, reserve(agent, 500), undefined);
			return tokensToday(agent);
		});
		expect(spent).toBe(500);
	});

	it('corrects on the day the reserve went to, even after midnight', async () => {
		const days = await runInDurableObject(env.Klippy.getByName('settle-midnight'), (agent: Klippy) => {
			spend(agent, 500, '2026-11-02'); // reserved just before midnight...
			settle(agent, { day: '2026-11-02', tokens: 500 }, 120); // ...settled after it
			return { reserved: tokensToday(agent, '2026-11-02'), today: tokensToday(agent) };
		});
		expect(days).toEqual({ reserved: 120, today: 0 });
	});

	it('reserves each step from what it sends: a big page read in step 1 makes step 2 reserve more', async () => {
		// Step 2 is cancelled, so it keeps its reserve: the total shows how much was reserved for it.
		async function spentAfterReading(page: string, name: string) {
			vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(page, { headers: { 'Content-Type': 'text/markdown' } }));
			const klippy = env.Klippy.getByName(name);
			return runInDurableObject(klippy, async (agent: Klippy) => {
				const controller = new AbortController();
				fake.model = cancelledOnStep(2, controller, { toolName: 'readLink', input: '{"url":"https://example.org/post"}' }) as never;
				await agent.saveMessages([say('m1', 'Summarise https://example.org/post')], { signal: controller.signal }).catch(() => {});
				return tokensToday(agent);
			});
		}
		const small = await spentAfterReading('# Hi', 'settle-small-page');
		const big = await spentAfterReading(`# Big\n\n${'word '.repeat(1400)}`, 'settle-big-page');
		vi.restoreAllMocks();
		expect(big - small).toBeGreaterThan(2000); // about 7,000 more characters sent, at 3 characters a token
	});
});
