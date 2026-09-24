# Test cases — Investigation Board and Connections

Spec: `docs/specs/board-and-connections.md`. All paths are relative to the API base (`/api`, through the Vite proxy on :5173 or directly on :4000). Case ids are the five folders `047`–`051`; unless stated, cases use `047`.

## Conventions and notes for the runner

- **Fresh** means the case has had `POST /api/cases/<id>/reset` (or a deleted SQLite file). Seed data: 047 has suspects `S01`–`S05`, locations `L01`–`L06`, statements `ST01`–`ST05` with claims such as `ST01-A`, `ST01-B`, `ST02-A`, `ST02-B`, `ST02-C`, timeline events `T01`–`T12`. `defaultUnlockedEvidence` is empty in every case, so **every `E` id is locked on a fresh case**.
- **Setup A (unlock E002 in 047):** `POST /cases/047/travel {"locationId":"L03"}` then `POST /cases/047/places/L03/search {"spotId":"L03-e002"}`. Afterwards `GET /cases/047/evidence` must list `E002`. This also makes timeline events `T08` and `T12` "known" (a `T` event is known when it has no exhibit or the player holds at least one of its exhibits).
- **Exact rejection strings** (from `investigation.service.js`, used for the comparisons below):
  - `R-UNKNOWN` = `One of those items isn't in this case.`
  - `R-SELF` = `An item can't be linked to itself.`
  - `R-DUP` = `Those two are already linked.`
  - `R-REL` = `That kind of link isn't supported.`
  - `R-400` = `Expected { source, target, relationship }`
  - `R-404` = `Connection not found`
  - Error bodies are exactly `{ "error": "<string>" }`.
- **Ambiguities found (verify, do not assume):**
  1. `docs/PRD.md` §7 documents `DELETE /api/connections/:connectionId`; `CLAUDE.md` and the code use `DELETE /api/cases/:caseId/connections/:connectionId`. These cases use the case-scoped path (TC-32). The PRD path is not tested.
  2. Spec point 2 says the id is `C\d+`. The implementation zero-pads to two digits (`C01`, `C02`, ..., `C10`). Cases assert the regex `^C\d+$`, and additionally note the observed `C01` form.
  3. Spec point 3 says a claim id has the `ST02-A` form. The bare statement id `ST02` and search-spot ids such as `L01-locker` are not named by the spec as valid; TC-16 records what happens.
  4. Spec point 4 says missing `source`/`target` is 400. An empty string `""` is present but not a valid id; TC-26 records the observed status (expected 422 per source).
  5. Spec point 10: reset clears the localStorage layout only via the UI (`NewInvestigation`, labelled `[ PLAY AGAIN ]` on the final report and `NEW INVESTIGATION` elsewhere). A raw `POST /reset` cannot touch the browser's localStorage. TC-58 uses the UI.
- Cases marked **[UI]** need a browser. All others are API-only (curl/fetch).

---

## TC-01 — Fresh case has no connections

- **Covers spec point:** 1
- **Preconditions:** Fresh case 047.
- **Steps / Input:** `GET /api/cases/047/connections`
- **Expected result:** Status 200, body is exactly the JSON array `[]` (not wrapped in an object, not `null`).
- **Priority:** high

## TC-02 — Fresh case has no connections in every case folder

- **Covers spec point:** 1
- **Preconditions:** Fresh cases 047, 048, 049, 050, 051.
- **Steps / Input:** `GET /api/cases/<id>/connections` for each of the five ids.
- **Expected result:** Each returns 200 and `[]`.
- **Priority:** medium

## TC-03 — Create a link between two suspects (relationship omitted)

- **Covers spec point:** 2, 3
- **Preconditions:** Fresh case 047.
- **Steps / Input:** `POST /api/cases/047/connections` with body `{"source":"S01","target":"S02"}`, header `Content-Type: application/json`.
- **Expected result:** Status 201. Body has exactly the keys `id`, `source`, `target`, `relationship`; `source` is `"S01"`, `target` is `"S02"`, `relationship` is `"linked_to"`, `id` matches `^C\d+$` (observed: `"C01"`). No other keys (see TC-28).
- **Priority:** high

## TC-04 — Create a link with explicit relationship

- **Covers spec point:** 2
- **Preconditions:** Fresh case 047.
- **Steps / Input:** `POST /api/cases/047/connections` with `{"source":"S03","target":"S04","relationship":"linked_to"}`
- **Expected result:** 201; body `relationship` is `"linked_to"`; `id` matches `^C\d+$`.
- **Priority:** medium

## TC-05 — Created link appears in GET /connections

- **Covers spec point:** 2, 8
- **Preconditions:** Fresh case 047.
- **Steps / Input:** (1) `POST /api/cases/047/connections {"source":"S01","target":"S02"}`. (2) `POST` again with `{"source":"S03","target":"S04"}`. (3) `GET /api/cases/047/connections`.
- **Expected result:** Step 3 returns 200 and an array of exactly two objects in creation order: first equals the step-1 response body, second equals the step-2 response body (same `id`, `source`, `target`, `relationship`).
- **Priority:** high

## TC-06 — investigation.connections matches GET /connections

- **Covers spec point:** 8
- **Preconditions:** Fresh case 047 with TC-05's two links created.
- **Steps / Input:** `GET /api/cases/047/connections` and `GET /api/cases/047/investigation`.
- **Expected result:** `investigation.connections` is deep-equal (same items, same order, same fields) to the `GET /connections` array. Also true on a fresh case (both `[]`).
- **Priority:** high

## TC-07 — Link two locations

- **Covers spec point:** 3
- **Preconditions:** Fresh case 047.
- **Steps / Input:** `POST /api/cases/047/connections {"source":"L01","target":"L02"}`
- **Expected result:** 201 with `source: "L01"`, `target: "L02"`.
- **Priority:** medium

## TC-08 — Link a statement claim to a suspect

- **Covers spec point:** 3
- **Preconditions:** Fresh case 047. `GET /api/cases/047/statements` contains an assertion with id `ST02-A`.
- **Steps / Input:** `POST /api/cases/047/connections {"source":"ST02-A","target":"S02"}`
- **Expected result:** 201; `source` is `"ST02-A"`, `target` is `"S02"`.
- **Priority:** high

## TC-09 — Link two claims

- **Covers spec point:** 3
- **Preconditions:** Fresh case 047.
- **Steps / Input:** `POST /api/cases/047/connections {"source":"ST01-A","target":"ST02-A"}`
- **Expected result:** 201 with those two ids.
- **Priority:** low

## TC-10 — Link an unlocked exhibit

- **Covers spec point:** 3
- **Preconditions:** Fresh case 047, then Setup A (E002 unlocked).
- **Steps / Input:** `POST /api/cases/047/connections {"source":"E002","target":"S02"}`
- **Expected result:** 201; `source: "E002"`, `target: "S02"`. Repeat with source/target swapped on a fresh case after Setup A (`{"source":"S02","target":"E002"}`): also 201.
- **Priority:** high

## TC-11 — Locked exhibit is rejected

- **Covers spec point:** 3, 4
- **Preconditions:** Fresh case 047 (no Setup A). `GET /api/cases/047/evidence` does not list `E002`.
- **Steps / Input:** `POST /api/cases/047/connections {"source":"E002","target":"S02"}`, then the same with `{"source":"S02","target":"E002"}`.
- **Expected result:** Both return 422 with body exactly `{"error":"One of those items isn't in this case."}` (`R-UNKNOWN`). `GET /connections` is still `[]`.
- **Priority:** high

## TC-12 — Nonexistent exhibit id is rejected

- **Covers spec point:** 3, 4
- **Preconditions:** Fresh case 047, Setup A done.
- **Steps / Input:** `POST /api/cases/047/connections {"source":"E999","target":"S02"}`
- **Expected result:** 422, `{"error":"One of those items isn't in this case."}`.
- **Priority:** medium

## TC-13 — Timeline event with no held exhibit is rejected

- **Covers spec point:** 3, 4
- **Preconditions:** Fresh case 047 (no exhibits held). `GET /api/cases/047/timeline` does not contain `T08` (all of T01–T12 have exhibits behind them; verify from the response).
- **Steps / Input:** `POST /api/cases/047/connections {"source":"T08","target":"S02"}`
- **Expected result:** 422, `{"error":"One of those items isn't in this case."}`.
- **Priority:** high

## TC-14 — Timeline event becomes linkable once an exhibit behind it is held

- **Covers spec point:** 3
- **Preconditions:** Fresh case 047, then Setup A. `GET /api/cases/047/timeline` now contains `T08` (its exhibits include `E002`).
- **Steps / Input:** `POST /api/cases/047/connections {"source":"T08","target":"S02"}`
- **Expected result:** 201; `source: "T08"`, `target: "S02"`.
- **Priority:** medium

## TC-15 — Unknown ids of every kind are rejected, in either position

- **Covers spec point:** 4
- **Preconditions:** Fresh case 047.
- **Steps / Input:** For each unknown id `X` in `S99`, `L99`, `T99`, `ST99-A`, `ST02-Z`, `X01`, `C01`, `abc`: send `{"source":"S01","target":"X"}` and `{"source":"X","target":"S01"}` to `POST /api/cases/047/connections`.
- **Expected result:** Every one of the 16 calls returns 422 with `{"error":"One of those items isn't in this case."}`. `GET /connections` is still `[]`.
- **Priority:** high

## TC-16 — Bare statement id and search-spot id (spec ambiguity)

- **Covers spec point:** 3, 4
- **Preconditions:** Fresh case 047.
- **Steps / Input:** (a) `{"source":"ST02","target":"S01"}`; (b) `{"source":"L01-locker","target":"S01"}`.
- **Expected result:** Both are not a claim id / location id, so per current source both return 422 `One of those items isn't in this case.` If either returns 201, record as a deviation from source and flag it to the spec owner (spec is silent on these ids).
- **Priority:** low

## TC-17 — Self-link is rejected

- **Covers spec point:** 4
- **Preconditions:** Fresh case 047.
- **Steps / Input:** `POST /api/cases/047/connections {"source":"S01","target":"S01"}`
- **Expected result:** 422, `{"error":"An item can't be linked to itself."}` (`R-SELF`). `GET /connections` is `[]`.
- **Priority:** high

## TC-18 — Duplicate in the same direction is rejected

- **Covers spec point:** 4
- **Preconditions:** Fresh case 047; `POST {"source":"S01","target":"S02"}` already returned 201.
- **Steps / Input:** `POST /api/cases/047/connections {"source":"S01","target":"S02"}`
- **Expected result:** 422, `{"error":"Those two are already linked."}` (`R-DUP`). `GET /connections` still has exactly one item.
- **Priority:** high

## TC-19 — Duplicate in the reverse direction is rejected

- **Covers spec point:** 4
- **Preconditions:** Fresh case 047; `POST {"source":"S01","target":"S02"}` already returned 201.
- **Steps / Input:** `POST /api/cases/047/connections {"source":"S02","target":"S01"}`
- **Expected result:** 422, `{"error":"Those two are already linked."}`. `GET /connections` still has exactly one item, with `source: "S01"`, `target: "S02"`.
- **Priority:** high

## TC-20 — Missing source is a 400

- **Covers spec point:** 4
- **Preconditions:** Fresh case 047.
- **Steps / Input:** `POST /api/cases/047/connections {"target":"S02"}`
- **Expected result:** 400, `{"error":"Expected { source, target, relationship }"}` (`R-400`). Nothing created.
- **Priority:** high

## TC-21 — Missing target is a 400

- **Covers spec point:** 4
- **Preconditions:** Fresh case 047.
- **Steps / Input:** `POST /api/cases/047/connections {"source":"S01"}`
- **Expected result:** 400, `{"error":"Expected { source, target, relationship }"}`. Nothing created.
- **Priority:** high

## TC-22 — Empty or absent body is a 400

- **Covers spec point:** 4
- **Preconditions:** Fresh case 047.
- **Steps / Input:** (a) `POST /api/cases/047/connections` with body `{}`; (b) same with no body and `Content-Type: application/json`.
- **Expected result:** (a) 400 with `R-400`. (b) 400 (with `R-400`; if the JSON parser rejects it first, any 400 with an `{error}` body is acceptable). Nothing created.
- **Priority:** medium

## TC-23 — Non-string source or target is a 400

- **Covers spec point:** 4
- **Preconditions:** Fresh case 047.
- **Steps / Input:** Post each of: `{"source":1,"target":"S02"}`, `{"source":"S01","target":null}`, `{"source":["S01"],"target":"S02"}`, `{"source":"S01","target":{"id":"S02"}}`.
- **Expected result:** Each returns 400 with `R-400`. Nothing created.
- **Priority:** medium

## TC-24 — Unsupported relationship is rejected

- **Covers spec point:** 2, 4
- **Preconditions:** Fresh case 047.
- **Steps / Input:** `POST /api/cases/047/connections {"source":"S01","target":"S02","relationship":"caused_by"}`
- **Expected result:** 422, `{"error":"That kind of link isn't supported."}` (`R-REL`). Nothing created.
- **Priority:** medium

## TC-25 — Non-string relationship is a 400

- **Covers spec point:** 4
- **Preconditions:** Fresh case 047.
- **Steps / Input:** `POST /api/cases/047/connections {"source":"S01","target":"S02","relationship":5}`
- **Expected result:** 400 with `R-400`. Nothing created.
- **Priority:** low

## TC-26 — Empty-string ids (spec ambiguity)

- **Covers spec point:** 4
- **Preconditions:** Fresh case 047.
- **Steps / Input:** `POST /api/cases/047/connections {"source":"","target":"S02"}` and `{"source":"S01","target":""}`.
- **Expected result:** Per source both are 422 `One of those items isn't in this case.` (present strings, unknown ids). The spec only defines 400 for missing fields; if the app returns 400 instead, record it as a spec/implementation ambiguity rather than a failure. Nothing created either way.
- **Priority:** low

## TC-27 — Rejection messages never say whether a link is right or wrong

- **Covers spec point:** 5
- **Preconditions:** Fresh case 047, Setup A done; `POST {"source":"S01","target":"S02"}` created.
- **Steps / Input:** Trigger every rejection type and collect the `error` strings: unknown id (TC-15), locked exhibit (TC-11), self-link (TC-17), same-direction and reverse duplicate (TC-18, TC-19), unsupported relationship (TC-24), missing field (TC-20). Also trigger the same rejection type with two different pairs (e.g. duplicate of `S01/S02` and duplicate of `E002/S02` after creating it; self-link on `S01` and self-link on `S05`).
- **Expected result:** Every 4xx body is exactly `{"error": <one of the R-* strings above>}`. Strings are identical for the same rejection type regardless of which ids were used (e.g. the `R-DUP` string for the two duplicates is byte-identical). No string contains, case-insensitively, any of: `right`, `wrong`, `correct`, `incorrect`, `culprit`, `guilty`, `innocent`, `relevant`, `irrelevant`, `contradict`, `solution`. No extra keys beside `error`.
- **Priority:** high

## TC-28 — Successful creation carries no verdict

- **Covers spec point:** 5, 2
- **Preconditions:** Fresh case 047.
- **Steps / Input:** Create three links between arbitrary valid pairs (e.g. `S01/S02`, `S03/L01`, `ST01-A/S01`).
- **Expected result:** Each 201 body has exactly the four keys `id`, `source`, `target`, `relationship` and nothing else (no `correct`, `valid`, `score`, `hint`, `message` keys). The response shape is identical for all three pairs.
- **Priority:** high

## TC-29 — Rejected requests change no state

- **Covers spec point:** 4, 8
- **Preconditions:** Fresh case 047 with one link `S01/S02` (`C01`).
- **Steps / Input:** Send TC-15 (one call), TC-17, TC-18, TC-19, TC-20, TC-24 requests, then `GET /connections` and `GET /investigation`.
- **Expected result:** Both return exactly the single `C01` link. Then `POST {"source":"S03","target":"S04"}` returns id `C02` (rejected requests did not consume ids).
- **Priority:** medium

## TC-30 — DELETE returns 204 and removes the link from GET /connections

- **Covers spec point:** 6
- **Preconditions:** Fresh case 047 with `C01` (`S01/S02`) and `C02` (`S03/S04`).
- **Steps / Input:** `DELETE /api/cases/047/connections/C01`, then `GET /api/cases/047/connections`.
- **Expected result:** DELETE returns 204 with an empty body. GET returns an array containing only `C02`.
- **Priority:** high

## TC-31 — DELETE removes the link from investigation.connections

- **Covers spec point:** 6, 8
- **Preconditions:** Same as TC-30 after the delete.
- **Steps / Input:** `GET /api/cases/047/investigation`.
- **Expected result:** `connections` is exactly the array containing only `C02`, deep-equal to `GET /connections`.
- **Priority:** high

## TC-32 — DELETE of an unknown id is a 404

- **Covers spec point:** 6
- **Preconditions:** Fresh case 047 with `C01` only.
- **Steps / Input:** `DELETE /api/cases/047/connections/C99`; `DELETE /api/cases/047/connections/abc`.
- **Expected result:** Both return 404 with `{"error":"Connection not found"}` (`R-404`). `GET /connections` still contains `C01`.
- **Priority:** high

## TC-33 — Deleting the same id twice

- **Covers spec point:** 6
- **Preconditions:** Fresh case 047 with `C01`.
- **Steps / Input:** `DELETE /api/cases/047/connections/C01` twice.
- **Expected result:** First 204; second 404 `{"error":"Connection not found"}`.
- **Priority:** medium

## TC-34 — New connection after a delete gets a fresh, unique id

- **Covers spec point:** 7
- **Preconditions:** Fresh case 047.
- **Steps / Input:** (1) create `S01/S02` -> id A. (2) create `S03/S04` -> id B. (3) `DELETE` id B (the highest id). (4) create `S05/L01` -> id D. (5) `GET /connections`.
- **Expected result:** A, B, D all match `^C\d+$` and are pairwise different; in particular D is not equal to B (observed: `C01`, `C02`, then `C03`). Step 5 contains A and D only; no entry has id B.
- **Priority:** high

## TC-35 — Deleting a lower id does not cause a collision

- **Covers spec point:** 7
- **Preconditions:** Fresh case 047.
- **Steps / Input:** Create three links (ids A, B, C in order). Delete A. Create a fourth.
- **Expected result:** The fourth id matches `^C\d+$`, and differs from A, B and C. `GET /connections` shows B, C and the fourth with three distinct ids.
- **Priority:** medium

## TC-36 — Same pair can be linked again after deletion

- **Covers spec point:** 4, 6, 7
- **Preconditions:** Fresh case 047; `S01/S02` created then deleted.
- **Steps / Input:** `POST {"source":"S02","target":"S01"}`.
- **Expected result:** 201 (duplicate check only considers existing links); new `id` differs from the deleted one; `GET /connections` has exactly one item.
- **Priority:** medium

## TC-37 — Connections are isolated per case

- **Covers spec point:** 1, 2, 8
- **Preconditions:** Fresh cases 047 and 048.
- **Steps / Input:** (1) `POST /cases/047/connections {"source":"S01","target":"S02"}`. (2) `GET /cases/048/connections`. (3) `GET /cases/048/investigation`. (4) `POST /cases/048/connections {"source":"S01","target":"S02"}`. (5) `GET /cases/047/connections`.
- **Expected result:** (2) `[]`; (3) `connections: []`; (4) 201 (not a duplicate, different case); (5) exactly one item.
- **Priority:** high

## TC-38 — DELETE only acts within the case in the URL

- **Covers spec point:** 6
- **Preconditions:** Fresh cases 047 and 048; only case 047 has a link with id `C01`.
- **Steps / Input:** `DELETE /api/cases/048/connections/C01`; then, if case 048 also has its own `C01`, `DELETE /api/cases/048/connections/C01` and check 047.
- **Expected result:** With no link in 048: 404 `R-404` and 047's `C01` still present. If 048 has its own `C01`: 204, 048's list is `[]`, and 047's `C01` is untouched.
- **Priority:** medium

## TC-39 — Reset clears all connections

- **Covers spec point:** 10
- **Preconditions:** Case 047 with at least two links, and Setup A done with an `E002` link.
- **Steps / Input:** `POST /api/cases/047/reset`, then `GET /cases/047/connections` and `GET /cases/047/investigation`.
- **Expected result:** Reset returns 200 with an investigation body whose `connections` is `[]`. `GET /connections` is `[]`. `investigation.connections` is `[]`.
- **Priority:** high

## TC-40 — Post-reset creation works and starts over

- **Covers spec point:** 7, 10
- **Preconditions:** After TC-39.
- **Steps / Input:** `POST /cases/047/connections {"source":"S01","target":"S02"}`; also retry `{"source":"E002","target":"S02"}`.
- **Expected result:** First is 201 with an id matching `^C\d+$` (observed in source: `C01`, as the counter is reset). The `E002` one is 422 `R-UNKNOWN` because reset re-locks evidence (`defaultUnlockedEvidence` is empty).
- **Priority:** low

## TC-41 — Reset of one case leaves other cases' connections alone

- **Covers spec point:** 10
- **Preconditions:** Cases 047 and 048 each have one link.
- **Steps / Input:** `POST /api/cases/047/reset`; then `GET /cases/048/connections`.
- **Expected result:** 048 still returns its one link unchanged.
- **Priority:** medium

## TC-42 — Unknown caseId is a 404 on all three connection routes

- **Covers spec point:** 1, 2, 6
- **Preconditions:** None.
- **Steps / Input:** `GET /api/cases/999/connections`; `POST /api/cases/999/connections {"source":"S01","target":"S02"}`; `DELETE /api/cases/999/connections/C01`.
- **Expected result:** Each returns 404 with an `{"error": "<string>"}` body. Nothing is created for case 047 or any other case.
- **Priority:** medium

---

## UI cases (browser required)

Base URL `http://localhost:5173/case/047/board` unless noted. "Layout key" means the `localStorage` key `mysterydesk:board:<caseId>`. Titles on cards come from the API (read them from `GET /evidence|suspects|...`, never assume text).
