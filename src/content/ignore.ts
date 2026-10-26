// Runs at document_start on enabled sites, before the Plausible script can send a pageview.
import { setFlagInPage } from '../lib/flag';
import type { ContentMessage } from '../lib/messages';
import { FLAGGED_ORIGINS_KEY } from '../lib/storage-keys';

const send = (message: ContentMessage) => chrome.runtime.sendMessage(message);

const result = setFlagInPage();

if (result && 'blocked' in result) {
	send({ type: 'flag-blocked' }).catch(() => undefined);
} else if (result) {
	// The site is enabled, so the extension owns the flag here, even if it was set by hand
	// before. Report it once, so the service worker can clean it up after removal.
	chrome.storage.local
		.get(FLAGGED_ORIGINS_KEY)
		.then((stored) => {
			const owned: unknown = stored[FLAGGED_ORIGINS_KEY];
			if (!Array.isArray(owned) || !owned.includes(location.origin)) {
				return send({ type: 'flag-set' });
			}
		})
		.catch(() => undefined);
}
