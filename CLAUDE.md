# Project rules for AI agents

This repo and the extension are public. Every change must be fit for that.

## Before every merge

- Run `/codex-review` on the diff. Fix findings or justify them in the PR.
- `pnpm lint`, `pnpm check`, `pnpm test` pass
- TDD: test first, then code

## Public hygiene

- English for code, docs, commits, issues and PRs
- No secrets, tokens, private paths, email addresses or internal notes in code, commits or issues
- No telemetry, no remote requests
- No `console.log` in commits
- Minimal permissions. Every new permission needs a reason in the PR.
- UI meets WCAG 2.2 AA
- Follow CONTRIBUTING.md and SECURITY.md
