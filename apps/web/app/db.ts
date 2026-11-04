import { env } from 'cloudflare:workers';
import { createD1Database } from 'data-table-d1';

// remix/data-table over the D1 binding: the same query layer, and the same tables, as the agent.
export function database() {
	return createD1Database(env.DB);
}
