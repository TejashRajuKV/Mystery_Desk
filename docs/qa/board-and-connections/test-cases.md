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

## Additional cases (added 2026-09-24)

These cases close two gaps: (a) the API-level behaviour of connections once a case is
closed or its clock has run out, which `createConnection`/`deleteConnection` in
`backend/src/services/investigation.service.js` never gate behind `assertOpen()` or
`spendTime()` (unlike travel, search, page reads and the theory field, per commit
b45dd98's closed-case rules) — confirmed by reading the current source, not assumed;
and (b) the entire "UI cases (browser required)" section above, which the teammate's
draft left as a header with no actual cases (it references a `TC-58` that does not
exist in this file). All source-of-truth claims below were checked against
`backend/src/services/investigation.service.js`, `backend/src/services/field.service.js`,
`frontend/src/pages/InvestigationBoard/InvestigationBoard.jsx` and
`frontend/src/utils/boardStore.js`.

## TC-43 — Connections can still be created after the case is closed

- **Covers spec point:** 2, 3 (interaction with the conclusion/closed-case rule in `CLAUDE.md`, not itself numbered in the spec)
- **Preconditions:** Fresh case 047. File a conclusion to close the case: `POST /api/cases/047/conclusion {"suspectId": null}` (the documented "Cannot determine" option, which needs no evidence and does not require knowledge of the answer key). Confirm `GET /api/cases/047/investigation` now has a non-null `conclusion`.
- **Steps / Input:** `POST /api/cases/047/connections {"source":"S01","target":"S02"}`
- **Expected result:** 201 with the usual `{id, source, target, relationship}` shape (same as TC-03). Per current source, `createConnection` never calls `assertOpen()`, so the closed-case check that blocks `PUT /theory`, `POST /file/:pageId/read`, `POST /travel` and `POST /places/:id/search` does not apply here. If this ever returns 422 `"This case is closed."`, treat it as a behaviour change worth flagging to the spec owner, since it would newly restrict board editing after the verdict.
- **Priority:** high

## TC-44 — Connections can still be deleted after the case is closed

- **Covers spec point:** 6 (interaction with the closed-case rule)
- **Preconditions:** Same as TC-43, with the connection from TC-43 created (id noted as `X`).
- **Steps / Input:** `DELETE /api/cases/047/connections/<X>`
- **Expected result:** 204, empty body, exactly as TC-30. `GET /connections` no longer contains `X`. `deleteConnection` also never calls `assertOpen()`.
- **Priority:** high

## TC-45 — Creating or deleting a connection does not spend time on the case clock

- **Covers spec point:** 2, 6 (the clock is documented under "Investigation state" in `CLAUDE.md`; `connections` carries no `TIME_COST` entry in `backend/src/config/index.js`)
- **Preconditions:** Fresh case 047.
- **Steps / Input:** (1) `GET /api/cases/047/investigation`, note `clock.minutesUsed`. (2) `POST /connections {"source":"S01","target":"S02"}`. (3) `GET /investigation` again, note `clock.minutesUsed`. (4) `DELETE /connections/<id from step 2>`. (5) `GET /investigation` again.
- **Expected result:** `clock.minutesUsed` (and `clock.now`) are identical across all three `GET /investigation` calls — creating and deleting a link costs no time, unlike `travel` (30), `search` (15), `readPage` (20) or `question`/`present` (10).
- **Priority:** medium

## TC-46 — Connections remain postable once the clock has run out but no accusation has been filed yet

- **Covers spec point:** 2, 3 (edge case implied by the clock rules in `CLAUDE.md`, "time up forces the accusation")
- **Preconditions:** Fresh case 047. Exhaust the clock without an accusation: alternate `POST /travel` between two different locations (e.g. `L01`, then `L02`, then `L01`, ...) until `GET /investigation` reports `clock.timeUp: true`. Do not call `POST /conclusion`.
- **Steps / Input:** `POST /api/cases/047/connections {"source":"S03","target":"S04"}`
- **Expected result:** 201 with the usual shape. `createConnection` checks neither `assertOpen()` nor `spendTime()`, so it is not gated by `clock.timeUp` the way `travel`/`search`/`readPage` are (those would now return 422 `"Time is up. The District Attorney wants a name."`). If this ever rejects the connection, flag it as a behaviour change.
- **Priority:** low

## TC-47 — [UI] Pinning a card from the panel adds it to the board and to localStorage

- **Covers spec point:** 9
- **Preconditions:** Fresh case 047, browser at `http://localhost:5173/case/047/board`. Setup A done via the app (travel to and search the relevant spot) so at least one evidence card, e.g. `E002`, is available to pin. Board is empty (`localStorage` key `mysterydesk:board:047` absent or `{}`).
- **Steps / Input:** In the "PIN TO BOARD" panel, choose `E002` from the select and click `PIN`.
- **Expected result:** A card for `E002` appears on the canvas with its title read from the API (not hardcoded). `localStorage.getItem("mysterydesk:board:047")` now parses to an object with a key `"E002"` whose value is `{x, y}` numbers. The page title's `N PINNED` count increments by 1. `E002` no longer appears in the "PIN TO BOARD" select's Evidence group (already pinned).
- **Priority:** high

## TC-48 — [UI] Selecting two pinned cards and confirming creates a real connection and draws a line

- **Covers spec point:** 9
- **Preconditions:** Fresh case 047, browser. Two cards already pinned (e.g. `S01` and `S02`, via the PIN control).
- **Steps / Input:** Click the `S01` card (it becomes selected), then click the `S02` card. In the "NEW LINK" panel that appears (`S01 → S02`), click `CREATE LINK`.
- **Expected result:** While pending, no network call has been made yet (`GET /api/cases/047/connections` from another tab still shows it absent). After clicking `CREATE LINK`, a `POST /api/cases/047/connections {"source":"S01","target":"S02","relationship":"linked_to"}` fires; on success a red-string `<line>` is drawn between the two cards, the "LINKS" list shows one entry `<id> · S01 → S02`, and `GET /api/cases/047/connections` (checked independently) now contains that same connection.
- **Priority:** high

## TC-49 — [UI] Cancelling a pending link makes no API call

- **Covers spec point:** 9 (implied: only a confirmed action reaches the backend)
- **Preconditions:** Fresh case 047, browser, two cards pinned (e.g. `S03`, `S04`).
- **Steps / Input:** Click `S03` then `S04` to open the "NEW LINK" panel, then click `CANCEL` instead of `CREATE LINK`.
- **Expected result:** The "NEW LINK" panel closes, no line is drawn, the "LINKS" list is unchanged. `GET /api/cases/047/connections` (checked independently) is still `[]` — cancelling never called `POST /connections`.
- **Priority:** medium

## TC-50 — [UI] Refreshing the page keeps both the server connections and the pinned layout

- **Covers spec point:** 9
- **Preconditions:** Fresh case 047, browser. Two cards pinned and linked (per TC-48), at custom dragged positions.
- **Steps / Input:** Reload the browser tab (`F5`) at `http://localhost:5173/case/047/board`.
- **Expected result:** Both cards reappear at the same `{x, y}` positions they were left at (read back from `localStorage`, not re-auto-positioned), and the line between them is redrawn. `GET /api/cases/047/connections` still returns the same connection — it was never dependent on the browser reload since it's server state.
- **Priority:** high

## TC-51 — [UI] Deleting a link via the panel removes the line and the server record, but leaves both cards pinned

- **Covers spec point:** 6, 9
- **Preconditions:** Fresh case 047, browser, one link created per TC-48 (id noted as `X`).
- **Steps / Input:** In the "LINKS" list, click the `✕` button next to the `X · S01 → S02` entry.
- **Expected result:** The red-string line disappears from the canvas immediately. The "LINKS" list becomes empty (or loses that entry). `GET /api/cases/047/connections` (checked independently) no longer contains `X` — the same as `DELETE /connections/X` in TC-30. Both `S01` and `S02` cards remain visible and pinned on the canvas (only the link is gone, not the cards).
- **Priority:** high

## TC-52 — [UI] A card that is part of a live connection cannot be unpinned until the connection is removed

- **Covers spec point:** 9 (UI constraint on top of the backend's per-viewer layout state)
- **Preconditions:** Fresh case 047, browser, `S01`/`S02` linked per TC-48.
- **Steps / Input:** Click the `S01` card to select it. Observe the `REMOVE S01 FROM BOARD` button. Then delete the `S01`–`S02` link (per TC-51) and re-select `S01`.
- **Expected result:** While the link exists, the `REMOVE S01 FROM BOARD` button is disabled with title text "Remove its links first" (or equivalent visible affordance) and clicking it has no effect (card stays pinned). After the link is deleted, re-selecting `S01` shows the button enabled; clicking it removes `S01` from the canvas and from the `mysterydesk:board:047` localStorage entry.
- **Priority:** medium

## TC-53 — [UI] Board layout does not leak between cases

- **Covers spec point:** 9
- **Preconditions:** Fresh cases 047 and 048, browser. `mysterydesk:board:047` and `mysterydesk:board:048` both absent.
- **Steps / Input:** (1) Go to `http://localhost:5173/case/047/board`, pin `S01`. (2) Navigate to `http://localhost:5173/case/048/board`.
- **Expected result:** Case 048's board is empty (`EmptyState` "The board is empty" shown; `0 PINNED`). `localStorage.getItem("mysterydesk:board:048")` is absent or `{}` — the `S01` pin written under the `mysterydesk:board:047` key does not appear under the `048` key. Navigating back to 047's board still shows `S01` pinned.
- **Priority:** high

## TC-54 — [UI] Locked evidence never appears in the PIN TO BOARD dropdown

- **Covers spec point:** 3 (exhibit must be unlocked), applied to the UI layer; also the general "locked evidence doesn't exist as far as the player is concerned" rule in `CLAUDE.md`
- **Preconditions:** Fresh case 047, browser, no evidence found yet (`GET /api/cases/047/evidence` returns none of the locked ids, e.g. `E002` absent).
- **Steps / Input:** Open the "PIN TO BOARD" select and expand the "Evidence" optgroup.
- **Expected result:** The Evidence optgroup is empty (or absent) — no locked evidence id/title is listed, since the board's pinnable list is built from the same `evidence` array the Evidence Room uses (`useCase()`), which the backend already filters to unlocked-only. After performing Setup A in the browser (travel + search), reopening the select shows `E002 · <title>` in the Evidence optgroup.
- **Priority:** medium

## TC-55 — [UI] New Investigation / Play Again clears both the server connections and the localStorage layout

- **Covers spec point:** 10
- **Preconditions:** Case 047, browser, at least one card pinned and one connection created.
- **Steps / Input:** Trigger the UI's reset flow (`NEW INVESTIGATION` control, or `[ PLAY AGAIN ]` from the final report after an accusation) and confirm.
- **Expected result:** `POST /api/cases/047/reset` fires (connections wiped server-side, per TC-39). In the same flow, `localStorage.getItem("mysterydesk:board:047")` becomes `{}` (the app's `resetInvestigation` calls `clearBoard()` right after the API reset). Navigating to the board shows the empty-board state with `0 PINNED · 0 LINKS`.
- **Priority:** high

## TC-56 — [UI] A raw API reset (outside the UI) does not clear the browser's board layout

- **Covers spec point:** 10 (the ambiguity flagged in this file's conventions note 5, whose referenced `TC-58` does not exist in this document — this case fills that gap)
- **Preconditions:** Case 047, browser, at least one card pinned (e.g. `S01` at a dragged position) and one connection created (e.g. `S01`–`S02`).
- **Steps / Input:** Outside the browser, call `POST /api/cases/047/reset` directly (curl/fetch, not through the app's Play Again button). Then reload the board page in the browser.
- **Expected result:** `GET /connections` is `[]` (server state wiped, per TC-39). After the reload, the `mysterydesk:board:047` localStorage entry is untouched by the raw API call, so `S01`'s pinned position (and `S02`'s, if it was pinned) is still shown on the canvas at its old coordinates — but the line between them is gone (the connection no longer exists server-side) and the "LINKS" list is empty. This is the stale-layout state the spec's per-viewer/backend split implies: only the UI's own reset path (TC-55) clears `localStorage`.
- **Priority:** medium

---

**Summary:** 42 original test cases (unchanged) + 14 added 2026-09-24 = 56 total. High priority: 22 original + 8 added = 30.

## Additional cases (added 2026-09-25)

These cases cover the 2026-09-25 closed-case fix (decision D1-A in
`docs/plans/2026-09-25-qa-bug-fixes.md`): `createConnection` and `deleteConnection` in
`backend/src/services/investigation.service.js` now call `assertOpen()`, so a case with
an accepted conclusion on file rejects new links and deletions with 422
`{"error":"This case is closed."}` — the exact behaviour TC-43 and TC-44 said would be a
"behaviour change worth flagging" if it ever happened. Checked against the current
source: `createConnection` checks the body shape (400 `R-400`) first, then `assertOpen()`
(422 closed), then `validateConnection` (422 unknown id / self-link / duplicate /
unsupported relationship). `deleteConnection` checks the id exists (404 `R-404`) first,
then `assertOpen()` (422 closed). `GET /connections`, `GET /investigation` and
`POST /reset` are unaffected — `listConnections` and `resetInvestigation` never call
`assertOpen()`. On the frontend, `frontend/src/pages/InvestigationBoard/InvestigationBoard.jsx`
shows a `CASE CLOSED` `Stamp` panel when `investigation.conclusion` is set (`const closed =
Boolean(investigation.conclusion)`); `onNodeClick` no longer opens the "NEW LINK" panel
when closed — it returns early and only toggles `selected` (`if (closed) return
setSelected(...)`, `pending` is never set); and the `✕` delete button is omitted per link
(`{!closed && <button ... aria-label="Delete link ...">✕</button>}`). Pinning (`pin()`)
and dragging (`onPointerDown`/`onPointerMove`/`onKeyDown`) are not gated by `closed`, and
`REMOVE <id> FROM BOARD` stays available once its links are gone (`canUnpin`) — cards
remain pinnable and movable on a closed board, since layout is `localStorage` UI state,
never backend state.

## TC-57 — POST /connections on a closed case is rejected as closed

- **Covers spec point:** 2, 3 (closed-case rule, D1-A; supersedes TC-43)
- **Preconditions:** Fresh case 047. Close it: `POST /api/cases/047/conclusion {"suspectId": null}`. Confirm `GET /api/cases/047/investigation` now has a non-null `conclusion`.
- **Steps / Input:** `POST /api/cases/047/connections {"source":"S01","target":"S02"}`
- **Expected result:** 422 with body exactly `{"error":"This case is closed."}`. `GET /api/cases/047/connections` is still `[]` — nothing created.
- **Priority:** high

## TC-58 — A malformed body still wins over the closed-case check

- **Covers spec point:** 4 (order of checks, D1-A: 400 before 422 closed)
- **Preconditions:** Case 047 closed per TC-57.
- **Steps / Input:** (a) `POST /api/cases/047/connections {"target":"S02"}` (missing `source`); (b) `POST /api/cases/047/connections {}`.
- **Expected result:** Both return 400 with body exactly `{"error":"Expected { source, target, relationship }"}` (`R-400`), not 422 `"This case is closed."` — the body-shape check in `createConnection` runs before `assertOpen()`.
- **Priority:** high

## TC-59 — The closed-case rejection wins over every other game-rule 422

- **Covers spec point:** 4, 5 (order of checks, D1-A: 422 closed before other 422s)
- **Preconditions:** Case 047 closed per TC-57.
- **Steps / Input:** (a) self-link `{"source":"S01","target":"S01"}`; (b) unsupported relationship `{"source":"S01","target":"S02","relationship":"caused_by"}`; (c) unknown id `{"source":"S99","target":"S02"}`.
- **Expected result:** All three return 422 with body exactly `{"error":"This case is closed."}` — not `R-SELF`, `R-REL` or `R-UNKNOWN`. `assertOpen()` runs before `validateConnection()` in `createConnection`, so the closed check pre-empts every other 422 reason. (Per TC-27's rule, none of these strings hint at right/wrong either.)
- **Priority:** medium

## TC-60 — DELETE of an existing connection on a closed case is rejected as closed

- **Covers spec point:** 6 (closed-case rule, D1-A; supersedes TC-44)
- **Preconditions:** Fresh case 047. While still open, create a connection `POST {"source":"S01","target":"S02"}` (id noted as `X`). Then close the case: `POST /api/cases/047/conclusion {"suspectId": null}`.
- **Steps / Input:** `DELETE /api/cases/047/connections/<X>`
- **Expected result:** 422 with body exactly `{"error":"This case is closed."}`. `GET /api/cases/047/connections` still contains `X` — nothing deleted.
- **Priority:** high

## TC-61 — DELETE of an unknown id on a closed case is still 404, not the closed-case 422

- **Covers spec point:** 6 (order of checks, D1-A: 404 unknown id before 422 closed)
- **Preconditions:** Case 047 closed (per TC-57's method; no connections need exist).
- **Steps / Input:** `DELETE /api/cases/047/connections/C99`
- **Expected result:** 404 with body exactly `{"error":"Connection not found"}` (`R-404`) — `deleteConnection`'s existence check runs before `assertOpen()`, so an unknown id on a closed case is still 404, not 422.
- **Priority:** high

## TC-62 — GET /connections and GET /investigation still work on a closed case

- **Covers spec point:** 1, 8 (closed-case rule does not gate GETs, D1-A)
- **Preconditions:** Fresh case 047 with one connection created (id `X`) while open, then closed via `POST /conclusion {"suspectId": null}`.
- **Steps / Input:** `GET /api/cases/047/connections`; `GET /api/cases/047/investigation`.
- **Expected result:** Both return 200. `GET /connections` still contains `X` (closing the case does not delete existing links). `investigation.connections` is deep-equal to the `GET /connections` array.
- **Priority:** high

## TC-63 — POST /reset still works on a closed case and clears its connections

- **Covers spec point:** 10 (closed-case rule does not gate reset, D1-A)
- **Preconditions:** Case 047 closed with at least one connection on file (per TC-62).
- **Steps / Input:** `POST /api/cases/047/reset`, then `GET /api/cases/047/connections`.
- **Expected result:** Reset returns 200 with `connections: []` in the returned investigation body (the case is also reopened — `investigation.conclusion` is `null` again). `GET /connections` is `[]`.
- **Priority:** medium

## TC-64 — [UI] A closed board shows a CASE CLOSED panel and hides the ✕ delete buttons

- **Covers spec point:** 9 (closed-case UI rule, D1-A)
- **Preconditions:** Fresh case 047, browser. At least one connection created via the board (per the TC-48 flow) while the case is open. Then close the case (file an accusation through the app's accusation flow, or `POST /conclusion {"suspectId": null}` directly, and reload the board page).
- **Steps / Input:** Navigate to `http://localhost:5173/case/047/board`.
- **Expected result:** A panel with a `Stamp` reading "CASE CLOSED" is shown above the "PIN TO BOARD" section, with copy to the effect that the links are part of the record now. In the "LINKS" list, each entry shows only `<id> · <source> → <target>` text — no `✕` button is rendered next to any entry (no element with `aria-label="Delete link ..."` is present in the DOM).
- **Priority:** high

## TC-65 — [UI] A closed board does not open a NEW LINK panel or call the API

- **Covers spec point:** 9 (closed-case UI rule, D1-A)
- **Preconditions:** Same as TC-64 (case closed), with at least two cards already pinned on the board (e.g. `S01`, `S02`, pinned before closing).
- **Steps / Input:** Click the `S01` card, then click the `S02` card.
- **Expected result:** Clicking `S01` toggles it `selected` (visibly highlighted); clicking `S02` while `S01` is selected does not open a "NEW LINK" panel (no `CREATE LINK`/`CANCEL` buttons appear anywhere) and fires no `POST /connections` call — `onNodeClick` returns early on `closed` and only toggles `selected`, it never sets `pending`. `GET /api/cases/047/connections` (checked independently in another tab/terminal) is unchanged after both clicks.
- **Priority:** high

## TC-66 — [UI] Cards on a closed board can still be pinned and dragged

- **Covers spec point:** 9, 10 (closed-case UI rule leaves the localStorage layout editable, D1-A)
- **Preconditions:** Case 047 closed, browser, at least one exhibit or suspect not yet pinned.
- **Steps / Input:** (1) Choose an unpinned item in the "PIN TO BOARD" select and click `PIN`. (2) Drag an already-pinned card to a new position.
- **Expected result:** (1) The new card appears on the canvas and the `N PINNED` count in the page title increments, exactly as on an open case (per TC-47) — the `PIN` button is not disabled by `closed`. (2) The dragged card moves and settles at the new position, and `localStorage.getItem("mysterydesk:board:047")` reflects the new `{x, y}` — dragging is not gated by `closed` either.
- **Priority:** medium

---

## Superseded by the 2026-09-25 fixes

- TC-43 — old expectation: `POST /connections` after the case is closed still returns 201, because `createConnection` never called `assertOpen()` — new expected behaviour: 422 `{"error":"This case is closed."}` (see TC-57) — change: `docs/plans/2026-09-25-qa-bug-fixes.md` decision D1-A (`assertOpen()` added to `createConnection`, checked after the body-shape 400 and before `validateConnection`'s other 422s).
- TC-44 — old expectation: `DELETE /connections/:id` after the case is closed still returns 204, because `deleteConnection` never called `assertOpen()` — new expected behaviour: 422 `{"error":"This case is closed."}` for an existing connection id (see TC-60); an unknown connection id on a closed case is unaffected and still 404 (see TC-61) — change: `docs/plans/2026-09-25-qa-bug-fixes.md` decision D1-A (`assertOpen()` added to `deleteConnection`, checked after the existence-based 404).

> 2026-09-25: added TC-57..TC-66; superseded expectations are listed above and in docs/qa/SUPERSEDED-2026-09-25.md.
