// Forwards events from the MAIN-world probe to the service worker.
// The page can post fake messages too. They only reach this tab's debug log.
import { isProbeMessage, type ContentMessage } from '../lib/messages';
import { safeSend } from '../lib/safe-send';

// The isolated world keeps globals between injections, so this guard prevents a second
// listener when the popup injects the relay into a page that already has it.
const scope = globalThis as unknown as { ignoreForPlausibleRelay?: boolean };

function relay(event: MessageEvent<unknown>): void {
	if (event.source !== window || !isProbeMessage(event.data)) return;
	const message: ContentMessage = { type: 'event', event: event.data.event };
	if (!safeSend(message)) {
		// The extension was reloaded. Stop listening and let a new relay take over.
		window.removeEventListener('message', relay);
		scope.ignoreForPlausibleRelay = false;
	}
}

if (!scope.ignoreForPlausibleRelay) {
	scope.ignoreForPlausibleRelay = true;
	window.addEventListener('message', relay);
}
