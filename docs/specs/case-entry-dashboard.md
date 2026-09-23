# SPEC — Case Entry & Dashboard

## What it does

The player opens the app, reads the Case #047 briefing (Case Entry), then lands on the
Dashboard, which shows case status, objectives, investigation progress and the most
recently discovered leads. There is no login and no case selector — `:caseId` is always
`047`.

## Endpoints involved

```
GET /api/cases/:caseId                    case briefing (Case Entry + Dashboard header)
GET /api/cases/:caseId/investigation       progress %, viewed/connections/contradictions counts
GET /api/cases/:caseId/evidence            latest leads list (Dashboard)
```

## Inputs

- `caseId` route param — the only input. No request body, no query params, no auth.

## What "correct" means

1. `GET /api/cases/047` returns 200 with `id`, `title`, `status`, `classification`,
   `company`, `site`, `openedAt`, `incidentWindow`, `summary`, `briefing[]`,
   `objectives[]`, `suspectCount` (5), `evidenceCount` (18), `locationCount` (6),
   `eventCount` (12), and a `locations[]` array.
2. `GET /api/cases/<anything other than 047>` returns 404 — e.g. `048`, `47`, `abc`.
   No route ever returns `solution.json` data.
3. `GET /api/cases/047/investigation` on a fresh (never-played) case returns
   `progress: 0`, empty `evidenceViewed`/`suspectsViewed`/`eventsViewed`/`connections`/
   `contradictionsFound`, `theory: ""`, `conclusion: null`.
4. `progress` is an integer 0–100, the average of four ratios (evidence viewed,
   suspects viewed, events viewed, contradictions found) — never decreases when new
   items are viewed, only increases or stays flat.
5. Refreshing the page (re-fetching case + investigation) after viewing items does not
   lose any previously recorded state — GET is idempotent and non-mutating.
6. The Dashboard never hardcodes a suspect name, evidence title or count in the
   frontend — every number on screen traces back to one of the three GET responses
   above (per CLAUDE.md's "no frontend mockup" rule).
7. No accounts, no login screen, no `Authorization` header anywhere in this flow.

## Out of scope

Editing case data, multi-case support, any form of authentication.
