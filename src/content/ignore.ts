// Runs at document_start on enabled sites, before the Plausible script can send a pageview.
import { setFlagInPage } from '../lib/flag';
import { safeSend } from '../lib/safe-send';
import { FLAGGED_ORIGINS_KEY } from '../lib/storage-keys';

const result = setFlagInPage();

if (result && 'blocked' in result) {
	safeSend({ type: 'flag-blocked' });
} else if (result) {
	// The site is enabled, so the extension owns the flag here, even if it was set by hand
	// before. Report it once, so the service worker can clean it up after removal.
	chrome.storage.local
		.get(FLAGGED_ORIGINS_KEY)
		.then((stored) => {
			const owned: unknown = stored[FLAGGED_ORIGINS_KEY];
			if (!Array.isArray(owned) || !owned.includes(location.origin)) {
				safeSend({ type: 'flag-set' });
			}
		})
		.catch(() => undefined);
}
