# SPEC — Evidence Room

## What it does

The player browses all 18 evidence items (keycard logs, CCTV, phone records,
documents, forensic reports), filters by type, and opens a detail view for each.
Opening a detail view marks that evidence as "viewed" in the player's investigation
state, which feeds the Dashboard's progress bar.

## Endpoints involved

```
GET  /api/cases/:caseId/evidence     list (id, type, title, timestamp, time,
                                      locationId, location, personIds, people, summary)
GET  /api/evidence/:evidenceId       detail (adds details, source, relatedEvidenceIds)
POST /api/cases/:caseId/viewed       { type: "evidence", id: "E014" }
```

## Inputs

- Filter: evidence `type` (client-side filter over the already-fetched list — no
  server query param required).
- `POST /viewed` body: `{ "type": "evidence", "id": "<evidence id>" }`.

## What "correct" means

1. `GET /cases/047/evidence` returns exactly 18 items; every item has a non-null
   `id` matching `E\d+` and a `type`.
2. `GET /evidence/:id` for a valid ID returns 200 with the list fields plus
   `details`, `source`, `relatedEvidenceIds`; for an unknown ID (e.g. `E999`)
   returns 404.
3. `facts` is never present in any evidence response (backend-only per PRD §6) —
   this is a security/leak check, not just a shape check.
4. `POST /viewed` with `{ type: "evidence", id: "E014" }` returns the full
   investigation state and `evidenceViewed` includes `"E014"` exactly once, even if
   the same evidence is viewed twice (no duplicates).
5. `POST /viewed` with an unknown evidence id, a missing `type`, or a missing `id`
   is rejected (400/404, not a silent 200 that corrupts state).
6. Viewing evidence increases `investigation.progress` (or leaves it the same if
   already viewed) — it never decreases it.
7. `locationId` and `timestamp` may legitimately be `null` on some items (e.g. a
   bank letter) — the UI must render that as an empty/omitted field, not "null" or
   a crash.
8. No evidence title, summary or timestamp is hardcoded into any `.jsx` file —
   everything comes from the GET response.

## Out of scope

Editing or deleting evidence; uploading new evidence; evidence not in `data/evidence.json`.
