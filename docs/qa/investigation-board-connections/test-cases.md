# Test cases — Investigation Board (Connections)

Source spec: `docs/specs/investigation-board-connections.md`
Cross-checked against: `docs/PRD.md` §Connections, `backend/src/routes/connections.routes.js`,
`backend/src/controllers/investigation.controller.js`, `backend/src/services/investigation.service.js`
(`validateConnection`, `createConnection`, `entityExists`), `backend/src/models/investigation.model.js`,
`backend/src/routes/index.js` (case-id guard middleware), `frontend/src/utils/boardStore.js`.

Case id used throughout: `047` (`CASE_ID` in `backend/src/config/index.js`).

## TC-01 — Create a valid connection

- **Covers spec point:** 1
- **Preconditions:** fresh seed; note two valid, distinct entity ids that are not
  already linked (e.g. one `E` id and one `S` id from `GET /api/cases/047/evidence`
  and `GET /api/cases/047/suspects`)
- **Steps / Input:** `POST /api/cases/047/connections` `{ "source": "<E id>", "target": "<S id>" }`
  (no `relationship` field)
- **Expected result:** `201`; body is exactly `{ "id": "C<n>", "source": "<E id>", "target": "<S id>", "relationship": "linked_to" }` — no extra fields (e.g. no `case_id`, no raw SQLite rowid, per PRD's "no exposed SQLite rowids" rule)
- **Priority:** high

## TC-02 — Unknown id on either side rejected

- **Covers spec point:** 2
- **Preconditions:** fresh seed
- **Steps / Input:** `POST /api/cases/047/connections` `{ "source": "E999", "target": "S02" }`
- **Expected result:** `422`, body `{ "error": string }`
- **Priority:** high

## TC-02b — Unknown id, reversed sides

- **Covers spec point:** 2
- **Preconditions:** fresh seed
- **Steps / Input:** `POST /api/cases/047/connections` `{ "source": "S02", "target": "Z999" }` (bad id on the `target` side this time, and a prefix — `Z` — that isn't `E/S/T/L` at all)
- **Expected result:** `422`, body `{ "error": string }` — confirms rejection isn't only checked on `source`
- **Priority:** medium

## TC-02c — Missing `source` or `target` field

- **Covers spec point:** 2 (edge case implied but not spelled out by the spec)
- **Preconditions:** fresh seed
- **Steps / Input:** (a) `POST /api/cases/047/connections` `{ "target": "S02" }` (no `source` at all); (b) `POST /api/cases/047/connections` `{}`
- **Expected result:** `400`, body `{ "error": "Expected { source, target, relationship }" }` — this is a distinct code path from TC-02 (`createConnection`'s own `typeof` guard fires before `validateConnection` runs), so it is **400**, not 422. Runner should verify the status code is 400 exactly, not 422.
- **Priority:** high

## TC-02d — Non-string `source`/`target`/`relationship`

- **Covers spec point:** 2 (edge case)
- **Preconditions:** fresh seed
- **Steps / Input:** (a) `POST /api/cases/047/connections` `{ "source": 14, "target": "S02" }`; (b) `POST /api/cases/047/connections` `{ "source": "E014", "target": "S02", "relationship": 1 }`
- **Expected result:** both `400`, body `{ "error": "Expected { source, target, relationship }" }`
- **Priority:** medium

## TC-02e — Unsupported `relationship` value

- **Covers spec point:** out-of-scope note ("relationship types other than `linked_to`") — verifies the backend fails closed rather than silently accepting or crashing
- **Preconditions:** fresh seed
- **Steps / Input:** `POST /api/cases/047/connections` `{ "source": "E014", "target": "S02", "relationship": "hates" }`
- **Expected result:** `422`, body `{ "error": string }` (source: `validateConnection` rejects any value not in the single-element allowed list before checking ids at all — this check runs first, so it fires even if the ids are valid)
- **Priority:** medium

## TC-03 — Self-link rejected

- **Covers spec point:** 3
- **Preconditions:** fresh seed; use an id known to exist (e.g. `S02`)
- **Steps / Input:** `POST /api/cases/047/connections` `{ "source": "S02", "target": "S02" }`
- **Expected result:** `422`
- **Priority:** high

## TC-03b — Self-link with an unknown id (validation order)

- **Covers spec point:** 2, 3 (edge case — order of validation)
- **Preconditions:** fresh seed
- **Steps / Input:** `POST /api/cases/047/connections` `{ "source": "S999", "target": "S999" }`
- **Expected result:** `422`. Note for runner: the id-existence check runs before the self-link check in the current implementation, so this is rejected as an unknown id, not specifically flagged as a self-link — only the status code (422) is spec-mandated; don't fail this case over which specific reason string comes back, just confirm it's 422 and not 500/200.
- **Priority:** low

## TC-04 — Duplicate rejected, including reverse direction

- **Covers spec point:** 4
- **Preconditions:** TC-01's connection exists (`source`→`target`, not yet deleted)
- **Steps / Input:** (a) `POST` the same `source`/`target` again; (b) `POST` with `source`/`target` swapped
- **Expected result:** both (a) and (b) return `422`, body `{ "error": string }`
- **Priority:** high

## TC-05 — GET reflects only successful connections

- **Covers spec point:** 5
- **Preconditions:** run after TC-01–TC-04 in the same session (one successful connection created, several rejected attempts made)
- **Steps / Input:** `GET /api/cases/047/connections`
- **Expected result:** `200`; response is a JSON array; contains exactly one entry matching TC-01's `{ id, source, target, relationship: "linked_to" }`; no entries corresponding to any of the rejected TC-02/02b/02c/02d/02e/03/03b/04 attempts (array length unchanged by those attempts)
- **Priority:** high

## TC-06 — Delete an existing connection

- **Covers spec point:** 6
- **Preconditions:** TC-01's connection still exists
- **Steps / Input:** `DELETE /api/connections/<TC-01's id>`
- **Expected result:** `204`, empty body; a follow-up `GET /api/cases/047/connections` no longer lists that id
- **Priority:** high

## TC-06b — Deleting the same connection twice

- **Covers spec point:** 6, 7 (edge case — duplicate delete)
- **Preconditions:** run immediately after TC-06 (the connection was just deleted)
- **Steps / Input:** `DELETE /api/connections/<same id as TC-06>` again
- **Expected result:** `404` (it's already gone — same as any other unknown id per TC-07)
- **Priority:** medium

## TC-07 — Delete an unknown connection id

- **Covers spec point:** 7
- **Preconditions:** `C999` does not exist
- **Steps / Input:** `DELETE /api/connections/C999`
- **Expected result:** `404`, body `{ "error": string }`
- **Priority:** medium

## TC-07b — Connection ids are never reused after delete

- **Covers spec point:** 1, 6 (edge case implied by sequential id generation)
- **Preconditions:** fresh seed recommended for a clean sequence
- **Steps / Input:** create connection A (note its id), `DELETE` it, create connection B between a different valid pair
- **Expected result:** B's id is not equal to A's id (the id sequence — `connection_seq` — only increments, it's never reused/reassigned after a delete)
- **Priority:** low

## TC-08 — Connections persist across a backend restart

- **Covers spec point:** 8
- **Preconditions:** none beyond a running backend
- **Steps / Input:** create a connection via `POST`, note its id, stop and restart the backend process (`npm run dev` stop/start, or equivalent), then `GET /api/cases/047/connections`
- **Expected result:** the connection created before restart is present in the post-restart `GET` response with the same id/source/target/relationship (SQLite-backed per `backend/src/database/schema.sql`, not in-memory)
- **Priority:** medium

## TC-09 — Board pin positions are never sent to the backend (UI case)

- **Covers spec point:** 9
- **Preconditions:** app running in browser, board loaded for case 047, browser devtools open (Network tab)
- **Steps / Input:** on the Investigation Board screen, drag a pinned card to a new position
- **Expected result:** no HTTP request is fired to `/api/cases/047/connections` or any other backend endpoint as a result of the drag (Network tab shows zero new requests); `localStorage` key `mysterydesk:board:047` is updated with the new `{x, y}` for that entity id (inspect via devtools Application tab or `localStorage.getItem('mysterydesk:board:047')`)
- **Priority:** medium

## TC-09b — Pin position survives reload but not a fresh browser profile (UI case)

- **Covers spec point:** 9
- **Preconditions:** continues from TC-09 (a card has been dragged to a non-default position)
- **Steps / Input:** reload the page in the same browser
- **Expected result:** the dragged card reappears at the same position it was left in (read from `localStorage`, not from any backend response) — confirms position state is client-persisted, not server-persisted
- **Priority:** low

## TC-09c — `POST /connections` request body never contains position data (UI case)

- **Covers spec point:** 9
- **Preconditions:** app running in browser, devtools Network tab open
- **Steps / Input:** on the board, draw a connection between two pinned cards (the UI action that triggers `POST /api/cases/047/connections`)
- **Expected result:** the captured request body matches exactly `{ source, target }` (and optionally `relationship`) per the documented shape — no `x`, `y`, `position`, or similar coordinate field present
- **Priority:** medium

## TC-10 — Unknown `caseId` in the URL path

- **Covers spec point:** none numbered directly — inferred from `backend/src/routes/index.js`, which guards every `/cases/:caseId/...` route with a check against the single configured `CASE_ID` ('047') before any connections logic runs. Flagging as a gap the spec doesn't mention but the source enforces.
- **Preconditions:** none
- **Steps / Input:** `GET /api/cases/999/connections` and `POST /api/cases/999/connections` `{ "source": "E014", "target": "S02" }`
- **Expected result:** both return `404`, body `{ "error": "Case not found" }` — request never reaches `validateConnection`/`listConnections`
- **Priority:** low

---
Total: 19 cases (16 API, 3 UI). High priority: 7.
