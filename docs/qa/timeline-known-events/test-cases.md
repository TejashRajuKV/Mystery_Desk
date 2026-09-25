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

## Additional cases (added 2026-09-24)

Cross-checked against the current backend source (`investigation.service.js`, `field.service.js`, `case.service.js`) and the frontend `pages/Timeline/Timeline.jsx`, not just the spec text, per the note that commit `b45dd98` changed closed-case and other behaviour. These cases fill three gaps the existing 22 leave open: (a) the spec's point 8 UI behaviour had no cases at all yet, (b) how the timeline's endpoints behave once a case is closed was untested (relevant to `b45dd98`'s "closed cases reject travel/search/page reads/theory" fix — the source shows `POST /viewed` is deliberately **not** in that list, which is worth pinning down explicitly rather than assuming), and (c) a couple of edge cases the spec implies (time cost, id/type cross-matching) but doesn't spell out.

## TC-23 — POST /viewed for a known event is not blocked once the case is closed (unlike legwork)

- **Covers spec point:** 6; cross-references CLAUDE.md ("a second `POST /conclusion` is a 422... interviews stop taking choices") and the `b45dd98` fix that closed cases reject travel/search/page reads/theory.
- **Preconditions:** 049-FRESH
- **Steps / Input:** 1) `POST /api/cases/049/conclusion` with body `{"suspectId":null,"evidenceIds":[]}` ("Cannot determine", needs no evidence, so it is always accepted). 2) `GET /api/cases/049/investigation`. 3) `POST /api/cases/049/viewed {"type":"event","id":"T03"}` (T03 needs no exhibit, so it is known even with nothing unlocked). 4) As a control on the same closed case, `POST /api/cases/049/travel {"locationId":"L01"}`.
- **Expected result:** Step 1: status 200, response has `suspectId: null`, `evidenceIds: []`, and an `ending` key (the exact ending string is not asserted here — only that the case is now closed). Step 2: `conclusion` is non-null. Step 3: status **200** (not 422) — in the current source, `recordViewed` never calls `assertOpen()`, unlike `readPage`, `travel`, `search` and `saveTheory`, which all do — and `eventsViewed` becomes `["T03"]`. Step 4 (control): status 422, body `{"error":"This case is closed."}`. Record this asymmetry explicitly in the report: viewing evidence/suspects/events stays open after a conclusion, legwork does not.
- **Priority:** high

## TC-24 — GET /timeline is unaffected by a closed case

- **Covers spec point:** 1, 2; touches the `b45dd98` closed-case fix (confirming its scope)
- **Preconditions:** 049-FRESH, then close the case as in TC-23 step 1 (`POST /conclusion {"suspectId":null,"evidenceIds":[]}`)
- **Steps / Input:** `GET /api/cases/049/timeline`
- **Expected result:** Status 200, body is exactly `[T03]` (or whatever was known at the moment of closing), identical to what it would return before closing. Read endpoints are never gated by `conclusion`, only the write endpoints `field.service.js` guards with `assertOpen()`.
- **Priority:** medium

## TC-25 — Viewing an event does not spend time on the case clock

- **Covers spec point:** 6; clarifies that viewing is not "legwork" under CLAUDE.md's "every action costs minutes on the case clock" (`config.TIME_COST` lists `readPage: 20, travel: 30, search: 15`, no `event`/`viewed` entry)
- **Preconditions:** 049-FRESH
- **Steps / Input:** 1) `GET /api/cases/049/investigation`, note `clock.minutesUsed`. 2) `POST /api/cases/049/viewed {"type":"event","id":"T03"}`.
- **Expected result:** Step 1: `clock.minutesUsed` is `0`. Step 2: the returned `clock.minutesUsed` is still `0` — `recordViewed` never calls `spendTime`, unlike reading a file page (20), travelling (30) or searching (15).
- **Priority:** medium

## TC-26 — An event id submitted under the wrong `type` is rejected as unknown

- **Covers spec point:** 6 (join on IDs per type, not on the bare string)
- **Preconditions:** 049-F2 (T12 is known)
- **Steps / Input:** `POST /api/cases/049/viewed {"type":"evidence","id":"T12"}`, then `POST /api/cases/049/viewed {"type":"suspect","id":"T03"}`.
- **Expected result:** Both return status 404, body exactly `{"error":"Nothing with that id in this case"}` — `T12`/`T03` are real, known event ids in this case, but `recordViewed`'s per-type existence check (`inCaseFile` for evidence, `getSuspect` for suspect) does not fall back to checking other id types. A following `GET /api/cases/049/investigation` shows `eventsViewed: []`, `evidenceViewed: []`, `suspectsViewed: []`.
- **Priority:** medium

## TC-27 — [UI] Timeline page shows a loading state, then renders the known events

- **Covers spec point:** 8
- **Preconditions:** 049-L01 (four known events: T03, T10, T11, T12); frontend on :5173, backend running normally.
- **Steps / Input:** In the browser, navigate to `/case/049/timeline` (via the dock's Timeline tab or a direct URL) and watch the page from the moment of navigation.
- **Expected result:** A brief loading state is shown before data resolves (the case-wide `Layout` shell's loading treatment noted in this file's ambiguities section as "PULLING THE FILE" — confirm the exact copy currently rendered and note any mismatch, don't guess it silently). Once resolved, the page shows the `PageTitle` "Timeline" with a meta line containing "4 KNOWN", a scrubber with four marks, and two columns of event cards totalling four `TimelineEvent` cards, with no console errors.
- **Priority:** medium

## TC-28 — [UI] Empty state has the exact documented copy when no events are known

- **Covers spec point:** 2, 8
- **Preconditions:** Case 047 freshly reset (`unlockedEvidence: []`; per this file's ground-truth section, 047's fresh timeline is `[]`).
- **Steps / Input:** In the browser, navigate to `/case/047/timeline`.
- **Expected result:** The `PageTitle` reads "Timeline" with meta text "NOTHING PINNED DOWN YET". No scrubber and no event columns are rendered. An `EmptyState` is shown with title exactly "No times to go on yet" and body text exactly "Events appear here as you collect the evidence behind them: a log, a receipt, a witness. Go and find some."
- **Priority:** high

## TC-29 — [UI] Opening a known event marks it viewed and that survives a refresh

- **Covers spec point:** 6, 8
- **Preconditions:** 049-L01, none of T03/T10/T11/T12 viewed yet (fresh browser session/localStorage irrelevant — viewed state is backend-owned).
- **Steps / Input:** 1) Navigate to `/case/049/timeline`. 2) Click the T03 event card (or its scrubber mark at 17:30). 3) Note the URL and the detail panel content. 4) Fully reload the browser at the resulting URL.
- **Expected result:** Step 2/3: the URL gains `?select=T03`; a `tl-detail` panel opens showing title "The branch closes for Easter", its description, and PLACE "The Banking Hall"; the T03 card and scrubber mark pick up the "seen" styling. Step 4: after reload, the detail panel for T03 reopens automatically (the query param persists across reload) and it is still shown as viewed — confirming the viewed flag comes from `GET /investigation` on the backend, not from transient component state. A direct check with `GET /api/cases/049/investigation` (e.g. in a second tab or devtools) shows `eventsViewed` containing `"T03"`.
- **Priority:** high

## TC-30 — [UI] An event with a null locationId renders a placeholder, not a crash

- **Covers spec point:** 5
- **Preconditions:** Case 049 with E012 unlocked so that T05 is known (same access path as TC-10, which the runner must derive from `GET /api/cases/049/dialogue/S04` and record; if unreachable, mark this case blocked rather than passed, same as TC-10).
- **Steps / Input:** In the browser, navigate to `/case/049/timeline` and open the T05 event's detail panel.
- **Expected result:** The page renders with no error boundary / blank screen and no console error. The detail panel's PLACE row shows "—" (a plain em dash placeholder, since `locationById[event.locationId]` and `event.location` are both null) rather than the literal text "null", "undefined", or an empty cell. The event's title, description and time render normally alongside it.
- **Priority:** medium (blocked-if-unreachable, same caveat as TC-10)

## TC-31 — [UI] A failed timeline load shows the shell's error state with a working retry

- **Covers spec point:** 8
- **Preconditions:** 049-L01; backend process stopped (or otherwise made unreachable) before navigating.
- **Steps / Input:** 1) With the backend down, navigate to `/case/049/timeline`. 2) Observe the page. 3) Restart the backend. 4) Click the shell's retry control.
- **Expected result:** Step 2: the `Layout` shell's error state is shown (documented in this file's ambiguities section as "FILE UNAVAILABLE" with a TRY AGAIN button) instead of a blank page or an uncaught exception in the console. Step 4: after the backend is back and the retry control is clicked, the timeline loads normally and shows the four known events for 049-L01 (T03, T10, T11, T12).
- **Priority:** medium

---

**Summary:** 31 test cases total (22 original + 9 added 2026-09-24) — 19 high priority (16 original + 3 added: TC-23, TC-28, TC-29).

## Additional cases (added 2026-09-25)

Cross-checked against `docs/plans/2026-09-25-qa-bug-fixes.md` (approved 2026-09-25) and the current source (`investigation.service.js` `assertOpen`/`recordViewed`, `field.service.js` `getPlace`) plus the case data the change brief names: `data/cases/047/evidence.json`, `data/cases/049/evidence.json`, `data/cases/050/evidence.json`, `data/cases/047/locations.json`, `data/cases/049/locations.json`, `data/cases/047/dialogue.json`, `data/cases/049/dialogue.json`, `data/cases/050/dialogue.json`, and `047/049/050/timeline.json`. These cases cover three things the 2026-09-25 fixes changed: (a) `recordViewed` now also calls `assertOpen()`, so `POST /viewed {type:"event"}` on a closed case is 422 after the existing 400/404 checks — this directly supersedes TC-23 below; (b) `GET /timeline` stays 200 and unaffected, confirming the fix's scope is limited to the write path; (c) the timeline events tied to the four relocated exhibits (047 E005/E006, 049 E014, 050 E008) still become known through their unlock routes now that those routes and the exhibits' `locationId` fields agree, and 049's `T05` is now also reachable through the new `L06-solicitor` spot once S04 has been threatened.

## TC-32 — POST /viewed {type:"event"} on a closed case is now 422, after the 400/404 checks

- **Covers spec point:** 6; supersedes TC-23 (see "Superseded" below); cross-references `investigation.service.js` `recordViewed`, which now calls `assertOpen()` after its 404 existence check (2026-09-25 fix, plan decision D1-A).
- **Preconditions:** 049-FRESH.
- **Steps / Input:** 1) `POST /api/cases/049/conclusion` `{"suspectId":null,"evidenceIds":[]}` (Cannot determine, always accepted, closes the case). 2) `POST /api/cases/049/viewed {"type":"event","id":"T99"}` (unknown id). 3) `POST /api/cases/049/viewed {}` (malformed). 4) `POST /api/cases/049/viewed {"type":"event","id":"T03"}` (T03 needs no exhibit, so it was known even on a fresh case). 5) `GET /api/cases/049/investigation`.
- **Expected result:** Step 1: 200, case closed (`conclusion` non-null). Step 2: still 404 `{"error":"Nothing with that id in this case"}` — the 404 existence check runs before `assertOpen()`, so an unknown id is never reinterpreted as "closed". Step 3: still 400 `{"error":"Expected { type: \"evidence\" | \"suspect\" | \"event\", id }"}` — malformed bodies are rejected before any id lookup or open check. Step 4: status **422**, body exactly `{"error":"This case is closed."}` (not 200, as it returned before the 2026-09-25 fix) — `T03` is a real, known event, so this result proves the close check, not a shape or id problem, is what blocks it. Step 5: `eventsViewed` is `[]` — the closed case never recorded T03.
- **Priority:** high

## TC-33 — GET /timeline stays 200 and unaffected by a closed case, after the 2026-09-25 fix

- **Covers spec point:** 1, 2; confirms the D1-A fix's scope is limited to the write endpoints named in the plan (`createConnection`, `deleteConnection`, `flagContradiction`, `recordViewed`), not the GETs.
- **Preconditions:** 049-FRESH, then close the case as in TC-32 step 1.
- **Steps / Input:** 1) `GET /api/cases/049/timeline`. 2) `GET /api/cases/049/investigation`.
- **Expected result:** Step 1: status 200, body exactly `[T03]` (T03 is the only event known on a fresh case with nothing unlocked; see TC-02), byte-identical to what it returned before the case closed. Step 2: status 200, `conclusion` non-null, `eventsViewed` still `[]` (nothing was viewed before closing).
- **Priority:** medium

## TC-34 — 047: event T07 becomes known through E005's existing, now place-consistent search-spot route

- **Covers spec point:** 2, 3; cross-references the 2026-09-25 data fix that moved 047 E005's `locationId` from `L03` to `L02` to match its real unlock route (`047/locations.json` spot `L02-recorder`, itself unchanged by the fix).
- **Preconditions:** Case 047 freshly reset.
- **Steps / Input:** 1) `GET /api/cases/047/timeline` (baseline). 2) `POST /api/cases/047/travel {"locationId":"L02"}`. 3) `POST /api/cases/047/places/L02/search {"spotId":"L02-recorder"}` (unlocks E005). 4) `GET /api/cases/047/timeline`.
- **Expected result:** Step 1: `[]` (047's fresh timeline is empty, per this file's ground-truth section). Step 3: 200. Step 4: contains `T07` (`"Storage Room camera goes dark"`, timestamp `1984-03-09T21:10:00`) with `evidenceIds` exactly `["E005"]` (E010 and E006 are still locked, so absent) and its own `locationId` `"L02"`/`location` `"Communications Room"` unchanged from the seed (the event's own location is independent of the exhibit's relocated `locationId`). `T10` (`"Camera recorder resumes"`, seed `evidenceIds` `["E005"]`) is also now present with `evidenceIds` `["E005"]`. `T01` (seed `evidenceIds` `["E006"]`) is still absent, since E006 is still locked.
- **Priority:** high

## TC-35 — 047: event T01 becomes known through E006's existing interview route, now consistent with its relocated locationId

- **Covers spec point:** 2, 3; cross-references the 2026-09-25 data fix that moved 047 E006's `locationId` from `L01` to `L02` (Cho's Communications Room, where the interview that unlocks it actually happens: `047/dialogue.json` choice `c-start-e010`, `present: "E010"`, whose consequences unlock `E006`).
- **Preconditions:** Case 047 freshly reset, with exhibit E010 already unlocked and viewed. (The route to E010 is outside this suite's scope; the runner must derive it from `GET /api/cases/047/places` / `GET /api/cases/047/dialogue/S05`, or note it in the report if unclear — this case only asserts what happens once E010 is in hand.)
- **Steps / Input:** 1) `POST /api/cases/047/travel {"locationId":"L02"}`. 2) `POST /api/cases/047/dialogue/S05/choice {"presentEvidenceId":"E010"}` (matches Cho's `c-start-e010` reaction). 3) `GET /api/cases/047/timeline`.
- **Expected result:** Step 2: 200. Step 3: contains `T01` (`"Work order #2291 filed"`, timestamp `1984-03-09T17:30:00`, `locationId` `"L01"`, `location` unchanged from the seed) with `evidenceIds` exactly `["E006"]`. `T07`'s `evidenceIds` now also includes `"E006"` alongside whatever of E005/E010 is unlocked. Neither event's own `locationId`/`location` field is affected by E006's relocation — only the set of exhibits an event can show changes.
- **Priority:** medium

## TC-36 — 049: event T10 becomes known through E014's existing interview route, now consistent with its relocated locationId

- **Covers spec point:** 2, 3; cross-references the 2026-09-25 data fix that moved 049 E014's `locationId` from `L03` to `L01` (Doreen Walsh's post, where the interview that unlocks it actually happens: `049/dialogue.json` choice `dw-start-e005`, present `E005` to S05, whose consequences unlock both `E006` and `E014`).
- **Preconditions:** 049-L01 (F2 read, E005 and E007 already unlocked via the two L01 search spots, per this file's ground-truth section).
- **Steps / Input:** 1) `GET /api/cases/049/timeline` (baseline: `T03, T10, T11, T12`, per TC-06). 2) `POST /api/cases/049/dialogue/S05/choice {"presentEvidenceId":"E005"}`. 3) `GET /api/cases/049/timeline`.
- **Expected result:** Step 1: `T10.evidenceIds` is `["E005"]` (matches TC-06; E014 still locked). Step 2: 200. Step 3: same four events, but `T10.evidenceIds` is now `["E005","E014"]` (both of its seed exhibits are unlocked). No other event's `evidenceIds` changes, and `T10`'s own `locationId` (`"L01"`) and `location` (`"The Banking Hall"`) are unchanged — the exhibit moved, the event didn't.
- **Priority:** high

## TC-37 — 050: event T03 becomes known through E008's existing interview route, now that E008 has a null locationId

- **Covers spec point:** 2, 3, 5; cross-references the 2026-09-25 data fix that changed 050 E008's `locationId` from `L04` to `null` (an off-map third-party photographer's receipt, like 048's phone record), and confirms spec point 5's "renders without crashing" also holds when a *cited exhibit*, not just the event itself, has a null `locationId`.
- **Preconditions:** Case 050 freshly reset, with E007 already unlocked and viewed. (The route to E007 is outside this suite's scope; the runner must derive it from `GET /api/cases/050/places` / `GET /api/cases/050/dialogue/S01`, or note it in the report if unclear.)
- **Steps / Input:** 1) `GET /api/cases/050/timeline` (baseline: `[]`, per this file's ground-truth section). 2) `POST /api/cases/050/travel {"locationId":"L02"}` (Oliver Hale's location, per `050/locations.json`). 3) `POST /api/cases/050/dialogue/S01/choice {"presentEvidenceId":"E007"}` (matches Oliver Hale's `oh-start-e007` reaction; consequences unlock `E008`). 4) `GET /api/cases/050/timeline`.
- **Expected result:** Step 1: `[]`. Step 3: 200. Step 4: contains `T03` (`"The spare key goes out"`, timestamp `1984-06-09T17:00:00`, `locationId` `"L04"`, `location` the seed's L04 name, both unchanged by E008's relocation) with `evidenceIds` `["E007","E008"]` (both now unlocked). No 500 and no `null`/`undefined` leaking into `evidenceIds`, even though one of the exhibits behind this event now carries a null `locationId` of its own.
- **Priority:** medium

## TC-38 — 049: T05 becomes known via the new L06-solicitor route once S04 has been threatened

- **Covers spec point:** 2, 3; cross-references the 2026-09-25 addition of spot `L06-solicitor` in `049/locations.json`, the only route left to E012 once `threatened.S04` is true (the plain `L06-sister` spot requires `threatened.S04: {ne: true}` and is blocked once he's been threatened). Path derived and verified against the current `049/dialogue.json` and `049/locations.json`; if the seed changes again, the runner must re-derive it and note any mismatch rather than assume this still holds, in the same spirit as TC-10.
- **Preconditions:** 049-FRESH.
- **Steps / Input:** 1) `POST /api/cases/049/travel {"locationId":"L06"}`. 2) `POST /api/cases/049/dialogue/S04/choice {"choiceId":"et-start-weekend"}` (sets flag `lead.sister`). 3) `POST /api/cases/049/dialogue/S04/choice {"choiceId":"et-start-threat"}` (sets flag `threatened.S04`). 4) `GET /api/cases/049/places/L06`. 5) `POST /api/cases/049/travel {"locationId":"L04"}`. 6) `POST /api/cases/049/dialogue/S03/choice {"choiceId":"wk-start-saw"}` (sets flag `lead.car`, Kemp's alternate route to it). 7) `POST /api/cases/049/travel {"locationId":"L06"}`. 8) `POST /api/cases/049/places/L06/search {"spotId":"L06-car"}` (requires `lead.car`; unlocks E013). 9) `POST /api/cases/049/viewed {"type":"evidence","id":"E013"}` (`L06-solicitor`'s `requires.evidenceViewed` needs E013 *viewed*, not merely unlocked). 10) `GET /api/cases/049/places/L06`. 11) `POST /api/cases/049/places/L06/search {"spotId":"L06-solicitor"}` (requires `evidenceViewed:["E013"]`, `lead.sister:true`, `threatened.S04:true`; unlocks E012). 12) `GET /api/cases/049/timeline`.
- **Expected result:** Step 4: the `spots` array does not contain `L06-sister` (its `threatened.S04.ne` gate now fails) and does not contain `L06-solicitor` either (its `evidenceViewed:["E013"]` gate isn't met yet) — per the change brief, "gated spots only appear in GET /places/:id when their requires are met". Step 8: 200, E013 unlocked. Step 10: the `spots` array now contains `L06-solicitor`, since its gate is now met. Step 11: 200, unlocks E012. Step 12: the timeline now contains `T05` (`"A car leaves Millbrook"`, timestamp `"1984-04-21T20:30:00"`, `locationId` `null`, `location` `null`, `personIds` `["S04"]`, `evidenceIds` `["E012"]`) — the same field shape as TC-10, reached this time via the threatened path instead of the direct `L06-sister` route. If any step in this derived path returns a status other than the one given here (for example a spot gated differently than read here), mark this case blocked and record the actual `GET /dialogue/S04` / `GET /places/L06` output in the report rather than guessing.
- **Priority:** high

## Superseded by the 2026-09-25 fixes

- TC-23 — old expectation: step 3 (`POST /viewed {"type":"event","id":"T03"}` on a closed case) returns status **200**, and `eventsViewed` becomes `["T03"]`, because `recordViewed` never called `assertOpen()`. New expected behaviour: status **422**, body `{"error":"This case is closed."}`, and `eventsViewed` stays `[]` — see TC-32. Which change: `docs/plans/2026-09-25-qa-bug-fixes.md` decision D1-A; `investigation.service.js` `recordViewed` now calls `assertOpen()` after its 404 existence check.

> 2026-09-25: added TC-32..TC-38; superseded expectations are listed above and in docs/qa/SUPERSEDED-2026-09-25.md.
