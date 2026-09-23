# SPEC — Timeline

## What it does

A scrubbable, minute-by-minute reconstruction of the 12 events of the night, each
with a detail view. Opening an event's detail marks it viewed, feeding progress.
Evidence spans several days (a loan notice from 5 March, phone records from 8
March), so the timeline is not a single evening end-to-end — only the incident
window events are the "night of the theft."

## Endpoints involved

```
GET  /api/cases/:caseId/timeline
POST /api/cases/:caseId/viewed     { type: "event", id: "T08" }
```

## Inputs

- `POST /viewed` body: `{ "type": "event", "id": "<timeline event id>" }`.

## What "correct" means

1. `GET /timeline` returns exactly 12 events, each with `id` (`T\d+`), `timestamp`,
   `time` (`HH:MM`), `title`, `description`, `locationId`, `location`, `personIds`,
   `evidenceIds`.
2. Events are orderable by `timestamp` and the API's `timestamp` values are valid
   ISO local strings with no timezone offset (per PRD §4).
3. `POST /viewed` with `{ type: "event", id: "T08" }` adds `"T08"` to
   `eventsViewed` exactly once, in first-viewed order (PRD §8: viewed lists are in
   view order, used by the Dashboard to show latest leads).
4. `POST /viewed` with an unknown event id (`T99`) is rejected, not silently
   accepted.
5. An event whose `locationId` is null still renders without crashing (some events
   may not be tied to a physical location — verify against actual seed data;
   if all 12 have a location, this case is N/A and should be noted as such in
   results, not fabricated).
6. `eventsViewed` contributes one of the four equally-weighted ratios in
   `investigation.progress` (PRD §8) — viewing all 12 events measurably moves
   progress toward, but not necessarily to, 100% (the other three ratios matter
   too).

## Out of scope

Editing the timeline; adding player-created events.
