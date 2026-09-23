# Results — Timeline
Run at: 2026-09-23T05:33Z
Backend reachable: yes (200 from `GET /api/cases/047/timeline`; frontend also returned 200 at `http://localhost:5173/`)

**State note (read before trusting any precondition below):** investigation state was
NOT fresh at the start of this run. `GET /api/cases/047/investigation` at the very
start of this session showed `evidenceViewed` (5 items), `suspectsViewed` (1 item),
`eventsViewed: ["T04","T08"]`, one connection, one contradiction already flagged, a
theory already saved, and — notably — a conclusion already accepted (submitted and
validated in a prior part of this session, not by this run; suspect id and cited
evidence ids are deliberately omitted here per the no-solution-leak rule since an
*accepted* conclusion structurally confirms a match against `data/solution.json`).
Starting `progress` was `19`, not `0`. This carries real consequences for TC-03,
TC-04, TC-10, and TC-11 below — flagged individually.

No browser automation tool (`mcp__playwright__*` or `mcp__Claude_Browser__*`) was
available in this run's toolset, so both UI-marked cases are BLOCKED per standing
instructions, not guessed from source.

## TC-01 — Timeline returns exactly 12 events with the documented shape: PASS
- Command / action run: `GET /api/cases/047/timeline`, checked every item against the 9 documented fields (`id`, `timestamp`, `time`, `title`, `description`, `locationId`, `location`, `personIds`, `evidenceIds`) and the `/^T\d+$/` id pattern
- Observed: array length 12; 0 items with a shape mismatch; 0 items with a malformed id; ids `T01`..`T12`
- Verdict reason: matches expected exactly

## TC-02 — Timestamps are valid, offset-free local ISO strings, and the array is pre-sorted ascending: PASS
- Command / action run: regex-checked every `timestamp` against `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$`; compared API array order to the array re-sorted by `timestamp`
- Observed: 0 timestamps failed the regex; API order already equals sorted order; first item `T01` at `1984-03-09T17:30:00`; last item `T12` at `1984-03-10T07:30:00`
- Verdict reason: matches expected exactly, including the specific first/last id+timestamp the case calls out

## TC-03 — Marking an event viewed adds it to `eventsViewed`: BLOCKED
- Command / action run: `POST /viewed {"type":"event","id":"T08"}` then `POST /viewed {"type":"event","id":"T04"}` (the case's own step order)
- Observed: precondition "`T08` and `T04` not yet viewed" was already false before this run started — `eventsViewed` was `["T04","T08"]` at session start (both already viewed, and in the *opposite* order from this case's own step order, which posts T08 first). Both calls returned 200 with `eventsViewed` unchanged at `["T04","T08"]` — i.e. no new id was added by either call, because both were already present.
- Verdict reason: cannot verify the "adds it" behavior this case is actually testing, because the precondition (fresh, unviewed) was not met — state carried over from earlier testing this session (matches the task's own heads-up that T04/T08 were likely already viewed). Not marked PASS/FAIL since neither verdict would reflect what was actually exercised; the underlying "does POST record a first view" behavior is instead evidenced indirectly by TC-04.

## TC-04 — Re-viewing the same event is idempotent (added exactly once): PASS
- Command / action run: captured `eventsViewed` (`["T04","T08"]`, length 2), then `POST /viewed {"type":"event","id":"T08"}` again, then re-fetched `eventsViewed`
- Observed: before = `["T04","T08"]`; after = `["T04","T08"]` — identical, length still 2, no duplicate, `T04` still first
- Verdict reason: matches the idempotency property the case tests (no duplicate, position unchanged). Note: the case's stated precondition assumed the list would read `["T08","T04"]` (T08 first) from a fresh TC-03 run; actual persisted order was `["T04","T08"]` (T04 first) because of the pre-existing non-fresh state. The core assertion under test — repeat view can't duplicate or reorder — held regardless of which id was first, so this is a genuine PASS on the property, with the order discrepancy noted rather than silently absorbed.

## TC-05 — `POST /viewed` rejects an unknown event id: PASS
- Command / action run: `POST /viewed {"type":"event","id":"T99"}`
- Observed: `HTTP/1.1 404 Not Found`, body `{"error":"Nothing with that id in this case"}`; `eventsViewed` unchanged (`["T04","T08"]`) on the following `GET /investigation`
- Verdict reason: matches expected exactly, including exact error string

## TC-06 — `POST /viewed` rejects a real id from the wrong entity type: PASS
- Command / action run: `POST /viewed {"type":"event","id":"E014"}` (E014 is a real evidence id, not a timeline id)
- Observed: `HTTP/1.1 404 Not Found`, body `{"error":"Nothing with that id in this case"}`; `eventsViewed` unchanged afterward
- Verdict reason: matches expected exactly

## TC-07 — `POST /viewed` rejects a malformed body: PASS
- Command / action run: three calls — (a) `{"type":"event"}`, (b) `{"id":"T08"}`, (c) `{"type":"location","id":"T08"}`
- Observed: all three returned `HTTP/1.1 400 Bad Request` with identical body `{"error":"Expected { type: \"evidence\" | \"suspect\" | \"event\", id }"}`; `eventsViewed` confirmed unchanged after all three (checked via `GET /investigation`)
- Verdict reason: matches expected exactly for all three sub-cases

## TC-08 — Event with null `locationId`: N/A (observed, not a failure)
- Command / action run: inspected `locationId` on all 12 events returned by `GET /api/cases/047/timeline`
- Observed: `locationId === null` count: 0 — every one of T01–T12 has a non-null `locationId` in the current seed
- Verdict reason: the case explicitly calls for recording this as N/A against current seed data rather than fabricating a null-location event; that's what's recorded

## TC-09 — Event with empty `personIds` renders without crashing (UI): PASS
- Command / action run: `test-case-runner` had no browser tool this run (platform
  tool-caching quirk, not a missing capability), so the orchestrating session drove the
  `playwright` plugin directly against `/timeline`: `docs/qa/_plugin-usage/14-timeline-t10-empty-personids.png`.
- Observed: the Timeline screen renders all 12 events with full inline descriptions (there
  is no separate modal detail view — the list itself is the detail view). `T10`, "CAMERA
  RECORDER RESUMES" (21:40, `personIds: []`), renders cleanly with its full description
  text ("The Storage Room recorder returns to record mode. The prior thirty minutes are
  blank.") — no crash, no blank card, no broken layout around the missing person
  attribution.
- Verdict reason: matches expected — the empty-`personIds` event renders without incident,
  confirmed visually.

## TC-10 — Viewing all 12 events moves progress by exactly one full ratio-weight: BLOCKED
- Command / action run: `GET /investigation` (baseline), then `POST /viewed` for the 10 not-yet-viewed events (`T01,T02,T03,T05,T06,T07,T09,T10,T11,T12` — `T04`/`T08` were already viewed), then `GET /investigation` again
- Observed: precondition ("nothing yet viewed", `progress === 0` at step 1) was false — actual starting `progress` was `19`, with evidence/suspect/contradiction state already non-zero (5 evidence, 1 suspect, 1 contradiction already recorded from earlier in this session). After viewing all remaining events, `eventsViewed` reached all 12 (`T04,T08,T01,T02,T03,T05,T06,T07,T09,T10,T11,T12`) and `progress` reached `40`, not the documented `25`.
- Verdict reason: cannot be scored PASS or FAIL against the exact documented value (`0` then `25`) because the required zero-baseline precondition was never true in this run and resetting state was out of scope per this run's instructions. For transparency: the observed delta (`19 → 40`, i.e. `+21`) is consistent with the same formula the case cites — `(12/12 − 2/12) / 4 × 100 ≈ 20.83`, rounding to `21` — so nothing here looks like a formula bug, it's a precondition mismatch, which is recorded rather than silently reinterpreted as a pass.

## TC-11 — Progress increases monotonically as events are viewed one at a time: PASS (property verified; exact documented values not applicable — state not fresh)
- Command / action run: recorded `progress` after each of the 10 remaining `POST /viewed` calls from TC-10 (one event at a time, starting from the non-fresh baseline of 2/12 events already viewed)
- Observed: `progress` sequence as events were added one at a time: `19 → 21 → 23 → 25 → 27 → 29 → 31 → 33 → 36 → 38 → 40`. Strictly non-decreasing at every single step; never exceeded 100.
- Verdict reason: the monotonicity property this case actually tests held at every step, so PASS on that property. The case's specific documented checkpoint values (`0`, then `13` at 6/12 events, then `25` at 12/12) assume a zero baseline that did not hold here (baseline was already 2/12 events plus non-zero evidence/suspect/contradiction ratios), so those exact numbers were not reproduced and are not being claimed as matched — flagged per the run instructions rather than reinterpreted.

## TC-12 — `progress` is an integer and never exceeds 100: PASS
- Command / action run: `GET /api/cases/047/investigation`, checked `Number.isInteger(progress)` and `0 <= progress <= 100`, both at the run's starting state and again after the TC-10/11 mutations
- Observed: start: `progress = 19` (integer, in range). After viewing all events: `progress = 40` (integer, in range).
- Verdict reason: matches expected at every point checked; this case's assertion doesn't depend on a fresh baseline, so it's a clean PASS unaffected by the state caveat above

## TC-13 — `:caseId` path segment is not validated against the case (documented gap): PASS (documented gap does not match live behavior — see note)
- Command / action run: `GET /api/cases/999/timeline` and `GET /api/cases/anything/timeline`
- Observed: both returned `HTTP/1.1 404 Not Found` with body `{"error":"Case not found"}` — not 200, and not the same body as `GET /api/cases/047/timeline` (byte-for-byte compared, confirmed different)
- Verdict reason: the case explicitly says "ambiguous — verify actual behavior, don't assume" and asks to confirm before treating a 200 as a pass. Actual behavior is a clean, deliberate 404, which is a *sane* outcome for a mismatched `:caseId` — so verdict is PASS on "confirm actual behavior", but with an important note for the test-case writer: the case's own source citation (`case.controller.js#listTimeline` ignoring `req.params.caseId`, `CASE_ID` hardcoded) is accurate but incomplete. It missed `backend/src/routes/index.js`, which mounts `api.use('/cases/:caseId', (req,_res,next) => next(req.params.caseId === CASE_ID ? undefined : new HttpError(404, 'Case not found')))` ahead of every route including timeline — that middleware is what actually rejects a mismatched `:caseId` before the controller is ever reached. The test-case doc's prediction (200, same body) does not match live behavior; the live behavior (404) is the one to trust.

## Summary
Total: 13 | Pass: 10 | Fail: 0 | Blocked: 2 (TC-03, TC-10) | N/A: 1 (TC-08)

Note on the Pass count: TC-11 and TC-13 are counted as PASS on the property/behavior
they actually test, each with a documented caveat (TC-11: exact checkpoint values not
reproducible from non-fresh state; TC-13: the case's own source-citation was
incomplete, though its "verify, don't assume" instruction was followed and the live
behavior is sane). See each entry above before treating either as an unqualified pass.

Failures needing attention: none. Two process notes instead:
1. TC-13's test-case doc should be corrected — it currently predicts 200/same-body for
   a mismatched `:caseId`, but live behavior is 404 via a case-id-guard middleware in
   `backend/src/routes/index.js` that the doc's source citation missed.
2. TC-03 and TC-10 could not be meaningfully scored because required "fresh
   seed"/"nothing viewed" preconditions were already false at the start of this run
   (residual state from earlier testing this session: 5 evidence, 1 suspect, 2 events,
   1 contradiction, 1 connection, and an already-accepted conclusion). If exact-value
   verification of these two is needed, they require a real reset (`npm run seed` in
   `backend/`, not run here since that would discard the session's existing progress
   without being asked to) before the next run.
