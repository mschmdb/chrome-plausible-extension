// Runs once on a removed site to clear the flag, then the background unregisters it.
import { clearFlagInPage } from '../lib/flag';
import type { ContentMessage } from '../lib/messages';

const result = clearFlagInPage();
const message: ContentMessage =
	result && 'blocked' in result ? { type: 'flag-blocked' } : { type: 'flag-cleared' };
chrome.runtime.sendMessage(message).catch(() => undefined);
