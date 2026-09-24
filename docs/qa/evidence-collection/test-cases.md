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
