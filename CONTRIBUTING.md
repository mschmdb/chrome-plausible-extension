# Contributing

Thanks for helping. Please open an issue before larger changes.

## Workflow

1. Fork and create a branch from `main`
2. Write a failing test first, then the code
3. Run `pnpm lint`, `pnpm check` and `pnpm test`
4. Open a pull request and fill in the template

## Rules

- Every pull request gets an independent code review (Codex review) before merge
- No telemetry, analytics or remote requests
- Keep permissions minimal. Explain every new permission in the pull request.
- UI must meet WCAG 2.2 AA: keyboard, screen reader, contrast
- No `console.log` in committed code
- Commit messages in imperative mood: "Add toggle", not "Added toggle"

## Security

Do not report vulnerabilities in public issues. See [SECURITY.md](SECURITY.md).
