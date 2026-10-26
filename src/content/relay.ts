// Forwards events from the MAIN-world probe to the service worker.
// The page can post fake messages too. They only reach this tab's debug log.
import { isProbeMessage, type ContentMessage } from '../lib/messages';

window.addEventListener('message', (event: MessageEvent<unknown>) => {
	if (event.source !== window || !isProbeMessage(event.data)) return;
	const message: ContentMessage = { type: 'event', event: event.data.event };
	chrome.runtime.sendMessage(message).catch(() => undefined);
});
