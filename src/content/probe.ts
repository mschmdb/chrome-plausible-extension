// MAIN world, document_start. Only registered while the event log is on.
import { installProbe } from '../lib/probe-hooks';
import { PROBE_SOURCE, type ProbeMessage } from '../lib/messages';

const targetOrigin = window.location.origin === 'null' ? '*' : window.location.origin;

installProbe(window, (event) => {
	const message: ProbeMessage = { source: PROBE_SOURCE, event };
	window.postMessage(message, targetOrigin);
});
