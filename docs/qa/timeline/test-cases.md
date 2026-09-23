# Test cases — Timeline

Source spec: `docs/specs/timeline.md`. Cross-checked against `docs/PRD.md` §7-8 and
`backend/src/{controllers,services,models}/{case,investigation}.*.js`,
`backend/src/utils/time.js`, `data/timeline.json`.

All cases assume `caseId = "047"` unless a case is specifically testing the
`:caseId` path param itself. The single-case backend (`CASE_ID = '047'` in
`backend/src/config/index.js`) ignores `req.params.caseId` entirely in
`case.controller.js#listTimeline` — see TC-13.

## TC-01 — Timeline returns exactly 12 events with the documented shape

- **Covers spec point:** 1
- **Preconditions:** fresh seed
- **Steps / Input:** `GET /api/cases/047/timeline`
- **Expected result:** 200; response body is a JSON array of length 12; every item
  has exactly the fields `id` (matches `/^T\d+$/`), `timestamp`, `time`, `title`,
  `description`, `locationId`, `location`, `personIds` (array), `evidenceIds`
  (array) — per PRD §7 timeline-event example and `data/timeline.json`
- **Priority:** high

## TC-02 — Timestamps are valid, offset-free local ISO strings, and the array is pre-sorted ascending

- **Covers spec point:** 2
- **Preconditions:** fresh seed
- **Steps / Input:** inspect every `timestamp` in TC-01's response, in array order
- **Expected result:** every `timestamp` matches `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/`
  (no `Z`, no `+HH:MM` offset); all parse as valid dates; the array as returned is
  already sorted ascending by `timestamp` (source: `case.model.js#listTimeline`
  does `ORDER BY timestamp, id` — this is not merely "sortable", the API contract
  is that it arrives pre-sorted). First item is `T01` at `1984-03-09T17:30:00`,
  last is `T12` at `1984-03-10T07:30:00`.
- **Priority:** medium

## TC-03 — Marking an event viewed adds it to `eventsViewed`

- **Covers spec point:** 3
- **Preconditions:** fresh seed; `T08` and `T04` not yet viewed
- **Steps / Input:**
  1. `POST /api/cases/047/viewed` `{ "type": "event", "id": "T08" }`
  2. `POST /api/cases/047/viewed` `{ "type": "event", "id": "T04" }`
- **Expected result:** both calls return 200 with the full investigation state
  (per PRD §8 shape: `evidenceViewed`, `suspectsViewed`, `eventsViewed`,
  `connections`, `contradictionsFound`, `theory`, `conclusion`, `progress`); after
  call 1, `eventsViewed === ["T08"]`; after call 2, `eventsViewed === ["T08", "T04"]`
  (first-viewed order, not sorted by id or timestamp)
- **Priority:** high

## TC-04 — Re-viewing the same event is idempotent (added exactly once)

- **Covers spec point:** 3
- **Preconditions:** fresh seed; `eventsViewed` already contains `["T08", "T04"]`
  (state from TC-03)
- **Steps / Input:** `POST /api/cases/047/viewed` `{ "type": "event", "id": "T08" }`
  again
- **Expected result:** 200; `eventsViewed` is still exactly `["T08", "T04"]` — length
  2, no duplicate `"T08"` entry, and its position is unchanged (still first). Source:
  `investigation.model.js#addViewed` uses `INSERT OR IGNORE`, so a repeat view
  cannot duplicate the row or change its `seq`/order.
- **Priority:** high

## TC-05 — `POST /viewed` rejects an unknown event id

- **Covers spec point:** 4
- **Preconditions:** fresh seed; `T99` does not exist in `data/timeline.json`
- **Steps / Input:** `POST /api/cases/047/viewed` `{ "type": "event", "id": "T99" }`
- **Expected result:** exactly `404` (source: `investigation.service.js#recordViewed`
  throws `HttpError(404, 'Nothing with that id in this case')` when
  `cases.listTimeline().some(t => t.id === id)` is false); body is
  `{ "error": "Nothing with that id in this case" }`; `eventsViewed` is unchanged
  (id not added)
- **Priority:** high

## TC-06 — `POST /viewed` rejects a real id from the wrong entity type

- **Covers spec point:** 4 (edge case implied by the type/id pairing in the request shape)
- **Preconditions:** fresh seed; `E014` exists as an evidence id, not a timeline event id
- **Steps / Input:** `POST /api/cases/047/viewed` `{ "type": "event", "id": "E014" }`
- **Expected result:** exactly `404`, body `{ "error": "Nothing with that id in this case" }`
  (the `event` branch only checks `cases.listTimeline()` ids, so an evidence id
  passed with `type: "event"` is rejected the same way as a wholly unknown id);
  `eventsViewed` unchanged
- **Priority:** medium

## TC-07 — `POST /viewed` rejects a malformed body

- **Covers spec point:** 4 (edge case: missing/invalid fields, implied by the request
  validation the spec's endpoint signature depends on)
- **Preconditions:** fresh seed
- **Steps / Input:** three separate calls to `POST /api/cases/047/viewed`:
  (a) `{ "type": "event" }` (missing `id`)
  (b) `{ "id": "T08" }` (missing `type`)
  (c) `{ "type": "location", "id": "T08" }` (invalid `type` — not one of
  `evidence`/`suspect`/`event`)
- **Expected result:** all three return exactly `400` with body
  `{ "error": "Expected { type: \"evidence\" | \"suspect\" | \"event\", id }" }`
  (source: `investigation.service.js#recordViewed`); `eventsViewed` unchanged after
  all three
- **Priority:** medium

## TC-08 — Event with null `locationId`

- **Covers spec point:** 5
- **Preconditions:** fresh seed
- **Steps / Input:** inspect all 12 events from TC-01 (or `data/timeline.json`
  directly) for any with `locationId === null`
- **Expected result:** confirmed against current seed data (`data/timeline.json`):
  all 12 events (`T01`–`T12`) have a non-null `locationId`. This case is **N/A**
  against the current seed — record it as N/A with that observation, do not
  fabricate a null-location event. If a future reseed introduces a null
  `locationId`, re-run this as a UI case: open that event's detail view and
  confirm no crash / no unhandled exception, and that the location field renders
  a placeholder rather than `null` or `undefined` literal text.
- **Priority:** low

## TC-09 — Event with empty `personIds` renders without crashing (UI)

- **Covers spec point:** 5 (adjacent edge case: seed data has a real instance of an
  empty relational array on a timeline event, which exercises the same
  "renders without crashing" requirement the spec calls out for null `locationId`)
- **Preconditions:** fresh seed; UI running against the real API
- **Steps / Input:** in the browser, open the Timeline screen for case 047 and open
  the detail view for `T10` ("Camera recorder resumes"), whose `personIds` is `[]`
  in `data/timeline.json`
- **Expected result:** UI case — detail view renders without a crash or blank
  screen; the people/suspects section shows an empty state (e.g. no chips /
  "no one identified" — whatever the component's documented empty-state is), not
  a JS error, `undefined` text, or a broken layout
- **Priority:** low

## TC-10 — Viewing all 12 events moves progress by exactly one full ratio-weight

- **Covers spec point:** 6
- **Preconditions:** fresh seed; nothing yet viewed and no contradictions found
  (`evidenceViewed: []`, `suspectsViewed: []`, `eventsViewed: []`,
  `contradictionsFound: []`)
- **Steps / Input:**
  1. `GET /api/cases/047/investigation` — record `progress`
  2. `POST /api/cases/047/viewed` for each of `T01`..`T12` in turn
  3. `GET /api/cases/047/investigation` — record `progress`
- **Expected result:** step 1 `progress === 0`. After step 2, step 3's `progress`
  is exactly `25`. Derivation from `investigation.service.js#calculateProgress`:
  with evidence/suspect/contradiction ratios all `0` and the event ratio at
  `12/12 = 1`, `parts = [0, 0, 1, 0]`, average `= 0.25`,
  `Math.round(100 * 0.25) = 25`. This is an exact, deterministic value, not a
  "does not decrease" check.
- **Priority:** high

## TC-11 — Progress increases monotonically as events are viewed one at a time

- **Covers spec point:** 6
- **Preconditions:** fresh seed; nothing yet viewed
- **Steps / Input:** `GET /investigation` after viewing 0, then 6, then 12 events
  (via `POST /viewed`, one call per event)
- **Expected result:** with all other three ratios held at `0` throughout,
  `progress` is `0`, then `13` (source: `events` ratio `6/12 = 0.5` →
  `parts = [0,0,0.5,0]`, average `0.125`, `Math.round(12.5) = 13`), then `25`
  (per TC-10) — non-decreasing at every step, and never reaches `100` from this
  ratio alone since the other three ratios (evidence, suspects, contradictions)
  are untouched
- **Priority:** medium

## TC-12 — `progress` is an integer and never exceeds 100

- **Covers spec point:** 6 (edge case implied by "integer percentage" framing in
  PRD §8, and by the four-ratio average formula)
- **Preconditions:** fresh seed
- **Steps / Input:** `GET /api/cases/047/investigation` at any point in the flow
- **Expected result:** `progress` is a whole number (`Number.isInteger(progress)`
  is true), `0 <= progress <= 100`
- **Priority:** low

## TC-13 — `:caseId` path segment is not validated against the case (documented gap)

- **Covers spec point:** none numbered — flagging an ambiguity between the spec's
  endpoint shape (`GET /api/cases/:caseId/timeline`, implying `:caseId` is
  meaningful) and the actual implementation
- **Preconditions:** fresh seed
- **Steps / Input:** `GET /api/cases/999/timeline` and `GET /api/cases/anything/timeline`
- **Expected result:** **ambiguous — verify actual behavior, don't assume.** Source
  inspection shows `case.controller.js#listTimeline` is `(_req, res) =>
  res.json(service.listTimeline())` — it never reads `req.params.caseId`, and
  `CASE_ID` is hardcoded to `'047'` in `backend/src/config/index.js`. As written,
  both calls above are expected to return 200 with the same 12 events as
  `/api/cases/047/timeline`, not a 404, because this is a single-case app. Confirm
  this is the intended behavior (matches PRD's "one fictional case" framing) rather
  than an oversight before treating a mismatched `:caseId` returning 200 as a pass.
- **Priority:** low

---
Total: 13 cases (11 API, 2 UI). High priority: 4.
