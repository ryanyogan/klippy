// Is this GitHub account allowed in? We compare the numeric id, never the login: a login can be renamed, and then
// someone else can register the old name. The id never changes. `allowed` is a comma-separated list of ids.
export function isAllowedId(id: number, allowed: string) {
	return allowed
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean)
		.includes(String(id));
}
