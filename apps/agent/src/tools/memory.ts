import { tool } from 'ai';
import { z } from 'zod';
import type { Klippy } from '../agent';

// Long-term memory has limits too: at most 50 facts of up to 200 characters, so the system prompt stays small.
export const MAX_FACTS = 50;
export const MAX_FACT = 200;

// The facts this Klippy knows, from its own SQLite (the same database that holds its chat).
export function facts(agent: Klippy) {
	agent.sql`CREATE TABLE IF NOT EXISTS facts (id INTEGER PRIMARY KEY, fact TEXT NOT NULL)`;
	return agent.sql<{ id: number; fact: string }>`SELECT id, fact FROM facts ORDER BY id`;
}

export function memoryTools(agent: Klippy) {
	const remember = tool({
		description:
			'Remember a lasting fact about the user for future chats: their name, preferences, people and plans. Not for one-off questions or things only true today.',
		inputSchema: z.object({ fact: z.string().trim().min(1).max(MAX_FACT).describe('One short fact, e.g. "Has a dog called Pip"') }),
		execute: async ({ fact }) => {
			if (facts(agent).length >= MAX_FACTS) return { error: `Memory is full (${MAX_FACTS} facts). Forget one first.` };
			const [row] = agent.sql<{ id: number }>`INSERT INTO facts (fact) VALUES (${fact}) RETURNING id`;
			return { remembered: { id: row.id, fact } };
		},
	});

	const forget = tool({
		description: 'Forget a fact you remembered, by its id from "What you know about the user". Use it when the user asks, or a fact is wrong.',
		inputSchema: z.object({ id: z.number().int().describe('The id of the fact') }),
		execute: async ({ id }) => {
			facts(agent); // makes sure the table exists
			agent.sql`DELETE FROM facts WHERE id = ${id}`;
			return { forgot: id };
		},
	});

	return { remember, forget };
}
