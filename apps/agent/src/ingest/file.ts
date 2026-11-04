// The kinds of file Klippy reads. Images are left out: describing one is a model call per image.
const TYPES = new Set(['text/plain', 'text/markdown', 'text/html', 'application/pdf']);
const MAX_FILE = 1_000_000;

// A file as Markdown: text as it is, HTML and PDF converted by env.AI.toMarkdown. Or the error to send back.
export async function fileToMarkdown(env: Env, file: File): Promise<string | Response> {
	const type = file.type.split(';')[0];
	if (!TYPES.has(type)) return Response.json({ error: 'Send plain text, Markdown, HTML or a PDF.' }, { status: 415 });
	if (file.size > MAX_FILE) return Response.json({ error: 'Files can be up to 1 MB.' }, { status: 413 });
	if (type === 'text/plain' || type === 'text/markdown') return file.text();
	const result = await env.AI.toMarkdown({ name: file.name || 'file', blob: file });
	if (result.format === 'error') return Response.json({ error: `Couldn't read that file: ${result.error}` }, { status: 422 });
	return result.data;
}
