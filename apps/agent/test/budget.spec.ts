import { env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import type { Klippy } from '../src/agent';
import { spend, tokensToday } from '../src/budget';
import { fakeModel } from './fake-model';

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
