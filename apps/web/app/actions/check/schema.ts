import * as s from 'remix/data-schema';
import * as f from 'remix/data-schema/form-data';

// ?nonce= from the bits grader: 8 to 64 letters, digits, - or _ (the agent checks the same rule).
export const CheckQuery = f.object({
	nonce: f.field(s.string().refine((value) => /^[A-Za-z0-9_-]{8,64}$/.test(value), 'Send ?nonce= (8 to 64 letters, digits, - or _)')),
});
