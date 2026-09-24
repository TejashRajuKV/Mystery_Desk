# Test cases: Timeline (known events only)

Spec: `docs/specs/timeline-known-events.md`. Written against the five-case game (CLAUDE.md API list). Nothing here was executed.

## Conventions and ground truth used by these cases

- Base URL is `/api` (through the Vite proxy on :5173, or the backend on :4000). All investigation calls are scoped `/api/cases/:caseId/...`. Valid case ids are `047`, `048`, `049`, `050`, `051`.
- "Fresh" means `POST /api/cases/<id>/reset` was just called (or the SQLite file was deleted), so `unlockedEvidence` is `[]` (`defaultUnlockedEvidence` is `[]` in all five cases) and `eventsViewed` is `[]`.
- Known-event rule, taken from `investigation.service.js` `knownTimeline()`: an event is listed if its seed `evidenceIds` is empty, or at least one of its exhibits is unlocked. Each listed event's `evidenceIds` is then filtered to unlocked exhibits only. Events come back ordered by `timestamp`, then `id`.
- Seed facts the cases rely on (from `data/cases/*/timeline.json`, not the answer key):
  - `eventCount` (total seed events) is 047: 12, 048: 11, 049: 12, 050: 9, 051: 11. The pass criterion is always equality with the `eventCount` returned by `GET /api/cases/:caseId`; the numbers are given so the runner can sanity-check.
  - In 047, 048, 050 and 051 every event has at least one exhibit, so a fresh timeline is `[]`.
  - Case 049 is the workhorse. It has exactly one event with no exhibit (`T03`, 1984-04-19T17:30:00, `locationId` L01, `personIds` ["S01"], `evidenceIds` []). It spans 1984-04-19 to 1984-04-24. `T05` and `T06` have `locationId: null`. `T09` has `personIds: []`.
  - 049 event to exhibit map used below: T10 = [E005, E014], T11 = [E005, E007], T12 = [E001, E002], T09 = [E004], T05 = [E012], T06 = [E013].
  - 049 unlock routes used below: `POST /file/F2/read` unlocks E002. `POST /file/F3/read` unlocks E015, which is on no timeline event. `POST /travel {"locationId":"L01"}` then `POST /places/L01/search {"spotId":"L01-staff"}` unlocks E005, and spot `L01-patrol` unlocks E007. `POST /travel {"locationId":"L03"}` then spot `L03-timelock` unlocks E004.
- State names used in preconditions:
  - **049-FRESH**: case 049 just reset.
  - **049-F2**: 049-FRESH, then `POST /api/cases/049/file/F2/read`.
  - **049-L01**: 049-F2, then `POST /api/cases/049/travel {"locationId":"L01"}`, then `POST /api/cases/049/places/L01/search {"spotId":"L01-staff"}`, then `POST /api/cases/049/places/L01/search {"spotId":"L01-patrol"}`.
- Ambiguities the runner should note in the report rather than resolve silently:
  - Spec point 6 says an unknown event id is "rejected" without a status. The source (`recordViewed`) returns 404 `{ "error": "Nothing with that id in this case" }`, and the PRD says 404 for unknown. These cases expect 404.
  - Spec point 8's "loading state" and "error with retry" are provided by the case-wide shell (`Layout`: "PULLING THE FILE" and "FILE UNAVAILABLE" with a TRY AGAIN button), not by the Timeline page itself. The UI cases expect that.
  - The `T99` example in the spec does not exist in any case; the locked-but-real event case (TC-15) is a separate, stricter check.

---

## TC-01 — Known event has the full field set (fresh 049)

- **Covers spec point:** 1
- **Preconditions:** 049-FRESH
- **Steps / Input:** `GET /api/cases/049/timeline`
- **Expected result:** Status 200. Body is a bare JSON array (not wrapped in `{ data: ... }`). It contains an object with `id` equal to `"T03"` that has all of these keys: `id`, `timestamp`, `time`, `title`, `description`, `locationId`, `location`, `personIds`, `evidenceIds`. Values: `id` matches `^T\d+$`; `timestamp` is `"1984-04-19T17:30:00"`; `time` is `"17:30"`; `title` is `"The branch closes for Easter"`; `description` is `"The manager locks up for the long weekend."`; `locationId` is `"L01"`; `location` is `"The Banking Hall"`; `personIds` is `["S01"]`; `evidenceIds` is `[]`. Extra keys are allowed.
- **Priority:** high

## TC-02 — Fresh 049 timeline holds only the event with no exhibit

- **Covers spec point:** 2
- **Preconditions:** 049-FRESH
- **Steps / Input:** `GET /api/cases/049/timeline` and `GET /api/cases/049`
- **Expected result:** The timeline array is exactly one element with `id` `"T03"`. `GET /api/cases/049` returns `eventCount` `12`. Timeline length (1) is strictly less than `eventCount` (12). No event other than T03 appears (in particular T01, T02, T04 to T12 are absent).
- **Priority:** high

## TC-03 — Fresh timelines of the other four cases are empty and below eventCount

- **Covers spec point:** 2
- **Preconditions:** For each of 047, 048, 050, 051, in turn: fresh (reset).
- **Steps / Input:** For each `<id>`: `GET /api/cases/<id>/timeline`, then `GET /api/cases/<id>`.
- **Expected result:** Each timeline response is status 200 with body `[]`. Each `GET /api/cases/<id>` has `eventCount` of 12, 11, 9, 11 respectively (047, 048, 050, 051), and timeline length (0) is strictly less than it in every case.
- **Priority:** high

## TC-04 — Timeline grows when evidence is found (file page)

- **Covers spec point:** 2, 3
- **Preconditions:** 049-FRESH
- **Steps / Input:** 1) `POST /api/cases/049/file/F2/read`. 2) `GET /api/cases/049/timeline`.
- **Expected result:** Step 1 returns 200. Step 2 returns exactly two events, in this order: `T03`, `T12`. `T03.evidenceIds` is `[]`. `T12.evidenceIds` is exactly `["E002"]` (E001 is a seed exhibit of T12 but is still locked, so it must be absent).
- **Priority:** high

## TC-05 — Unlocking an exhibit that no event cites adds no event

- **Covers spec point:** 2
- **Preconditions:** 049-FRESH
- **Steps / Input:** 1) `POST /api/cases/049/file/F3/read` (unlocks E015). 2) `GET /api/cases/049/investigation`. 3) `GET /api/cases/049/timeline`.
- **Expected result:** Step 2: `unlockedEvidence` contains `"E015"`. Step 3: the timeline is still exactly `[T03]` (length 1).
- **Priority:** medium

## TC-06 — Timeline grows again when evidence is found at a place

- **Covers spec point:** 2, 3
- **Preconditions:** 049-L01 (F2 read, at L01, both L01-staff and L01-patrol searched)
- **Steps / Input:** `GET /api/cases/049/timeline`
- **Expected result:** Exactly four events with ids `["T03","T10","T11","T12"]` in that order. `T10.evidenceIds` is `["E005"]` (E014 is locked, so absent). `T11.evidenceIds` is `["E005","E007"]`. `T12.evidenceIds` is `["E002"]`. `T03.evidenceIds` is `[]`. Events T01, T02, T04 to T09 are absent.
- **Priority:** high

## TC-07 — evidenceIds never list a locked exhibit (invariant)

- **Covers spec point:** 3
- **Preconditions:** Run on each of these states: 049-FRESH, 049-F2, 049-L01.
- **Steps / Input:** `GET /api/cases/049/timeline` and `GET /api/cases/049/investigation`; also `GET /api/cases/049/evidence`.
- **Expected result:** For every event in the timeline, every id in `evidenceIds` is present in `investigation.unlockedEvidence` and also appears as an `id` in the `GET /evidence` list. The union of all `evidenceIds` across the timeline is a subset of `unlockedEvidence`. Additionally, in 049-L01 the id `E001` and the id `E014` appear in no event's `evidenceIds`.
- **Priority:** high

## TC-08 — Events come back in chronological order across several days

- **Covers spec point:** 4, and the "several days" statement in "What it does"
- **Preconditions:** 049-L01
- **Steps / Input:** `GET /api/cases/049/timeline`
- **Expected result:** Comparing the `timestamp` strings of consecutive array elements, each is lexicographically less than or equal to the next (array is sorted ascending as returned, no client sort needed). The timestamps are `1984-04-19T17:30:00` (T03), `1984-04-22T07:00:00` (T10), `1984-04-22T10:02:00` (T11), `1984-04-24T09:05:00` (T12), so the set of distinct dates (first 10 chars) has 3 or more values, i.e. not one evening.
- **Priority:** high

## TC-09 — Timestamps are local ISO strings with no timezone

- **Covers spec point:** 1
- **Preconditions:** 049-L01
- **Steps / Input:** `GET /api/cases/049/timeline`
- **Expected result:** For every event, `timestamp` matches the regex `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$` (no `Z`, no `+hh:mm`/`-hh:mm` suffix, no milliseconds). For every event, `time` matches `^\d{2}:\d{2}$` and equals characters 11 to 15 of `timestamp` (T03 `"17:30"`, T10 `"07:00"`, T11 `"10:02"`, T12 `"09:05"`).
- **Priority:** medium

## TC-10 — Event with a null locationId is returned intact (API)

- **Covers spec point:** 5
- **Preconditions:** 049 with exhibit E012 unlocked so that `T05` is known (alternatively E013 for `T06`). E012 comes from spot `L06-sister`, which requires flag `lead.sister` (set by an interview with S04) and `threatened.S04` not true; E013 comes from `L06-car`, which requires `lead.car`. The runner must derive the interview path from `GET /api/cases/049/dialogue/S04` and record it in the report. If it cannot be reached, mark this case blocked, not passed.
- **Steps / Input:** `GET /api/cases/049/timeline`
- **Expected result:** Status 200 for the whole list (no 500). The `T05` object (`"A car leaves Millbrook"`, timestamp `"1984-04-21T20:30:00"`, time `"20:30"`) has `locationId` equal to JSON `null` and `location` equal to JSON `null` (not `undefined`, not the string `"null"`), `personIds` `["S04"]`, `evidenceIds` `["E012"]`. All other fields are present.
- **Priority:** high

## TC-11 — Viewing a known event records it and returns the whole investigation

- **Covers spec point:** 6
- **Preconditions:** 049-FRESH
- **Steps / Input:** `POST /api/cases/049/viewed` with body `{"type":"event","id":"T03"}`
- **Expected result:** Status 200. Body is the whole investigation object (not `{ ok: true }`): it has the keys `evidenceViewed`, `suspectsViewed`, `eventsViewed`, `connections`, `contradictionsFound`, `unlockedEvidence`, `progress`. `eventsViewed` equals `["T03"]`. A follow-up `GET /api/cases/049/investigation` also shows `eventsViewed` `["T03"]`.
- **Priority:** high

## TC-12 — Viewing the same event twice records it once

- **Covers spec point:** 6
- **Preconditions:** 049-FRESH
- **Steps / Input:** Send `POST /api/cases/049/viewed {"type":"event","id":"T03"}` three times in a row.
- **Expected result:** All three return 200. After each response, `eventsViewed` is exactly `["T03"]` (length 1). A `GET /api/cases/049/investigation` afterwards shows `eventsViewed` `["T03"]`.
- **Priority:** high

## TC-13 — eventsViewed is in first-viewed order

- **Covers spec point:** 6
- **Preconditions:** 049-F2 (T03 and T12 both known)
- **Steps / Input:** 1) `POST /api/cases/049/viewed {"type":"event","id":"T12"}`. 2) `POST /api/cases/049/viewed {"type":"event","id":"T03"}`. 3) `POST /api/cases/049/viewed {"type":"event","id":"T12"}` again.
- **Expected result:** After step 2 the response `eventsViewed` is `["T12","T03"]` (view order, not timestamp order). After step 3 it is still `["T12","T03"]`.
- **Priority:** high

## TC-14 — Unknown event id is rejected with 404 and changes nothing

- **Covers spec point:** 6
- **Preconditions:** 049-FRESH
- **Steps / Input:** Three calls to `POST /api/cases/049/viewed`: body `{"type":"event","id":"T99"}`; body `{"type":"event","id":"X1"}`; body `{"type":"event","id":""}`. Then `GET /api/cases/049/investigation`.
- **Expected result:** Each POST returns status 404 with body exactly `{"error":"Nothing with that id in this case"}`. The GET shows `eventsViewed` equal to `[]` and `progress` equal to `0`.
- **Priority:** high

## TC-15 — A real but not-yet-known event is rejected like an unknown one

- **Covers spec point:** 2, 6 (the player must not be able to act on an event they cannot see)
- **Preconditions:** 049-FRESH (T12 exists in the seed but its exhibits E001 and E002 are locked, so it is not in the timeline)
- **Steps / Input:** 1) `POST /api/cases/049/viewed {"type":"event","id":"T12"}`. 2) `GET /api/cases/049/investigation`. 3) `POST /api/cases/049/file/F2/read`. 4) `POST /api/cases/049/viewed {"type":"event","id":"T12"}`.
- **Expected result:** Step 1: status 404, body `{"error":"Nothing with that id in this case"}` (identical to TC-14, so a locked event cannot be told apart from a nonexistent one). Step 2: `eventsViewed` is `[]`. Step 4: status 200 and `eventsViewed` is `["T12"]`.
- **Priority:** high

## TC-16 — Malformed viewed bodies are 400

- **Covers spec point:** 6
- **Preconditions:** 049-FRESH
- **Steps / Input:** Each of these to `POST /api/cases/049/viewed`: (a) `{"type":"event"}` (no id); (b) `{"id":"T03"}` (no type); (c) `{"type":"event","id":3}` (id not a string); (d) `{"type":"page","id":"T03"}` (type not one of evidence/suspect/event); (e) empty body `{}`; (f) no body / no Content-Type.
- **Expected result:** Every one returns status 400 with body exactly `{"error":"Expected { type: \"evidence\" | \"suspect\" | \"event\", id }"}`. Afterwards `GET /api/cases/049/investigation` shows `eventsViewed` `[]`.
- **Priority:** medium

## TC-17 — GET timeline and GET investigation never mark anything viewed

- **Covers spec point:** 6 (CLAUDE.md: "GET never changes state")
- **Preconditions:** 049-L01, `eventsViewed` `[]`
- **Steps / Input:** `GET /api/cases/049/timeline` three times, then `GET /api/cases/049/investigation`.
- **Expected result:** `eventsViewed` is `[]` and `progress` is `0` (nothing viewed yet; unlocking exhibits does not raise it).
- **Priority:** medium

## TC-18 — Progress counts events viewed against all seed events, not just known ones

- **Covers spec point:** 7
- **Preconditions:** 049-FRESH. Nothing else viewed; no contradictions found.
- **Steps / Input:** `POST /api/cases/049/viewed {"type":"event","id":"T03"}`
- **Expected result:** Response `progress` is exactly `2` (event ratio 1/12; evidence, suspect and contradiction ratios are 0; `Math.round(100 * (1/12) / 4)` = 2). It must not be 25, which would result if the denominator were the 1 known event.
- **Priority:** high

## TC-19 — Progress rises with each new event viewed

- **Covers spec point:** 7
- **Preconditions:** 049-F2, nothing viewed
- **Steps / Input:** 1) `GET /api/cases/049/investigation`. 2) `POST /api/cases/049/viewed {"type":"event","id":"T03"}`. 3) `POST /api/cases/049/viewed {"type":"event","id":"T12"}`. 4) Repeat step 3.
- **Expected result:** Step 1: `progress` is `0` (unlocking E002 without viewing it adds nothing). Step 2: `progress` is `2`. Step 3: `progress` is `4` (`Math.round(100 * (2/12) / 4)` = round(4.17)). Step 4: `progress` stays `4`.
- **Priority:** high

## TC-20 — Reset clears viewed events and shrinks the timeline back

- **Covers spec point:** 2, 6, 7
- **Preconditions:** 049-F2 with `T03` and `T12` viewed (progress 4)
- **Steps / Input:** 1) `POST /api/cases/049/reset`. 2) `GET /api/cases/049/investigation`. 3) `GET /api/cases/049/timeline`.
- **Expected result:** Step 1 returns 200 with `eventsViewed` `[]`, `unlockedEvidence` `[]` and `progress` `0`. Step 2 agrees. Step 3 is exactly `[T03]` (T12 is gone because E002 is locked again).
- **Priority:** high

## TC-21 — Viewed events are per case

- **Covers spec point:** 6
- **Preconditions:** 049-FRESH; 048 fresh
- **Steps / Input:** 1) `POST /api/cases/049/viewed {"type":"event","id":"T03"}`. 2) `GET /api/cases/048/investigation`. 3) `GET /api/cases/048/timeline`. 4) `POST /api/cases/048/viewed {"type":"event","id":"T03"}`.
- **Expected result:** Step 2: `eventsViewed` is `[]`. Step 3: `[]`. Step 4: status 404 (048's T03 exists in the seed but is not known on a fresh 048), body `{"error":"Nothing with that id in this case"}`. `GET /api/cases/049/investigation` still shows `eventsViewed` `["T03"]`.
- **Priority:** medium

## TC-22 — Unknown case id is a 404 for the timeline endpoints

- **Covers spec point:** (endpoint scoping; CLAUDE.md `:caseId` must be a real case)
- **Preconditions:** none
- **Steps / Input:** `GET /api/cases/999/timeline`; `POST /api/cases/999/viewed {"type":"event","id":"T03"}`; `GET /api/cases/999/investigation`.
- **Expected result:** Each returns status 404 with body exactly `{"error":"Case not found"}`.
- **Priority:** low

---

## UI cases (need a browser; start with the frontend on :5173 and the backend running)
