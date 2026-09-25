# Test cases — Evidence Room and Evidence Locking

Spec: `docs/specs/evidence-collection.md`. Cases are tagged `[API]` (curl or any HTTP client, no browser) or `[UI]` (needs the browser).

## Conventions used by every case

- `BASE` = `http://localhost:4000/api` (use the port the backend is actually on). All paths below are relative to `BASE`.
- Unless a case says otherwise, "fresh" means `POST /cases/047/reset` was just called (it returns the investigation state with `unlockedEvidence: []` because `defaultUnlockedEvidence` is empty in every case).
- Seed facts used (all from the case's own seed files, not the answer key):
  - Case 047 has 18 exhibits, E001 to E018. Every timeline event T01 to T12 has at least one exhibit behind it.
  - 047 spots at L03 (Storage Room B): `L03-e001` unlocks E001, `L03-e002` unlocks E002, `L03-e013` unlocks E013, `L03-reader` unlocks E014 but only after file page F2 has been read.
  - 047 other spots: `L01-locker` unlocks E015, `L01-desk` unlocks E017, `L05-stairs` unlocks E007, `L06-turnstile` unlocks E003, `L06-tape` unlocks E004, `L06-desk` unlocks E012.
  - Case 048 file page F2 attaches E002. 048 spot `L03-ashtray` (L03 = "Dressing Room 1") unlocks E009, which has `timestamp: null`.
  - The 047 case clock is 16 hours (960 minutes). Travel costs 30, search 15, read page 20. None of the setups below get near the limit.
- **Setup A** (three exhibits): `POST /cases/047/reset`; `POST /travel {"locationId":"L03"}`; `POST /places/L03/search {"spotId":"L03-e001"}`, then the same with `L03-e002` and `L03-e013`. Result: E001, E002 and E013 unlocked; nothing viewed.
- **Setup B** (nine exhibits): Setup A, then `POST /file/F2/read`; `POST /places/L03/search {"spotId":"L03-reader"}` (E014); `POST /travel {"locationId":"L06"}` and search `L06-turnstile`, `L06-tape`, `L06-desk` (E003, E004, E012); `POST /travel {"locationId":"L05"}` and search `L05-stairs` (E007); `POST /travel {"locationId":"L01"}` and search `L01-desk` (E017). Result: unlocked = E001, E002, E003, E004, E007, E012, E013, E014, E017.
- "Forbidden keys" = any JSON key, at any depth, named `facts`, `personId`, `action`, `target`, `kind`, `solution`, `culprit`, `requiredEvidence` or `requiredConnections`. (`personIds` is allowed; it is a different key.)

## Ambiguities and implementation notes the runner should record

1. Spec point 4 says viewing a locked or unknown id is "rejected". The source (`investigation.service.js` `recordViewed`) returns **404** `{ "error": "Nothing with that id in this case" }` for both, so the cases below expect 404, not 400 or 422. If a different status comes back, report it as a spec/implementation mismatch.
2. Spec point 10 says a failing request shows an error state "with retry". In the code the room does not fetch the list itself: `useCase` loads the list once when the case shell (`Layout`) mounts, and a failure there shows the `ErrorState` (stamp `FILE UNAVAILABLE`, button `TRY AGAIN`). A failure when opening a single card (the inspector's `GET /evidence/:id`) only shows an inline message `Could not load the full exhibit.` and has no retry button. TC-41 checks this literally so the gap is visible.
3. Spec point 9 says filters are "if present". They are present: ALL, ACCESS, CCTV & PHOTO, DOCUMENTS, FORENSIC, RECORDS. "Cleared" means selecting ALL; there is no separate clear control.
4. Spec point 7 does not give a formula. Per the source (`calculateProgress`) and PRD, progress is the rounded average of four ratios, and the evidence ratio is (evidence viewed) / (all exhibits in the case, locked ones included, so 18 for case 047). With nothing else done that is `round(100 * (n/18) / 4)`. TC-24 relies on that.
5. Spec point 8 says a viewed exhibit "survives refresh". `markViewed` in the UI is best-effort and swallows errors, so a failed `POST /viewed` would not be visible. TC-34 therefore inspects the network call.

---

## TC-01 — [API] Fresh investigation: evidence list is empty

- **Covers spec point:** 1
- **Preconditions:** `POST /cases/047/reset` just called.
- **Steps / Input:** `GET /cases/047/evidence`
- **Expected result:** Status 200. Body is exactly `[]` (a bare JSON array, not wrapped in `{ data: ... }`). `Content-Type` starts with `application/json`.
- **Priority:** high

## TC-02 — [API] Fresh investigation: real exhibit ids are 404

- **Covers spec point:** 1
- **Preconditions:** `POST /cases/047/reset` just called.
- **Steps / Input:** `GET /cases/047/evidence/E014`, then `GET /cases/047/evidence/E001`.
- **Expected result:** Both return status 404 with body exactly `{ "error": "Evidence not found" }`. Neither body contains `title`, `details` or `source`.
- **Priority:** high

## TC-03 — [API] Unknown or malformed exhibit ids are the same 404 as locked ones

- **Covers spec point:** 1, 3
- **Preconditions:** Setup A (E001 unlocked).
- **Steps / Input:** `GET /cases/047/evidence/E999`, `GET /cases/047/evidence/abc`, `GET /cases/047/evidence/e001` (lowercase), `GET /cases/047/evidence/E014` (real but locked).
- **Expected result:** All four return status 404 with body exactly `{ "error": "Evidence not found" }`, so a locked id cannot be told apart from a nonexistent one. `GET /cases/047/evidence/E001` still returns 200.
- **Priority:** medium

## TC-04 — [API] Unknown case is a 404 on every evidence endpoint

- **Covers spec point:** 1 (the `:caseId` guard the endpoints sit behind)
- **Preconditions:** None.
- **Steps / Input:** `GET /cases/999/evidence`, `GET /cases/999/evidence/E001`, `POST /cases/999/viewed` with body `{"type":"evidence","id":"E001"}`.
- **Expected result:** All three return status 404 with body exactly `{ "error": "Case not found" }`.
- **Priority:** medium

## TC-05 — [API] Exhibit found by searching a spot appears in the list with the full list shape

- **Covers spec point:** 2
- **Preconditions:** `POST /cases/047/reset`.
- **Steps / Input:** `POST /cases/047/travel {"locationId":"L03"}` (expect 200), then `POST /cases/047/places/L03/search {"spotId":"L03-e001"}`, then `GET /cases/047/evidence`.
- **Expected result:** The search returns 200 and `effects.unlockedEvidence` equals `[{ "id": "E001", "title": "Empty Prototype Case" }]`. The list returns 200 with exactly one element whose keys are exactly `id, type, title, timestamp, time, locationId, location, personIds, people, summary` and values:
  `id: "E001"`, `type: "physical"`, `title: "Empty Prototype Case"`, `timestamp: "1984-03-10T07:30:00"`, `time: "07:30"`, `locationId: "L03"`, `location: "Storage Room B"`, `personIds: ["S01"]`, `people: ["Dr. Maren Voss"]`, `summary: "The Argus-7 case, found open and empty on the shelf."`.
- **Priority:** high

## TC-06 — [API] Every list item matches the shape, and detail-only fields are absent from the list

- **Covers spec point:** 2, 3
- **Preconditions:** Setup B (nine exhibits).
- **Steps / Input:** `GET /cases/047/evidence`.
- **Expected result:** Status 200, array of exactly 9 items. For every item: `id` matches `^E\d+$`; `type`, `title`, `summary` are non-empty strings; `time` is a string of the form `HH:MM` when `timestamp` is non-null; `timestamp` is a string or null; `locationId` is a string or null; `location` is a string when `locationId` is non-null; `personIds` and `people` are arrays of equal length; the keys `details`, `source` and `relatedEvidenceIds` are **not** present.
- **Priority:** medium

## TC-07 — [API] Exhibit with a null locationId

- **Covers spec point:** 2
- **Preconditions:** `POST /cases/047/reset`.
- **Steps / Input:** `POST /cases/047/travel {"locationId":"L01"}`, `POST /cases/047/places/L01/search {"spotId":"L01-locker"}`, `GET /cases/047/evidence`, `GET /cases/047/evidence/E015`.
- **Expected result:** The list is a single item (E015) with `locationId: null`, `location: null`, `timestamp: "1984-03-05T00:00:00"`, `time: "00:00"`, `type: "financial"`, `title: "Loan Default Notice"`, `personIds: ["S02"]`, `people: ["Alex Reyes"]`. The detail call returns 200 with the same values plus `details`, `source` and `relatedEvidenceIds`. Neither response has a 500 or a missing key: `locationId` and `location` are present with value `null`.
- **Priority:** high

## TC-08 — [API] Exhibit with a null timestamp (case 048)

- **Covers spec point:** 2
- **Preconditions:** `POST /cases/048/reset`.
- **Steps / Input:** `POST /cases/048/travel {"locationId":"L03"}`, `POST /cases/048/places/L03/search {"spotId":"L03-ashtray"}`, `GET /cases/048/evidence`.
- **Expected result:** List has exactly one item: `id: "E009"`, `type: "physical"`, `title: "Cigar Band"`, `timestamp: null`, `time: null`, `locationId: "L03"`, `location: "Dressing Room 1"`, `personIds: ["S04"]`, `people: ["Leonard Voight"]`. Status 200.
- **Priority:** medium

## TC-09 — [API] List contains only unlocked exhibits

- **Covers spec point:** 1, 2
- **Preconditions:** Fresh 047, then unlock only E001 and E002 (travel to L03, search `L03-e001` and `L03-e002`).
- **Steps / Input:** `GET /cases/047/evidence`.
- **Expected result:** Exactly 2 items, with ids {E001, E002} (order not checked). None of E013 or E014 or any other id is present.
- **Priority:** high

## TC-10 — [API] Detail of an unlocked exhibit adds details, source and relatedEvidenceIds

- **Covers spec point:** 3
- **Preconditions:** Fresh 047, then unlock only E001 (travel to L03, search `L03-e001`).
- **Steps / Input:** `GET /cases/047/evidence/E001`
- **Expected result:** Status 200. Body has every key of the TC-05 list item with the same values, plus `details` equal to `"Foam-lined transit case, catalogue no. AR7-C. Latches undamaged. The foam cut-out is intact and undisturbed, as though the unit was lifted out carefully by someone who knew how it seated. Found by Dr. Voss at 07:30 Saturday."`, `source` equal to `"Recovered by Dr. M. Voss"`, and `relatedEvidenceIds` equal to `[]` (its seed neighbours E002 and E013 are still locked). No forbidden keys.
- **Priority:** high

## TC-11 — [API] relatedEvidenceIds contains only unlocked ids and grows as exhibits are found

- **Covers spec point:** 3
- **Preconditions:** `POST /cases/047/reset`, then travel to L03. Run the unlocks in order and check after each.
- **Steps / Input:**
  1. Search `L03-e001` (E001). `GET /evidence/E001`.
  2. Search `L03-e002` (E002). `GET /evidence/E001`, `GET /evidence/E002`.
  3. Search `L03-e013` (E013). `GET /evidence/E001`, `GET /evidence/E002`, `GET /evidence/E013`.
  4. `POST /file/F2/read`, then search `L03-reader` (E014). `GET /evidence/E002`, `GET /evidence/E013`.
- **Expected result:**
  1. E001 `relatedEvidenceIds` is `[]`.
  2. E001 is `["E002"]`; E002 is `[]` (its only neighbour E014 is locked).
  3. E001 is `["E002","E013"]`; E002 is `[]`; E013 is `["E001"]` (E014 is locked).
  4. E002 is `["E014"]`; E013 is `["E001","E014"]`.
  At every step no id in any `relatedEvidenceIds` is absent from `GET /evidence`, and E014 never appears before step 4.
- **Priority:** high

## TC-12 — [API] Exhibits with no place of their own unlock from a file page (case 048)

- **Covers spec point:** 1, 2
- **Preconditions:** `POST /cases/048/reset`. E002 not in the list.
- **Steps / Input:** `GET /cases/048/evidence/E002` (before), `POST /cases/048/file/F2/read`, `GET /cases/048/evidence`, `GET /cases/048/evidence/E002`.
- **Expected result:** Before: 404 `{ "error": "Evidence not found" }`. The read returns 200 with `effects.unlockedEvidence` equal to `[{ "id": "E002", "title": "Medical Examiner's Note" }]`. The list has exactly one item: `id: "E002"`, `type: "forensic"`, `timestamp: "1984-05-19T02:10:00"`, `time: "02:10"`, `locationId: null`, `location: null`, `personIds: []`, `people: []`. The detail call returns 200.
- **Priority:** high

## TC-13 — [API] A gated search spot stays closed, and its exhibit stays locked, until the file page is read

- **Covers spec point:** 1, 2
- **Preconditions:** `POST /cases/047/reset`, then `POST /travel {"locationId":"L03"}`.
- **Steps / Input:** `POST /cases/047/places/L03/search {"spotId":"L03-reader"}`; `GET /cases/047/evidence`; `POST /cases/047/file/F2/read`; `POST /cases/047/places/L03/search {"spotId":"L03-reader"}`; `GET /cases/047/evidence`; `GET /cases/047/evidence/E014`.
- **Expected result:** First search: 404 `{ "error": "There is nothing like that to search here" }`; first list is `[]`. After reading F2 the second search returns 200 with `effects.unlockedEvidence` equal to `[{ "id": "E014", "title": "Keycard Access" }]`. Final list has exactly one item, E014. The detail returns 200 with `title: "Keycard Access"`, `relatedEvidenceIds: []`.
- **Priority:** medium

## TC-14 — [API] Exhibit unlocked by an interview appears in the list

- **Covers spec point:** 1, 2
- **Preconditions:** `POST /cases/047/reset`. E014 not in the list.
- **Steps / Input:** `POST /cases/047/file/F1/read`; `POST /cases/047/travel {"locationId":"L01"}`; `GET /cases/047/dialogue/S01`; `POST /cases/047/dialogue/S01/choice {"choiceId":"v-start-discovery"}`; `GET /cases/047/evidence`.
- **Expected result:** The choice returns 200 and `effects.unlockedEvidence` contains `{ "id": "E014", "title": "Keycard Access" }`. The list has exactly one item, E014, with `type: "keycard"`, `timestamp: "1984-03-09T21:14:00"`, `time: "21:14"`, `locationId: "L03"`, `location: "Storage Room B"`, `personIds: ["S02"]`, `people: ["Alex Reyes"]`. If the choice call is not 200, record the response and mark this case blocked rather than failed (the interview rules are covered by the interviews spec).
- **Priority:** medium

## TC-15 — [API] Finding the same exhibit twice does not duplicate it

- **Covers spec point:** 2
- **Preconditions:** Fresh 047; travel to L03; search `L03-e001` once.
- **Steps / Input:** Search `L03-e001` a second time, then `GET /cases/047/evidence` and `GET /cases/047/investigation`.
- **Expected result:** The second search returns 200 with `effects.unlockedEvidence` equal to `[]`. The list still has exactly one item (E001). `unlockedEvidence` in the investigation is exactly `["E001"]`.
- **Priority:** medium

## TC-16 — [API] Reading the list or a detail does not mark anything viewed

- **Covers spec point:** 4, 7
- **Preconditions:** Setup A.
- **Steps / Input:** `GET /cases/047/evidence`, `GET /cases/047/evidence/E001`, `GET /cases/047/evidence/E002`, then `GET /cases/047/investigation`.
- **Expected result:** `evidenceViewed` is `[]` and `progress` is `0`.
- **Priority:** high

## TC-17 — [API] Viewing records the id once, in first-viewed order

- **Covers spec point:** 4
- **Preconditions:** Setup A.
- **Steps / Input:** `POST /cases/047/viewed {"type":"evidence","id":"E002"}`, then `{"type":"evidence","id":"E001"}`, then `{"type":"evidence","id":"E002"}` again. `GET /cases/047/investigation` after the third call.
- **Expected result:** Each POST returns 200. `evidenceViewed` in the three responses is `["E002"]`, `["E002","E001"]`, `["E002","E001"]` respectively (no duplicate, order unchanged by the repeat). The GET shows `evidenceViewed: ["E002","E001"]`.
- **Priority:** high

## TC-18 — [API] Viewing a locked exhibit is rejected and records nothing

- **Covers spec point:** 4
- **Preconditions:** Setup A (E014 is a real exhibit, still locked). Note the current `evidenceViewed`.
- **Steps / Input:** `POST /cases/047/viewed {"type":"evidence","id":"E014"}`, then `GET /cases/047/investigation`.
- **Expected result:** Status 404 with body exactly `{ "error": "Nothing with that id in this case" }`. `evidenceViewed` is unchanged (still `[]`) and `progress` is unchanged. After unlocking E014 (Setup B) the same call returns 200 and `evidenceViewed` is `["E014"]`.
- **Priority:** high

## TC-19 — [API] Viewing an unknown exhibit id is rejected

- **Covers spec point:** 4
- **Preconditions:** Setup A.
- **Steps / Input:** `POST /cases/047/viewed {"type":"evidence","id":"E999"}`; `{"type":"evidence","id":"e001"}`; `{"type":"evidence","id":""}`.
- **Expected result:** All three return status 404 with body exactly `{ "error": "Nothing with that id in this case" }` and `evidenceViewed` stays `[]`.
- **Priority:** medium

## TC-20 — [API] Bad `type` is a 400

- **Covers spec point:** 5
- **Preconditions:** Setup A.
- **Steps / Input:** Each body posted to `POST /cases/047/viewed`: `{"type":"page","id":"F1"}`, `{"type":"bogus","id":"E001"}`, `{"type":"","id":"E001"}`, `{"id":"E001"}`, `{"type":null,"id":"E001"}`, `{"type":"Evidence","id":"E001"}`.
- **Expected result:** Every call returns status 400 with body exactly `{ "error": "Expected { type: \"evidence\" | \"suspect\" | \"event\", id }" }`. `GET /investigation` afterwards still shows `evidenceViewed: []` and `pagesRead: []`.
- **Priority:** high

## TC-21 — [API] Missing or non-string `id` is a 400

- **Covers spec point:** 5
- **Preconditions:** Setup A.
- **Steps / Input:** Each body posted to `POST /cases/047/viewed`: `{"type":"evidence"}`, `{"type":"evidence","id":null}`, `{"type":"evidence","id":1}`, `{"type":"evidence","id":["E001"]}`, `{}`, and a request with no body at all.
- **Expected result:** Every call returns status 400 with the same `{ "error": ... }` string as TC-20. `evidenceViewed` stays `[]`.
- **Priority:** high

## TC-22 — [API] Malformed JSON body is a 400

- **Covers spec point:** 5
- **Preconditions:** Setup A.
- **Steps / Input:** `POST /cases/047/viewed` with header `Content-Type: application/json` and raw body `{"type":"evidence",`.
- **Expected result:** Status 400 and a JSON body with a non-empty string `error`. Status is not 500. (The exact message comes from the JSON parser and is not asserted.)
- **Priority:** low

## TC-23 — [API] POST /viewed returns the whole investigation state

- **Covers spec point:** 4, 7
- **Preconditions:** Setup A.
- **Steps / Input:** `POST /cases/047/viewed {"type":"evidence","id":"E001"}`.
- **Expected result:** Status 200. Body is the investigation resource (not wrapped): contains keys `evidenceViewed`, `suspectsViewed`, `eventsViewed`, `connections`, `contradictionsFound`, `unlockedEvidence`, `storyFlags`, `clock`, `theory`, `conclusion`, `progress`. Values: `evidenceViewed: ["E001"]`, `suspectsViewed: []`, `eventsViewed: []`, `connections: []`, `contradictionsFound: []`, `unlockedEvidence: ["E001","E002","E013"]`, `conclusion: null`. Body equals what `GET /cases/047/investigation` returns immediately afterwards.
- **Priority:** medium

## TC-24 — [API] Progress is an integer 0–100 and rises with evidence viewed

- **Covers spec point:** 7
- **Preconditions:** Setup A. No suspects or events viewed, no contradictions logged (fresh reset guarantees this).
- **Steps / Input:** `GET /cases/047/investigation` and read `progress`; then `POST /viewed` for E001, E002, E013 in that order, then E001 again, reading `progress` from each response.
- **Expected result:** `progress` values in order: after Setup A (three exhibits unlocked, none viewed) `0`; after E001 `1`; after E002 `3`; after E013 `4`; after E001 again `4` (unchanged). Every value is a JSON number with no fraction (`Number.isInteger`) between 0 and 100 inclusive. Values are computed as `round(100 * (n / 18) / 4)` with n = 1, 2, 3.
- **Priority:** high

## TC-25 — [API] Progress returns to 0 after a reset

- **Covers spec point:** 7
- **Preconditions:** Setup A, then E001 and E002 viewed (progress 3).
- **Steps / Input:** `POST /cases/047/reset`, then `GET /cases/047/investigation`.
- **Expected result:** Reset returns 200 with `progress: 0`, `evidenceViewed: []`, `unlockedEvidence: []`. The GET agrees.
- **Priority:** medium

## TC-26 — [API] No evidence payload contains facts or any solution field

- **Covers spec point:** 6
- **Preconditions:** Setup B (nine exhibits, including E003, E007, E012, E014 whose seed data has backend-only placements).
- **Steps / Input:** `GET /cases/047/evidence`; `GET /cases/047/evidence/<id>` for each of E001, E002, E003, E004, E007, E012, E013, E014, E017; `POST /cases/047/viewed {"type":"evidence","id":"E003"}`; `GET /cases/047/investigation`; `GET /cases/047/timeline`.
- **Expected result:** Every response is 200. Walking each parsed JSON body recursively finds none of the forbidden keys (`facts`, `personId`, `action`, `target`, `kind`, `solution`, `culprit`, `requiredEvidence`, `requiredConnections`). The raw text of the list body contains neither the substring `"facts"` nor `"requiredEvidence"`.
- **Priority:** high

## TC-27 — [API] Timeline evidence references leave out locked exhibits

- **Covers spec point:** 1 (timeline part of the locking rule), 2
- **Preconditions:** `POST /cases/047/reset`.
- **Steps / Input:**
  1. `GET /cases/047/timeline`.
  2. Unlock E001 and E002 (travel to L03, search `L03-e001`, `L03-e002`). `GET /cases/047/timeline`.
  3. Search `L03-e013`. `GET /cases/047/timeline`.
- **Expected result:**
  1. Body is `[]` (every event in 047 rests on an exhibit the player does not hold).
  2. Exactly two events, in this order: T08 with `evidenceIds: ["E002"]` and T12 with `evidenceIds: ["E001","E002"]`. E014, E013 and every other id are absent from both.
  3. Still exactly two events: T08 `evidenceIds: ["E002","E013"]`, T12 `evidenceIds: ["E001","E002","E013"]`.
  Across all steps every id in every `evidenceIds` is present in `GET /evidence`.
- **Priority:** high

## TC-28 — [API] Reset re-locks everything and clears viewed

- **Covers spec point:** 1, 4, 7
- **Preconditions:** Setup B, then E001 and E014 viewed.
- **Steps / Input:** `POST /cases/047/reset`; `GET /cases/047/evidence`; `GET /cases/047/evidence/E001`; `GET /cases/047/timeline`; `GET /cases/047/investigation`.
- **Expected result:** Reset returns 200. The list is `[]`. The detail is 404 `{ "error": "Evidence not found" }`. Timeline is `[]`. Investigation has `evidenceViewed: []`, `unlockedEvidence: []`, `progress: 0`. Re-running `POST /travel` and search `L03-e001` unlocks E001 again (the reset does not break unlocking).
- **Priority:** high

## TC-29 — [API] Evidence state is per case

- **Covers spec point:** 1, 2, 4
- **Preconditions:** `POST /cases/047/reset` and `POST /cases/048/reset`.
- **Steps / Input:** Unlock E001 in 047 (travel L03, search `L03-e001`) and `POST /cases/047/viewed {"type":"evidence","id":"E001"}`. Then `GET /cases/048/evidence`, `GET /cases/048/evidence/E001`, `GET /cases/048/investigation`. Then unlock E009 in 048 (travel L03, search `L03-ashtray`) and `GET /cases/047/evidence`. Finally `POST /cases/048/reset` and `GET /cases/047/evidence`.
- **Expected result:** 048 list is `[]`, 048 detail of E001 is 404, 048 `evidenceViewed` is `[]` and `progress` is `0`. After the 048 unlock the 047 list is still exactly `[E001]` (only E001, no E009). After the 048 reset the 047 list is still exactly `[E001]` and 047 `evidenceViewed` is still `["E001"]`.
- **Priority:** high

## TC-30 — [API] investigation.unlockedEvidence agrees with the list

- **Covers spec point:** 1, 2
- **Preconditions:** Setup A, unlocking in the order E001, E002, E013 (as Setup A does).
- **Steps / Input:** `GET /cases/047/investigation` and `GET /cases/047/evidence`.
- **Expected result:** `unlockedEvidence` is exactly `["E001","E002","E013"]` and the set of `id` values in the list is the same set.
- **Priority:** medium

## Additional cases (added 2026-09-24)

Gaps closed by this batch: spec points 8, 9 and 10 (Evidence Room UI — empty/error/filter states, card-to-API fidelity, viewed-on-refresh) had no test cases at all before this batch; and the closed-case and clock-clamp rules from commit b45dd98 were not yet checked against evidence collection specifically (they change whether legwork that unlocks evidence, i.e. travel/search/file-read, can still run). No case here reads or reveals `solution.json`; TC-39/TC-40/TC-41 close the case with the answer-free `{ "suspectId": null }` ("Cannot determine") accusation, which needs no evidence and does not depend on who the culprit is.

## TC-31 — [UI] Fresh case: Evidence Room shows an empty state, not a spinner

- **Covers spec point:** 8
- **Preconditions:** Case 047 reset (Play Again from a previous session, or a case never started); no exhibits unlocked.
- **Steps / Input:** In the browser, open `/case/047/evidence`.
- **Expected result:** The evidence grid area renders `EmptyState` with title "Nothing collected yet" and body text starting "Evidence isn't handed to you." No spinner (`Loading`, cursor-blink label) appears anywhere inside the Evidence Room's own content area. `PageTitle` meta text reads "0 EXHIBITS · 0 EXAMINED".
- **Priority:** high

## TC-32 — [UI] A card's fields match what the API returns as the list grows

- **Covers spec point:** 2, 8
- **Preconditions:** Fresh 047. In the browser: travel to Storage Room B (L03) and search the spot that yields E001 (`L03-e001`).
- **Steps / Input:** Open `/case/047/evidence`.
- **Expected result:** Exactly one card is shown: id label "E001", type badge "PHYSICAL", title "Empty Prototype Case", caption "[ EXHIBIT ]" (not yet opened), and a meta row with the formatted time and location "Storage Room B" — all matching the values `GET /cases/047/evidence` returns for E001 (per TC-05). `PageTitle` meta reads "1 EXHIBIT · 0 EXAMINED".
- **Priority:** high

## TC-33 — [UI] Opening a card loads details and source into the inspector and marks it viewed

- **Covers spec point:** 3, 4, 8
- **Preconditions:** As TC-32 (E001 unlocked, not yet viewed).
- **Steps / Input:** Click the E001 card.
- **Expected result:** The card's caption changes to "[ EXAMINED ]". The inspector panel shows heading "E001", title "Empty Prototype Case", a SOURCE row reading "Recovered by Dr. M. Voss", and a details paragraph equal to the exact `details` string from TC-10. `PageTitle` meta updates to "1 EXHIBIT · 1 EXAMINED".
- **Priority:** high

## TC-34 — [UI] A viewed exhibit survives a refresh, checked via the network call

- **Covers spec point:** 4, 8 (see ambiguity note 5)
- **Preconditions:** As TC-33 — E001 was just opened in the browser.
- **Steps / Input:** With the browser devtools network panel open, confirm a `POST /api/cases/047/viewed` request with body `{"type":"evidence","id":"E001"}` was sent when the card was opened and returned status 200. Then hard-refresh `/case/047/evidence`.
- **Expected result:** The network call above exists and returned 200 — because `markViewed` swallows failures silently in the UI, this network check is the only reliable way to catch a broken persist; if the call is missing or non-200, mark this case failed even if the card visually shows "[ EXAMINED ]" before the refresh. After the refresh, the E001 card still shows caption "[ EXAMINED ]", confirming the state was actually persisted server-side and not just held in local React state.
- **Priority:** high

## TC-35 — [UI] Type filters narrow the list, and ALL restores it

- **Covers spec point:** 9
- **Preconditions:** Setup B unlocked in the backend (via API), then the page loaded/reloaded so at least E001 (physical/FORENSIC) and E014 (keycard/ACCESS) are visible.
- **Steps / Input:** On `/case/047/evidence`, click the "ACCESS" filter stamp, note the visible cards; click "FORENSIC", note the visible cards; click "ALL".
- **Expected result:** With ACCESS selected: only cards of type `keycard` or `access_log` show (E014 present, E001 absent) and the ACCESS stamp has `aria-pressed="true"`. With FORENSIC selected: only `forensic`/`physical` cards show (E001 present, E014 absent). With ALL selected: every previously-visible unlocked card shows again and ALL has `aria-pressed="true"`. Switching filters causes no new network request (filtering is client-side over the already-loaded list).
- **Priority:** medium

## TC-36 — [UI] A filter with zero matches shows different copy than the fresh-case empty state

- **Covers spec point:** 9
- **Preconditions:** Only a FORENSIC-type exhibit unlocked (e.g. E001 only), nothing ACCESS-type.
- **Steps / Input:** On `/case/047/evidence`, click the "ACCESS" filter stamp.
- **Expected result:** `EmptyState` shows title "Nothing filed here" and body "No exhibits match this filter." — wording distinct from TC-31's "Nothing collected yet" state, so a runner can tell a truly empty case apart from an over-filtered one.
- **Priority:** medium

## TC-37 — [UI] Backend down on first load shows FILE UNAVAILABLE with a working retry

- **Covers spec point:** 10
- **Preconditions:** Backend stopped/unreachable before the case shell has ever loaded for this session.
- **Steps / Input:** Navigate to `/case/047/evidence` with the backend down. Then start the backend and click "TRY AGAIN".
- **Expected result:** Before retry: a stamp reading exactly "FILE UNAVAILABLE", a message ending "Make sure the MysteryDesk API is running." and a button labelled "TRY AGAIN". After the backend is started and "TRY AGAIN" is clicked: the case shell loads normally and the Evidence Room renders its empty or populated list state (no leftover error banner).
- **Priority:** high

## TC-38 — [UI] A failure loading one exhibit's detail has no retry control (documented gap)

- **Covers spec point:** 10 (see ambiguity note 2)
- **Preconditions:** The case shell has already loaded successfully and E001 is unlocked; then make only `GET /cases/047/evidence/E001` fail (e.g. stop the backend after the list is cached, or block just that route).
- **Steps / Input:** Click the E001 card.
- **Expected result:** The inspector still renders using the cached list summary (id, title, time, place) and shows an inline line of text starting "Could not load the full exhibit." with the underlying error message appended. No retry button is present anywhere in the inspector. Record this literally: it is a real gap against spec point 10's "error state with retry" for this one failure path, not something to silently mark passing.
- **Priority:** medium

## TC-39 — [API] Closed case: travel and search are rejected, so no more evidence can ever be unlocked

- **Covers spec point:** 1 (persistence of locking once the case is closed — behaviour from commit b45dd98)
- **Preconditions:** `POST /cases/047/reset`; unlock E001 only (travel to L03, search `L03-e001`); then `POST /cases/047/conclusion {"suspectId": null, "evidenceIds": []}` to close the case (the answer-free "Cannot determine" accusation).
- **Steps / Input:** `POST /cases/047/travel {"locationId":"L03"}`; `POST /cases/047/places/L03/search {"spotId":"L03-e002"}`; `GET /cases/047/evidence`.
- **Expected result:** Both POSTs return status 422 with body exactly `{ "error": "This case is closed." }`. `GET /evidence` still returns exactly the one previously-unlocked item, E001; E002 never appears.
- **Priority:** high

## TC-40 — [API] Closed case: reading a file page is rejected too, but the evidence endpoints stay readable

- **Covers spec point:** 1, 2, 3
- **Preconditions:** As TC-39 (case closed, E001 unlocked).
- **Steps / Input:** `POST /cases/047/file/F2/read`; `GET /cases/047/evidence`; `GET /cases/047/evidence/E001`.
- **Expected result:** The read returns 422 `{ "error": "This case is closed." }`, and none of F2's attachments unlock. `GET /evidence` still returns 200 with the one item (E001), unaffected. `GET /evidence/E001` still returns 200 with its full detail shape (`details`, `source`, `relatedEvidenceIds`) — the closed-case rule blocks new legwork, not reading what was already found.
- **Priority:** high

## TC-41 — [API] Closed case: marking an already-unlocked exhibit as viewed still works

- **Covers spec point:** 4, 7
- **Preconditions:** As TC-39 (case closed, E001 unlocked, not yet viewed).
- **Steps / Input:** `POST /cases/047/viewed {"type":"evidence","id":"E001"}`.
- **Expected result:** Status 200, not 422 — `recordViewed` has no closed-case check in the source, unlike travel/search/file-read/theory/conclusion. `evidenceViewed` becomes `["E001"]` and `progress` increases accordingly. Record this as an asymmetry against spec point 4 (which only documents "locked or unknown" as rejected, not "case closed"); confirm with the owner whether this is intentional before treating it as a defect.
- **Priority:** low

## TC-42 — [API] The clock clamps at budget, and time-up then blocks any further evidence hunting

- **Covers spec point:** 1 (the clock as the natural end of evidence collection — clamp behaviour from commit b45dd98)
- **Preconditions:** `POST /cases/047/reset`; drive the clock to `minutesUsed: 950` (`minutesLeft: 10`): `POST /cases/047/file/F1/read` (20 min), then alternate `POST /cases/047/travel {"locationId":"L01"}` / `POST /cases/047/travel {"locationId":"L03"}` 31 times (30 min each = 930 min). Confirm via `GET /cases/047/investigation` that `clock.minutesUsed === 950` and `clock.minutesLeft === 10` before continuing.
- **Steps / Input:** `POST /cases/047/places/L03/search {"spotId":"L03-e001"}` (a fresh spot, cost 15, only 10 minutes left); then `GET /cases/047/investigation`; then `POST /cases/047/places/L03/search {"spotId":"L03-e002"}`.
- **Expected result:** The first search returns 200 and E001 unlocks normally (`effects.unlockedEvidence` equals `[{"id":"E001","title":"Empty Prototype Case"}]`) even though its 15-minute cost exceeds the 10 minutes left — the clock clamps the spend rather than blocking an action already allowed to start. The GET shows `clock.minutesUsed: 960` (not 965), `clock.minutesLeft: 0`, `clock.timeUp: true`. The second search then returns 422 `{ "error": "Time is up. The District Attorney wants a name." }`, and E002 is never unlocked (a following `GET /evidence` still lacks it).
- **Priority:** high

---

Total: 42 test cases (30 original + 12 added 2026-09-24) — 26 high priority.

## Additional cases (added 2026-09-25)

Gaps closed by this batch (2026-09-25 QA bug-fix plan, `docs/plans/2026-09-25-qa-bug-fixes.md`, D1 and D4): (a) four exhibits' `locationId`/`location` in `GET /evidence` were wrong before this fix — 047 E005 and E006 now sit at L02 ("Communications Room"), 048 E005 and 050 E008 are now off-map (`locationId: null`), 049 E014 now sits at L01 ("The Banking Hall") — matching where each is actually found, per the "place rule" (a search spot's exhibit must belong to that spot's place; an interview route counts too, since a witness may hand something over from where they stand); (b) five new gated search spots (047 `L05-permit`, 049 `L06-solicitor`, 050 `L03-grate`, 051 `L04-bankcall` and `L04-pardoe`) give every case a recovery route to an exhibit that a single bad interview choice would otherwise lose for good, and `GET /places/:id` must hide each one until its `requires` holds; (c) `POST /viewed` now shares the same "case closed" freeze as connections and contradictions (`investigation.service.js` `recordViewed` calls `assertOpen()` after the existing-id check), which reverses TC-41's expectation below. No case here reads or prints `solution.json`; all evidence ids, flags and dialogue node/choice ids below come from the cases' own `evidence.json`, `locations.json` and `dialogue.json`.

## TC-43 — [API] 047: E005 and E006 relocate to Communications Room (L02) in GET /evidence

- **Covers spec point:** 2 (locationId/location correctness); ties to the 2026-09-25 place-rule fix (not a numbered spec point)
- **Preconditions:** `POST /cases/047/reset`.
- **Steps / Input:** `POST /cases/047/travel {"locationId":"L02"}`; `POST /cases/047/places/L02/search {"spotId":"L02-recorder"}` (unlocks E005); `POST /cases/047/places/L02/search {"spotId":"L02-modem"}` (unlocks E010); `GET /cases/047/dialogue/S05`; `POST /cases/047/dialogue/S05/choice {"presentEvidenceId":"E010"}` (Cho, present at L02, reacts and unlocks E006); `GET /cases/047/evidence`.
- **Expected result:** Both searches and the presented choice return 200. The final `GET /evidence` list includes an item with `id: "E005"`, `locationId: "L02"`, `location: "Communications Room"`, `type: "cctv_log"`, `title: "Storage Room Recorder Timer Log"`, and an item with `id: "E006"`, `locationId: "L02"`, `location: "Communications Room"`, `type: "work_order"`, `title: "Maintenance Work Order #2291"`. Neither reports `locationId: "L01"` or `"L03"` (the old, pre-fix values).
- **Priority:** high

## TC-44 — [API] 048: E005 relocates to null (off-map) in GET /evidence

- **Covers spec point:** 2
- **Preconditions:** `POST /cases/048/reset`.
- **Steps / Input:** `POST /cases/048/travel {"locationId":"L02"}`; `POST /cases/048/places/L02/search {"spotId":"L02-log"}` (unlocks E004); `POST /cases/048/travel {"locationId":"L04"}`; `GET /cases/048/dialogue/S02`; `POST /cases/048/dialogue/S02/choice {"presentEvidenceId":"E004"}` (Marsh, present at L04, unlocks E005); `GET /cases/048/evidence`.
- **Expected result:** All calls return 200. The list includes an item with `id: "E005"`, `locationId: null`, `location: null`, `type: "phone_records"`, `title: "Payphone Call to a Casting Agent"`, `timestamp: "1984-05-18T21:52:00"`. It does not report `locationId: "L02"` (the old, pre-fix value that put it at a place Marsh never stood).
- **Priority:** high

## TC-45 — [API] 049: E014 relocates to The Banking Hall (L01) in GET /evidence

- **Covers spec point:** 2
- **Preconditions:** `POST /cases/049/reset`.
- **Steps / Input:** `POST /cases/049/travel {"locationId":"L01"}`; `POST /cases/049/places/L01/search {"spotId":"L01-staff"}` (unlocks E005); `GET /cases/049/dialogue/S05`; `POST /cases/049/dialogue/S05/choice {"presentEvidenceId":"E005"}` (Doreen Walsh, present at L01, unlocks E006 and E014); `GET /cases/049/evidence`.
- **Expected result:** All calls return 200. The list includes an item with `id: "E014"`, `locationId: "L01"`, `location: "The Banking Hall"`, `type: "message"`, `title: "Doreen's Note on the Vault Corridor"`. It does not report `locationId: "L03"` (the old, pre-fix value).
- **Priority:** high

## TC-46 — [API] 050: E008 relocates to null (off-map) in GET /evidence

- **Covers spec point:** 2
- **Preconditions:** `POST /cases/050/reset`.
- **Steps / Input:** `POST /cases/050/travel {"locationId":"L04"}`; `POST /cases/050/places/L04/search {"spotId":"L04-keys"}` (unlocks E007); `POST /cases/050/travel {"locationId":"L02"}`; `GET /cases/050/dialogue/S01`; `POST /cases/050/dialogue/S01/choice {"presentEvidenceId":"E007"}` (Oliver Hale, present at L02, unlocks E008); `GET /cases/050/evidence`.
- **Expected result:** All calls return 200. The list includes an item with `id: "E008"`, `locationId: null`, `location: null`, `type: "photo"`, `title: "Photographer's Receipt"`, `timestamp: "1984-06-09T17:30:00"`. It does not report `locationId: "L04"` (the old, pre-fix value that put it at a place Oliver Hale never stood).
- **Priority:** high

## TC-47 — [API] 047: gated spot L05-permit is hidden until E004 and E007 are viewed, then turns up E011

- **Covers spec point:** 1, 2
- **Preconditions:** `POST /cases/047/reset`.
- **Steps / Input:**
  1. `POST /cases/047/travel {"locationId":"L06"}`; `POST /cases/047/places/L06/search {"spotId":"L06-tape"}` (unlocks E004); `POST /cases/047/viewed {"type":"evidence","id":"E004"}`.
  2. `POST /cases/047/travel {"locationId":"L05"}`; `GET /cases/047/places/L05` (before search).
  3. `POST /cases/047/places/L05/search {"spotId":"L05-stairs"}` (unlocks E007); `GET /cases/047/places/L05` (after search, before viewing E007).
  4. `POST /cases/047/places/L05/search {"spotId":"L05-permit"}` (attempted early).
  5. `POST /cases/047/viewed {"type":"evidence","id":"E007"}`; `GET /cases/047/places/L05` (after viewing).
  6. `POST /cases/047/places/L05/search {"spotId":"L05-permit"}`; `GET /cases/047/evidence`.
- **Expected result:**
  1. Both calls 200.
  2. The `spots` array does not contain an item with `id: "L05-permit"` (E007 not yet viewed).
  3. Search returns 200; `spots` still does not contain `L05-permit` (E004 viewed, but E007 only just unlocked, not yet viewed).
  4. Status 404 `{ "error": "There is nothing like that to search here" }` — the spot's `requires` are not yet met.
  5. The viewed call is 200; the `spots` array now contains `{ "id": "L05-permit", "label": "Look for Reyes's car on the staff barrier roll", "searched": false }`.
  6. Status 200 with `effects.unlockedEvidence` equal to `[{ "id": "E011", "title": "Garage Barrier Log, Permit A-117" }]`. `GET /evidence` includes E011 with `locationId: "L05"`, `location: "Parking Garage"`.
- **Priority:** high

## TC-48 — [API] 049: gated spot L06-solicitor is hidden until its requires hold, then turns up E012 (and sets lead.car)

- **Covers spec point:** 1, 2
- **Preconditions:** `POST /cases/049/reset`.
- **Steps / Input:**
  1. `POST /cases/049/travel {"locationId":"L06"}`; `GET /cases/049/dialogue/S04`; `POST /cases/049/dialogue/S04/choice {"choiceId":"et-start-threat"}` (sets `threatened.S04`); `POST /cases/049/dialogue/S04/choice {"choiceId":"et-threat-back"}`; `POST /cases/049/dialogue/S04/choice {"choiceId":"et-start-weekend"}` (sets `lead.sister`).
  2. `POST /cases/049/travel {"locationId":"L04"}`; `GET /cases/049/dialogue/S03`; `POST /cases/049/dialogue/S03/choice {"choiceId":"wk-start-saw"}` (sets `lead.car`).
  3. `POST /cases/049/travel {"locationId":"L06"}`; `GET /cases/049/places/L06`.
  4. `POST /cases/049/places/L06/search {"spotId":"L06-car"}` (unlocks E013); `POST /cases/049/viewed {"type":"evidence","id":"E013"}`; `GET /cases/049/places/L06`.
  5. `POST /cases/049/places/L06/search {"spotId":"L06-solicitor"}`; `GET /cases/049/evidence`; `GET /cases/049/investigation`.
- **Expected result:**
  1. Each choice returns 200.
  2. Both calls 200.
  3. The `spots` array contains `L06-car` (its `requires.lead.car` is now true) and does **not** contain `L06-sister` (its `requires.threatened.S04` is `ne: true`, which now fails) or `L06-solicitor` (E013 not yet viewed).
  4. The search returns 200 with `effects.unlockedEvidence` equal to `[{ "id": "E013", "title": "Millbrook Toll Receipt" }]`; the viewed call is 200; the second `GET /places/L06` now includes `{ "id": "L06-solicitor", "label": "Ring Margaret Thorne's solicitor", "searched": false }`.
  5. The search returns 200 with `effects.unlockedEvidence` equal to `[{ "id": "E012", "title": "Margaret Thorne's Account" }]`. `GET /evidence` includes E012 with `locationId: null`, `location: null`. `GET /investigation` shows `storyFlags["lead.car"]: true`.
- **Priority:** high

## TC-49 — [API] 050: gated spot L03-grate recovers E011 after the bluff burns the direct route

- **Covers spec point:** 1, 2
- **Preconditions:** `POST /cases/050/reset`.
- **Steps / Input:**
  1. `POST /cases/050/travel {"locationId":"L06"}`; `GET /cases/050/dialogue/S04`; `POST /cases/050/dialogue/S04/choice {"choiceId":"pc-start-how"}` (sets `lead.transport`); `GET /cases/050/dialogue/S05`; `POST /cases/050/dialogue/S05/choice {"choiceId":"dp-start-buyers"}` (sets `lead.buyer`).
  2. `POST /cases/050/travel {"locationId":"L05"}`; `GET /cases/050/places/L05`; `POST /cases/050/places/L05/search {"spotId":"L05-sheets"}` (unlocks E012); `POST /cases/050/viewed {"type":"evidence","id":"E012"}`.
  3. `POST /cases/050/travel {"locationId":"L03"}`; `GET /cases/050/places/L03` (before the bluff).
  4. `GET /cases/050/dialogue/S03`; `POST /cases/050/dialogue/S03/choice {"choiceId":"tr-start-bluff"}` (sets `burned.S03`); `GET /cases/050/places/L03` (after the bluff).
  5. `POST /cases/050/places/L03/search {"spotId":"L03-grate"}`; `GET /cases/050/evidence`.
- **Expected result:**
  1. All four choices return 200.
  2. `L05-sheets` is present in the before-search `spots` list (`lead.transport` is true); the search returns 200 with `effects.unlockedEvidence` equal to `[{ "id": "E012", "title": "Kingsway Job Sheet 6612" }]`; the viewed call is 200.
  3. `spots` contains `L03-bureau` (its `requires` — `lead.buyer eq true`, `burned.S03 ne true` — both hold) and does not yet contain `L03-grate` (`burned.S03` is not yet true).
  4. The choice returns 200. The after-bluff `spots` list no longer contains `L03-bureau` (`burned.S03 ne true` now fails) and now contains `{ "id": "L03-grate", "label": "Go through the ashes in the grate", "searched": false }`.
  5. The search returns 200 with `effects.unlockedEvidence` equal to `[{ "id": "E011", "title": "Letter from a Rotterdam Dealer" }]`. `GET /evidence` includes E011 with `locationId: "L03"`, `location: "The Coach-House Flat"`.
- **Priority:** high

## TC-50 — [API] 051: gated spots L04-bankcall and L04-pardoe recover E011/E013 after the briefcase demand burns the direct routes

- **Covers spec point:** 1, 2
- **Preconditions:** `POST /cases/051/reset`.
- **Steps / Input:**
  1. `POST /cases/051/travel {"locationId":"L01"}`; `POST /cases/051/places/L01/search {"spotId":"L01-will"}` (unlocks E012); `POST /cases/051/viewed {"type":"evidence","id":"E012"}`.
  2. `POST /cases/051/travel {"locationId":"L03"}`; `POST /cases/051/places/L03/search {"spotId":"L03-log"}` (unlocks E008); `POST /cases/051/viewed {"type":"evidence","id":"E008"}`.
  3. `POST /cases/051/travel {"locationId":"L04"}`; `GET /cases/051/places/L04` (before demanding the briefcase).
  4. `GET /cases/051/dialogue/S04`; `POST /cases/051/dialogue/S04/choice {"choiceId":"af-start-briefcase"}` (sets `briefcase.S04`); `GET /cases/051/places/L04` (after).
  5. `POST /cases/051/places/L04/search {"spotId":"L04-bankcall"}`; `POST /cases/051/places/L04/search {"spotId":"L04-pardoe"}`; `GET /cases/051/evidence`.
- **Expected result:**
  1. Search and viewed calls 200.
  2. Search and viewed calls 200.
  3. `spots` contains `L04-tray` and `L04-briefcase` (both `requires.briefcase.S04: { ne: true }`, which holds) and does not yet contain `L04-bankcall` or `L04-pardoe`.
  4. The choice returns 200. The after-demand `spots` list no longer contains `L04-tray` or `L04-briefcase` (both now fail their `ne: true` requirement) and now contains `L04-bankcall` and `L04-pardoe`, both `searched: false`.
  5. Both searches return 200: the first with `effects.unlockedEvidence` equal to `[{ "id": "E011", "title": "Bank Letter to the Trustee" }]`, the second with `[{ "id": "E013", "title": "Probate Inventory" }]`. `GET /evidence` shows both E011 and E013 with `locationId: "L04"`, `location: "The Library"`.
- **Priority:** high

## TC-51 — [API] The place rule holds across all five cases: a search spot's exhibit reports the same locationId as the place searched

- **Covers spec point:** 2; the 2026-09-25 place-rule fix, enforced at seed time by `validateDialogue`
- **Preconditions:** A fresh reset of each of the five cases in turn.
- **Steps / Input:** For each case, travel to the named place and search the named spot, then `GET .../evidence`:
  1. 047: `POST /travel {"locationId":"L02"}`; search `L02-recorder` (unlocks E005).
  2. 048: `POST /travel {"locationId":"L03"}`; search `L03-ashtray` (unlocks E009).
  3. 049: `POST /travel {"locationId":"L03"}`; search `L03-e001` (unlocks E001).
  4. 050: `POST /travel {"locationId":"L03"}`; search `L03-bin` (unlocks E010).
  5. 051: `POST /travel {"locationId":"L03"}`; search `L03-log` (unlocks E008).
- **Expected result:** In every case, the unlocked exhibit's `locationId` in `GET /evidence` equals the id of the place that was searched, and `location` equals that place's `name` (047 E005 → `"L02"`/"Communications Room"; 048 E009 → `"L03"`/"Dressing Room 1"; 049 E001 → `"L03"`/"The Vault & Loading Bay"; 050 E010 → `"L03"`/"The Coach-House Flat"; 051 E008 → `"L03"`/"The Nurse's Room"). None reports a `locationId` other than the place it was actually found at.
- **Priority:** medium

## TC-52 — [API] Closed case: POST /viewed on an evidence id is now 422, not 200

- **Covers spec point:** 4
- **Preconditions:** `POST /cases/047/reset`; unlock E001 only (travel to L03, search `L03-e001`); then `POST /cases/047/conclusion {"suspectId": null, "evidenceIds": []}` to close the case. E001 is unlocked but not yet viewed.
- **Steps / Input:** `POST /cases/047/viewed {"type":"evidence","id":"E001"}`; then `GET /cases/047/investigation`.
- **Expected result:** The POST returns status 422 with body exactly `{ "error": "This case is closed." }`. The GET shows `evidenceViewed: []` (unchanged) and `progress` unchanged from before the POST. This reverses TC-41's expectation — see the superseded section below.
- **Priority:** high

## TC-53 — [API] Closed case: POST /viewed keeps the 400 → 404 → 422 order

- **Covers spec point:** 4, 5
- **Preconditions:** As TC-52 (case closed, E001 unlocked and not yet viewed).
- **Steps / Input:**
  1. `POST /cases/047/viewed {"type":"bogus","id":"E001"}`
  2. `POST /cases/047/viewed {"type":"evidence","id":"E999"}`
  3. `POST /cases/047/viewed {"type":"evidence","id":"E014"}` (real exhibit, never unlocked)
  4. `POST /cases/047/viewed {"type":"evidence","id":"E001"}` (real, unlocked)
- **Expected result:**
  1. Status 400, body exactly `{ "error": "Expected { type: \"evidence\" | \"suspect\" | \"event\", id }" }` — malformed body is checked before the case is known to be closed.
  2. Status 404, body exactly `{ "error": "Nothing with that id in this case" }` — an unknown id is still 404 on a closed case.
  3. Status 404, the same body as step 2 — a real but locked exhibit is still indistinguishable from unknown, even closed.
  4. Status 422, body exactly `{ "error": "This case is closed." }` — only a well-formed, known, unlocked id reaches the closed-case check.
  In every step `evidenceViewed` stays `[]` (confirm with a final `GET /cases/047/investigation`).
- **Priority:** medium

---

## Superseded by the 2026-09-25 fixes

- TC-41 — old expectation: `POST /viewed` on an already-unlocked exhibit returns 200 and records the view even when the case is closed ("`recordViewed` has no closed-case check in the source"). — new expected behaviour: returns 422 `{ "error": "This case is closed." }` and `evidenceViewed` is unchanged, per TC-52/TC-53 above. — which change: 2026-09-25 QA bug-fix plan, decision D1-A — `investigation.service.js` `recordViewed` now calls `assertOpen()` (after the existing-id 404 check, before recording), matching the freeze already applied to connections and contradictions.

> 2026-09-25: added TC-43..TC-53; superseded expectations are listed above and in docs/qa/SUPERSEDED-2026-09-25.md.
