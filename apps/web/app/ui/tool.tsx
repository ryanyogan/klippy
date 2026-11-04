// Adapted from AI Elements (Tool), Copyright 2023 Vercel, Inc., Apache-2.0. See AI-ELEMENTS-LICENSE.txt.
import type { Handle, RemixNode } from 'remix/component';
import { getToolName, type DynamicToolUIPart, type ToolUIPart } from 'ai';

export type ToolPart = ToolUIPart | DynamicToolUIPart;

// What each step of a tool call looks like to you, in plain words.
const labels: Record<ToolPart['state'], string> = {
	'input-streaming': 'Getting ready',
	'input-available': 'Running',
	'approval-requested': 'Waiting for you',
	'approval-responded': 'Sending your answer',
	'output-available': 'Done',
	'output-error': 'Failed',
	'output-denied': 'You said no',
};

// One tool call as a quiet card: a one-line summary that opens to show the input and the result.
// `children` is where the chat puts Approve / Deny while the call waits for you.
export function Tool(handle: Handle<{ part: ToolPart; children?: RemixNode }>) {
	return () => {
		const { part, children } = handle.props;
		return (
			<details class="tool" open={part.state === 'approval-requested'}>
				<summary>
					<span class="tool-name">{getToolName(part)}</span>
					<span class="tool-state">{labels[part.state]}</span>
				</summary>
				<div class="tool-body">
					<p class="muted">Input</p>
					<pre>{JSON.stringify(part.input ?? {}, null, 2)}</pre>
					{part.state === 'output-available' && (
						<>
							<p class="muted">Result</p>
							<pre>{JSON.stringify(part.output, null, 2)}</pre>
						</>
					)}
					{part.state === 'output-error' && (
						<>
							<p class="muted">Error</p>
							<pre>{part.errorText}</pre>
						</>
					)}
				</div>
				{children && <div class="tool-actions">{children}</div>}
			</details>
		);
	};
}
