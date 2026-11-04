import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAllowedId } from './allowlist.ts';

// Plain Node tests (node --test): this module has no Worker imports, so it runs anywhere.
test('lets in an id on the list', () => {
	assert.equal(isAllowedId(583231, '583231'), true);
	assert.equal(isAllowedId(583231, '12, 583231'), true);
});

test('refuses the same login with a different id (a renamed or re-registered account)', () => {
	// The profile says login "octocat", but its id isn't the one on the list: refused.
	const profile = { id: 999999, login: 'octocat' };
	assert.equal(isAllowedId(profile.id, '583231'), false);
});

test('refuses everyone when the list is empty or a placeholder', () => {
	assert.equal(isAllowedId(583231, ''), false);
	assert.equal(isAllowedId(583231, 'your-github-id'), false);
});
