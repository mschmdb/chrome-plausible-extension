# Chrome Web Store listing (draft)

## Single purpose

Exclude the user's own visits from Plausible Analytics by setting Plausible's documented `plausible_ignore` localStorage flag on sites the user chooses.

## Short description (max. 132 characters)

Stop Plausible Analytics from counting your own visits. Per site or everywhere, with developer tools for debugging.

## Permission justifications

| Permission                       | Why                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `storage`                        | Saves the site list and settings, remembers where the flag was set and keeps the debug log for the session.                                |
| `scripting`                      | Registers the content script that sets the flag before Plausible loads, and reads the flag and the Plausible setup for the popup.          |
| `activeTab`                      | Shows the status of the current tab when the user opens the popup, without host access to that site.                                       |
| Optional host access (`*://*/*`) | Requested per site when the user enables it, or for all sites only if the user turns on global mode. Needed to set the flag at page start. |

## Remote code

None. All code ships in the package.

## Data usage

The extension collects no user data. Nothing to declare.

## Open points before submission

- Final name and trademark check (see #12)
- Final icon (#18)
- Screenshots (1280×800): popup on a site with Plausible, developer tools, options page
- Developer account registration
