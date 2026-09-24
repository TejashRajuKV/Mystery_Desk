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

Summary: 44 test cases, 28 high priority.
