# 1. Capture Plausible events in the page's main world

Status: accepted (2026-10-26)

## Context

The debug view should list the events Plausible sends or skips on a page. Two options:

1. **`chrome.webRequest`, read-only.** Sees requests to the event endpoint. Needs host access to the endpoint, which can be any proxy path. Cannot see events the tracker skips before sending, such as those blocked by `plausible_ignore`.
2. **Main-world script.** Wraps `fetch`, `XMLHttpRequest`, `navigator.sendBeacon` and `console.warn` in the page. Sees the payload (`n`, `u`, `d`, `p`, `$`, `i`), the response status and the tracker's `Ignoring Event: <reason>` warning.

## Decision

Use a main-world script (`content/probe.js`). A relay content script forwards its messages to the service worker.

- It only runs when the user turns on the event log, and only on enabled sites or sites in test mode.
- Every hook calls the original first and never changes arguments, return values or errors.
- The page can post fake messages to the relay. They only reach the debug log of that tab. The service worker validates their shape and caps the log at 100 entries per tab.

## Consequences

- No extra permission. `webRequest` would have been one more permission to justify in the store.
- Ignored events appear without a name, because the tracker's warning only contains the reason.
- The tracker logs the warning only when its `logging` option is on (default). With `logging: false`, ignored events do not appear.
- DevTools shows `probe.js` as the caller of wrapped `console.warn` calls.
