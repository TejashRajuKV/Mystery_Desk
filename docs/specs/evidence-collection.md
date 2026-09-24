# SPEC — Evidence Room and Evidence Locking

## What it does

The Evidence Room (`/case/:caseId/evidence`) lists the exhibits the player has
collected and lets them open one for its details. Evidence is locked until it is
found (a search spot, an interview, or a file page's attachments). Locked evidence
does not exist as far as the player can tell: it is left out of the list, out of the
timeline's evidence references, and its detail is a 404. Opening an exhibit marks it
viewed, which feeds progress.

## Endpoints involved

```
GET  /api/cases/:caseId/evidence            GET /api/cases/:caseId/evidence/:id
POST /api/cases/:caseId/viewed              { type: "evidence", id }
GET  /api/cases/:caseId/investigation
POST /api/cases/:caseId/reset
```

## What "correct" means

1. On a fresh investigation `GET /evidence` returns an empty list (nothing is
   pre-unlocked) and `GET /evidence/:id` for a real exhibit id (e.g. E014 on 047) is
   a 404 `{ error }`.
2. After an exhibit is unlocked (found in the field), it appears in `GET /evidence`
   with `id` (`E\d+`), `type`, `title`, `timestamp` (or null), `time`, `locationId`
   (or null), `location`, `personIds`, `people`, `summary`. `locationId` and
   `timestamp` may be null and the UI must cope.
3. `GET /evidence/:id` for an unlocked exhibit adds `details`, `source`, and
   `relatedEvidenceIds` containing only unlocked ids.
4. `POST /viewed { type: "evidence", id }` adds the id to `evidenceViewed` once, in
   first-viewed order; viewing again does not duplicate. Viewing a locked or
   unknown id is rejected (not silently accepted).
5. `POST /viewed` with a bad `type` or missing `id` is a 400.
6. No evidence payload contains `facts` or any solution field.
7. `investigation.progress` is an integer 0–100 that increases when evidence is
   viewed.
8. In the browser the room shows an empty state on a fresh case (not a spinner), and
   the list grows as evidence is found; each card's title matches the API; opening
   a card shows details and source and counts as viewed (survives refresh).
9. Type filters (if present) narrow the list to that type and can be cleared.
10. Loading the room, then a failing request (backend down) shows an error state
    with retry.

## Out of scope

Card styling; sort order beyond what the API returns.
