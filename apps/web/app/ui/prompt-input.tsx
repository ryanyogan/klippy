// Adapted from AI Elements (PromptInput), Copyright 2023 Vercel, Inc., Apache-2.0. See AI-ELEMENTS-LICENSE.txt.
import { on, type Handle } from 'remix/component';

// The message box: a labelled textarea and a send button. Enter sends, Shift+Enter adds a line.
// `onSend` gets the text and says whether it went through; the box is cleared only then, so a failed send keeps
// your words. `busy` disables it while Klippy answers.
export function PromptInput(handle: Handle<{ busy?: boolean; disabled?: boolean; onSend?: (text: string) => Promise<boolean> }>) {
	return () => {
		const { busy, disabled, onSend } = handle.props;
		return (
			<form
				class="prompt-input"
				mix={on('submit', async (event) => {
					event.preventDefault();
					const box = event.currentTarget.elements.namedItem('message') as HTMLTextAreaElement;
					const text = box.value.trim();
					if (!text || busy || !onSend) return;
					if (await onSend(text)) box.value = '';
				})}
			>
				<label for="message">Message Klippy</label>
				<div class="row">
					<textarea
						id="message"
						name="message"
						rows={2}
						maxLength={2000}
						disabled={disabled}
						mix={on('keydown', (event) => {
							if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
								event.preventDefault();
								event.currentTarget.form?.requestSubmit();
							}
						})}
					/>
					<button class="button" type="submit" disabled={disabled || busy} aria-busy={busy ? 'true' : undefined}>
						{busy ? 'Klippy is answering…' : 'Send'}
					</button>
				</div>
			</form>
		);
	};
}
