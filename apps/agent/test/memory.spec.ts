import { env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import type { Klippy } from '../src/agent';
import { memoryTools } from '../src/tools/memory';
import { fakeModel } from './fake-model';

const fake = vi.hoisted(() => ({ model: undefined as ReturnType<typeof fakeModel> | undefined }));
vi.mock('../src/model', () => ({ model: () => fake.model }));

const say = (id: string, text: string) => ({ id, role: 'user' as const, parts: [{ type: 'text' as const, text }] });

// The system prompt the model saw on its nth call.
const systemOf = (n: number) => fake.model!.doStreamCalls[n].prompt.find((m) => m.role === 'system')?.content;

describe("Klippy's long-term memory", () => {
	it('remembers a fact and puts it in the system prompt from then on', async () => {
		fake.model = fakeModel({ tool: 'remember', input: { fact: 'Has a dog called Pip' } }, 'Noted!', 'Pip, your dog.');
		const klippy = env.Klippy.getByName('erin');
		await klippy.saveMessages([say('m1', 'Remember that I have a dog called Pip.')]);
		expect(systemOf(0)).toContain('(nothing yet)');

		await klippy.saveMessages((messages) => [...messages, say('m2', "What's my dog called?")]);
		expect(systemOf(2)).toContain('1: Has a dog called Pip');
	});

	it('forgets a fact by its id', async () => {
		fake.model = fakeModel(
			{ tool: 'remember', input: { fact: 'Likes tea' } },
			{ tool: 'forget', input: { id: 1 } },
			'Done.',
			'Nothing yet.',
		);
		const klippy = env.Klippy.getByName('frank');
		await klippy.saveMessages([say('m1', 'Remember I like tea. Actually, forget that.')]);
		await klippy.saveMessages((messages) => [...messages, say('m2', 'What do you know about me?')]);
		expect(systemOf(3)).toContain('(nothing yet)');
	});

	it('keeps each Klippy\'s memory to itself', async () => {
		fake.model = fakeModel({ tool: 'remember', input: { fact: 'Lives in Cork' } }, 'Noted.', 'No idea.');
		await env.Klippy.getByName('gina').saveMessages([say('m1', 'I live in Cork.')]);
		await env.Klippy.getByName('hal').saveMessages([say('m1', 'Where do I live?')]);
		expect(systemOf(2)).toContain('(nothing yet)');
	});

	it('refuses a 51st fact', async () => {
		await runInDurableObject(env.Klippy.getByName('iris'), async (klippy: Klippy) => {
			const { remember } = memoryTools(klippy);
			const call = (fact: string) => remember.execute!({ fact }, { toolCallId: 't', messages: [], context: {} });
			for (let i = 1; i <= 50; i++) await call(`Fact ${i}`);
			expect(await call('One too many')).toEqual({ error: 'Memory is full (50 facts). Forget one first.' });
		});
	});
});
