# MysteryDesk: Case #047, The Missing Prototype

A full-stack detective investigation game. React frontend, Express + SQLite backend, all case data served from the API.

## Run

```bash
cd backend && npm install && npm run dev     # API on :4000
cd frontend && npm install && npm run dev    # UI on :5173 (proxies /api to :4000)
```

Requires Node 22.13+ (uses the built-in `node:sqlite`).

## Layout

- `data/` — case content (case, locations, suspects, evidence, timeline, statements) plus `solution.json`, which is backend-only and never served.
- `backend/` — Express REST API, SQLite database (`storage/`), investigation logic.
- `frontend/` — Vite + React UI.
- `docs/PRD.md` — how it works (API shapes, data model, rules). `CLAUDE.md` holds the project rules and known gaps; `.claude/skills/mysterydesk-dev-rules/SKILL.md` is the checklist.

The case data is re-seeded into SQLite on every server start. Player state (viewed items, connections, contradictions, theory, conclusion) persists.

## Setting

1984. Halden Dynamics, Ridgeway Industrial Park. Keycards, CCTV recorders, modem dial-in and payphone records. The UI is a 1970s/80s black-and-white noir.
