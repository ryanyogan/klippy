import { env, runInDurableObject } from 'cloudflare:test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Klippy } from '../src/agent';
import { spend } from '../src/budget';
import { fakeModel } from './fake-model';

const fake = vi.hoisted(() => ({ model: undefined as ReturnType<typeof fakeModel> | undefined }));
vi.mock('../src/model', () => ({ model: () => fake.model }));

const say = (id: string, text: string) => ({ id, role: 'user' as const, parts: [{ type: 'text' as const, text }] });

// The objects Klippy logged with a given event name.
function logged(spy: { mock: { calls: unknown[][] } }, event: string) {
	return spy.mock.calls.map(([line]) => line as Record<string, unknown>).filter((line) => line?.event === event);
}

describe('one log line per turn (f-04)', () => {
	afterEach(() => vi.restoreAllMocks());

	it('logs the shape of a turn: steps, tool names, tokens, time', async () => {
		const spy = vi.spyOn(console, 'log');
		fake.model = fakeModel({ tool: 'getTime', input: { timeZone: 'Europe/Lisbon' } }, 'It is noon in Lisbon.');
		await env.Klippy.getByName('log-shape').saveMessages([say('m1', 'My secret is swordfish. What time is it in Lisbon?')]);
		const [turn] = logged(spy, 'turn');
		expect(turn).toMatchObject({
			event: 'turn',
			agent: 'log-shape',
			steps: 2,
			finish: 'stop',
			tools: ['getTime'],
			toolErrors: 0,
			tokens: { input: 20, output: 10, cached: 0, total: 30 },
		});
		expect(turn.ms).toBeTypeOf('number');
	});

	it('never logs what was said, what a tool was given, or what it returned', async () => {
		const spy = vi.spyOn(console, 'log');
		fake.model = fakeModel({ tool: 'getTime', input: { timeZone: 'Europe/Lisbon' } }, 'Noon, and your secret is swordfish.');
		await env.Klippy.getByName('log-private').saveMessages([say('m1', 'My secret is swordfish. What time is it in Lisbon?')]);
		const line = JSON.stringify(logged(spy, 'turn'));
		for (const secret of ['swordfish', 'Lisbon', 'Noon']) expect(line).not.toContain(secret);
	});

	it('logs a refused turn with its reason, and still no content', async () => {
		const spy = vi.spyOn(console, 'log');
		fake.model = fakeModel('never');
		const klippy = env.Klippy.getByName('log-refused');
		await runInDurableObject(klippy, (agent: Klippy) => spend(agent, Number(env.DAILY_TOKEN_BUDGET)));
		await klippy.saveMessages([say('m1', 'My secret is swordfish.')]);
		expect(logged(spy, 'turn.refused')).toEqual([{ event: 'turn.refused', agent: 'log-refused', reason: 'budget' }]);
		expect(JSON.stringify(spy.mock.calls)).not.toContain('swordfish');
	});
});
