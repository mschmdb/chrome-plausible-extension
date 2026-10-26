# Ignore for Plausible (working title)

A browser extension that sets `localStorage.plausible_ignore = "true"` so [Plausible Analytics](https://plausible.io) stops counting your own visits. Per site or globally, with a debug view.

> **Status:** early development. Not yet in any store.

## Why

Plausible's [official way](https://plausible.io/docs/excluding-localstorage) to exclude yourself is a console command per domain and browser. It also counts the first pageview, because the flag only applies from the next load. This extension sets the flag before the Plausible script runs, on every site you choose. It works with plausible.io, self-hosted instances and proxied scripts.

## Privacy

- No telemetry, no remote requests
- Only asks for host permissions on sites you enable
- Your site list stays in `chrome.storage.sync`

## Development

Stack: Manifest V3, TypeScript, Vite, Svelte 5, pnpm. Setup instructions follow with [#1](../../issues/1).

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)

Not affiliated with Plausible Insights OÜ.
