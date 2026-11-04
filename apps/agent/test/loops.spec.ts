import { applyD1Migrations, env, runInDurableObject } from 'cloudflare:test';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { chatTools, type Klippy } from '../src/agent';
import { OUT_OF_STEPS } from '../src/ask';
import { fakeModel } from './fake-model';

const fake = vi.hoisted(() => ({ model: undefined as ReturnType<typeof fakeModel> | undefined }));
vi.mock('../src/model', () => ({ model: () => fake.model }));

const say = (id: string, text: string) => ({ id, role: 'user' as const, parts: [{ type: 'text' as const, text }] });
// Klippy's last message, read inside the Durable Object.
const lastMessage = (stub: DurableObjectStub<Klippy>) => runInDurableObject(stub, async (klippy: Klippy) => klippy.messages.at(-1)!);
// The tool names the model was offered on its nth call.
const toolsAt = (n: number) => fake.model!.doStreamCalls[n].tools?.map((t) => t.name).sort();

beforeAll(() => applyD1Migrations(env.DB, env.TEST_MIGRATIONS));

describe('when loops go wrong', () => {
	it('stops a stuck loop: the same call twice, and the next step may not call tools', async () => {
		const sameCall = { tool: 'getTime', input: { timeZone: 'Europe/Dublin' } };
		fake.model = fakeModel(sameCall, sameCall, 'It is about noon.');
		await env.Klippy.getByName('pat').saveMessages([say('m1', 'What time is it in Dublin?')]);
		const calls = fake.model.doStreamCalls;
		expect(calls[1].toolChoice).toEqual({ type: 'auto' }); // one call is fine
		expect(calls[2].toolChoice).toEqual({ type: 'none' }); // the same call twice: answer now
		expect(calls).toHaveLength(3);
	});

	it('never runs more than 8 steps in one turn', async () => {
		// A model that keeps asking for something new: no repeats, so only the step cap stops it.
		const zones = ['Europe/Dublin', 'Europe/Paris', 'Asia/Tokyo', 'America/Lima', 'Africa/Cairo', 'Asia/Dubai', 'Europe/Oslo', 'Asia/Seoul', 'Europe/Rome'];
		fake.model = fakeModel(...zones.map((timeZone) => ({ tool: 'getTime', input: { timeZone } })));
		await env.Klippy.getByName('ray').saveMessages([say('m1', 'What time is it everywhere?')]);
		expect(fake.model.doStreamCalls).toHaveLength(8);
	});

	it('says it ran out of steps when the cap stops a turn mid tool-call', async () => {
		const zones = ['Europe/Dublin', 'Europe/Paris', 'Asia/Tokyo', 'America/Lima', 'Africa/Cairo', 'Asia/Dubai', 'Europe/Oslo', 'Asia/Seoul'];
		fake.model = fakeModel(...zones.map((timeZone) => ({ tool: 'getTime', input: { timeZone } })));
		const klippy = env.Klippy.getByName('sam');
		await klippy.saveMessages([say('m1', 'What time is it everywhere?')]);
		const reply = await lastMessage(klippy);
		expect(reply.parts.at(-1)).toMatchObject({ type: 'text', text: OUT_OF_STEPS });
	});

	it('adds nothing when the turn ends with an answer', async () => {
		fake.model = fakeModel('Hello!');
		const klippy = env.Klippy.getByName('lee');
		await klippy.saveMessages([say('m1', 'Hi')]);
		const reply = await lastMessage(klippy);
		expect(reply.parts.filter((part) => part.type === 'text')).toMatchObject([{ text: 'Hello!' }]);
	});

	it('drops the notes and memory tools once the model reads a page, for the rest of the chat', async () => {
		// The model tries a link that isn't in the message: readLink refuses it, but a page read was attempted.
		fake.model = fakeModel({ tool: 'readLink', input: { url: 'https://example.com/' } }, 'Done.', 'Hi again.');
		const klippy = env.Klippy.getByName('quinn');
		await klippy.saveMessages([say('m1', 'What does that page say?')]);
		expect(toolsAt(0)).toEqual(['forget', 'getTime', 'getWeather', 'listNotes', 'readLink', 'remember', 'saveNote']);
		expect(toolsAt(1)).toEqual(['getTime', 'getWeather', 'readLink']);

		// Next turn: the page is still in the conversation, so the private tools stay off.
		await klippy.saveMessages((messages) => [...messages, say('m2', 'Now list my notes.')]);
		expect(toolsAt(2)).toEqual(['getTime', 'getWeather', 'readLink']);
	});

	it('keeps the private tools off when a page read and a repeated call meet in one turn', async () => {
		const read = { tool: 'readLink', input: { url: 'https://example.com/' } };
		fake.model = fakeModel(read, read, 'Done.');
		await env.Klippy.getByName('rio').saveMessages([say('m1', 'What does that page say?')]);
		expect(fake.model.doStreamCalls[2].toolChoice).toEqual({ type: 'none' }); // the repeat: answer now
		expect(toolsAt(2)).toEqual(['getTime', 'getWeather', 'readLink']); // and still no notes or memory tools
	});

	it('builds no private tools at all for a turn that starts with a page in the chat', async () => {
		await runInDurableObject(env.Klippy.getByName('ivy'), async (klippy: Klippy) => {
			const tools = chatTools(klippy, env, 'Hi', { pageRead: false }, true);
			expect(Object.keys(tools).sort()).toEqual(['getTime', 'getWeather', 'readLink']);
		});
	});

	it('locks the private tools the moment readLink runs, even if the model calls one it was not offered', async () => {
		await runInDurableObject(env.Klippy.getByName('jo'), async (klippy: Klippy) => {
			const turn = { pageRead: false };
			const tools = chatTools(klippy, env, 'What does that page say?', turn, false);
			const opts = { toolCallId: 'c1', messages: [], context: {} };
			await expect(tools.listNotes.execute!({}, opts)).resolves.toHaveProperty('notes'); // before any page: fine
			// A link that isn't in the message is refused, but the attempt alone locks the private tools.
			await expect(tools.readLink.execute!({ url: 'https://evil.example/' }, opts)).rejects.toThrow();
			expect(turn.pageRead).toBe(true);
			for (const name of ['listNotes', 'saveNote', 'remember', 'forget']) {
				await expect(tools[name].execute!({ body: 'x', fact: 'x', id: 1 }, opts)).rejects.toThrow("can't run after reading a page");
			}
		});
	});

	it('never lists notes when the model forces listNotes after readLink in one turn', async () => {
		fake.model = fakeModel({ tool: 'readLink', input: { url: 'https://example.com/' } }, { tool: 'listNotes', input: {} }, 'Done.');
		const klippy = env.Klippy.getByName('kit');
		await klippy.saveMessages([say('m1', 'What does that page say?')]);
		const parts = (await lastMessage(klippy)).parts.filter((part) => part.type === 'tool-listNotes');
		expect(parts).toMatchObject([{ state: 'output-error' }]); // refused: no notes reached the model
	});
});
