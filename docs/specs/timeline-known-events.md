# SPEC — Timeline

## What it does

The Timeline (`/case/:caseId/timeline`) shows the case's reconstruction, but only the
events the player can know about: events with no exhibit behind them, or events whose
evidence the player holds. Each event has a detail view; opening it marks it viewed
and may show related statements. Evidence spans several days, so the timeline is not
one evening end to end.

## Endpoints involved

```
GET  /api/cases/:caseId/timeline
POST /api/cases/:caseId/viewed     { type: "event", id }
GET  /api/cases/:caseId/investigation
POST /api/cases/:caseId/reset
```

## What "correct" means

1. `GET /timeline` returns events with `id` (`T\d+`), `timestamp`, `time` (`HH:MM`),
   `title`, `description`, `locationId`, `location`, `personIds`, `evidenceIds`.
   `timestamp` values are local ISO strings without a timezone offset.
2. On a fresh investigation the timeline contains only events that need no exhibit
   the player lacks; it has fewer events than the case's `eventCount` (verify by
   comparing to `GET /cases/:caseId`), and grows as evidence is found.
3. `evidenceIds` on any event lists only exhibits the player has unlocked.
4. Events are orderable by `timestamp`; the UI shows them in chronological order.
5. An event with a null `locationId` renders without crashing.
6. `POST /viewed { type: "event", id }` adds the id to `eventsViewed` once, in
   first-viewed order. An unknown event id (`T99`) is rejected.
7. `eventsViewed` feeds `investigation.progress` (average of four ratios).
8. In the browser: the timeline loads with a loading state, then events; opening
   one shows its detail and marks it viewed (persisting across refresh); an empty
   state is shown if no events are known; a failed load shows an error with retry.

## Out of scope

The scrubber's animation; layout at other widths.
