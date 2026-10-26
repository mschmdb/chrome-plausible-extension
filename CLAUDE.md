# Projektregeln

Repo und Extension werden öffentlich. Jede Änderung muss dafür taugen.

## Pflicht vor jedem Merge

- `/codex-review` über den Diff laufen lassen. Findings beheben oder im PR begründen.
- `pnpm lint`, `pnpm check`, `pnpm test` grün
- TDD: erst Test, dann Code

## Public-Hygiene

- Keine Secrets, Tokens, privaten Pfade, E-Mails oder internen Notizen in Code, Commits, Issues
- Keine Telemetrie, keine Remote-Requests
- Kein `console.log` im Commit
- Permissions minimal halten. Jede neue Permission braucht eine Begründung im PR.
- UI barrierefrei nach WCAG 2.2 AA
