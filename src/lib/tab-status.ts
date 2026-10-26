import type { Detection } from './detect';
import type { CapturedEvent } from './events';
import type { Site } from './host';
import type { FlagState, PageStatus } from './status';

/** Everything the popup needs to render one tab. */
export interface TabStatus {
	tabId: number;
	host: string | null;
	/** The site entry that covers this host, if any. */
	site: Site | null;
	/** Host access for the site's patterns is granted. */
	siteGranted: boolean;
	global: boolean;
	globalGranted: boolean;
	/** The flag should be set here according to settings and test mode. */
	shouldIgnore: boolean;
	testMode: boolean;
	pendingCleanup: boolean;
	status: PageStatus;
	flag: FlagState | null;
	detection: Detection | null;
	eventLog: boolean;
	events: CapturedEvent[];
}
