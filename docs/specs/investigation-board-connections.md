# SPEC — Investigation Board (Connections)

## What it does

The player pins evidence, suspects, locations and events to a board, drags them, and
draws connections between two cards. The backend stores and validates each
connection; it does not say whether a link is "right" (only the final conclusion
check does that). Board *layout* (pin positions) is per-viewer `localStorage` state,
not backend state — connections themselves are backend state.

## Endpoints involved

```
GET    /api/cases/:caseId/connections
POST   /api/cases/:caseId/connections     { source, target, relationship? }
DELETE /api/connections/:connectionId
```

## Inputs

- `POST` body: `{ "source": "<E|S|T|L id>", "target": "<E|S|T|L id>",
  "relationship"?: "linked_to" }` — `relationship` defaults to `"linked_to"` when
  omitted (the only relationship that exists today).
- `DELETE` path param: `connectionId` (e.g. `C07`).

## What "correct" means

1. `POST /connections` with two valid, distinct IDs (any mix of E/S/T/L) returns
   201 with `{ id: "C0N", source, target, relationship: "linked_to" }`.
2. `POST /connections` with an unknown ID on either side returns 422 (`validateConnection`
   rejects unknown IDs per PRD §7).
3. `POST /connections` with `source === target` (a self-link) returns 422.
4. `POST /connections` with a pair that already exists — in **either** direction
   (`A→B` when `B→A` already exists) — returns 422 as a duplicate.
5. `GET /connections` reflects every successfully created connection and none of
   the rejected attempts.
6. `DELETE /connections/:id` on an existing connection returns 204 and it no longer
   appears in a subsequent `GET /connections`.
7. `DELETE /connections/:id` on an unknown id returns 404.
8. Connections persist across a backend restart (stored in SQLite, not memory) —
   verify by re-fetching after a server restart in the same test run.
9. Board pin *positions* are never sent to or read from the backend — that state
   lives only in `localStorage` (a spec/behavioral note, not an API check).

## Out of scope

Relationship types other than `linked_to`; connection editing (only create/delete
exist).
