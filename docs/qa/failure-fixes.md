# QA failures: what failed, why, and how it was fixed

Date: 2026-09-24. Covers the 12 test cases that failed across the two QA suites: the new
five-case suite (382 cases, 10 failed) and the earlier single-case suite (124 cases, 2 failed).
After the fixes below, both suites show 0 failures (497 pass). The 9 cases in the earlier suite
that were blocked or N/A were not part of this work.

| # | Suite / case | Type | One-line reason | Fixed in |
|---|---|---|---|---|
| 1 | main-menu-case-select TC-16 | App bug | Case detail exposed locked evidence IDs | `case.service.js` |
| 2 | main-menu-case-select TC-20 | App bug | `/favicon.ico` 404 on every load | `frontend/public/favicon.svg`, `index.html` |
| 3 | main-menu-case-select TC-28 | Wrong test | Expected a dock on the case-start screen | test case |
| 4 | detective-notes TC-06 | App bug | "What doesn't add up?" said `medium` on an empty case | `notes.service.js` |
| 5 | detective-notes TC-07 | App bug | Statement review said `medium` on an empty case | `notes.service.js` |
| 6 | detective-notes TC-08 | App bug | Theory review said `medium` with no theory | `notes.service.js` |
| 7 | detective-notes TC-10 | App bug + wrong test | Same `medium` answers; 049 window prompt expectation too strict | `notes.service.js`, test case |
| 8 | detective-notes TC-17 | App bug | `connect` accepted a locked timeline event | `notes.service.js` |
| 9 | detective-notes TC-19 | App bug | Same `medium` answer with unexamined evidence | `notes.service.js` |
| 10 | accusation-and-endings TC-43 | App bug | Closed case still accepted repeat travel, search and reads | `field.service.js`, `investigation.service.js` |
| 11 | conclusion-and-report TC-13 (earlier suite) | App bug | Report timeline sorted by time, not view order | `report.service.js` |
| 12 | investigation-assistant TC-03 (earlier suite) | Wrong test | Test facts undercounted Alex's contradictions | test case |

Of the 12, 9 were app bugs, 2 were wrong test expectations (rows 3 and 12), and 1 was both (row 7).

---

## 1. main-menu-case-select TC-16: locked evidence IDs in case detail

**What failed.** `GET /api/cases/:caseId` returned a `locations` array with each place's search
spots and their `consequences`, which contain `unlock_evidence` entries. That put 12 to 13 exhibit
IDs (`E###`) in the response for every case, naming evidence the player has not found yet.

**Why.** `getCase()` in `backend/src/services/case.service.js` returned the raw location rows from
the database. Those rows include the full search-spot data the game logic needs. CLAUDE.md says
locked evidence must not exist as far as the player is concerned.

**Fix.** `getCase()` now maps each location to its public fields only: `id`, `name`, `floor`,
`district`, `description`, `map`. Spots are still served through the place endpoints after the
player has travelled there, and they never list what a search will turn up.

**Verified.** All five cases: the case detail contains no `E###` IDs, no `spots` and no
`consequences`.

## 2. main-menu-case-select TC-20: favicon 404

**What failed.** The main menu logged a `404` console error for `/favicon.ico` on every load.

**Why.** The app had no favicon, so the browser's automatic request failed.

**Fix.** Added `frontend/public/favicon.svg` (a small magnifier icon) and a
`<link rel="icon" href="/favicon.svg">` in `frontend/index.html`.

**Verified.** In a fresh browser tab: no console errors and no failed resource requests on load.

## 3. main-menu-case-select TC-28: dock on the case-start screen

**What failed.** The case expected a dock of tabs on `/case/049` right after taking the case. There
is none there.

**Why.** The test case was wrong, not the app. The dock only appears on section pages (map, file,
people and so on). The case-start screen is deliberately just the HUD and the two choices.

**Fix.** Corrected the expectation in the test case: no dock on `/case/049`, dock visible on
`/case/049/map`.

**Verified.** `/case/049` shows the HUD and no dock; `/case/049/map` shows the dock with 8 tabs;
no console errors.

## 4 to 7 and 9. detective-notes TC-06, 07, 08, 10, 19: `medium` confidence on empty answers

**What failed.** On a fresh or unexamined case, the "What doesn't add up?", "Review <suspect>'s
statement" and "Review my current theory" prompts returned `confidence: "medium"`. The spec says an
answer with nothing to go on should be `low`. TC-19 hit the same thing with an unlocked but
unexamined exhibit.

**Why.** `notes.service.js` rewrote the answer text for the "nothing found" case but kept the
assistant's default confidence for that path, which is `medium`. The theory prompt was hard-coded
to `medium` even with no theory and no board links.

**Fix.** In `notes.service.js`, when a contradictions or statement prompt finds nothing, the answer
is now `confidence: "low"`. The theory prompt is `low` when there are no board links and no theory
text, and `medium` otherwise.

**Verified.** All five cases, every prompt, on a fresh investigation: `low`, no contradiction, no
related evidence. TC-19: with E007 unlocked but not viewed, the answers stay `low` and never use it.

**Test correction (TC-10).** Case 049 lists a half-hour window prompt on a fresh case, because its
event T03 has no exhibit behind it and is known from the start. The case expected empty related
events for every prompt, which was too strict. The test case now exempts window prompts, whose
related events may include events the timeline already shows.

## 8. detective-notes TC-17: locked timeline event accepted by `connect`

**What failed.** `POST /notes` with prompt `connect` and items `["T08","S02"]` on a fresh case
returned 200 and named the locked event ("Storage Room B opened"). It should be a 400, because a
locked event does not exist for the player yet.

**Why.** The `describe()` helper in `notes.service.js` looked timeline events up in the full list
(`cases.listTimeline()`), not in the list of events the player can know about.

**Fix.** It now looks in `investigation.knownTimeline()`, so an unknown event id fails the
"real clue" check and returns 400.

**Verified.** `connect` with `["T08","S02"]` on a fresh 047 returns 400.

## 10. accusation-and-endings TC-43: closed case accepted repeat actions

**What failed.** After an accusation closed the case, travelling to the current place,
re-searching a searched spot and re-reading a read page all returned 200. The spec says a closed
case rejects them with 422.

**Why.** The "case is closed" check lived only inside `spendTime()`. Repeating a free action costs
no time, so it never reached that check. The same gap let `PUT /theory` change the theory after
the case closed, which then showed up in the report.

**Fix.** Added `assertOpen()` to `investigation.service.js` (422 "This case is closed."). It runs
at the start of `readPage`, `travel` and `search` in `field.service.js`, inside `spendTime()`, and
in `saveTheory()`. GET requests and the report still work on a closed case.

**Verified.** After closing: re-travel, re-search and re-read return 422, `PUT /theory` returns
422, minutes used is unchanged, and the report is still readable.

## 11. conclusion-and-report TC-13 (earlier suite): report timeline order

**What failed.** The report's `timeline` came back sorted chronologically. The spec and the test
case both say it lists the events the player viewed, in the order they viewed them.

**Why.** `getReport()` in `report.service.js` filtered the full chronological timeline by
membership (`listTimeline().filter(t => eventsViewed.includes(t.id))`), which discards view order.

**Fix.** It now maps over `eventsViewed` in order and looks each event up, so the report follows
the order of viewing.

**Verified.** On case 049, viewing T12 and then T03 produces a report timeline of `[T12, T03]`.

## 12. investigation-assistant TC-03 (earlier suite): wrong facts in the test case

**What failed.** The case expected every contradiction for Alex Reyes to be on claim `ST02-A`. The
app returned five pairs across `ST02-A`, `ST02-B` and `ST02-C`.

**Why.** The test case's "fixed facts" undercounted Alex's real contradictions (it listed three)
and misnamed Nina Okafor's pair as `ST04-A` vs `E018` when it is `ST04-A` vs `E012`, mitigated by
`E018`. The assistant was working correctly.

**Fix.** Corrected the facts and the expected result in
`docs/qa/investigation-assistant/test-cases.md`: Alex has five real pairs, and a response lists
only the pairs whose exhibit the player holds.

**Verified.** With E007 and E014 unlocked, the live answer for Alex is `contradiction: true`,
`confidence: "high"`, pairs `ST02-A/E007`, `ST02-A/E014` and `ST02-B/E014`, and no locked
exhibit is used.

---

## Also fixed while in there

These came from observations in the QA runs, not from a failing case.

- **Held-back exhibit in contradiction responses.** `POST /contradictions` and interview results
  returned a `mitigatedBy` list that could name an exhibit the player did not hold yet (seen as
  `["E006"]` with only E010 unlocked). `flagContradiction` in `investigation.service.js` now
  filters it to unlocked exhibits.
- **Clock overshoot.** A final action could push the case clock past its budget (975 of 960
  minutes). `spendTime` now clamps to the minutes left.
- **Misleading 404 message.** The error screen said "Make sure the MysteryDesk API is running"
  even for "Case not found". `ErrorState` in `ui.jsx` now shows that hint only for network
  errors and server errors (5xx).
- **Accusation TC-13 test.** Its expectation that the case shows `new` was wrong once setup steps
  had spent time. It now only requires the case not to be closed.

## Not changed

- Repeat free actions after the clock runs out (time up, case still open) still return 200. The
  spec does not say what should happen, so the current behaviour was left.
- The main menu still requests `GET /api/cases` twice on load; harmless, not a failing case.
- GSAP "target not found" warnings after reading a file page were noted by the runner and left.
- Error states in a few places have no retry button (opening a single evidence card, a failed
  Notes consult); the runner noted the gap and it was left.

## Commits

- `b45dd98` Fix answer-key leaks and closed-case rules found by the QA run
- `b562c05` List the report timeline in the order events were viewed
- `37551c4` Mark the 12 QA failures as fixed and re-verified

## Caveat

The fixes were re-checked one by one against the running app, not by re-running the full
suites. The results files mark these 12 cases as "re-verified after fix", and the 9 blocked or
N/A cases in the earlier suite are unchanged.
