# Ignore for Plausible (working title)

A browser extension that stops [Plausible Analytics](https://plausible.io) from counting your own visits. It sets `localStorage.plausible_ignore = "true"` on the sites you choose, before the Plausible script runs.

> **Status:** early development. Not yet in any store.

## Why

Plausible's [documented way](https://plausible.io/docs/excluding-localstorage) to exclude yourself is a console command per site and browser. The first pageview still counts, because the flag only applies from the next page load.

This extension sets the flag at `document_start`, so the first pageview is skipped too. It works with plausible.io, self-hosted instances and proxied scripts, because it only touches the page's localStorage.

## Features

- **Per site:** toggle the current site in the popup. Subdomains are optional.
- **Global mode:** opt in to set the flag on every site.
- **Badge:** shows per tab whether your visits are ignored or counted.
- **Developer tools** in the popup:
  - Plausible detection: script, variant, domain, endpoint, version
  - Local installation checks: multiple scripts, CSP, blocked script, localhost, tagged-event classes
  - Flag inspector: current value next to the expected one
  - Test mode: lifts the flag on a site until you stop it or close the tab
  - Event log: events Plausible sends or skips, with payload warnings
- **Export and import** of the site list as JSON.
- **Cleanup:** removing a site clears the flag it set, on open tabs right away and on other origins at your next visit. Flags you set by hand stay untouched.

## Privacy

- No telemetry, no analytics, no remote requests
- Host access only for the sites you enable, asked at the moment you enable them
- Your site list syncs through your browser account (`chrome.storage.sync`)

See [PRIVACY.md](PRIVACY.md).

## Development

Requires Node 24 and pnpm.

```sh
pnpm install
pnpm build        # builds dist/
pnpm test         # unit and component tests
pnpm test:e2e     # loads the extension in Chromium
pnpm lint
pnpm check        # type check
pnpm package      # zips dist/ into release/
```

Load `dist/` in Chrome via `chrome://extensions` → Developer mode → Load unpacked.

Architecture decisions live in [docs/adr](docs/adr). See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

[MIT](LICENSE). The icon glyph comes from [Lucide](https://lucide.dev) (ISC license).

Not affiliated with Plausible Insights OÜ.
