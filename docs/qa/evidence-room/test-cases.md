# Test cases — Evidence Room

Source spec: `docs/specs/evidence-room.md`
Cross-checked against: `docs/PRD.md` §4, §6, §7; `backend/src/routes/evidence.routes.js`,
`backend/src/routes/investigation.routes.js`, `backend/src/routes/index.js`,
`backend/src/controllers/case.controller.js`, `backend/src/services/case.service.js`,
`backend/src/models/case.model.js`, `backend/src/services/investigation.service.js`,
`backend/src/models/investigation.model.js`, `backend/src/middleware/errorHandler.js`,
`data/evidence.json`, `frontend/src/pages/EvidenceRoom/EvidenceRoom.jsx`,
`frontend/src/components/EvidenceCard/EvidenceCard.jsx`, `frontend/src/utils/format.js`.

Case id is always `047` (`backend/src/config/index.js`); any other `:caseId` is rejected by the
shared `/cases/:caseId` guard in `backend/src/routes/index.js` before it reaches evidence routes.

## TC-01 — Evidence list returns exactly 18 items

- **Covers spec point:** 1
- **Preconditions:** fresh seed (`npm run seed` state, or any state — evidence rows are static)
- **Steps / Input:** `GET /api/cases/047/evidence`
- **Expected result:** 200; response is an array of length 18; every item has `id` matching
  `/^E\d+$/` and a non-empty `type` string. (Seed data is `E001`–`E018`.)
- **Priority:** high

## TC-02 — Evidence detail for a valid id has the full shape

- **Covers spec point:** 2
- **Preconditions:** know one real id from TC-01, e.g. `E014`
- **Steps / Input:** `GET /api/evidence/E014`
- **Expected result:** 200; body includes every list field (`id`, `type`, `title`, `timestamp`,
  `time`, `locationId`, `location`, `personIds`, `people`, `summary`) plus `details`, `source`,
  `relatedEvidenceIds` (array, possibly empty). `time` is `HH:MM` derived from `timestamp`
  (e.g. `E014` → `timestamp: "1984-03-09T21:14:00"`, `time: "21:14"`).
- **Priority:** high

## TC-03 — Evidence detail for an unknown id

- **Covers spec point:** 2
- **Steps / Input:** `GET /api/evidence/E999`
- **Expected result:** 404 with body exactly `{ "error": "Evidence not found" }`
  (`case.service.js` `getEvidence` throws this specific `HttpError(404, 'Evidence not found')`
  when the model lookup returns nothing).
- **Priority:** high

## TC-04 — `GET /cases/:caseId/evidence` rejects a caseId other than 047

- **Covers spec point:** implied by PRD §4 ("404 unknown resource, including any caseId other
  than 047") and the spec's "Endpoints involved" section — not numbered in the spec itself, but
  the same guard applies to every `/cases/:caseId/...` route including evidence.
- **Steps / Input:** `GET /api/cases/048/evidence`
- **Expected result:** 404 with body exactly `{ "error": "Case not found" }`, returned by the
  shared `/cases/:caseId` middleware in `backend/src/routes/index.js` before any evidence-specific
  logic runs.
- **Priority:** medium

## TC-05 — `facts` never leaks in any evidence response

- **Covers spec point:** 3 (security/leak check)
- **Steps / Input:** `GET /api/cases/047/evidence`, then `GET /api/evidence/<id>` for at least 3
  different real ids (include `E014`, which has a non-empty `facts` array in the seed data, so a
  leak would be visible here if present).
- **Expected result:** the string `"facts"` does not appear as a key anywhere in any response
  body (list or detail). `case.service.js`'s `shapeEvidence()` only copies `id, type, title,
  timestamp, time, locationId, location, personIds, people, summary` (detail adds `details,
  source, relatedEvidenceIds`) — `facts` is never included in the returned object.
- **Priority:** high

## TC-06 — Marking evidence viewed

- **Covers spec point:** 4
- **Preconditions:** know a real evidence id, e.g. `E014`
- **Steps / Input:** `POST /api/cases/047/viewed` body `{ "type": "evidence", "id": "E014" }`
- **Expected result:** 200 with the full investigation state shape (`evidenceViewed`,
  `suspectsViewed`, `eventsViewed`, `connections`, `contradictionsFound`, `theory`, `conclusion`,
  `progress`); `evidenceViewed` is an array containing `"E014"`.
- **Priority:** high

## TC-07 — Viewing the same evidence twice does not duplicate

- **Covers spec point:** 4
- **Steps / Input:** repeat TC-06's POST with the same `{ "type": "evidence", "id": "E014" }`
  body a second time
- **Expected result:** 200; `evidenceViewed` contains `"E014"` exactly once (array length for
  that id's occurrences is 1, not 2). Enforced by the `UNIQUE (case_id, entity_type, entity_id)`
  constraint + `INSERT OR IGNORE` in `investigation.model.js`'s `addViewed`.
- **Priority:** high

## TC-08 — `/viewed` rejects an unknown evidence id

- **Covers spec point:** 5
- **Steps / Input:** `POST /api/cases/047/viewed` body `{ "type": "evidence", "id": "E999" }`
- **Expected result:** 404 with body exactly `{ "error": "Nothing with that id in this case" }`.
  Note this message differs from TC-03's `"Evidence not found"` — `/viewed`'s unknown-id check is
  a separate code path in `investigation.service.js`'s `recordViewed` (`known[type]()` returning
  falsy), not `case.service.js`'s `getEvidence`. Then `GET /api/cases/047/investigation` confirms
  `evidenceViewed` does not contain `"E999"`.
- **Priority:** high

## TC-09 — `/viewed` rejects a missing `id`

- **Covers spec point:** 5
- **Steps / Input:** `POST /api/cases/047/viewed` body `{ "type": "evidence" }`
- **Expected result:** 400 with body exactly
  `{ "error": "Expected { type: \"evidence\" | \"suspect\" | \"event\", id }" }`
- **Priority:** medium

## TC-10 — `/viewed` rejects a missing `type`

- **Covers spec point:** 5
- **Steps / Input:** `POST /api/cases/047/viewed` body `{ "id": "E014" }`
- **Expected result:** 400 with the same body as TC-09:
  `{ "error": "Expected { type: \"evidence\" | \"suspect\" | \"event\", id }" }`
  (`VIEW_TYPES.includes(undefined)` is `false`, so this fails the same check as a missing id.)
- **Priority:** medium

## TC-11 — `/viewed` rejects an invalid `type` value

- **Covers spec point:** 5 (edge case implied by the type validation — `type` must be one of
  `"evidence" | "suspect" | "event"` per PRD §7)
- **Steps / Input:** `POST /api/cases/047/viewed` body `{ "type": "document", "id": "E014" }`
- **Expected result:** 400, same error body as TC-09/TC-10 (not a silent 200, and `evidenceViewed`
  is unaffected).
- **Priority:** medium

## TC-12 — Viewing evidence never decreases progress

- **Covers spec point:** 6
- **Preconditions:** an evidence id not yet viewed in the current investigation state
- **Steps / Input:** `GET /api/cases/047/investigation`, note `progress`; then `POST /viewed`
  with that unviewed evidence id; then `GET /api/cases/047/investigation` again
- **Expected result:** `progress` after >= `progress` before, both are integers in `[0, 100]`.
  Re-running TC-06/TC-07 (viewing something already viewed) leaves `progress` unchanged.
- **Priority:** medium

## TC-13 — Evidence with `locationId: null` returns `location: null` in the API (not omitted, not a crash)

- **Covers spec point:** 7 (API-level half of the check; TC-15 below is the UI half)
- **Preconditions:** `E015` ("Loan Default Notice") and `E016` ("Telephone Company Call Records")
  have `locationId: null` in the seed data
- **Steps / Input:** `GET /api/evidence/E015` and `GET /api/evidence/E016`
- **Expected result:** 200 for both; `locationId` is `null` and `location` is `null` (per
  `shapeEvidence()`'s `location: e.locationId ? locations[e.locationId] ?? null : null`), not
  omitted from the JSON and not the string `"null"`. `timestamp`/`time` are still populated
  normally for these two items (the current seed data has no evidence item with a `null`
  `timestamp` — see note on TC-15).
- **Priority:** medium

## TC-14 — `POST /viewed` under a caseId other than 047 is rejected before evidence logic runs

- **Covers spec point:** implied by the same caseId guard as TC-04, applied to the write endpoint
- **Steps / Input:** `POST /api/cases/048/viewed` body `{ "type": "evidence", "id": "E014" }`
- **Expected result:** 404 with body exactly `{ "error": "Case not found" }`; a follow-up
  `GET /api/cases/047/investigation` shows `E014` was not added to `evidenceViewed` by this call.
- **Priority:** low

## TC-15 (UI) — Null `locationId` and `timestamp` render without crashing, with exact fallback text

- **Covers spec point:** 7
- **Preconditions:** use `E015` or `E016` (real seed items with `locationId: null`); no seed item
  currently has `timestamp: null`, so the timestamp-null render path cannot be exercised against
  real data today — note this as a gap rather than fabricating an item (flag it, don't invent
  a test fixture the app doesn't have).
- **Steps / Input:** in the browser, open the Evidence Room, filter to "DOCUMENTS" or "RECORDS",
  and open the detail card for `E015` ("Loan Default Notice").
- **Expected result:**
  - Page renders, no crash / blank screen.
  - `EvidenceCard.jsx`: the meta row shows the literal text `Off-site` for the null location
    (`item.location ?? 'Off-site'`), never the string `"null"` or a blank cell.
  - `EvidenceRoom.jsx` Inspector panel: the `PLACE` field shows `Off-site` (same fallback,
    line 40: `<dd>{item.location ?? 'Off-site'}</dd>`).
  - Neither view shows the literal string `null` anywhere in the rendered DOM for this item.
- **Priority:** medium

## TC-16 (UI, code audit) — No evidence title, summary or timestamp is hardcoded in a `.jsx` file

- **Covers spec point:** 8
- **Preconditions:** none (static source check, does not require the app running)
- **Steps / Input:** grep `frontend/src/pages/EvidenceRoom/EvidenceRoom.jsx` and
  `frontend/src/components/EvidenceCard/EvidenceCard.jsx` (and any other `.jsx` under
  `frontend/src/` that renders evidence) for literal evidence copy from `data/evidence.json` —
  e.g. the strings `"Keycard Access"`, `"Loan Default Notice"`, `"Telephone Company Call
  Records"`, or any `summary`/`details` text.
- **Expected result:** zero matches. All evidence text reaches the DOM only via `item.title`,
  `item.summary`, `item.timestamp`/`item.time`, `detail.details` etc. read from the API response
  (`api.getEvidence` / `useCase()`'s `evidence`/`evidenceById`), never a string literal.
- **Priority:** medium

## TC-17 (UI) — Client-side type filter narrows the visible list without a server call

- **Covers spec point:** implied by the spec's "Inputs" section ("client-side filter over the
  already-fetched list — no server query param required"); not a numbered correctness point but
  directly describes intended behavior worth a smoke check.
- **Preconditions:** Evidence Room loaded with all 18 items
- **Steps / Input:** in the browser, click a filter stamp other than "ALL" (e.g. "FORENSIC")
- **Expected result:** the visible card grid narrows to only items whose `type` is in that
  group's `types` list (see `EVIDENCE_GROUPS` in `frontend/src/utils/format.js`); no new network
  request is made to `/api/cases/047/evidence` (the existing fetched list is filtered in memory).
  If the filtered list is empty, the `EmptyState` "Nothing filed here" / "No exhibits match this
  filter." is shown instead of a crash.
- **Priority:** low

---

Total: 17 cases (12 API, 1 API+state follow-up, 3 UI, 1 UI/code-audit). High priority: 6.
