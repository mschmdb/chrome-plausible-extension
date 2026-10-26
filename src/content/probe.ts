// MAIN world. Registered at document_start on enabled sites while the event log is on,
// or injected once into an open page from the popup.
import { installProbe } from '../lib/probe-hooks';
import { PROBE_SOURCE, type ProbeMessage } from '../lib/messages';

// Installing twice would report every event twice.
const INSTALLED = Symbol.for('uncounted.probe');
const marked = window as unknown as Record<symbol, boolean>;

if (!marked[INSTALLED]) {
	Object.defineProperty(window, INSTALLED, { value: true });
	const targetOrigin = window.location.origin === 'null' ? '*' : window.location.origin;
	installProbe(window, (event) => {
		const message: ProbeMessage = { source: PROBE_SOURCE, event };
		window.postMessage(message, targetOrigin);
	});
}
