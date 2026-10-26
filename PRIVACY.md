# Privacy Policy

Last updated: 2026-10-26

Uncounted does not collect, send or sell any data.

## What the extension stores

- **Your site list and settings** in `chrome.storage.sync`. Your browser syncs them across your devices if you use browser sync. The extension has no server.
- **Origins where it set the flag**, in `chrome.storage.local` on this device, so it can remove the flag later.
- **Debug data** (test mode, event log) in `chrome.storage.session`. The browser deletes it when it closes.

## What the extension does on web pages

- On sites you enable, it writes `plausible_ignore` to the page's localStorage and removes it when you disable the site.
- If you turn on the event log, it reads requests the page sends to Plausible and shows them in the popup. The data stays in your browser.

## Network requests

None. The extension makes no network requests of its own.

## Contact

Matze Schmidbauer, see https://schmidbauer.dev/imprint. For questions about this extension, open an issue at https://github.com/mschmdb/chrome-plausible-extension/issues.
