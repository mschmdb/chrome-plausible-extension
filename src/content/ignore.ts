// Runs at document_start on enabled sites, before the Plausible script can send a pageview.
import { setFlagInPage } from '../lib/flag';
import type { ContentMessage } from '../lib/messages';

const result = setFlagInPage();

let message: ContentMessage | null = null;
if (result && 'blocked' in result) message = { type: 'flag-blocked' };
// Report only real changes. The service worker remembers the origin to clean it up later,
// and a flag the user set by hand stays theirs.
else if (result?.changed) message = { type: 'flag-set' };

if (message) chrome.runtime.sendMessage(message).catch(() => undefined);
