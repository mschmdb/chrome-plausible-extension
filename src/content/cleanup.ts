// Runs on origins that may still carry a flag this extension set. The match pattern
// cannot tell ports apart, so the script checks ownership of the exact origin first.
import { clearFlagInPage } from '../lib/flag';
import type { ContentMessage } from '../lib/messages';
import { safeSend } from '../lib/safe-send';

import { FLAGGED_ORIGINS_KEY as FLAGGED_KEY } from '../lib/storage-keys';

async function cleanUp(): Promise<void> {
	const stored = await chrome.storage.local.get(FLAGGED_KEY);
	const owned: unknown = stored[FLAGGED_KEY];
	if (!Array.isArray(owned) || !owned.includes(location.origin)) return;

	const result = clearFlagInPage(location.origin);
	if (!result) return;
	const message: ContentMessage =
		'blocked' in result ? { type: 'flag-blocked' } : { type: 'flag-cleared' };
	safeSend(message);
}

cleanUp().catch(() => undefined);
