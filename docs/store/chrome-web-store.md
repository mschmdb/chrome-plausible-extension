# Chrome Web Store listing

Everything to paste into the developer dashboard. Assets live in [assets/](assets/) and are generated with `node scripts/build.mjs --e2e && node scripts/store-assets.mjs`.

## Name

Uncounted

The name avoids the Plausible trademark (https://plausible.io/trademark). Plausible appears only in factual descriptions, never more prominently than the product name.

## Summary (max. 132 characters)

Exclude your own visits from Plausible Analytics. Per site or everywhere, with developer tools for debugging.

## Description

```text
Unofficial extension. Not made by, endorsed by or affiliated with Plausible Analytics or Plausible Insights OÜ. It uses the opt-out flag Plausible documents at https://plausible.io/docs/excluding-localstorage.

Uncounted keeps your own visits out of your Plausible Analytics stats.

Plausible lets you exclude yourself with a console command per site and browser, and the first pageview still counts. Uncounted sets the same flag automatically, before the Plausible script loads. It works with plausible.io, self-hosted instances and proxied scripts.

WHAT IT DOES
• Turn your own sites on with one click in the toolbar
• Include subdomains if you like
• Global mode, opt-in, for every site
• Badge per tab: ignored, counted or no Plausible found
• Takes over flags you set by hand and removes them cleanly when you turn a site off

FOR DEVELOPERS
• Detects the Plausible script, variant, domain, endpoint and version
• Local installation checks: duplicate scripts, Content Security Policy, blocked script, localhost, tagged-event classes
• Flag inspector
• Test mode: lift the flag for a while to check goals and custom events
• Event log: what Plausible sends or skips, with properties, revenue, HTTP status and payload warnings
• Export and import your site list

PRIVACY
• No data collection, no analytics, no remote requests
• Host access only for sites you turn on, requested at that moment
• Open source: https://github.com/mschmdb/chrome-plausible-extension
```

## Category

Developer Tools

## Language

English

## Graphic assets

| Asset                    | File                               |
| ------------------------ | ---------------------------------- |
| Icon 128×128             | `static/icons/icon-128.png`        |
| Small promo tile 440×280 | `assets/promo-small-440x280.png`   |
| Screenshot 1             | `assets/screenshot-1-status.png`   |
| Screenshot 2             | `assets/screenshot-2-devtools.png` |
| Screenshot 3             | `assets/screenshot-3-settings.png` |

## Single purpose

Exclude the user's own visits from Plausible Analytics by setting Plausible's documented `plausible_ignore` localStorage flag on sites the user chooses, and help the user check that it works.

## Permission justifications

| Permission                       | Why                                                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                        | Saves the site list and settings, remembers where the extension set the flag so it can remove it later, and keeps the debug log for the session.    |
| `scripting`                      | Registers the content script that sets the flag before Plausible loads, and reads the flag and the Plausible setup of a page for the popup.         |
| `activeTab`                      | Shows the status of the current tab and records its Plausible events when the user asks for it in the popup, without permanent access to that site. |
| Optional host access (`*://*/*`) | Requested per site when the user turns it on, or for all sites only if the user turns on global mode. Needed to set the flag at page start.         |

## Remote code

No. All code ships in the package.

## Data usage

The extension does not collect or transmit user data. Tick none of the data categories. Certify all three disclosures.

## Privacy policy URL

https://github.com/mschmdb/chrome-plausible-extension/blob/main/PRIVACY.md

## Homepage and support URL

https://github.com/mschmdb/chrome-plausible-extension

## Package

Push a tag `v<version>` (matching `package.json`). The release workflow builds `uncounted-<version>.zip` and attaches it to a GitHub release. Upload that file in the dashboard.
