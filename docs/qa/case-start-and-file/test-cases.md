# Test cases — Case Start, Case Clock and Case File

Spec: `docs/specs/case-start-and-file.md`. Cross-checked against `docs/PRD.md`, `CLAUDE.md`,
`backend/src/services/field.service.js`, `investigation.service.js`, `case.service.js`,
`config/index.js`, `routes/index.js`, `data/cases/*/case.json` (file pages and clock only) and
`frontend/src/pages/{CaseStart,CaseFile}`, `components/Layout`.

## Conventions

- `BASE` = `http://localhost:4000/api` (or the Vite proxy `http://localhost:5173/api`). `<id>` is a case id: one of `047`, `048`, `049`, `050`, `051`.
- "Fresh" means `POST BASE/cases/<id>/reset` was just called on that case (response is the investigation state).
- "Investigation" means the body of `GET BASE/cases/<id>/investigation`.
- Errors are `{ "error": "<message>" }` with the stated status.
- Cases marked **UI** need a browser. Everything else is API-only (curl or equivalent).
- Time costs (`config.TIME_COST`): readPage 20, travel 30, search 15, question 10, present 10.

## Seed facts the cases rely on (read from `data/cases/*/case.json`, not from the answer key)

| Case | Clock start | Hours | Total min | Deadline (`start` + hours) | Pages with non-empty `attachments` |
|------|-------------|-------|-----------|----------------------------|------------------------------------|
| 047 | `1984-03-10T08:15:00` | 16 | 960 | `1984-03-11T00:15:00` | none (F1-F4 all empty) |
| 048 | `1984-05-19T09:00:00` | 14 | 840 | `1984-05-19T23:00:00` | F2 -> E002 "Medical Examiner's Note" |
| 049 | `1984-04-24T10:00:00` | 14 | 840 | `1984-04-25T00:00:00` | F2 -> E002 "Loss Schedule"; F3 -> E015 "Kemp's 1971 Conviction" |
| 050 | `1984-06-10T09:00:00` | 12 | 720 | `1984-06-10T21:00:00` | F2 -> E002 "Insurance Schedule" |
| 051 | `1984-07-15T09:00:00` | 12 | 720 | `1984-07-15T21:00:00` | F2 -> E002 "Toxicology Report" |

Every case has pages `F1`..`F4` (page ids are `F1`, `F2`, ... in every case).

**Ambiguity noted:** Case 047 has no page with attachments, so spec point 4 ("reading a page that has
attachments adds those exhibit ids") can only be exercised on 048-051. The spec's "Case 047's clock is 16
hours from 08:15" gives a deadline of `1984-03-11T00:15:00` (15 minutes past midnight), while 047's
`deadlineNote` says "by midnight"; the cases below assert the spec's formula (`start` + `clockHours`), not the note.

---

## TC-01 — Fresh GET /file (Case 047): every page unread, body null, attachments empty

- **Covers spec point:** 1
- **Preconditions:** Fresh 047.
- **Steps / Input:** `GET BASE/cases/047/file`
- **Expected result:** 200. Body is a JSON array (not wrapped in `{ data }`) with exactly 4 entries with ids `F1`, `F2`, `F3`, `F4` in that order. Each entry has exactly the keys `id`, `title`, `read`, `body`, `attachments`. For every entry: `read === false`, `body === null`, `attachments` is `[]`, `title` is a non-empty string.
- **Priority:** high

## TC-02 — Fresh GET /file for every other case

- **Covers spec point:** 1
- **Preconditions:** Fresh 048, 049, 050, 051 (reset each).
- **Steps / Input:** For each `<id>` in 048, 049, 050, 051: `GET BASE/cases/<id>/file`
- **Expected result:** 200 for each. Every entry has keys `id`, `title`, `read`, `body`, `attachments`; all `read === false`, all `body === null`, all `attachments` equal `[]` (including F2 in each case and F3 in 049, whose attachments must NOT appear before the page is read). Page ids start at `F1` and are contiguous.
- **Priority:** high

## TC-03 — GET /cases/047 leaves out the page bodies

- **Covers spec point:** 1
- **Preconditions:** Any state (fresh 047).
- **Steps / Input:** `GET BASE/cases/047`
- **Expected result:** 200. The response object has NO key named `file`. It has a numeric `filePages` equal to the length of the array from `GET BASE/cases/047/file` (4). The raw response text does not contain the string `Taken: the Argus-7 prototype, from its case in Storage Room B.` (a sentence that appears only in the F1 page body, not in `briefing`) and does not contain `047-2` (a reference that appears only in the F2 page body). The response does contain `clock` with `start` `"1984-03-10T08:15:00"`, `hours` `16` and a string `deadlineNote`.
- **Priority:** high

## TC-04 — GET /cases/:caseId leaves out page bodies for all five cases

- **Covers spec point:** 1
- **Preconditions:** None.
- **Steps / Input:** For each `<id>` in 047-051: `GET BASE/cases/<id>`; then `GET BASE/cases/<id>/file`.
- **Expected result:** For each case: 200; the case response has no `file` key; `filePages` equals the length of the `/file` array; the case response contains no key named `body` at any depth; after reading every page of that case (see TC-15) the text of no page body paragraph is present in a fresh `GET /cases/<id>` response (spot check: take the last paragraph of F4 returned by the read call and assert it is absent).
- **Priority:** medium

## TC-05 — Fresh investigation: nothing unlocked, no pages read, no file flags, clock at zero (Case 047)

- **Covers spec point:** 1, 7, 8
- **Preconditions:** Fresh 047.
- **Steps / Input:** `GET BASE/cases/047/investigation`
- **Expected result:** 200. `unlockedEvidence` is `[]`. `pagesRead` is `[]`. `storyFlags` has no key starting with `file.`. `clock.minutesUsed === 0`, `clock.minutesLeft === 960`, `clock.timeUp === false`, `clock.now === clock.start === "1984-03-10T08:15:00"`, `clock.deadline === "1984-03-11T00:15:00"`.
- **Priority:** high

## TC-06 — Fresh GET /evidence returns an empty list, for every case

- **Covers spec point:** 8
- **Preconditions:** Fresh case (reset each of 047-051 before checking it).
- **Steps / Input:** For each `<id>`: `GET BASE/cases/<id>/evidence`, and `GET BASE/cases/<id>/investigation`.
- **Expected result:** 200 with body exactly `[]` for the evidence list; `investigation.unlockedEvidence` is `[]` for every case.
- **Priority:** high

## TC-07 — Read a page: response shape

- **Covers spec point:** 2
- **Preconditions:** Fresh 047.
- **Steps / Input:** `POST BASE/cases/047/file/F1/read` (no body)
- **Expected result:** 200. Body has exactly the top-level keys `page`, `investigation`, `effects`. `page.id === "F1"`, `page.read === true`, `page.body` is a non-empty array of strings, `page.attachments` is `[]`, `page.title` equals the title of F1 in `GET /file`. `investigation` is the full investigation state (has `clock`, `storyFlags`, `unlockedEvidence`, `pagesRead`, ...). `effects.unlockedEvidence` is `[]` (present as an array, not missing).
- **Priority:** high

## TC-08 — First read costs 20 minutes and moves the clock

- **Covers spec point:** 3, 7
- **Preconditions:** Fresh 047 (`minutesUsed === 0`).
- **Steps / Input:** `POST BASE/cases/047/file/F1/read`, then `GET BASE/cases/047/investigation`.
- **Expected result:** In both the read response `investigation.clock` and the GET response `clock`: `minutesUsed === 20`, `minutesLeft === 940`, `timeUp === false`, `now === "1984-03-10T08:35:00"`, `start === "1984-03-10T08:15:00"`, `deadline === "1984-03-11T00:15:00"`. `pagesRead` is `["F1"]`.
- **Priority:** high

## TC-09 — Re-reading the same page costs nothing and unlocks nothing new

- **Covers spec point:** 3
- **Preconditions:** Fresh 047; `POST .../file/F1/read` already done once (`minutesUsed === 20`).
- **Steps / Input:** `POST BASE/cases/047/file/F1/read` twice more.
- **Expected result:** Both calls 200. In each, `investigation.clock.minutesUsed === 20`, `minutesLeft === 940`, `now === "1984-03-10T08:35:00"`; `page.read === true` and `page.body` is the same array as on the first read; `effects.unlockedEvidence` is `[]`; `investigation.pagesRead` is `["F1"]` (no duplicate).
- **Priority:** high

## TC-10 — Reading pages without attachments unlocks nothing (Case 047, all pages)

- **Covers spec point:** 4, 8
- **Preconditions:** Fresh 047.
- **Steps / Input:** `POST BASE/cases/047/file/F1/read`, `.../F2/read`, `.../F3/read`, `.../F4/read`; after each, `GET BASE/cases/047/evidence`.
- **Expected result:** Each read returns 200 with `effects.unlockedEvidence === []` and `page.attachments === []`. After each read `investigation.unlockedEvidence === []` and `GET /evidence` returns `[]`.
- **Priority:** high

## TC-11 — Reading a page with an attachment unlocks it (Case 048, F2 -> E002)

- **Covers spec point:** 2, 4
- **Preconditions:** Fresh 048. Before the read, `GET BASE/cases/048/evidence/E002` returns 404.
- **Steps / Input:** `POST BASE/cases/048/file/F2/read`, then `GET BASE/cases/048/evidence` and `GET BASE/cases/048/evidence/E002`.
- **Expected result:** Read response: 200; `page.attachments` equals `[{ "id": "E002", "title": "Medical Examiner's Note" }]`; `effects.unlockedEvidence` equals `[{ "id": "E002", "title": "Medical Examiner's Note" }]`; `investigation.unlockedEvidence` equals `["E002"]`. `GET /evidence` is a one-element array whose element has `id === "E002"`. `GET /evidence/E002` is 200. `investigation.clock.minutesUsed === 20`.
- **Priority:** high

## TC-12 — Case 049: two pages with attachments (F2 -> E002, F3 -> E015)

- **Covers spec point:** 2, 4
- **Preconditions:** Fresh 049.
- **Steps / Input:** `POST BASE/cases/049/file/F1/read`, then `.../F2/read`, then `.../F3/read`, then `.../F4/read`.
- **Expected result:** F1: `effects.unlockedEvidence === []`, `investigation.unlockedEvidence === []`. F2: `effects.unlockedEvidence` is `[{ "id": "E002", "title": "Loss Schedule" }]`, `investigation.unlockedEvidence` is `["E002"]`. F3: `effects.unlockedEvidence` is `[{ "id": "E015", "title": "Kemp's 1971 Conviction" }]`, and `investigation.unlockedEvidence` contains exactly `E002` and `E015` (order not asserted, no other ids). F4: `effects.unlockedEvidence === []` and `unlockedEvidence` still has exactly `E002` and `E015`. Final `clock.minutesUsed === 80`.
- **Priority:** high

## TC-13 — Cases 050 and 051: F2 unlocks E002 with the right title

- **Covers spec point:** 4
- **Preconditions:** Fresh 050; fresh 051.
- **Steps / Input:** `POST BASE/cases/050/file/F2/read`; `POST BASE/cases/051/file/F2/read`.
- **Expected result:** 050: `effects.unlockedEvidence === [{ "id": "E002", "title": "Insurance Schedule" }]` and `investigation.unlockedEvidence === ["E002"]`. 051: `effects.unlockedEvidence === [{ "id": "E002", "title": "Toxicology Report" }]` and `investigation.unlockedEvidence === ["E002"]`. Reading `F1` on either case first or after does not add anything else.
- **Priority:** medium

## TC-14 — Re-reading an attachment page does not re-unlock or duplicate

- **Covers spec point:** 3, 4
- **Preconditions:** Fresh 048; `POST .../file/F2/read` done once (`minutesUsed === 20`, `unlockedEvidence === ["E002"]`).
- **Steps / Input:** `POST BASE/cases/048/file/F2/read` again.
- **Expected result:** 200. `effects.unlockedEvidence === []`. `investigation.unlockedEvidence === ["E002"]` (one entry). `investigation.clock.minutesUsed === 20`. `page.attachments` still lists E002 (the page keeps showing its clip once read).
- **Priority:** high

## TC-15 — GET /file after reading: only read pages reveal body and attachments

- **Covers spec point:** 1, 2, 4
- **Preconditions:** Fresh 048; only F2 read.
- **Steps / Input:** `GET BASE/cases/048/file`
- **Expected result:** 200. F2 entry: `read === true`, `body` is a non-empty array of strings, `attachments === [{ "id": "E002", "title": "Medical Examiner's Note" }]`. F1, F3, F4 entries: `read === false`, `body === null`, `attachments === []`.
- **Priority:** high

## TC-16 — Reading sets storyFlags["file.<pageId>"] to true, and only for pages read

- **Covers spec point:** 5
- **Preconditions:** Fresh 047.
- **Steps / Input:** `POST BASE/cases/047/file/F1/read`; then `GET BASE/cases/047/investigation`.
- **Expected result:** In both the read response `investigation.storyFlags` and the GET response: `storyFlags["file.F1"] === true` (boolean `true`, not `"true"` or `1`). Keys `file.F2`, `file.F3`, `file.F4` are absent. `investigation.pagesRead` is `["F1"]`.
- **Priority:** high

## TC-17 — All four pages read: all flags set, cumulative cost is 80 minutes

- **Covers spec point:** 3, 5, 7
- **Preconditions:** Fresh 047.
- **Steps / Input:** `POST .../F1/read`, `.../F2/read`, `.../F3/read`, `.../F4/read`; `GET BASE/cases/047/investigation`.
- **Expected result:** `storyFlags["file.F1"]`, `["file.F2"]`, `["file.F3"]`, `["file.F4"]` are all `true`. `pagesRead` contains exactly F1-F4. `clock.minutesUsed === 80`, `minutesLeft === 880`, `now === "1984-03-10T09:35:00"`, `timeUp === false`. Costs after each read were 20, 40, 60, 80.
- **Priority:** high

## TC-18 — Unknown page id is a 404 and changes nothing

- **Covers spec point:** 6
- **Preconditions:** Fresh 047.
- **Steps / Input:** `POST BASE/cases/047/file/F9/read`; then `GET BASE/cases/047/investigation`.
- **Expected result:** Read call: status 404, body `{ "error": "There is no such page in the file" }`. Investigation afterwards: `clock.minutesUsed === 0`, `pagesRead === []`, no `file.*` flag, `unlockedEvidence === []`.
- **Priority:** high

## TC-19 — Page ids are exact: wrong case, empty-ish and other-kind ids are 404

- **Covers spec point:** 6
- **Preconditions:** Fresh 047.
- **Steps / Input:** Each of: `POST BASE/cases/047/file/f1/read`, `POST BASE/cases/047/file/F0/read`, `POST BASE/cases/047/file/E002/read`, `POST BASE/cases/047/file/F1%20/read`.
- **Expected result:** Every call: status 404 and body `{ "error": "There is no such page in the file" }`. Afterwards `clock.minutesUsed === 0` and `pagesRead === []`.
- **Priority:** medium

## TC-20 — Unknown case id is a 404 on the file endpoints

- **Covers spec point:** 6 (id validation), 1
- **Preconditions:** None.
- **Steps / Input:** `GET BASE/cases/999/file`; `POST BASE/cases/999/file/F1/read`; `GET BASE/cases/999/investigation`; `GET BASE/cases/999`.
- **Expected result:** Every call: status 404 and body `{ "error": "Case not found" }`.
- **Priority:** medium

## TC-21 — Clock object shape and deadline arithmetic for every case

- **Covers spec point:** 7
- **Preconditions:** Fresh case for each of 047-051.
- **Steps / Input:** For each `<id>`: `GET BASE/cases/<id>/investigation`, and `GET BASE/cases/<id>` for `clock.start` and `clock.hours`.
- **Expected result:** `investigation.clock` has keys `start`, `deadline`, `now`, `minutesUsed`, `minutesLeft`, `timeUp` (and `costs`). Values by case (start / deadline / minutesLeft): 047 `1984-03-10T08:15:00` / `1984-03-11T00:15:00` / 960; 048 `1984-05-19T09:00:00` / `1984-05-19T23:00:00` / 840; 049 `1984-04-24T10:00:00` / `1984-04-25T00:00:00` / 840; 050 `1984-06-10T09:00:00` / `1984-06-10T21:00:00` / 720; 051 `1984-07-15T09:00:00` / `1984-07-15T21:00:00` / 720. In each: `now === start`, `minutesUsed === 0`, `timeUp === false`, `start` equals `GET /cases/<id>` `clock.start`, and `deadline - start` equals `clock.hours * 60` minutes.
- **Priority:** high

## TC-22 — Time costs are published on the clock and match the spec

- **Covers spec point:** (preamble costs), 7
- **Preconditions:** Any.
- **Steps / Input:** `GET BASE/cases/047/investigation`
- **Expected result:** `clock.costs` deep-equals `{ "readPage": 20, "travel": 30, "search": 15, "question": 10, "present": 10 }`.
- **Priority:** medium

## TC-23 — minutesLeft decreases as actions are taken; now tracks minutesUsed

- **Covers spec point:** 7
- **Preconditions:** Fresh 047.
- **Steps / Input:** `GET /places`, pick a location id `L`; `POST BASE/cases/047/file/F1/read` (20); `POST BASE/cases/047/travel { "locationId": "<L>" }` (30). Read `clock` after each.
- **Expected result:** After read: `minutesUsed 20`, `minutesLeft 940`, `now 1984-03-10T08:35:00`. After travel: 200, `investigation.clock.minutesUsed 50`, `minutesLeft 910`, `now 1984-03-10T09:05:00`. At every step `minutesUsed + minutesLeft === 960`, `deadline` is unchanged at `1984-03-11T00:15:00`, `start` is unchanged.
- **Priority:** high

## TC-24 — GET requests never change the clock or read state

- **Covers spec point:** 1, 3 (GET is read-only per CLAUDE.md)
- **Preconditions:** Fresh 047.
- **Steps / Input:** `GET /file`, `GET /file`, `GET /investigation`, `GET /cases/047`, `GET /evidence` (each 3 times). Also `GET BASE/cases/047/file/F1/read`.
- **Expected result:** After all the GETs: `clock.minutesUsed === 0`, `pagesRead === []`, no `file.*` flags, all page entries `read === false`. The `GET .../file/F1/read` call returns 404 (no such GET route) and does not mark F1 read.
- **Priority:** medium

## TC-25 — Reading an unread page after time is up is rejected (422), no state change

- **Covers spec point:** 3, 7
- **Preconditions:** Fresh 047. Read F1, F2, F3 (`minutesUsed === 60`). `GET /places`, take two different location ids `LA`, `LB`. Send `POST BASE/cases/047/travel` 30 times alternating `{ "locationId": "LA" }`, `{ "locationId": "LB" }`, starting with `LA` (the first travel moves from no location; each of the 30 costs 30 minutes, so 60 + 900 = 960). Each travel must return 200.
- **Steps / Input:** `GET BASE/cases/047/investigation`; then `POST BASE/cases/047/file/F4/read`; then `GET BASE/cases/047/investigation` and `GET BASE/cases/047/file`.
- **Expected result:** First investigation: `clock.minutesUsed === 960`, `minutesLeft === 0`, `timeUp === true`, `now === "1984-03-11T00:15:00"` (equal to `deadline`). Read of F4: status 422, body `{ "error": "Time is up. The District Attorney wants a name." }`. Afterwards: `minutesUsed` still 960, `pagesRead` is `["F1","F2","F3"]`, `storyFlags` has no `file.F4`, and the F4 entry in `GET /file` is `read === false`, `body === null`.
- **Priority:** high

## TC-26 — After time is up, re-reading an already-read page still works and costs nothing

- **Covers spec point:** 3
- **Preconditions:** State from TC-25 (047 with `timeUp === true`, F1 read).
- **Steps / Input:** `POST BASE/cases/047/file/F1/read`
- **Expected result:** 200. `page.read === true`, `page.body` is the non-empty array. `investigation.clock.minutesUsed === 960`, `timeUp === true`. `effects.unlockedEvidence === []`.
- **Priority:** low

## TC-27 — Reading an unread page on a closed case is rejected (422)

- **Covers spec point:** 3 (cost/gating; the case-closed rule comes from `CLAUDE.md`/`spendTime`, not the spec — verify)
- **Preconditions:** Fresh 047; read only F1. Close the case: `POST BASE/cases/047/conclusion { "suspectId": null, "evidenceIds": [] }` returns 200.
- **Steps / Input:** `POST BASE/cases/047/file/F2/read`; then `POST BASE/cases/047/file/F1/read`.
- **Expected result:** F2: status 422, body `{ "error": "This case is closed." }`, and afterwards `clock.minutesUsed === 20`, `pagesRead === ["F1"]`. F1 (already read): 200, cost unchanged (`minutesUsed === 20`).
- **Priority:** low

## TC-28 — Reset restores clock, flags, pages and unlocked evidence

- **Covers spec point:** 9
- **Preconditions:** 048 with F1 and F2 read (`minutesUsed === 40`, `unlockedEvidence === ["E002"]`, flags `file.F1` and `file.F2` true).
- **Steps / Input:** `POST BASE/cases/048/reset`; then `GET BASE/cases/048/investigation`, `GET BASE/cases/048/file`, `GET BASE/cases/048/evidence`.
- **Expected result:** Reset returns 200 with the investigation state: `clock.minutesUsed === 0`, `minutesLeft === 840`, `now === start === "1984-05-19T09:00:00"`, `timeUp === false`, `storyFlags` has no `file.*` key, `pagesRead === []`, `unlockedEvidence === []` (the default: `defaultUnlockedEvidence` is empty in every case), `conclusion === null`. Subsequent GETs agree: every page `read === false`, `body === null`, `attachments === []`; `GET /evidence` is `[]`; `GET /evidence/E002` is 404.
- **Priority:** high

## TC-29 — After reset, reading costs and unlocks again (nothing is "already spent")

- **Covers spec point:** 3, 4, 9
- **Preconditions:** State from TC-28 (fresh 048 after reset).
- **Steps / Input:** `POST BASE/cases/048/file/F2/read`.
- **Expected result:** 200. `investigation.clock.minutesUsed === 20`. `effects.unlockedEvidence === [{ "id": "E002", "title": "Medical Examiner's Note" }]`. `storyFlags["file.F2"] === true`.
- **Priority:** high

## TC-30 — Reset after time-up or a closed case makes the file readable again

- **Covers spec point:** 9
- **Preconditions:** 047 in the time-up state from TC-25 (or closed as in TC-27).
- **Steps / Input:** `POST BASE/cases/047/reset`; then `POST BASE/cases/047/file/F4/read`.
- **Expected result:** Reset 200 with `clock.timeUp === false`, `minutesUsed === 0`, `conclusion === null`. Read of F4: 200, `investigation.clock.minutesUsed === 20`.
- **Priority:** medium

## TC-31 — Progress is scoped to its own case

- **Covers spec point:** 2, 3, 5, 9
- **Preconditions:** Fresh 047 and fresh 048.
- **Steps / Input:** `POST BASE/cases/048/file/F2/read`; then `GET BASE/cases/047/investigation`, `GET BASE/cases/047/file`, `GET BASE/cases/047/evidence`; then `POST BASE/cases/047/reset`; then `GET BASE/cases/048/investigation`.
- **Expected result:** After the 048 read, 047 is untouched: `minutesUsed === 0`, `pagesRead === []`, no `file.*` flags, `GET /file` all unread, `GET /evidence` is `[]`. After resetting 047, 048 still has `minutesUsed === 20`, `pagesRead === ["F2"]`, `unlockedEvidence === ["E002"]`, `storyFlags["file.F2"] === true`.
- **Priority:** medium

## TC-32 — State persists between requests (server-owned)

- **Covers spec point:** 2, 5, 11 (persistence half)
- **Preconditions:** Fresh 047.
- **Steps / Input:** `POST .../file/F1/read`, `POST .../file/F3/read`; then, as separate later requests, `GET /investigation` and `GET /file` (with no client-side state carried).
- **Expected result:** `pagesRead` is `["F1","F3"]` (order not asserted), `clock.minutesUsed === 40`, `now === "1984-03-10T08:55:00"`, flags `file.F1` and `file.F3` true and `file.F2`/`file.F4` absent; `GET /file` shows F1 and F3 `read: true` with bodies, F2 and F4 `read: false`, `body: null`.
- **Priority:** medium

## TC-33 — The file endpoints never leak the answer key

- **Covers spec point:** 1, 2 (security-sensitive: nothing about the answer in these responses)
- **Preconditions:** Case 049 with F1-F4 all read (so every response has its fullest content).
- **Steps / Input:** Capture the raw text of `GET BASE/cases/049`, `GET BASE/cases/049/file`, each `POST .../file/<F1..F4>/read` response, and `GET BASE/cases/049/investigation`.
- **Expected result:** In none of the captured texts does any JSON key equal `solution`, `culprit`, `requiredEvidence` or `requiredConnections`, and none of the strings `"culprit"`, `"requiredEvidence"`, `"requiredConnections"` occurs anywhere in them.
- **Priority:** high

---

## UI cases (need the browser; frontend on :5173 proxying to the backend)

## TC-34 — UI: CaseStart shows the brief from the API and the two main choices (fresh case)

- **Covers spec point:** 10
- **Preconditions:** Fresh 047 (`POST /cases/047/reset`). Browser open at `http://localhost:5173/case/047`.
- **Steps / Input:** Load the page. Compare against `GET /api/cases/047` and `GET /api/cases/047/investigation`.
- **Expected result:** The page shows: the folder label `CASE #047`; `classification` (`CONFIDENTIAL`) and `crime` (`Industrial theft`) on the folder; the title `The Missing Prototype` as the `h1`; the `summary` text exactly as returned by the API (the "Sometime between Friday evening and Saturday morning ..." paragraph); the `deadlineNote`; the time line `SAT 10 MAR · 08:15 · RIDGEWAY INDUSTRIAL PARK` (formatted from `clock.now` and `site`); the heading `What do you do?`. The choice list contains exactly three options in this order: `Open the file and read it (each page takes time)`, `Leave the file on the desk. Go straight to the scene`, `Put the file back and pick another case`.
- **Priority:** high

## TC-35 — UI: CaseStart takes its text from the API, not from the source

- **Covers spec point:** 10 (and the "never hardcodes case data" rule)
- **Preconditions:** Fresh 048 and fresh 051.
- **Steps / Input:** Open `/case/048`, then `/case/051`. Compare each to `GET /api/cases/<id>`.
- **Expected result:** 048 page shows `CASE #048`, title `Last Curtain at the Orpheum`, the 048 `summary`, the 048 `deadlineNote`, time line `SAT 19 MAY · 09:00 · CANAL STREET, RIDGEWAY`. 051 page shows `CASE #051`, title `The Ashcombe Tea`, the 051 `summary`, its `deadlineNote`, time line `SUN 15 JUL · 09:00 · ASHCOMBE HALL, NEAR RIDGEWAY`. None of the 047 strings appear on either page.
- **Priority:** medium

## TC-36 — UI: choosing "Open the file" goes to the file; choosing "Go straight to the scene" goes to the map at no cost

- **Covers spec point:** 10, 3 (going out does not spend time)
- **Preconditions:** Fresh 047, at `/case/047`.
- **Steps / Input:** (a) Click `Open the file and read it (each page takes time)`. Observe the URL, then press Back to return. (b) Click `Leave the file on the desk. Go straight to the scene`. Then `GET /api/cases/047/investigation`.
- **Expected result:** (a) URL becomes `/case/047/file`. (b) URL becomes `/case/047/map`. `pagesRead` is `[]`, no `file.*` flag, `clock.minutesUsed === 0`, and the HUD still shows `SAT 10 MAR · 08:15` with `16H 00M LEFT`.
- **Priority:** high

## TC-37 — UI: CaseStart choice labels change once the case has been started or closed

- **Covers spec point:** 10
- **Preconditions:** 047 with F1 read via API (`pagesRead === ["F1"]`).
- **Steps / Input:** Open `/case/047`. Then close the case via `POST /cases/047/conclusion { "suspectId": null, "evidenceIds": [] }` and reload.
- **Expected result:** Started: the summary paragraph reads `The file is where you left it, and the clock is still running.` (not the API `summary`); choices in order: `Get back out there`, `Read the case file again`, `Put the file back and pick another case`. Closed: choices are exactly `Read how it ended` and `Put the file back and pick another case`.
- **Priority:** low

## TC-38 — UI: unread CaseFile page hides its body and offers a timed read button

- **Covers spec point:** 10, 1
- **Preconditions:** Fresh 047. Browser at `/case/047/file`.
- **Steps / Input:** Load the page; click each tab in turn.
- **Expected result:** Heading `Case File #047`. Meta line starts with `0 OF 4 PAGES READ`. Four tabs numbered `01`-`04` whose titles equal the `title` values from `GET /api/cases/047/file`; no tab shows a ✓. The selected (first) page shows the text `The page is face down. Reading it properly will take time off the clock.` and a button labelled `[ READ IT · 20 MIN ]`. None of the page body text (for example the string `Taken: the Argus-7 prototype`) is present in the DOM. Switching tabs never triggers a `POST .../read` request (check the network log) and the clock stays at `SAT 10 MAR · 08:15`.
- **Priority:** high

## TC-39 — UI: reading a page reveals the body, ticks the tab and updates the HUD clock

- **Covers spec point:** 10, 3, 7
- **Preconditions:** Fresh 047, at `/case/047/file`, first page (F1) selected.
- **Steps / Input:** Click `[ READ IT · 20 MIN ]`. Wait for the request to finish.
- **Expected result:** One `POST /api/cases/047/file/F1/read` request, status 200. The face-down text and the button disappear; the page paragraphs from the API response `page.body` are all in the DOM, in order. The F1 tab shows a ✓. Meta line reads `1 OF 4 PAGES READ · SAT 10 MAR · 08:35`. The HUD clock shows `SAT 10 MAR · 08:35` and `15H 40M LEFT`. Clicking away to F2 and back to F1 shows the body without a new POST.
- **Priority:** high

## TC-40 — UI: a page with paperwork shows a notice and an attached-exhibit clip

- **Covers spec point:** 10, 4
- **Preconditions:** Fresh 048, at `/case/048/file`.
- **Steps / Input:** Select the F2 tab and click its read button.
- **Expected result:** A toast appears with the heading `NEW CLUE DISCOVERED` and detail `E002 — Medical Examiner's Note`. Below the page text a clip reads `ATTACHED · E002` and `Medical Examiner's Note`; its link target is `/case/048/evidence?select=E002`. Following it lands on the Evidence Room, which lists E002 (matches `GET /api/cases/048/evidence`).
- **Priority:** high

## TC-41 — UI: reading a page without paperwork shows no clue notice

- **Covers spec point:** 10, 4
- **Preconditions:** Fresh 047, at `/case/047/file`.
- **Steps / Input:** Read F1 (no attachments). Then read F2 (also no attachments in 047).
- **Expected result:** No toast with the heading `NEW CLUE DISCOVERED` appears for either read; no `ATTACHED ·` clip is shown on either page; the Evidence Room (`/case/047/evidence`) still lists no exhibits.
- **Priority:** medium

## TC-42 — UI: HUD clock matches the API on a fresh case and survives a refresh

- **Covers spec point:** 11
- **Preconditions:** Fresh 047; read F1 and F2 in the browser (`minutesUsed === 40`).
- **Steps / Input:** Note the HUD text. `GET /api/cases/047/investigation`. Hard-reload the page (F5) on `/case/047/file`, then again on `/case/047`.
- **Expected result:** Before and after each reload the HUD shows `SAT 10 MAR · 08:55` (from API `clock.now === "1984-03-10T08:55:00"`) and `15H 20M LEFT` (`minutesLeft === 920`). After reload on the file page, the meta line says `2 OF 4 PAGES READ`, the F1 and F2 tabs show ✓, and selecting them shows the bodies straight away with no new `POST .../read`. On a fresh 047 (before any read) the HUD shows `SAT 10 MAR · 08:15` and `16H 00M LEFT`; on a fresh 051 it shows `SUN 15 JUL · 09:00` and `12H 00M LEFT`.
- **Priority:** high

## TC-43 — UI: read button is disabled and HUD says time is up when the clock has run out

- **Covers spec point:** 7, 11
- **Preconditions:** 047 in the time-up state from TC-25 (F4 unread).
- **Steps / Input:** Open `/case/047/file` and select F4.
- **Expected result:** HUD shows `SUN 11 MAR · 00:15` (formatted from `now === "1984-03-11T00:15:00"`) and the text `TIME IS UP`. The F4 read button is present and has the `disabled` attribute; clicking it sends no request. A banner beginning `TIME IS UP.` followed by the case's `deadlineNote` in upper case is shown.
- **Priority:** low

## TC-44 — UI: a rejected read shows the server message

- **Covers spec point:** 10 (error state)
- **Preconditions:** 047 with F1 read. Open `/case/047/file` and select the unread F2. Then, from another tab or curl, close the case with `POST /cases/047/conclusion { "suspectId": null, "evidenceIds": [] }` (the UI has not reloaded).
- **Steps / Input:** Click the F2 read button.
- **Expected result:** The POST returns 422; the page shows an element with `role="alert"` whose text is exactly `This case is closed.`; the F2 body is not shown, the F2 tab has no ✓, and the HUD clock is unchanged.
- **Priority:** low

---

## Additional cases (added 2026-09-24)

Added after reading the current backend source (`field.service.js`, `investigation.service.js`,
`case.service.js`, `config/index.js`) post commit `b45dd98`. Two of these expose real behaviour of
the running code that the existing suite (TC-01..TC-44) does not exercise:

- `investigation.service.spendTime` now **clamps** the minutes it adds to whatever is left
  (`Math.min(TIME_COST[action], minutesLeft)`), so an action whose nominal cost would overrun the
  deadline still succeeds — it just lands exactly on the deadline instead of being rejected. Only
  the *next* action after that is turned away. TC-45/TC-46 cover this.
- `field.service.readPage` calls `investigation.assertOpen()` **unconditionally**, before the
  "already read" check. That means on a **closed** case, re-reading a page that was already read
  before the case closed is *also* a 422, not a free 200. This contradicts the second half of
  existing **TC-27**, which asserts 200 for that exact scenario (re-reading F1, already read,
  after the case was closed via `POST /conclusion`). TC-27 was left untouched per instructions;
  TC-47 below documents the behaviour actually produced by the current source and should be used
  to resolve the discrepancy.

## TC-45 — Clock clamps to the remaining minutes instead of rejecting the action (Case 047, plain page)

- **Covers spec point:** 3, 7 (clock clamped at budget — `spendTime`'s `Math.min(cost, minutesLeft)`)
- **Preconditions:** Fresh 047. `GET BASE/cases/047/places`, take two different location ids `LA`, `LB`.
- **Steps / Input:** `POST BASE/cases/047/file/F1/read` (cost 20, `minutesUsed` -> 20). Then `POST BASE/cases/047/travel` 31 times alternating `{ "locationId": "LA" }`, `{ "locationId": "LB" }`, starting with `LA` (31 x 30 = 930; cumulative `minutesUsed` -> 950). Each travel must return 200. `GET BASE/cases/047/investigation` to confirm the checkpoint. Then `POST BASE/cases/047/file/F2/read`. Then `GET BASE/cases/047/investigation`. Then `POST BASE/cases/047/file/F3/read`.
- **Expected result:** Checkpoint investigation: `clock.minutesUsed === 950`, `clock.minutesLeft === 10`, `clock.timeUp === false`, `clock.now === "1984-03-11T00:05:00"`. The F2 read: status **200** (not rejected) — `page.read === true`, `page.body` non-null, `effects.unlockedEvidence === []`, `investigation.storyFlags["file.F2"] === true`, `investigation.pagesRead` contains `F2`. Its `investigation.clock`: `minutesUsed === 960` (only 10 of the nominal 20 were charged), `minutesLeft === 0`, `timeUp === true`, `now === "1984-03-11T00:15:00"` (equal to `deadline`). The subsequent F3 read: status 422, body `{ "error": "Time is up. The District Attorney wants a name." }`, and `pagesRead` afterwards still excludes `F3`.
- **Priority:** high

## TC-46 — Clock clamp still triggers the attachment unlock (Case 048, F2 -> E002)

- **Covers spec point:** 2, 3, 4, 7
- **Preconditions:** Fresh 048. `GET BASE/cases/048/places`, take two different location ids `LA`, `LB`.
- **Steps / Input:** `POST BASE/cases/048/file/F1/read` (cost 20, `minutesUsed` -> 20). Then `POST BASE/cases/048/travel` 27 times alternating `{ "locationId": "LA" }`, `{ "locationId": "LB" }`, starting with `LA` (27 x 30 = 810; cumulative `minutesUsed` -> 830). Each travel must return 200. `GET BASE/cases/048/investigation` to confirm the checkpoint. Then `POST BASE/cases/048/file/F2/read`. Then `GET BASE/cases/048/evidence/E002`.
- **Expected result:** Checkpoint investigation: `clock.minutesUsed === 830`, `clock.minutesLeft === 10`, `clock.timeUp === false`. The F2 read: status 200; `effects.unlockedEvidence === [{ "id": "E002", "title": "Medical Examiner's Note" }]` (the attachment still unlocks even though only part of the nominal cost was charged); `investigation.unlockedEvidence` contains `E002`; `investigation.storyFlags["file.F2"] === true`; `investigation.clock.minutesUsed === 840`, `minutesLeft === 0`, `timeUp === true`, `now === "1984-05-19T23:00:00"` (equal to `deadline`). `GET .../evidence/E002` afterwards: 200.
- **Priority:** high

## TC-47 — Closed case rejects re-reading an already-read page too (corrects the "already read" branch of TC-27)

- **Covers spec point:** 3 (case-closed gating; `readPage` calls `assertOpen()` before checking whether the page was already read)
- **Preconditions:** Fresh 047; read F1 only (`minutesUsed === 20`, `pagesRead === ["F1"]`). Close the case: `POST BASE/cases/047/conclusion { "suspectId": null, "evidenceIds": [] }` returns 200.
- **Steps / Input:** `POST BASE/cases/047/file/F1/read` (F1 was already read before the case closed). Then `GET BASE/cases/047/investigation` and `GET BASE/cases/047/file`.
- **Expected result:** The read call: status **422**, body exactly `{ "error": "This case is closed." }` — not the 200 that re-reading an already-read page returns while the case is still open (contrast TC-09, TC-14, TC-26). Afterwards: `investigation.clock.minutesUsed` unchanged at 20, `investigation.pagesRead` unchanged at `["F1"]`, and the F1 entry in `GET /file` is unchanged (`read === true`, its original `body`).
- **Priority:** high

## TC-48 — Unknown page id is still a 404 on a closed case (existence check runs before the closed-case gate)

- **Covers spec point:** 6, 3 (order of checks inside `readPage`)
- **Preconditions:** Fresh 047. Close the case: `POST BASE/cases/047/conclusion { "suspectId": null, "evidenceIds": [] }` returns 200.
- **Steps / Input:** `POST BASE/cases/047/file/F9/read`.
- **Expected result:** Status **404**, body `{ "error": "There is no such page in the file" }` — not 422 `"This case is closed."` — confirming the page's existence is checked before the case-closed gate. `investigation.clock.minutesUsed` unaffected (still 0), `pagesRead` still `[]`.
- **Priority:** medium

## TC-49 — GET /cases/:caseId `locations` entries never expose search spots, people or arrival text

- **Covers spec point:** 1 (case-detail shape; post-`b45dd98` fix — case detail `locations` no longer exposes spots)
- **Preconditions:** Fresh case, one for each of 047, 048, 049, 050, 051.
- **Steps / Input:** For each `<id>`: `GET BASE/cases/<id>` and inspect every element of its `locations` array.
- **Expected result:** For every case, every element of `locations` has exactly the keys `id`, `name`, `floor`, `district`, `description`, `map` — no `spots`, `people` or `arrival` key at any depth of that element. `locations.length` equals the same response's `locationCount`. The raw response text of `GET /cases/<id>` contains no JSON key literally named `spots`, `people` or `arrival` anywhere (not just within `locations`).
- **Priority:** medium

---

Summary: 44 original test cases + 5 added (TC-45–TC-49) = 49 total, 31 high priority (28 original + 3 added).

## Additional cases (added 2026-09-25)

Source: `changes-brief.md` (approved plan `docs/plans/2026-09-25-qa-bug-fixes.md`), cross-checked
against `backend/src/services/investigation.service.js` (`assertOpen`, `spendTime`, `recordViewed`,
`saveTheory`), `backend/src/middleware/errorHandler.js` (the `entity.too.large` → 413 branch) and the
seed data (`data/cases/*/case.json` file-page `attachments`, `data/cases/*/evidence.json`
`locationId`). None of the five endpoints in this suite's own "Endpoints involved" list changed
behaviour today: `GET /file`, `POST /file/:pageId/read`, `GET /cases/:caseId`, `GET /investigation`
and `POST /reset` are all unaffected by the 2026-09-25 fixes. TC-50/TC-51 are regression checks that
the unrelated 2026-09-25 evidence-locationId changes (047 E005, E006; 048 E005; 049 E014; 050 E008 —
none of them a file-page attachment in any case) did not disturb file-attachment unlocking or the
"attachments carry no locationId" invariant. TC-52–TC-56 exercise `PUT /theory`, `POST /viewed` and
the request-size limit, which are **not** in this suite's own endpoint list; they are included because
the change brief calls out "the closed-case matrix as it touches this suite" explicitly. Ambiguity
noted for the record: a reader who only wants this suite's own five endpoints should treat
TC-52/TC-53/TC-54/TC-55/TC-56/TC-57 as cross-cutting coverage borrowed from the shared closed-case
and body-size rules, not spec points unique to case-start-and-file.

## TC-50 — File attachments still unlock correctly after the 2026-09-25 evidence-data changes (regression)

- **Covers spec point:** 2, 4 (regression: confirms the 2026-09-25 changes to E005/E006 (047), E005 (048), E014 (049) and E008 (050) `locationId` — none of them file-page attachments — did not disturb file-attachment unlocking)
- **Preconditions:** Fresh 048, fresh 049, fresh 050, fresh 051.
- **Steps / Input:** `POST BASE/cases/048/file/F2/read`; `POST BASE/cases/049/file/F2/read` then `.../F3/read`; `POST BASE/cases/050/file/F2/read`; `POST BASE/cases/051/file/F2/read`.
- **Expected result:** Identical to TC-11/TC-12/TC-13 on the current source: 048 F2 → `effects.unlockedEvidence === [{ "id": "E002", "title": "Medical Examiner's Note" }]`; 049 F2 → `E002`/"Loss Schedule", F3 → `E015`/"Kemp's 1971 Conviction" (`investigation.unlockedEvidence` ends with exactly `E002` and `E015`); 050 F2 → `E002`/"Insurance Schedule"; 051 F2 → `E002`/"Toxicology Report". None of E005, E006, E008 or E014 appears in any `effects.unlockedEvidence` or `investigation.unlockedEvidence` in this test (they are not reachable through a file page in any case).
- **Priority:** medium

## TC-51 — Every file-page attachment exhibit has `locationId: null` in the seed (place-rule invariant)

- **Covers spec point:** 4 (and the seed-time rule, new in the 2026-09-25 change brief item 7, that only paperwork with no place of its own may ride on a file page's `attachments`)
- **Preconditions:** Fresh 048, 049, 050, 051 (047 has no attachment exhibits, so is not exercised here).
- **Steps / Input:** Unlock each attachment exhibit via its file page (`POST .../file/F2/read` on 048, 050, 051; `.../F2/read` then `.../F3/read` on 049), then `GET .../evidence/E002` on each of 048/049/050/051 and `GET .../evidence/E015` on 049.
- **Expected result:** Every one of those five `GET /evidence/:id` responses (048 E002, 049 E002, 049 E015, 050 E002, 051 E002) has `"locationId": null`. This is the invariant `validateDialogue`'s seed-time check (change brief item 7: "every exhibit with a locationId needs a route at its place") depends on for file-page paperwork — a violation would mean the exhibit could also be found at a place, contradicting "only paperwork with no place of its own rides on a file page's attachments."
- **Priority:** medium

## TC-52 — Closed case: file read on an unread page is still 422 "This case is closed.", unchanged by today's fix

- **Covers spec point:** 3, 6 (closed-case gating and check order — change brief item 1 notes file read "were already 422" before today's fix, i.e. unaffected by it; restated here against the current source to lock down the order rule for this suite)
- **Preconditions:** Fresh 047; read F1 only. Close the case: `POST BASE/cases/047/conclusion { "suspectId": null, "evidenceIds": [] }` returns 200.
- **Steps / Input:** `POST BASE/cases/047/file/F2/read` (unread page); `POST BASE/cases/047/file/F9/read` (unknown page id).
- **Expected result:** F2: 422, body `{ "error": "This case is closed." }`. F9: 404, body `{ "error": "There is no such page in the file" }` — the existence check still runs before the closed-case gate (order: 400 malformed body, then 404 unknown id, then 422 closed, per the change brief), exactly as in TC-48, and unaffected by the 2026-09-25 fix since file read was already gated pre-change.
- **Priority:** low

## TC-53 — Closed case: `PUT /theory` returns 422 "This case is closed."

- **Covers spec point:** none of this suite's own numbered points — `PUT /theory` is not in this spec's "Endpoints involved" list. Included per the 2026-09-25 change brief's closed-case matrix, which names theory explicitly as touching this suite.
- **Preconditions:** Fresh 047. Close the case: `POST BASE/cases/047/conclusion { "suspectId": null, "evidenceIds": [] }` returns 200.
- **Steps / Input:** `PUT BASE/cases/047/theory { "text": "Reyes did it." }`
- **Expected result:** 422, body `{ "error": "This case is closed." }`. A following `GET /investigation` shows `theory` unchanged (still whatever it was immediately before this call — `null` on this fresh-then-closed case, since none was ever filed).
- **Priority:** low

## TC-54 — Closed case: `POST /viewed` on a file-unlocked exhibit now returns 422 "This case is closed." (new behaviour in the 2026-09-25 fix)

- **Covers spec point:** none of this suite's own numbered points — `POST /viewed` is not in this spec's "Endpoints involved" list, but it is the natural place to exercise the newly-closed-case-aware `/viewed` against a file-unlocked exhibit, since this suite is what unlocks E002 via the file.
- **Preconditions:** Fresh 048; `POST .../file/F2/read` (unlocks E002, `minutesUsed === 20`). Close the case: `POST BASE/cases/048/conclusion { "suspectId": null, "evidenceIds": [] }` returns 200.
- **Steps / Input:** `POST BASE/cases/048/viewed { "type": "evidence", "id": "E002" }`
- **Expected result:** 422, body `{ "error": "This case is closed." }`. Before the 2026-09-25 fix this same call on a closed case with an already-unlocked exhibit returned 200 and recorded the view (no closed-case check existed in `recordViewed`); that is no longer true. A following `GET /investigation` shows `E002` absent from `evidenceViewed` (the rejected call recorded nothing).
- **Priority:** high

## TC-55 — `POST /viewed` on a closed case: malformed body and unknown/locked id still win over the closed-case check

- **Covers spec point:** none of this suite's own numbered points — order-of-checks coverage for the change brief's rule "400 malformed body, then 404 unknown id, ..., then 422 closed", exercised here against a file-unlocked exhibit.
- **Preconditions:** Fresh 048; `POST .../file/F2/read` (unlocks E002 only; E003 remains locked — nothing has unlocked it). Close the case: `POST BASE/cases/048/conclusion { "suspectId": null, "evidenceIds": [] }` returns 200.
- **Steps / Input:** (a) `POST BASE/cases/048/viewed { "type": "evidence" }` (missing `id`). (b) `POST BASE/cases/048/viewed { "type": "evidence", "id": "E999" }` (an id that does not exist in this case). (c) `POST BASE/cases/048/viewed { "type": "evidence", "id": "E003" }` (a real 048 exhibit, but never unlocked, so treated as not existing).
- **Expected result:** (a) 400, body `{ "error": "Expected { type: \"evidence\" | \"suspect\" | \"event\", id }" }`. (b) 404, body `{ "error": "Nothing with that id in this case" }`. (c) 404, body `{ "error": "Nothing with that id in this case" }` — locked/unknown evidence is rejected as not-found ahead of the closed-case check, same ordering as on an open case. None of the three adds anything to `evidenceViewed`.
- **Priority:** medium

## TC-56 — `PUT /theory`: a body over 100 kb is 413; a 5001-character `text` is still the existing 400

- **Covers spec point:** none of this suite's own numbered points — request-size limit, change brief item 3, included per the change brief for completeness on the shared `/theory` endpoint. Note: 5001 ASCII characters (~5001 bytes) is far under the 100 kb / 102400-byte body-parser ceiling, so that request reaches the route and is rejected by the route's own 5000-character field cap, not by the size limit — the two checks are independent and this case distinguishes them.
- **Preconditions:** Fresh 047 (the case does not need to be closed — `express.json`'s size check runs before any route or service code, ahead of `assertOpen`).
- **Steps / Input:** (a) `PUT BASE/cases/047/theory` with a JSON body whose `text` field is a string of at least 150,000 characters (so the raw request body exceeds 100 kb / 102400 bytes). (b) `PUT BASE/cases/047/theory` with `{ "text": "<a string of exactly 5001 characters>" }`.
- **Expected result:** (a) 413, body `{ "error": "That request is too large." }`. (b) 400, body `{ "error": "Expected { text } of at most 5000 characters" }`. Neither call changes `investigation.theory` or `investigation.clock`.
- **Priority:** medium

## TC-57 — UI: Notes page on a closed case hides the theory-filing controls and shows the closed message; textarea is read-only

- **Covers spec point:** 10 (UI reflects investigation/story state) — not one of CaseStart/CaseFile's own screens; included because the change brief's closed-case-matrix note explicitly covers the Notes page's theory controls, and this suite is where the file-read flow that produces `pagesRead`/`storyFlags` for a theory originates.
- **Preconditions:** 047 with F1 read (via the file screen or the API) and a theory already filed: `PUT /cases/047/theory { "text": "Reyes did it." }` returns 200. Close the case: `POST /cases/047/conclusion { "suspectId": null, "evidenceIds": [] }` returns 200. Browser open at `/case/047/notes`.
- **Steps / Input:** Load the page. Inspect the theory textarea and the buttons/controls around it. Attempt to type into the textarea.
- **Expected result:** The theory textarea has the `readOnly` (or `disabled`) attribute and still shows `Reyes did it.` as its value. No "LOG … vs …" contradiction-logging buttons appear anywhere on the page. In place of a `FILE THEORY` button/control, the text `The case is closed. Your theory is on the record as it stands.` is shown. Typing into the textarea changes nothing in the DOM and triggers no `PUT /theory` (or other) request in the network log.
- **Priority:** low

---

## Superseded by the 2026-09-25 fixes

- **TC-27** — old expectation: the second half of the case (re-reading F1, already read, after the case was closed via `POST /conclusion`) expects status **200** with the cost unchanged. — new expected behaviour: status **422**, body `{ "error": "This case is closed." }`, because `field.service.readPage` calls `assertOpen()` unconditionally before the "already read" check (see TC-47). — which change: this was already superseded by commit `b45dd98` (pre-dates 2026-09-25, first documented in this file's TC-47 on 2026-09-24); listed here for completeness per instruction, not caused by today's fixes. No other existing case in TC-01–TC-49 was found to be affected by the 2026-09-25 changes: this suite's five endpoints (`GET /file`, `POST /file/:pageId/read`, `GET /cases/:caseId`, `GET /investigation`, `POST /reset`) are unchanged today, and none of TC-01–TC-49 references `PUT /theory`, `POST /viewed`, the 413 body-size limit, or the evidence ids touched by today's data changes (E005, E006, E008, E014).

> 2026-09-25: added TC-50..TC-57; superseded expectations are listed above and in docs/qa/SUPERSEDED-2026-09-25.md.
