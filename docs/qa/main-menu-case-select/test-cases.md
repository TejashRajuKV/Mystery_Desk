# Test cases — Main Menu and Case Select

Spec: `docs/specs/main-menu-case-select.md`. Cross-checked against `backend/src/services/case.service.js`, `backend/src/routes/index.js`, `backend/src/middleware/errorHandler.js`, `frontend/src/App.jsx`, `pages/MainMenu`, `pages/CaseSelect`, `components/Tutorial`, `components/Layout`, `components/ui` (ErrorState) and the public seed files `data/cases/<id>/case.json`, `endings.json`. `solution.json` was not opened.

Conventions

- **[API]** cases are run with curl or equivalent against the backend (`http://localhost:4000/api`, or through the Vite proxy at `:5173/api`). **[UI]** cases need the browser (Vite on `:5173`).
- "Fresh seed" means the backend was stopped, `backend/storage/mysterydesk.v2.sqlite` (and `-wal`/`-shm`) deleted, and the backend restarted. Cases that change state say so and end with `POST /api/cases/<id>/reset`.
- "Forbidden keys" (used in leak checks) means any object key, at any depth, whose name matches one of: `solution`, `culprit`, `requiredEvidence`, `requiredConnections`, `body`, `file`. For the detail response the numeric `filePages` is allowed; the key `file` is not.
- Error body shape for every 404/400/422 is exactly `{ "error": "<string>" }`.

Reference values (from public `case.json`; the API is the source of truth for anything not listed here):

| id | title | crime | difficulty | clockHours | deadlineNote |
|----|-------|-------|-----------|-----------|--------------|
| 047 | The Missing Prototype | Industrial theft | Standard | 16 | The board wants a name by midnight. |
| 048 | Last Curtain at the Orpheum | Murder | Hard | 14 | The Sunday papers go to press at eleven tonight. |
| 049 | The Harbour Street Vault | Bank heist | Hard | 14 | The evening papers go to bed at midnight. |
| 050 | Midnight Chrome | Grand theft auto | Standard | 12 | The insurers write it off at nine tonight. |
| 051 | The Ashcombe Tea | Poisoning | Standard | 12 | The inquest opens at nine tomorrow; the coroner wants a name tonight. |

---

## TC-01 — [API] Case list returns exactly the five cases, in order

- **Covers spec point:** 1
- **Preconditions:** Fresh seed.
- **Steps / Input:** `GET /api/cases`
- **Expected result:** Status 200. Body is a bare JSON array (not wrapped in `{ data: ... }`) of length exactly 5. The `id` values, in array order, are `"047"`, `"048"`, `"049"`, `"050"`, `"051"`. No other ids, no duplicates.
- **Priority:** high

## TC-02 — [API] Every list entry has the full field set with correct types

- **Covers spec point:** 1
- **Preconditions:** Fresh seed.
- **Steps / Input:** `GET /api/cases`; inspect each of the 5 objects.
- **Expected result:** Each object contains all of these keys: `id`, `title`, `crime`, `difficulty`, `teaser`, `summary`, `openedAt`, `site`, `deadlineNote`, `suspectCount`, `evidenceCount`, `locationCount`, `clockHours`, `status`, `ending`. `id`, `title`, `crime`, `difficulty`, `teaser`, `summary`, `site`, `deadlineNote` are non-empty strings. `openedAt` is a local ISO string matching `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$`. `suspectCount`, `evidenceCount`, `locationCount`, `clockHours` are integers greater than 0. `status` is one of `"new"`, `"in_progress"`, `"closed"`. `ending` is `null` on a fresh seed.
- **Priority:** high

## TC-03 — [API] Per-case title, crime, difficulty, clock and deadline match the seed

- **Covers spec point:** 1
- **Preconditions:** Fresh seed.
- **Steps / Input:** `GET /api/cases`; compare each entry to the reference table at the top of this file.
- **Expected result:** For each id, `title`, `crime`, `difficulty`, `clockHours` (number) and `deadlineNote` equal the table row exactly. `teaser` and `summary` are different, non-empty strings for every case, and `summary` is not equal to `teaser`.
- **Priority:** medium

## TC-04 — [API] Suspect, location and evidence counts per case

- **Covers spec point:** 2
- **Preconditions:** Fresh seed.
- **Steps / Input:** `GET /api/cases`; read `suspectCount`, `locationCount`, `evidenceCount` for each case. Then for each case id `GET /api/cases/<id>/suspects` and count the array. (`GET /api/cases/<id>/evidence` returns `[]` on a fresh seed because nothing is unlocked yet, so evidence is checked against the list counts only.)
- **Expected result:** Every case has `suspectCount` = 5 and `locationCount` = 6. `evidenceCount` is 18 for `047`, 15 for `048`, 16 for `049`, 14 for `050`, 15 for `051`. `GET /suspects` length is 5 for every case. `GET /api/cases/<id>` returns the same three counts as the list entry for that id.
- **Priority:** high

## TC-05 — [API] Untouched cases are `new` with a null ending

- **Covers spec point:** 3
- **Preconditions:** Fresh seed; no other calls made.
- **Steps / Input:** `GET /api/cases`
- **Expected result:** All 5 entries have `status` exactly `"new"` and `ending` exactly `null` (the key is present, value null).
- **Priority:** high

## TC-06 — [API] Spending time (travel) moves only that case to `in_progress`

- **Covers spec point:** 3
- **Preconditions:** Fresh seed.
- **Steps / Input:** 1) `POST /api/cases/048/travel` body `{ "locationId": "L03" }`. 2) `GET /api/cases`.
- **Expected result:** Step 1 returns 200. In step 2 the entry for `048` has `status: "in_progress"` and `ending: null`; entries `047`, `049`, `050`, `051` still have `status: "new"`. Cleanup: `POST /api/cases/048/reset`.
- **Priority:** high

## TC-07 — [API] Reading a file page moves the case to `in_progress`, and re-reading changes nothing further

- **Covers spec point:** 3
- **Preconditions:** Fresh seed.
- **Steps / Input:** 1) `POST /api/cases/049/file/F1/read`. 2) `GET /api/cases`. 3) `POST /api/cases/049/file/F1/read` again. 4) `GET /api/cases`.
- **Expected result:** Step 1 returns 200. Step 2: `049` is `"in_progress"`, the other four are `"new"`. Step 3 returns 200. Step 4: `049` is still `"in_progress"` (not `closed`), `ending` still `null`. Cleanup: `POST /api/cases/049/reset`.
- **Priority:** high

## TC-08 — [API] Read-only requests do not start a case

- **Covers spec point:** 3
- **Preconditions:** Fresh seed.
- **Steps / Input:** For case `050`, issue: `GET /api/cases`, `GET /api/cases/050`, `GET /api/cases/050/evidence`, `GET /api/cases/050/suspects`, `GET /api/cases/050/places`, `GET /api/cases/050/file`, `GET /api/cases/050/investigation`. Then `GET /api/cases`.
- **Expected result:** Every request returns 200. In the final list, `050` still has `status: "new"` and `ending: null`. (Also confirms GET never changes state.)
- **Priority:** medium

## TC-09 — [API] Accepted conclusion closes the case and carries `ending` `{ id, title, stamp }`

- **Covers spec point:** 3
- **Preconditions:** Fresh seed.
- **Steps / Input:** 1) `POST /api/cases/048/conclusion` body `{ "suspectId": null, "evidenceIds": [] }`. 2) `GET /api/cases`.
- **Expected result:** Step 1 returns 200. In step 2, entry `048` has `status: "closed"` and `ending` equal to exactly `{ "id": "criminal_escapes", "title": "Criminal Escapes", "stamp": "UNSOLVED" }` (these strings come from `data/cases/048/endings.json`; the object has exactly these three keys). The other four cases are still `"new"` with `ending: null`. Leave the state for TC-10, then reset.
- **Priority:** high

## TC-10 — [API] A closed case stays closed after a second conclusion attempt

- **Covers spec point:** 3
- **Preconditions:** State from TC-09 (case `048` closed).
- **Steps / Input:** 1) `POST /api/cases/048/conclusion` body `{ "suspectId": null, "evidenceIds": [] }`. 2) `GET /api/cases`. Cleanup: `POST /api/cases/048/reset`.
- **Expected result:** Step 1 returns 422 with `{ "error": "<non-empty string>" }`. In step 2, `048` is still `status: "closed"` with the same `ending` object as in TC-09.
- **Priority:** medium

## TC-11 — [API] Progress in one case never changes another case's status

- **Covers spec point:** 3
- **Preconditions:** Fresh seed.
- **Steps / Input:** 1) `POST /api/cases/047/file/F1/read`. 2) `POST /api/cases/051/travel` body `{ "locationId": "L01" }`. 3) `POST /api/cases/050/conclusion` body `{ "suspectId": null, "evidenceIds": [] }`. 4) `GET /api/cases`. Cleanup: reset `047`, `051`, `050`.
- **Expected result:** Steps 1-3 return 200 (if `L01` does not exist in `051`, use any id from `GET /api/cases/051/places`). Step 4: `047` = `in_progress`, `051` = `in_progress`, `050` = `closed`, `048` = `new`, `049` = `new`. Only `050` has a non-null `ending`.
- **Priority:** medium

## TC-12 — [API] Reset returns a case to `new`

- **Covers spec point:** 3
- **Preconditions:** Case `048` is `in_progress` (as in TC-06) and, separately, `closed` (as in TC-09).
- **Steps / Input:** For each starting state: `POST /api/cases/048/reset`, then `GET /api/cases`.
- **Expected result:** Reset returns 200 (or 204). Afterwards `048` has `status: "new"` and `ending: null`.
- **Priority:** medium

## TC-13 — [API] Case list contains no answer or file-body data

- **Covers spec point:** 4
- **Preconditions:** Fresh seed, then repeat once with case `048` closed (TC-09 state) so the `ending` object is exercised.
- **Steps / Input:** `GET /api/cases`; recursively scan every object key in the response.
- **Expected result:** No key matches the forbidden keys (`solution`, `culprit`, `requiredEvidence`, `requiredConnections`, `body`, `file`) at any depth. The only keys inside a non-null `ending` are `id`, `title`, `stamp`. Cleanup: reset `048`.
- **Priority:** high

## TC-14 — [API] Case detail returns 200 for each of the five ids and agrees with the list

- **Covers spec point:** 1, 2, 4
- **Preconditions:** Fresh seed.
- **Steps / Input:** For each id in `047`..`051`: `GET /api/cases/<id>`.
- **Expected result:** Status 200 each. Body is a bare object with `id` equal to the requested id, `title`, `crime`, `difficulty`, `teaser`, `summary`, `site`, `openedAt` equal to the values in the list entry, plus `suspectCount`, `evidenceCount`, `locationCount` equal to the list counts, `filePages` an integer >= 2, `eventCount` an integer > 0, `clock.hours` equal to the list's `clockHours`, `clock.deadlineNote` equal to the list's `deadlineNote`. For `048`, `filePages` is 4; for `050`, `filePages` is 3.
- **Priority:** high

## TC-15 — [API] Case detail has no solution data and no file page bodies

- **Covers spec point:** 4
- **Preconditions:** Fresh seed.
- **Steps / Input:** For each id `047`..`051`: `GET /api/cases/<id>`; recursively scan every object key.
- **Expected result:** No forbidden key (`solution`, `culprit`, `requiredEvidence`, `requiredConnections`, `body`, `file`) appears at any depth. `filePages` is a number, not an array. No key named `attachments` appears at the top level of the response.
- **Priority:** high

## TC-16 — [API] Case detail's `locations` does not expose evidence unlock data (ambiguity to verify)

- **Covers spec point:** 4 (and the CLAUDE.md rule that locked evidence "doesn't exist" for the player)
- **Preconditions:** Fresh seed; nothing searched.
- **Steps / Input:** `GET /api/cases/048`; inspect `locations[*]`.
- **Expected result:** Spec point 4 does not list search spots, so this is a verification of intent: per CLAUDE.md, no response should name locked evidence. Expected: no `spots`, `consequences`, `unlock_evidence` or `evidenceId` keys anywhere in the response, and no string matching `^E\d{3}$` anywhere in the response. The source (`case.service.js#getCase` spreads `cases.listLocations()`) appears to return raw location records including `spots[].consequences`. If those keys are present, record the case as FAILED-BY-AMBIGUITY and report it to the owner rather than deciding whether the spec allows it.
- **Priority:** medium

## TC-17 — [API] Unknown case id 999 is a 404 with the error body

- **Covers spec point:** 5
- **Preconditions:** None.
- **Steps / Input:** `GET /api/cases/999`
- **Expected result:** Status 404. Body is exactly `{ "error": "Case not found" }`. No other keys. Body contains none of the forbidden keys.
- **Priority:** high

## TC-18 — [API] Other malformed or near-miss case ids are also 404

- **Covers spec point:** 5
- **Preconditions:** None.
- **Steps / Input:** `GET /api/cases/47`, `GET /api/cases/0470`, `GET /api/cases/abc`, `GET /api/cases/%20`, `GET /api/cases/047%20`.
- **Expected result:** Every request returns 404 with body exactly `{ "error": "Case not found" }`. None returns 200, 400 or 500.
- **Priority:** medium

## TC-19 — [API] An unknown API path is a 404 with the error body

- **Covers spec point:** 5
- **Preconditions:** None.
- **Steps / Input:** `GET /api/nothing-here`
- **Expected result:** Status 404 with body exactly `{ "error": "Not found" }`.
- **Priority:** low

## TC-20 — [UI] Main menu renders with no console errors

- **Covers spec point:** 6
- **Preconditions:** Fresh seed; backend and Vite running; browser console open and cleared.
- **Steps / Input:** Open `http://localhost:5173/`. Wait 3 seconds.
- **Expected result:** The page shows the heading "MysteryDesk" (h1, `aria-label="MysteryDesk"`), a nav labelled "Main menu" with exactly two buttons: "Select a case" (sub-text "5 files on your desk") and "How to play". There is no "Continue" button. The console contains zero errors and zero failed network requests (the only API call is `GET /api/cases`, status 200).
- **Priority:** high

## TC-21 — [UI] "Continue" appears only when a case is in progress and resumes at the map

- **Covers spec point:** 6, 8
- **Preconditions:** Case `048` in progress (`POST /api/cases/048/travel` `{ "locationId": "L03" }`); others new.
- **Steps / Input:** Open `/`. Click "Continue".
- **Expected result:** The first menu item is "Continue" with sub-text `Case #048 · Last Curtain at the Orpheum`, followed by "Select a case" and "How to play". Clicking it ends on URL `/case/048/map`. Cleanup: reset `048`.
- **Priority:** medium

## TC-22 — [UI] "Select a case" goes to `/cases` by mouse and keyboard

- **Covers spec point:** 6
- **Preconditions:** Fresh seed.
- **Steps / Input:** Open `/`. Click "Select a case". Return to `/`; press ArrowDown/ArrowUp until "Select a case" is highlighted (class `menu__item--on`), press Enter.
- **Expected result:** Both routes end at URL `/cases`. ArrowDown from "Select a case" moves the highlight to "How to play"; ArrowDown from "How to play" wraps to the first item.
- **Priority:** medium

## TC-23 — [UI] `/cases` shows five folders whose content matches the API

- **Covers spec point:** 6
- **Preconditions:** Fresh seed; console cleared.
- **Steps / Input:** Open `/cases` directly. Also fetch `GET /api/cases` for comparison.
- **Expected result:** The heading "The Case Files" is shown. Exactly 5 elements with class `folder` are rendered, in the order 047, 048, 049, 050, 051. For each folder: the tab text is `#<id>`, the title text equals the API `title`, the crime label equals API `crime` upper-cased, the teaser text equals the API `teaser`, the difficulty label equals API `difficulty` upper-cased, and the stamp reads `NEW`. Each folder's `aria-label` is `Case <id>, <title>, <crime>, NEW`. No loading text ("OPENING THE DRAWER") remains after 3 seconds. Console has zero errors.
- **Priority:** high

## TC-24 — [UI] Folder stamps reflect each status and the ending stamp once closed

- **Covers spec point:** 3, 6
- **Preconditions:** `047` new; `048` in progress (travel to `L03`); `050` closed via `POST /api/cases/050/conclusion` `{ "suspectId": null, "evidenceIds": [] }`. Note the `ending.stamp` returned by `GET /api/cases` for `050`.
- **Steps / Input:** Open `/cases`.
- **Expected result:** Folder 047 stamp text `NEW`; folder 048 stamp text `IN PROGRESS`; folder 050 stamp text equals the API `ending.stamp` for `050` (not `CLOSED`); folder 050 `aria-label` ends with `CLOSED`; the folder elements have classes `folder--new`, `folder--in_progress`, `folder--closed` respectively. Cleanup: reset `048` and `050`.
- **Priority:** high

## TC-25 — [UI] Opening a folder shows the API's brief and READ MORE reveals the summary

- **Covers spec point:** 7
- **Preconditions:** Fresh seed.
- **Steps / Input:** Open `/cases`; click folder 048. Compare with `GET /api/cases`. Click "READ MORE ▾".
- **Expected result:** A dialog with `aria-label` `Case 048: <title from API>` opens. Before READ MORE: the dialog shows the API `teaser` text, the site and `OPENED <date>` line built from API `site`/`openedAt`, and the facts PERSONS OF INTEREST 5, PLACES 6, EXHIBITS 15, ON THE CLOCK 14 HRS, DIFFICULTY HARD, plus the API `deadlineNote`; the API `summary` text is NOT in the DOM; a "READ MORE ▾" button is present. After clicking: the full API `summary` string appears in the dialog and the "READ MORE" button is gone.
- **Priority:** high

## TC-26 — [UI] Brief content is not hardcoded in the frontend

- **Covers spec point:** 7 (and the CLAUDE.md rule that no case data lives in `.jsx`)
- **Preconditions:** None (static check plus one runtime check).
- **Steps / Input:** 1) Search `frontend/src` (all `.jsx`, `.js`) for each of these strings: `The Missing Prototype`, `Last Curtain at the Orpheum`, `The Harbour Street Vault`, `Midnight Chrome`, `The Ashcombe Tea`, `Orpheum`, `Ashcombe`. 2) In the browser devtools, block/override the `GET /api/cases` response to return one case with `title: "ZZ Test Title"`, `teaser: "ZZ teaser"`, `summary: "ZZ summary"` and reload `/cases`; open that folder.
- **Expected result:** 1) Zero matches in `frontend/src`. 2) The folder and brief show `ZZ Test Title`, `ZZ teaser`, and after READ MORE `ZZ summary`.
- **Priority:** high

## TC-27 — [UI] The brief's action button matches the case status

- **Covers spec point:** 3, 7, 8
- **Preconditions:** `047` new; `048` in progress (travel to `L03`); `050` closed (cannot-determine conclusion).
- **Steps / Input:** Open `/cases`; open folders 047, 048, 050 one at a time and note the primary button; click it in each.
- **Expected result:** 047: button `[ TAKE THE CASE ]`, click ends at URL `/case/047`. 048: button `[ CONTINUE THE CASE ]`, click ends at `/case/048/map`. 050: button `[ READ HOW IT ENDED ]`, click ends at `/case/050/accuse`; the dialog also shows `LAST ENDING:` followed by the API `ending.title` upper-cased. Each brief has a secondary "PUT IT BACK" button. Cleanup: reset `048` and `050`.
- **Priority:** high

## TC-28 — [UI] Taking a case navigates to `/case/<id>` and loads that case

- **Covers spec point:** 8
- **Preconditions:** Fresh seed.
- **Steps / Input:** `/cases` → open folder 049 → click `[ TAKE THE CASE ]`. Wait for the scene transition to finish (max 5 seconds).
- **Expected result:** URL is `/case/049`. The HUD shows `CASE #049` and the title `The Harbour Street Vault`. The case-start screen shows no dock of tabs (the dock only appears on section pages); navigating to `/case/049/map` afterwards shows it. No loading spinner remains. Console has zero errors.
- **Priority:** high

## TC-29 — [UI] Refreshing inside a case keeps the player in the same case with state intact

- **Covers spec point:** 8
- **Preconditions:** Fresh seed.
- **Steps / Input:** Take case 049 (TC-28). Open the Case File tab (`/case/049/file`), read page F1 (cost 20 minutes). Note the HUD time-left value. Reload the browser (F5) on `/case/049/file`. Then navigate to `/case/049` and reload again.
- **Expected result:** After each reload the URL is unchanged, the HUD still shows `CASE #049` and `The Harbour Street Vault`, page F1 is still shown as read with its body, and the HUD time-left value equals the value noted before the reload. `GET /api/cases` shows `049` as `in_progress`. Cleanup: reset `049`.
- **Priority:** high

## TC-30 — [UI] Dismissing the brief and leaving the desk

- **Covers spec point:** 7
- **Preconditions:** Fresh seed.
- **Steps / Input:** On `/cases`: 1) open a folder, click "PUT IT BACK". 2) open a folder, click the dark backdrop outside the folder paper. 3) open a folder, press Escape. 4) with no brief open, press Escape. 5) click "← MAIN MENU" from `/cases`.
- **Expected result:** Steps 1-3 close the dialog and leave the URL at `/cases` with five folders visible. Step 4 navigates to `/`. Step 5 navigates to `/`.
- **Priority:** low

## TC-31 — [UI] How to play opens from the main menu and is mechanics-only

- **Covers spec point:** 9
- **Preconditions:** Fresh seed.
- **Steps / Input:** 1) Open `/`, click "How to play". 2) Step through every page with "NEXT →" until the last page shows "GOT IT"; on each page record all visible text. 3) For each case id `047`..`051`, `GET /api/cases/<id>/suspects` and collect every suspect `name` (and its individual name parts), and `GET /api/cases` for every `title`, `site`. 4) Search the recorded tutorial text for each collected string. 5) Press Escape on any page; reopen and click "GOT IT" on the last page.
- **Expected result:** A dialog with `aria-label` `How to play` opens over the menu (URL still `/`). Its kicker reads `HOW TO PLAY · <n> OF 10 · ...` and there are 10 pages. No suspect name, case title or case site from step 3 appears in any page (zero matches in step 4). No page states who the culprit is. Escape closes the casebook and leaves the menu visible; "GOT IT" on the last page closes it.
- **Priority:** high

## TC-32 — [UI] Unknown routes redirect to `/`

- **Covers spec point:** 10
- **Preconditions:** Fresh seed.
- **Steps / Input:** Type each URL directly into the address bar: `/nowhere`, `/cases/extra`, `/case/048/nowhere`, `/a/b/c`.
- **Expected result:** Each ends at URL `/` (the path is replaced, so Back does not return to the unknown URL) and shows the main menu with the "MysteryDesk" heading. (If `/case/048/nowhere` instead renders inside the case shell, record it as a deviation from spec point 10.)
- **Priority:** medium

## TC-33 — [UI] `/case/999` shows an error state, not a blank page or endless spinner

- **Covers spec point:** 10
- **Preconditions:** Backend running.
- **Steps / Input:** Open `http://localhost:5173/case/999`. Wait 5 seconds.
- **Expected result:** Within 5 seconds the loading label "PULLING THE FILE" is gone. An element with `role="alert"` is visible containing the stamp text `FILE UNAVAILABLE`, the message `Case not found` (from the API 404 body), and a `TRY AGAIN` button. Clicking `TRY AGAIN` re-requests `GET /api/cases/999` (404 again) and shows the same error state, not a blank page. The page is not blank.
- **Priority:** high

## TC-34 — [UI] Backend unreachable on `/cases` shows an error with retry

- **Covers spec point:** 11
- **Preconditions:** Backend process stopped; Vite running.
- **Steps / Input:** Open `/cases`. Wait 5 seconds. Then start the backend and click `TRY AGAIN`.
- **Expected result:** While the backend is down: within 5 seconds "OPENING THE DRAWER" disappears and a `role="alert"` element shows `FILE UNAVAILABLE`, a non-empty message ending with `Make sure the MysteryDesk API is running.`, and a `TRY AGAIN` button; no folders are shown. After the backend is back and `TRY AGAIN` is clicked, the error state disappears and five folders (047-051) render.
- **Priority:** high

## TC-35 — [UI] Backend unreachable on `/` still renders the menu

- **Covers spec point:** 6, 11
- **Preconditions:** Backend process stopped; Vite running.
- **Steps / Input:** Open `/`. Wait 3 seconds.
- **Expected result:** The main menu still renders with "Select a case" and "How to play"; there is no "Continue" item and no blank page (source falls back to an empty case list on failure, so the sub-text reads `0 files on your desk`). "How to play" still opens the casebook. Spec does not state this behavior explicitly; record the observed sub-text so the owner can decide whether `0 files on your desk` is acceptable.
- **Priority:** low

## TC-36 — [UI] Opening a different folder never shows the previous case's brief

- **Covers spec point:** 7
- **Preconditions:** Fresh seed.
- **Steps / Input:** On `/cases`: open folder 047, click "READ MORE ▾", click "PUT IT BACK". Open folder 051.
- **Expected result:** The dialog `aria-label` is `Case 051: The Ashcombe Tea`; it shows the API `teaser` for `051`, the `summary` is hidden again and "READ MORE ▾" is present; no text from case 047's summary is in the DOM.
- **Priority:** low

---

## Additional cases (added 2026-09-24)

Added after re-reading current source (`backend/src/services/case.service.js`, `backend/src/services/field.service.js`, `backend/src/services/investigation.service.js`, `backend/src/config/index.js`, `backend/src/middleware/errorHandler.js`, `frontend/src/pages/MainMenu/MainMenu.jsx`, `frontend/src/pages/CityMap/CityMap.jsx`, `frontend/src/services/api.js`) against commit `b45dd98`. These cover: the `getCase` location shape now being explicitly whitelisted (resolves the ambiguity TC-16 flagged), closed cases rejecting legwork write endpoints, the clock clamping at budget instead of overrunning it, and the favicon fix's effect on the "zero failed network requests" checks in TC-20/TC-23. None of these duplicate an existing TC.

## TC-37 — [API] Case detail's `locations` field exposes no search-spot or unlock data

- **Covers spec point:** 4
- **Preconditions:** Fresh seed.
- **Steps / Input:** `GET /api/cases/048`; inspect every entry of `locations[]`.
- **Expected result:** Each location object has exactly these keys: `id`, `name`, `floor`, `district`, `description`, `map` (and `map`, when present, has only `x`, `y`, `kind`). None of `spots`, `consequences`, `unlock_evidence`, `evidenceId`, `arrival`, `people` appears anywhere in the response, and no string matching `^E\d{3}$` appears anywhere in the response. (`case.service.js#getCase` now builds each location with an explicit `{ id, name, floor, district, description, map }` pick, which closes the leak TC-16 flagged as an ambiguity to verify — this test asserts the fixed behavior directly. If any forbidden key reappears, treat it as a regression, not an ambiguity.)
- **Priority:** high

## TC-38 — [API] A closed case rejects every legwork write endpoint with the same message

- **Covers spec point:** 3, 8
- **Preconditions:** Fresh seed, then close case `048`: `POST /api/cases/048/conclusion` body `{ "suspectId": null, "evidenceIds": [] }` (200).
- **Steps / Input:** Against the now-closed case `048`: 1) `POST /api/cases/048/travel` body `{ "locationId": "L01" }`. 2) `POST /api/cases/048/places/L01/search` body `{ "spotId": "L01-book" }`. 3) `POST /api/cases/048/file/F1/read`. 4) `PUT /api/cases/048/theory` body `{ "text": "closed-case check" }`.
- **Expected result:** All four requests return status 422 with body exactly `{ "error": "This case is closed." }`. A follow-up `GET /api/cases/048/investigation` shows `locationId` unchanged from before this test, `pagesRead` does not include `"F1"`, `spotsSearched` does not include `"L01-book"`, and `theory` is unchanged — none of the four calls had any effect. Cleanup: `POST /api/cases/048/reset`.
- **Priority:** high

## TC-39 — [UI] Closed case blocks further travel in the map with an inline message, not a crash

- **Covers spec point:** 3, 8
- **Preconditions:** Case `048` closed (as in TC-38, or via the brief's `[ READ HOW IT ENDED ]` per TC-27).
- **Steps / Input:** Navigate to `/case/048/map` directly. Click a location marker other than the one the detective is currently at.
- **Expected result:** The URL stays `/case/048/map`; there is no navigation away, no blank page, and no unhandled exception in the console. An element with `role="alert"` is visible showing the message text `This case is closed.` exactly (the API's error string surfaced verbatim, per `frontend/src/services/api.js`'s `err.message = data.error`). Cleanup: reset `048`.
- **Priority:** medium

## TC-40 — [API] The clock clamps at the case's budget; running it out does not close the case by itself

- **Covers spec point:** 3
- **Preconditions:** Fresh seed, case `050` (`clockHours` 12, i.e. 720 minutes; travel costs 30 minutes per `config.TIME_COST`).
- **Steps / Input:** 1) `GET /api/cases/050/places`; pick two distinct location ids, A and B. 2) Alternate `POST /api/cases/050/travel` `{ "locationId": A }` / `{ "locationId": B }` at least 24 times (enough to exceed 720 travel-minutes), reading `investigation.clock` from each response. 3) After time is up, issue one more `POST /api/cases/050/travel` to the other of A/B. 4) `GET /api/cases`.
- **Expected result:** Once `minutesUsed` reaches 720, `clock.timeUp` is `true` and `clock.minutesLeft` is exactly `0` (never negative); `clock.minutesUsed` never exceeds 720 across all calls. The extra travel call in step 3 returns 422 with body exactly `{ "error": "Time is up. The District Attorney wants a name." }` and does not move the detective. In step 4, `050`'s `status` is still `"in_progress"` with `ending: null` — the clock running out never sets `status` to `"closed"` on its own; only an accepted conclusion does. Cleanup: `POST /api/cases/050/reset`.
- **Priority:** medium

## TC-41 — [UI] Main menu never offers "Continue" for a closed case

- **Covers spec point:** 3, 6
- **Preconditions:** Case `048` closed via `POST /api/cases/048/conclusion` `{ "suspectId": null, "evidenceIds": [] }`; no other case in progress.
- **Steps / Input:** Open `/`.
- **Expected result:** The menu has exactly two items, "Select a case" and "How to play"; there is no "Continue" item anywhere (`MainMenu.jsx` only offers Continue for a case with `status === 'in_progress'`, which a closed case never has). Cleanup: reset `048`.
- **Priority:** medium

## TC-42 — [UI] With more than one case in progress, "Continue" resumes only one of them

- **Covers spec point:** 6, 8
- **Preconditions:** Both `047` and `049` in progress (`POST /api/cases/047/travel` and `POST /api/cases/049/travel`, each to any valid `locationId` for that case); no case closed.
- **Steps / Input:** Open `/`.
- **Expected result:** Exactly one "Continue" item is shown, with sub-text `Case #047 · The Missing Prototype` (the first `in_progress` case in the `GET /api/cases` list order, since `MainMenu.jsx` uses `.find`); there is no second "Continue" item for `049`. Clicking it ends at URL `/case/047/map`. Cleanup: reset `047` and `049`.
- **Priority:** low

## TC-43 — [UI] The favicon request never shows as a failed network request on the menu or case select

- **Covers spec point:** 6
- **Preconditions:** Fresh seed; browser network tab open and cleared.
- **Steps / Input:** Open `/`, then `/cases`. Inspect the network panel for the request to `/favicon.svg` (referenced from `frontend/index.html`'s `<link rel="icon">`, served from `frontend/public/favicon.svg`).
- **Expected result:** The favicon request returns status 200 (not 404), so it never counts against the "zero failed network requests" checks in TC-20 and TC-23.
- **Priority:** low

## TC-44 — [UI] A caseId that looks plausible but isn't one of the five folders is a 404, not silently rendered

- **Covers spec point:** 5, 10 (the CLAUDE.md rule that `:caseId` must be one of the five folders; anything else is a 404)
- **Preconditions:** Backend running.
- **Steps / Input:** Open `/case/052` (one past the real range) and, separately, `/case/0470` (near-miss of a real id). Wait 5 seconds on each.
- **Expected result:** For each: within 5 seconds the loading label is gone; an element with `role="alert"` is visible showing the stamp text `FILE UNAVAILABLE` and the message `Case not found` (matching the `GET /api/cases/<id>` 404 body), with a `TRY AGAIN` button — the same error state as TC-33, never a blank page and never a rendered case shell.
- **Priority:** medium

---

Summary: 44 test cases (36 original + 8 added 2026-09-24), 24 high priority.
