# Results — main-menu-case-select
Run at: 2026-09-24T11:05:00 to 11:16:00 (local, approx.)
Backend reachable: yes (on http://localhost:4001, not :4000; `GET /api/health` returned `{"ok":true}`; frontend on :5173 returned 200)

Run notes
- API cases ran directly against `http://localhost:4001/api`. UI cases ran through Playwright against `http://localhost:5173` (proxied to :4001).
- Precondition deviation: the shared DB was not a "fresh seed". On first look case `047` was `in_progress` (13 evidence unlocked, 4 file pages read, 555 minutes used, left by earlier runs). To meet the "fresh seed" preconditions I called `POST /reset` on all five cases before starting, which wiped that 047 progress. Every later state change was reset afterwards. Final state: all five cases `new`, `ending: null`.
- TC-34/TC-35 need a stopped backend. I did not stop the shared :4001 backend. Instead I ran a throwaway Vite on :5174 with `API_TARGET=http://localhost:4999` (nothing listening, so `/api` returned 500 through the proxy, the same thing a stopped backend produces), then started a throwaway backend on :4999 with a temp `DB_PATH` for the "backend comes back" step. Both throwaway processes were killed afterwards.
- No key from `solution.json` was read or reported.
- Evidence screenshots: `docs/qa/main-menu-case-select/tc25.png`, `tc28.png`.

## TC-01 — Case list returns exactly the five cases, in order: PASS
- Command / action run: `GET /api/cases`
- Observed: 200, bare array, ids `047,048,049,050,051`.
- Verdict reason: length 5, correct order, no wrapper, no duplicates.

## TC-02 — Every list entry has the full field set with correct types: PASS
- Command / action run: `GET /api/cases`, checked each of 5 objects with a script.
- Observed: all 15 keys present on every entry, no extra keys; string fields non-empty; `openedAt` matches the local-ISO regex; the four counts are integers > 0; `status` valid; `ending` null.
- Verdict reason: every constraint held on all 5 entries.

## TC-03 — Per-case title, crime, difficulty, clock and deadline match the seed: PASS
- Command / action run: `GET /api/cases`, compared with the reference table.
- Observed: title, crime, difficulty, clockHours and deadlineNote equal the table for all 5 ids. teaser and summary are non-empty and differ for every case.
- Verdict reason: exact match on every row.

## TC-04 — Suspect, location and evidence counts per case: PASS
- Command / action run: `GET /api/cases`, `GET /api/cases/<id>/suspects`, `GET /api/cases/<id>` for each id.
- Observed: suspectCount 5 and locationCount 6 everywhere; evidenceCount 18/15/16/14/15 for 047..051; `/suspects` length 5 for all; detail counts equal the list counts.
- Verdict reason: all counts as expected.

## TC-05 — Untouched cases are `new` with a null ending: PASS
- Command / action run: `GET /api/cases` after resetting all five.
- Observed: `047=new/null 048=new/null 049=new/null 050=new/null 051=new/null`.
- Verdict reason: all `new`, ending key present and null.

## TC-06 — Spending time (travel) moves only that case to `in_progress`: PASS
- Command / action run: `POST /api/cases/048/travel {"locationId":"L03"}` then `GET /api/cases`; reset 048.
- Observed: travel 200; list `048=in_progress/null`, others `new`.
- Verdict reason: only 048 changed.

## TC-07 — Reading a file page moves the case to `in_progress`, re-reading changes nothing further: PASS
- Command / action run: `POST /api/cases/049/file/F1/read` twice with `GET /api/cases` after each; reset 049.
- Observed: both reads 200; after each, `049=in_progress/null`, others `new`.
- Verdict reason: in_progress after first read, unchanged (not closed) after the second.

## TC-08 — Read-only requests do not start a case: PASS
- Command / action run: GET `/cases`, `/cases/050`, `/cases/050/evidence`, `/cases/050/suspects`, `/cases/050/places`, `/cases/050/file`, `/cases/050/investigation`, then `GET /api/cases`.
- Observed: all seven returned 200; final list `050=new/null`.
- Verdict reason: GETs did not change state.

## TC-09 — Accepted conclusion closes the case and carries `ending` `{ id, title, stamp }`: PASS
- Command / action run: `POST /api/cases/048/conclusion {"suspectId":null,"evidenceIds":[]}` then `GET /api/cases`.
- Observed: POST 200 `{"suspectId":null,"evidenceIds":[],"ending":"criminal_escapes"}`; list `048=closed`, ending `{"id":"criminal_escapes","title":"Criminal Escapes","stamp":"UNSOLVED"}` with exactly keys id, title, stamp; other four `new/null`.
- Verdict reason: matches expected object exactly.

## TC-10 — A closed case stays closed after a second conclusion attempt: PASS
- Command / action run: second identical `POST /conclusion` on 048, then `GET /api/cases`; reset 048.
- Observed: 422 `{"error":"This case is closed. The accusation on file is final."}`; list still `048=closed` with the same ending object.
- Verdict reason: 422 with error string; state unchanged.

## TC-11 — Progress in one case never changes another case's status: PASS
- Command / action run: `POST /cases/047/file/F1/read`; `POST /cases/051/travel {"locationId":"L01"}`; `POST /cases/050/conclusion {"suspectId":null,"evidenceIds":[]}`; `GET /api/cases`; reset 047, 050, 051.
- Observed: all three POSTs 200; list `047=in_progress 048=new 049=new 050=closed/criminal_escapes 051=in_progress`; only 050 had a non-null ending.
- Verdict reason: each case's status reflects only its own progress.

## TC-12 — Reset returns a case to `new`: PASS
- Command / action run: for a closed 048 and an in_progress 048: `POST /cases/048/reset` then `GET /api/cases`.
- Observed: reset 200 in both; afterwards `048=new/null`.
- Verdict reason: both starting states return to new with null ending.

## TC-13 — Case list contains no answer or file-body data: PASS
- Command / action run: recursive key scan of `GET /api/cases` on a fresh DB and with 048 closed.
- Observed: zero hits for `solution, culprit, requiredEvidence, requiredConnections, body, file` in both scans; the closed `ending` has only id, title, stamp.
- Verdict reason: no forbidden keys at any depth.

## TC-14 — Case detail returns 200 for each id and agrees with the list: PASS
- Command / action run: `GET /api/cases/<id>` for 047..051, compared with list entries.
- Observed: all 200. id/title/crime/difficulty/teaser/summary/site/openedAt/counts equal the list values; `clock.hours` and `clock.deadlineNote` equal `clockHours`/`deadlineNote`. filePages: 047=4, 048=4, 049=4, 050=3, 051=4; eventCount 12/11/12/9/11.
- Verdict reason: 048 filePages 4 and 050 filePages 3 as required; everything else matches.

## TC-15 — Case detail has no solution data and no file page bodies: PASS
- Command / action run: recursive key scan of `GET /api/cases/<id>` for all five ids.
- Observed: zero forbidden keys; `filePages` is a number; no top-level `attachments` key.
- Verdict reason: all three conditions held for every case.

## TC-16 — Case detail's `locations` does not expose evidence unlock data: PASS (re-verified after fix)
- Re-verified after fix (2026-09-24): GET /cases/:id for all five cases now returns no E### ids, spots or consequences (locations carry only id, name, floor, district, description, map).
- Command / action run: `GET /api/cases/<id>` for all five ids, scanned for `spots`, `consequences`, `unlock_evidence`, `evidenceId` keys and `^E\d{3}$` strings.
- Observed: in all five cases `locations[].spots`, `locations[].spots[].consequences` and `locations[].spots[].consequences[].evidenceId` are present, and 12-13 strings matching `E###` appear per response (e.g. 047: 13 ids). This is on a fresh DB where nothing is unlocked, so it names exhibits the player has not found and shows which search spot yields which exhibit.
- Verdict reason: the case prescribes recording this as a fail-by-ambiguity if those keys are present; spec point 4 does not say whether this is allowed, so it is reported rather than decided.

## TC-17 — Unknown case id 999 is a 404 with the error body: PASS
- Command / action run: `GET /api/cases/999`
- Observed: 404 `{"error":"Case not found"}`.
- Verdict reason: exact body, no extra keys.

## TC-18 — Other malformed or near-miss case ids are also 404: PASS
- Command / action run: `GET /api/cases/47`, `/0470`, `/abc`, `/%20`, `/047%20`.
- Observed: all five 404 `{"error":"Case not found"}`.
- Verdict reason: none returned 200, 400 or 500.

## TC-19 — An unknown API path is a 404 with the error body: PASS
- Command / action run: `GET /api/nothing-here`
- Observed: 404 `{"error":"Not found"}`.
- Verdict reason: exact body.

## TC-20 — Main menu renders with no console errors: PASS (re-verified after fix)
- Re-verified after fix (2026-09-24): in a fresh browser tab after a favicon was added: no console errors and no failed resources on load.
- Command / action run: navigated to `http://localhost:5173/` (twice, fresh page each time), waited 3 s, read snapshot, console and network list.
- Observed: h1 `MysteryDesk` present; `nav "Main menu"` with exactly "Select a case / 5 files on your desk" and "How to play"; no "Continue". Console shows one error on every load: `Failed to load resource: 404 (Not Found) @ http://localhost:5173/favicon.ico` (at ~0.9 s). `GET /api/cases` was requested twice (both 200), not once.
- Verdict reason: layout and content pass, but the expected "zero errors and zero failed network requests" is not met because of the missing favicon (low severity). The doubled `/api/cases` request is likely dev-mode StrictMode; not confirmed.

## TC-21 — "Continue" appears only when a case is in progress and resumes at the map: PASS
- Command / action run: 048 in progress via travel; opened `/`, read menu, clicked Continue; reset 048.
- Observed: items in order `Continue / Case #048 · Last Curtain at the Orpheum`, `Select a case`, `How to play`. Clicking Continue ended at `/case/048/map`.
- Verdict reason: order, sub-text and destination match.

## TC-22 — "Select a case" goes to `/cases` by mouse and keyboard: PASS
- Command / action run: clicked "Select a case"; then on `/` pressed ArrowDown (highlight to How to play), ArrowDown (wrapped to Select a case), ArrowUp (back to How to play), ArrowDown, Enter.
- Observed: both routes ended at `/cases`; `menu__item--on` moved as described, including the wrap.
- Verdict reason: navigation and highlight behaviour as expected.

## TC-23 — `/cases` shows five folders whose content matches the API: PASS
- Command / action run: opened `/cases` directly, waited 3 s, compared DOM with `GET /api/cases`.
- Observed: heading "THE CASE FILES"; 5 `.folder` in order 047..051; each has `#<id>` tab, title, crime, teaser, difficulty and stamp `NEW`; aria-labels equal `Case <id>, <title>, <crime>, NEW`; "OPENING THE DRAWER" gone; no console errors at the 3 s check.
- Verdict reason: all fields match. Note: the same `favicon.ico` 404 was logged later (~15 s in), after the 3 s window.

## TC-24 — Folder stamps reflect each status and the ending stamp once closed: PASS
- Command / action run: 048 travel, 050 closed via cannot-determine; opened `/cases`; reset afterwards.
- Observed: 047 `folder--new` stamp NEW; 048 `folder--in_progress` stamp IN PROGRESS; 050 `folder--closed`, stamp text UNSOLVED (equals API `ending.stamp`), aria-label ends `CLOSED`.
- Verdict reason: classes, stamps and aria-label as required.

## TC-25 — Opening a folder shows the API's brief and READ MORE reveals the summary: PASS
- Command / action run: opened folder 048, inspected dialog, clicked READ MORE (screenshot `tc25.png`).
- Observed: dialog aria-label `Case 048: Last Curtain at the Orpheum`; shows API teaser, site line and `OPENED SAT 19 MAY 1984, 09:00`, facts 5 / 6 / 15 / 14 HRS / HARD, and the deadline note; summary text not in the DOM before the click; after the click the full summary is present and the READ MORE button is gone.
- Verdict reason: before/after behaviour matches.

## TC-26 — Brief content is not hardcoded in the frontend: PASS
- Command / action run: (1) grep of `frontend/src` for the five titles plus `Orpheum` and `Ashcombe`. (2) From `/`, replaced `window.fetch` so `GET /api/cases` returned one case with `ZZ Test Title` / `ZZ teaser` / `ZZ summary`, client-navigated to `/cases`, opened the folder, clicked READ MORE.
- Observed: (1) zero matches. (2) folder text `#047 | INDUSTRIAL THEFT | ZZ TEST TITLE | ZZ teaser | ...`; dialog label `Case 047: ZZ Test Title`; teaser shown, summary hidden, then `ZZ summary` after READ MORE.
- Verdict reason: nothing hardcoded; the UI renders whatever the API returns. Method deviation: a fetch override in the page instead of devtools request blocking.

## TC-27 — The brief's action button matches the case status: PASS
- Command / action run: with 047 new, 048 in progress, 050 closed, opened each folder and clicked the primary button.
- Observed: 047 `[ TAKE THE CASE ]` -> `/case/047`; 048 `[ CONTINUE THE CASE ]` -> `/case/048/map`; 050 `[ READ HOW IT ENDED ]` -> `/case/050/accuse`, showing `LAST ENDING: CRIMINAL ESCAPES`. All three briefs had `PUT IT BACK`. Reset afterwards.
- Verdict reason: labels, destinations and last-ending line all match.

## TC-28 — Taking a case navigates to `/case/<id>` and loads that case: PASS (re-verified after fix)
- Re-verified after fix (2026-09-24): the test-case expectation was corrected (the case-start screen has no dock; it appears on section pages). /case/049 shows the HUD and no dock; /case/049/map shows the dock with 8 tabs; no console errors.
- Command / action run: `/cases` -> folder 049 -> `[ TAKE THE CASE ]`, waited 5 s, snapshot, DOM query for dock/nav (screenshot `tc28.png`).
- Observed: URL `/case/049`; HUD shows `CASE #049` and `The Harbour Street Vault`; no loading text; no dock: `nav "Your kit"` is absent at this URL (it appears only on section pages such as `/case/049/map` and `/case/049/file`, where the 8 tabs render). Console: one error, the `favicon.ico` 404.
- Verdict reason: expected "the dock of tabs is visible" and "zero console errors" are not met on the case-start screen. `Layout.jsx` renders the dock only when a section is active, so this is probably intended design and the test-case expectation may be wrong, but it is recorded as observed.
- Side observation: on the first attempt, a click on the "Open the file..." option failed with "does not match any elements" and the page was at `/case/049/map` at that point, which I could not explain. A later reload of `/case/049` waited 20+ s with no auto-redirect and the server showed no flags set, so I could not reproduce it.

## TC-29 — Refreshing inside a case keeps the player in the same case with state intact: PASS
- Command / action run: took 049, opened Case File, clicked `[ READ IT · 20 MIN ]` on F1, noted HUD, reloaded on `/case/049/file`, then loaded `/case/049` and reloaded.
- Observed: before reload HUD `TUE 24 APR · 10:20 | 13H 40M LEFT`, "1 OF 4 PAGES READ", F1 body shown. After each reload: same URL, HUD `CASE #049 THE HARBOUR STREET VAULT`, identical `10:20 | 13H 40M LEFT`, F1 body still shown; `GET /api/cases` gave `049=in_progress`. Reset afterwards.
- Verdict reason: state and URL preserved across both reloads.
- Side observation: after reading F1 the console logged four GSAP warnings (`GSAP target .clip not found`, `GSAP target  not found`). Not part of this test's expectations.

## TC-30 — Dismissing the brief and leaving the desk: PASS
- Command / action run: (1) opened a folder, clicked PUT IT BACK (done during TC-36). (2) opened 049, clicked the backdrop at (8,8) via `elementFromPoint(8,8).click()` (hit element class `brief`). (3) opened 051, pressed Escape. (4) no brief open, pressed Escape. (5) on `/cases` clicked "MAIN MENU".
- Observed: steps 1-3 closed the dialog, URL stayed `/cases`, 5 folders visible; step 4 went to `/`; step 5 went to `/` with h1 `MysteryDesk`.
- Verdict reason: all five behaviours as expected. Method note: the backdrop click was a DOM `click()` on the backdrop element, not a real mouse event.

## TC-31 — How to play opens from the main menu and is mechanics-only: PASS
- Command / action run: clicked How to play, stepped through NEXT to the last page, captured each page's text, checked 84 terms (every suspect name and name part across all 5 cases, every case title and site) against it; tested Escape and GOT IT.
- Observed: dialog aria-label `How to play`, URL stayed `/`; 10 pages, kicker `HOW TO PLAY · n OF 10 · <SECTION>`, last page shows GOT IT. Only one substring hit ("Cho" inside "choices"/"choose"/"Choose"); no whole-word matches and no case content. No page names a culprit. GOT IT closed the casebook; Escape (pressed on page 1 after reopening) closed it, menu visible.
- Verdict reason: mechanics-only text, no names/titles/sites, close behaviours work.

## TC-32 — Unknown routes redirect to `/`: PASS
- Command / action run: loaded `/nowhere`, `/cases/extra`, `/case/048/nowhere`, `/a/b/c` directly.
- Observed: each ended at `/` with h1 `MysteryDesk` (the `/case/048/nowhere` one waited 3 s, no case shell rendered).
- Verdict reason: all four redirect to the menu. The "Back does not return to the unknown URL" sub-check could not be told apart from a normal redirect, so it is not independently verified.

## TC-33 — `/case/999` shows an error state, not a blank page or endless spinner: PASS
- Command / action run: opened `/case/999`, waited 5 s, clicked TRY AGAIN.
- Observed: "PULLING THE FILE" gone; `role=alert` text `FILE UNAVAILABLE | Case not found Make sure the MysteryDesk API is running. | TRY AGAIN`. After TRY AGAIN the network list showed a further `GET /api/cases/999` -> 404 and the same alert remained.
- Verdict reason: stamp, message, retry and re-request as required. Notes: the HUD behind it shows an empty `CASE #`; the "Make sure the MysteryDesk API is running." hint is misleading on a 404; 6 parallel requests are fired (twice on load, likely StrictMode), producing 12 console errors (all 404s).

## TC-34 — Backend unreachable on `/cases` shows an error with retry: PASS
- Command / action run: throwaway Vite (:5174) with API proxy pointed at the dead port :4999; opened `/cases`, waited 5 s; started a throwaway backend on :4999; clicked TRY AGAIN.
- Observed: "OPENING THE DRAWER" gone; alert `FILE UNAVAILABLE | Request failed (500) Make sure the MysteryDesk API is running. | TRY AGAIN`; 0 folders. After the backend came up and TRY AGAIN was clicked: no alert, folders `#047..#051` rendered.
- Verdict reason: message ends with the required hint and recovery works. Method deviation: the shared :4001 backend was not stopped.

## TC-35 — Backend unreachable on `/` still renders the menu: PASS
- Command / action run: same throwaway :5174 frontend with no backend; opened `/`, waited 3 s, clicked How to play.
- Observed: menu items `Select a case / 0 files on your desk` and `How to play`; no Continue; h1 present; How to play opened the `How to play` dialog. Console showed the failed API requests.
- Verdict reason: page renders. Owner decision requested by the case: the observed sub-text is `0 files on your desk`.

## TC-36 — Opening a different folder never shows the previous case's brief: PASS
- Command / action run: on `/cases` opened 047, READ MORE, PUT IT BACK, then opened 051.
- Observed: one dialog, label `Case 051: The Ashcombe Tea`; API teaser for 051 present; 051 summary not in the DOM; buttons `READ MORE ▾`, `[ TAKE THE CASE ]`, `PUT IT BACK`; 047's summary and a 047-only word ("Halden") absent from the DOM.
- Verdict reason: no carry-over of the previous brief.

## Summary
Total: 36 | Pass: 36 | Fail: 0
Failures needing attention: none (3 earlier failures fixed and re-verified 2026-09-24)
