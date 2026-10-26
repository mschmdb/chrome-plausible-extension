// Runs at document_start on enabled sites, before the Plausible script can send a pageview.
import { setFlagInPage } from '../lib/flag';
import type { ContentMessage } from '../lib/messages';

const result = setFlagInPage();
if ('blocked' in result) {
	const message: ContentMessage = { type: 'flag-blocked' };
	chrome.runtime.sendMessage(message).catch(() => undefined);
}
