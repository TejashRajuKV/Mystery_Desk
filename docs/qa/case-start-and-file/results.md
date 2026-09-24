# Results — case-start-and-file
Run at: 2026-09-24T11:29:26Z (approx. end of run)
Backend reachable: yes (http://localhost:4001, not :4000 as written in test-cases.md; `GET /api/health` returned `{"ok":true}`, `GET /api/cases/047` 200; frontend on :5173 also proxied 200)

## Run notes

- `BASE` for all API cases was `http://localhost:4001/api` (the run environment's backend). API cases were driven by one Node script (`fetch`, real HTTP, assertions compared to each "Expected result"); UI cases were driven with Playwright against `http://localhost:5173`.
- Every case was reset (`POST /cases/<id>/reset`) before its preconditions; all five cases were reset again at the end (verified: `minutesUsed 0`, `pagesRead []`, `unlockedEvidence []`, `conclusion null` for 047-051).
- Deviations from the written steps, none of which change a verdict:
  - TC-30 has two precondition paths ("time-up from TC-25 or closed as in TC-27"); both were run (30a time-up, 30b closed).
  - "Hard reload (F5)" in TC-42 was done as a full page navigation (`page.goto`) to the same URL, which reloads the app from scratch.
  - The test-cases doc says every case has pages F1..F4; observed: case 050 has only three pages (F1-F3). TC-02 only asserts contiguous ids from F1, so it still passes. The doc's seed table and the "F1..F4 in every case" line are slightly wrong for 050.
  - TC-34/TC-36/TC-37: the accessibility snapshot shows choice labels wrapped in square brackets (`[Open the file and read it (each page takes time)]`), while `innerText` shows the bare label text (the brackets are rendered as decoration). The label text matches the expected strings, so this was treated as a match.
  - Console noise seen but not asserted on: `/favicon.ico` 404 and GSAP "target .clip not found" warnings when reading a page.
- The answer key was never read and nothing about it is recorded here. TC-33 only searched response text for forbidden key names.
- Screenshot evidence for TC-40: `D:\MysteryDesk\docs\qa\case-start-and-file\tc40-evidence-room.png`.

## TC-01 — Fresh GET /file (Case 047): every page unread, body null, attachments empty: PASS
- Command / action run: `POST /cases/047/reset`; `GET /cases/047/file`
- Observed: 200; array of 4: `F1 "Incident report"`, `F2 "Scene examination: Storage Room B"`, `F3 "Persons of interest"`, `F4 "Forensics"`; each has exactly keys `attachments, body, id, read, title`; all `read:false, body:null, attachments:[]`.
- Verdict reason: shape, order, and unread state all match.

## TC-02 — Fresh GET /file for every other case: PASS
- Command / action run: reset then `GET /cases/<id>/file` for 048, 049, 050, 051
- Observed: 200 each; 048 4 pages, 049 4 pages, 050 3 pages, 051 4 pages; ids contiguous from F1; all `read:false, body:null, attachments:[]` (including 048/049/050/051 F2 and 049 F3).
- Verdict reason: no attachments leak before a read; ids contiguous (050 has 3 pages, see run notes).

## TC-03 — GET /cases/047 leaves out the page bodies: PASS
- Command / action run: `GET /cases/047`, `GET /cases/047/file`
- Observed: 200; no `file` key; `filePages: 4` (equals `/file` length); response text contains neither the F1-only sentence nor `047-2`; `clock = {"start":"1984-03-10T08:15:00","hours":16,"deadlineNote":"The board wants a name by midnight."}`.
- Verdict reason: all listed absences and presences hold.

## TC-04 — GET /cases/:caseId leaves out page bodies for all five cases: PASS
- Command / action run: for each 047-051: reset, `GET /cases/<id>`, `GET /cases/<id>/file`, read every page, `GET /cases/<id>` again
- Observed: 200 each; no `file` key; `filePages` 4/4/4/3/4 equal `/file` length for 047/048/049/050/051; no `"body":` key at any depth (checked before and after reading); last paragraph of the last page not present in the case response after reading.
- Verdict reason: bodies never appear in the case resource.

## TC-05 — Fresh investigation: nothing unlocked, no pages read, no file flags, clock at zero (Case 047): PASS
- Command / action run: reset, `GET /cases/047/investigation`
- Observed: 200; `unlockedEvidence []`, `pagesRead []`, `storyFlags {}`, clock `now == start == 1984-03-10T08:15:00`, `deadline 1984-03-11T00:15:00`, `minutesUsed 0`, `minutesLeft 960`, `timeUp false`.
- Verdict reason: matches exactly.

## TC-06 — Fresh GET /evidence returns an empty list, for every case: PASS
- Command / action run: reset then `GET /cases/<id>/evidence` and `/investigation` for 047-051
- Observed: 200 with body `[]` for every case; `unlockedEvidence []` for every case.
- Verdict reason: matches exactly.

## TC-07 — Read a page: response shape: PASS
- Command / action run: reset 047; `POST /cases/047/file/F1/read`
- Observed: 200; top-level keys `page, investigation, effects`; `page.id F1`, `read true`, `body` array of 4 strings, `attachments []`, `title "Incident report"` (equal to `/file` F1 title); investigation includes `clock, storyFlags, unlockedEvidence, pagesRead, ...`; `effects = {"unlockedEvidence":[]}`.
- Verdict reason: shape matches.

## TC-08 — First read costs 20 minutes and moves the clock: PASS
- Command / action run: (continuing TC-07 state) `GET /cases/047/investigation`
- Observed: in both read response and GET: `minutesUsed 20`, `minutesLeft 940`, `timeUp false`, `now 1984-03-10T08:35:00`, `start 1984-03-10T08:15:00`, `deadline 1984-03-11T00:15:00`; `pagesRead ["F1"]`.
- Verdict reason: matches exactly.

## TC-09 — Re-reading the same page costs nothing and unlocks nothing new: PASS
- Command / action run: `POST /cases/047/file/F1/read` twice more
- Observed: both 200; `minutesUsed 20`, `minutesLeft 940`, `now 1984-03-10T08:35:00`; body identical to first read; `effects.unlockedEvidence []`; `pagesRead ["F1"]`.
- Verdict reason: idempotent, no extra cost.

## TC-10 — Reading pages without attachments unlocks nothing (Case 047, all pages): PASS
- Command / action run: reset 047; read F1, F2, F3, F4; `GET /evidence` after each
- Observed: each 200; `effects.unlockedEvidence []`, `page.attachments []`, `investigation.unlockedEvidence []`, `GET /evidence` = `[]` after each read.
- Verdict reason: nothing unlocked at any point.

## TC-11 — Reading a page with an attachment unlocks it (Case 048, F2 -> E002): PASS
- Command / action run: reset 048; `GET /evidence/E002`; `POST /file/F2/read`; `GET /evidence`; `GET /evidence/E002`
- Observed: pre-read E002 = 404; read 200 with `page.attachments = [{"id":"E002","title":"Medical Examiner's Note"}]`, `effects.unlockedEvidence` the same, `investigation.unlockedEvidence ["E002"]`, `minutesUsed 20`; `/evidence` = one element `E002`; `GET /evidence/E002` = 200.
- Verdict reason: matches exactly.

## TC-12 — Case 049: two pages with attachments (F2 -> E002, F3 -> E015): PASS
- Command / action run: reset 049; read F1, F2, F3, F4 in order
- Observed: F1 effects `[]`, unlocked `[]`; F2 effects `[{"id":"E002","title":"Loss Schedule"}]`, unlocked `["E002"]`; F3 effects `[{"id":"E015","title":"Kemp's 1971 Conviction"}]`, unlocked `["E002","E015"]`; F4 effects `[]`, unlocked `["E002","E015"]`; final `minutesUsed 80`.
- Verdict reason: matches exactly.

## TC-13 — Cases 050 and 051: F2 unlocks E002 with the right title: PASS
- Command / action run: reset 050, 051; read F2 on each, then F1 on each
- Observed: 050 effects `[{"id":"E002","title":"Insurance Schedule"}]`, unlocked `["E002"]`; 051 effects `[{"id":"E002","title":"Toxicology Report"}]`, unlocked `["E002"]`; after F1 on each, unlocked still `["E002"]`.
- Verdict reason: matches exactly.

## TC-14 — Re-reading an attachment page does not re-unlock or duplicate: PASS
- Command / action run: (048 after TC-11) `POST /cases/048/file/F2/read` again
- Observed: 200; `effects.unlockedEvidence []`; `investigation.unlockedEvidence ["E002"]`; `minutesUsed 20`; `page.attachments` still `[{"id":"E002","title":"Medical Examiner's Note"}]`.
- Verdict reason: no re-unlock, no cost, clip still listed.

## TC-15 — GET /file after reading: only read pages reveal body and attachments: PASS
- Command / action run: (048, only F2 read) `GET /cases/048/file`
- Observed: 200; F2 `read true`, body of 2 paragraphs, attachments `[{"id":"E002","title":"Medical Examiner's Note"}]`; F1/F3/F4 `read false, body null, attachments []`.
- Verdict reason: matches exactly.

## TC-16 — Reading sets storyFlags["file.<pageId>"] to true, and only for pages read: PASS
- Command / action run: reset 047; read F1; `GET /investigation`
- Observed: read response and GET both `storyFlags {"file.F1": true}` (boolean); no F2/F3/F4 keys; `pagesRead ["F1"]`.
- Verdict reason: matches exactly.

## TC-17 — All four pages read: all flags set, cumulative cost is 80 minutes: PASS
- Command / action run: reset 047; read F1..F4 recording `minutesUsed` after each; `GET /investigation`
- Observed: cumulative `[20,40,60,80]`; flags `file.F1..file.F4` all `true`; `pagesRead ["F1","F2","F3","F4"]`; `minutesUsed 80`, `minutesLeft 880`, `now 1984-03-10T09:35:00`, `timeUp false`.
- Verdict reason: matches exactly.

## TC-18 — Unknown page id is a 404 and changes nothing: PASS
- Command / action run: reset 047; `POST /file/F9/read`; `GET /investigation`
- Observed: 404 `{"error":"There is no such page in the file"}`; afterwards `minutesUsed 0`, `pagesRead []`, `storyFlags {}`, `unlockedEvidence []`.
- Verdict reason: exact message and no state change.

## TC-19 — Page ids are exact: wrong case, empty-ish and other-kind ids are 404: PASS
- Command / action run: `POST /cases/047/file/{f1,F0,E002,F1%20}/read`; `GET /investigation`
- Observed: all four 404 `{"error":"There is no such page in the file"}`; afterwards `minutesUsed 0`, `pagesRead []`.
- Verdict reason: all rejected with the exact message, no state change.

## TC-20 — Unknown case id is a 404 on the file endpoints: PASS
- Command / action run: `GET /cases/999/file`, `POST /cases/999/file/F1/read`, `GET /cases/999/investigation`, `GET /cases/999`
- Observed: all 404 `{"error":"Case not found"}`.
- Verdict reason: matches exactly.

## TC-21 — Clock object shape and deadline arithmetic for every case: PASS
- Command / action run: reset each; `GET /cases/<id>/investigation` and `GET /cases/<id>`
- Observed: clock keys `start, deadline, now, minutesUsed, minutesLeft, timeUp, costs` in each. 047 `08:15 / 1984-03-11T00:15:00 / 960`; 048 `1984-05-19T09:00 / 23:00 / 840`; 049 `1984-04-24T10:00 / 1984-04-25T00:00 / 840`; 050 `1984-06-10T09:00 / 21:00 / 720`; 051 `1984-07-15T09:00 / 21:00 / 720`; each `now == start`, `minutesUsed 0`, `timeUp false`, `start` equals case clock start, deadline minus start = `hours*60` (960/840/840/720/720).
- Verdict reason: all values match.

## TC-22 — Time costs are published on the clock and match the spec: PASS
- Command / action run: `GET /cases/047/investigation`
- Observed: `clock.costs = {"readPage":20,"travel":30,"search":15,"question":10,"present":10}`.
- Verdict reason: deep-equal to expected.

## TC-23 — minutesLeft decreases as actions are taken; now tracks minutesUsed: PASS
- Command / action run: reset 047; `GET /places` (first id `L01`); `POST /file/F1/read`; `POST /travel {"locationId":"L01"}`
- Observed: after read `used 20, left 940, now 08:35`; travel 200 (body keys `place, investigation`), clock `used 50, left 910, now 1984-03-10T09:05:00`; deadline and start unchanged; used+left = 960 both times.
- Verdict reason: matches exactly.

## TC-24 — GET requests never change the clock or read state: PASS
- Command / action run: reset 047; `GET /file`, `/investigation`, `/cases/047`, `/evidence` x3 each; `GET /cases/047/file/F1/read`
- Observed: `GET .../file/F1/read` = 404 `{"error":"Not found"}`; afterwards `minutesUsed 0`, `pagesRead []`, `storyFlags {}`, all pages `read false`.
- Verdict reason: GETs read-only; no GET read route.

## TC-25 — Reading an unread page after time is up is rejected (422), no state change: PASS
- Command / action run: reset 047; read F1-F3; `GET /places` (first two ids `L01`, `L02`); 30 alternating `POST /travel` starting L01; `GET /investigation`; `POST /file/F4/read`; `GET /investigation`; `GET /file`
- Observed: all 30 travels 200; clock `minutesUsed 960, minutesLeft 0, timeUp true, now == deadline == 1984-03-11T00:15:00`; F4 read 422 `{"error":"Time is up. The District Attorney wants a name."}`; afterwards `minutesUsed 960`, `pagesRead ["F1","F2","F3"]`, no `file.F4` flag, F4 in `/file` `read false, body null`.
- Verdict reason: matches exactly.

## TC-26 — After time is up, re-reading an already-read page still works and costs nothing: PASS
- Command / action run: (047 still time-up) `POST /file/F1/read`
- Observed: 200; `page.read true`, body of 4 paragraphs; `minutesUsed 960`, `timeUp true`; `effects.unlockedEvidence []`.
- Verdict reason: matches exactly.

## TC-27 — Reading an unread page on a closed case is rejected (422): PASS
- Command / action run: reset 047; read F1; `POST /conclusion {"suspectId":null,"evidenceIds":[]}`; `POST /file/F2/read`; `GET /investigation`; `POST /file/F1/read`
- Observed: conclusion 200; F2 read 422 `{"error":"This case is closed."}`; afterwards `minutesUsed 20`, `pagesRead ["F1"]`; F1 re-read 200, `minutesUsed 20`.
- Verdict reason: matches exactly.

## TC-28 — Reset restores clock, flags, pages and unlocked evidence: PASS
- Command / action run: reset 048; read F1, F2 (pre-reset `minutesUsed 40`, `unlockedEvidence ["E002"]` confirmed); `POST /cases/048/reset`; `GET /file`, `/evidence`, `/evidence/E002`
- Observed: reset 200; clock `minutesUsed 0, minutesLeft 840, now == start == 1984-05-19T09:00:00, timeUp false`; `storyFlags {}`, `pagesRead []`, `unlockedEvidence []`, `conclusion null`; `/file` all `read false, body null, attachments []`; `/evidence` = `[]`; `/evidence/E002` = 404.
- Verdict reason: matches exactly.

## TC-29 — After reset, reading costs and unlocks again: PASS
- Command / action run: (048 after TC-28) `POST /file/F2/read`
- Observed: 200; `minutesUsed 20`; `effects.unlockedEvidence = [{"id":"E002","title":"Medical Examiner's Note"}]`; `storyFlags["file.F2"] true`.
- Verdict reason: matches exactly.

## TC-30 — Reset after time-up or a closed case makes the file readable again: PASS
- Command / action run: (a) from time-up state (after TC-26): `POST /cases/047/reset`, `POST /file/F4/read`; (b) from closed state (after TC-27): same
- Observed: (a) reset 200 `timeUp false, minutesUsed 0, conclusion null`; F4 read 200 `minutesUsed 20`. (b) identical result.
- Verdict reason: both paths recover.

## TC-31 — Progress is scoped to its own case: PASS
- Command / action run: reset 047, 048; `POST /cases/048/file/F2/read`; check 047 (`/investigation`, `/file`, `/evidence`); `POST /cases/047/reset`; `GET /cases/048/investigation`
- Observed: 047 `minutesUsed 0`, `pagesRead []`, no `file.*` flags, all pages unread, `/evidence` `[]`; after 047 reset, 048 `minutesUsed 20`, `pagesRead ["F2"]`, `unlockedEvidence ["E002"]`, `file.F2 true`.
- Verdict reason: no cross-case leakage.

## TC-32 — State persists between requests (server-owned): PASS
- Command / action run: reset 047; read F1, F3; separate later `GET /investigation` and `GET /file`
- Observed: `pagesRead ["F1","F3"]`; `minutesUsed 40`, `now 1984-03-10T08:55:00`; flags `file.F1`, `file.F3` true, no F2/F4; `/file`: F1/F3 read with bodies, F2/F4 `read false, body null`.
- Verdict reason: matches exactly.

## TC-33 — The file endpoints never leak the answer key: PASS
- Command / action run: reset 049; read F1-F4; captured raw text of `GET /cases/049`, `GET /cases/049/file`, the four read responses, `GET /cases/049/investigation` (7 responses); searched them for `solution`, `culprit`, `requiredEvidence`, `requiredConnections`
- Observed: none of the forbidden keys/strings found in any of the 7 responses.
- Verdict reason: no key-related text in any file/case/investigation response.

## TC-34 — UI: CaseStart shows the brief from the API and the two main choices (fresh case): PASS
- Command / action run: reset 047; open `http://localhost:5173/case/047`; compare with `GET /cases/047`
- Observed: folder label `CASE #047`, `CONFIDENTIAL`, `Industrial theft`; `h1 The Missing Prototype`; summary paragraph identical to the API `summary` ("Sometime between Friday evening and Saturday morning, ... One of them is lying."); `deadlineNote` "The board wants a name by midnight." (shown upper-cased by CSS); time line `SAT 10 MAR · 08:15 · RIDGEWAY INDUSTRIAL PARK`; heading `What do you do?`; three choices in order: `Open the file and read it (each page takes time)`, `Leave the file on the desk. Go straight to the scene`, `Put the file back and pick another case`. HUD `SAT 10 MAR · 08:15`, `16H 00M LEFT`.
- Verdict reason: all listed elements present with API-sourced text (bracket decoration noted in run notes).

## TC-35 — UI: CaseStart takes its text from the API, not from the source: PASS
- Command / action run: open `/case/048` then `/case/051`; compare with `GET /cases/048`, `GET /cases/051`
- Observed: 048 `CASE #048`, `Last Curtain at the Orpheum`, its API summary, "The Sunday papers go to press at eleven tonight.", `SAT 19 MAY · 09:00 · CANAL STREET, RIDGEWAY`. 051 `CASE #051`, `The Ashcombe Tea`, its API summary, "The inquest opens at nine tomorrow; the coroner wants a name tonight.", `SUN 15 JUL · 09:00 · ASHCOMBE HALL, NEAR RIDGEWAY`. No "Missing Prototype"/"Argus" text on the 051 page; 047 strings absent from the 048 main text.
- Verdict reason: text is per-case and matches the API.

## TC-36 — UI: choosing "Open the file" goes to the file; choosing "Go straight to the scene" goes to the map at no cost: PASS
- Command / action run: fresh 047 at `/case/047`; click choice 1; `history.back()`; click choice 2; `GET /investigation`
- Observed: (a) URL became `/case/047/file`; back returned to `/case/047`. (b) URL became `/case/047/map`; `pagesRead []`, `storyFlags {}`, `minutesUsed 0`; HUD `SAT 10 MAR · 08:15`, `16H 00M LEFT`.
- Verdict reason: routes and zero cost as expected.

## TC-37 — UI: CaseStart choice labels change once the case has been started or closed: PASS
- Command / action run: 047 with F1+F2 read (started; 2 pages, not exactly F1 only, which does not change the "started" condition); open `/case/047`; then `POST /conclusion {"suspectId":null,"evidenceIds":[]}` (200) and reload
- Observed: started: paragraph "The file is where you left it, and the clock is still running." (not the API summary); choices `Get back out there`, `Read the case file again`, `Put the file back and pick another case`. Closed: choices exactly `Read how it ended`, `Put the file back and pick another case`.
- Verdict reason: labels match both states. (Precondition deviation: two pages read rather than one.)

## TC-38 — UI: unread CaseFile page hides its body and offers a timed read button: PASS
- Command / action run: fresh 047, open `/case/047/file`; click tabs 02, 03, 04; check DOM and network log
- Observed: heading `Case File #047`; meta `0 OF 4 PAGES READ · SAT 10 MAR · 08:15`; four tabs `01 Incident report`, `02 Scene examination: Storage Room B`, `03 Persons of interest`, `04 Forensics` (equal to API titles), no tab check marks; F1 shows "The page is face down. Reading it properly will take time off the clock." and button `[ READ IT · 20 MIN ]`; body text `Taken: the Argus-7 prototype` not in DOM; network log after tab clicks shows only GETs (no POST `/read`); HUD still `SAT 10 MAR · 08:15`.
- Verdict reason: matches exactly.

## TC-39 — UI: reading a page reveals the body, ticks the tab and updates the HUD clock: PASS
- Command / action run: fresh 047, F1 selected; click `[ READ IT · 20 MIN ]`; then click tab 02 and tab 01
- Observed: exactly one `POST /api/cases/047/file/F1/read` => 200; face-down text and button gone; all 4 paragraphs of the API `page.body` present in order; tab shows `01 INCIDENT REPORT ✓`; meta `1 OF 4 PAGES READ · SAT 10 MAR · 08:35`; HUD `SAT 10 MAR · 08:35`, `15H 40M LEFT`; returning to F1 showed the body and the network log still listed only the one POST.
- Verdict reason: matches exactly.

## TC-40 — UI: a page with paperwork shows a notice and an attached-exhibit clip: PASS
- Command / action run: reset 048; open `/case/048/file`; select tab 02; click read
- Observed: toast `NEW CLUE DISCOVERED` with detail `E002 — Medical Examiner's Note`; clip `ATTACHED · E002` / `Medical Examiner's Note` linking to `/case/048/evidence?select=E002`; following it landed on `/case/048/evidence?select=E002` listing `1 EXHIBIT`, E002 "Medical Examiner's Note" (API `/evidence` = `[E002]`). Screenshot: `docs/qa/case-start-and-file/tc40-evidence-room.png`.
- Verdict reason: toast, clip, link target and Evidence Room all match.

## TC-41 — UI: reading a page without paperwork shows no clue notice: PASS
- Command / action run: 047, read F1 then F2 via the UI; snapshot after each click and a later DOM check; open `/case/047/evidence`
- Observed: no `NEW CLUE` text and no `ATTACHED` clip in the immediate snapshots, nor 1.5 s later; `GET /evidence` = `[]`; Evidence Room shows `0 EXHIBITS · 0 EXAMINED` and "NOTHING COLLECTED YET".
- Verdict reason: no notice, no clip, no exhibits.

## TC-42 — UI: HUD clock matches the API on a fresh case and survives a refresh: PASS
- Command / action run: 047 with F1, F2 read in the UI; full reload of `/case/047/file`, then of `/case/047`; fresh 047 and fresh 051 HUDs read earlier (TC-34/35/38)
- Observed: after reload on the file page: HUD `SAT 10 MAR · 08:55`, `15H 20M LEFT`; meta `2 OF 4 PAGES READ · SAT 10 MAR · 08:55`; tabs `01 ... ✓`, `02 ... ✓`; F2 body shown straight away and F1 body shown after tab click, with no POST `/read` in the network log; reload on `/case/047`: HUD `SAT 10 MAR · 08:55`, `15H 20M LEFT`. Fresh 047 HUD `SAT 10 MAR · 08:15` / `16H 00M LEFT`; fresh 051 HUD `SUN 15 JUL · 09:00` / `12H 00M LEFT`.
- Verdict reason: HUD is server-derived and survives a reload.

## TC-43 — UI: read button is disabled and HUD says time is up when the clock has run out: PASS
- Command / action run: reset 047; read F1-F3; 30 travels via API to time-up; open `/case/047/file`; select tab 04; attempt to click the read button
- Observed: page stayed on `/case/047/file`; HUD `SUN 11 MAR · 00:15` and `TIME IS UP`; F4 button `[ READ IT · 20 MIN ]` present with `disabled` attribute (Playwright click timed out: "element is not enabled"); banner text `TIME IS UP. THE BOARD WANTS A NAME BY MIDNIGHT.`; no POST `/read` in the network log.
- Verdict reason: matches exactly.

## TC-44 — UI: a rejected read shows the server message: PASS
- Command / action run: reset 047, read F1 via API; open `/case/047/file`, select unread F2; close the case via `POST /conclusion` (200) without reloading; click the F2 read button
- Observed: `POST /api/cases/047/file/F2/read` => 422; an element with `role="alert"` with text exactly `This case is closed.`; F2 still face down (no body), tab `02` has no check mark, HUD unchanged (`SAT 10 MAR · 08:35`, `15H 40M LEFT`).
- Verdict reason: matches exactly.

## Summary
Total: 44 | Pass: 44 | Fail: 0
Failures needing attention: none
Minor observations (not failures): test-cases.md says `BASE` is :4000 and that every case has pages F1..F4 (050 has three); the browser console logs a `/favicon.ico` 404 and GSAP "target .clip not found" warnings when a page is read.
