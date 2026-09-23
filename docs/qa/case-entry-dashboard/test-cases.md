# Test cases — Case Entry & Dashboard

Source spec: `docs/specs/case-entry-dashboard.md`

## TC-01 — Case load returns the full briefing shape

- **Covers spec point:** 1
- **Preconditions:** backend running, any investigation state
- **Steps / Input:** `GET /api/cases/047`
- **Expected result:** 200; body has `id === "047"`, `title`, `status`, `classification`, `company`, `site`, `openedAt`, `incidentWindow` (object with `from`/`to`), `summary`, `briefing` (array), `objectives` (array), `suspectCount === 5`, `evidenceCount === 18`, `locationCount === 6`, `eventCount === 12`, `locations` (array, length 6)
- **Priority:** high

## TC-02 — Unknown caseId (non-numeric-looking) returns 404

- **Covers spec point:** 2
- **Preconditions:** backend running
- **Steps / Input:** `GET /api/cases/048`
- **Expected result:** 404, body exactly `{ "error": "Case not found" }` (per `backend/src/routes/index.js` case-id gate)
- **Priority:** high

## TC-03 — Unknown caseId (near-miss "47", no leading zero) returns 404

- **Covers spec point:** 2
- **Preconditions:** backend running
- **Steps / Input:** `GET /api/cases/47`
- **Expected result:** 404, body exactly `{ "error": "Case not found" }`
- **Priority:** medium

## TC-04 — Unknown caseId (near-miss "0047", extra leading zero) returns 404

- **Covers spec point:** 2
- **Preconditions:** backend running
- **Steps / Input:** `GET /api/cases/0047`
- **Expected result:** 404, body exactly `{ "error": "Case not found" }` — confirms the caseId gate is strict string equality (`req.params.caseId === '047'`), not numeric coercion
- **Priority:** medium

## TC-05 — Case response never contains solution data

- **Covers spec point:** 2 (security)
- **Preconditions:** backend running
- **Steps / Input:** `GET /api/cases/047`
- **Expected result:** response body contains no key named `culprit`, `requiredEvidence`, or `requiredConnections` at any nesting level
- **Priority:** high

## TC-06 — Evidence list endpoint matches the case's evidenceCount

- **Covers spec point:** 1 (third listed endpoint, feeds the Dashboard's "latest leads")
- **Preconditions:** backend running
- **Steps / Input:** `GET /api/cases/047/evidence`, and separately `GET /api/cases/047`
- **Expected result:** evidence response is 200 with a JSON array; `array.length === evidenceCount` from the case response (18); each item has at least `id`, `type`, `title`, `timestamp`, `summary`
- **Priority:** medium

## TC-07 — Fresh investigation state shape

- **Covers spec point:** 3
- **Preconditions:** a case state with nothing viewed yet (verify counts, don't assume — report actual observed counts if the DB already has progress from earlier manual testing)
- **Steps / Input:** `GET /api/cases/047/investigation`
- **Expected result:** 200; `theory === ""` or previously-saved text, `conclusion === null` or previously-saved conclusion, `progress` is an integer 0-100, `evidenceViewed`/`suspectsViewed`/`eventsViewed`/`connections`/`contradictionsFound` are arrays (empty on a truly fresh case)
- **Priority:** high

## TC-08 — progress is a 0-100 integer

- **Covers spec point:** 4
- **Preconditions:** backend running
- **Steps / Input:** `GET /api/cases/047/investigation`, inspect `progress`
- **Expected result:** `Number.isInteger(progress) && progress >= 0 && progress <= 100`
- **Priority:** medium

## TC-09 — progress never decreases after a new item is viewed

- **Covers spec point:** 4
- **Preconditions:** backend running. Note: exercising this requires `POST /api/cases/047/viewed`, which exists in the source (`backend/src/routes/investigation.routes.js`) but is **not** in this spec's "Endpoints involved" list — flagging that gap rather than skipping the point. This case mutates investigation state; run it against a disposable DB or last in the suite.
- **Steps / Input:** 1) `GET /api/cases/047/investigation`, record `progress` as P0. 2) `POST /api/cases/047/viewed` with body `{ "type": "evidence", "id": "E001" }` (skip step if E001 already in `evidenceViewed` from P0 — pick any id not yet viewed). 3) `GET /api/cases/047/investigation` again, record `progress` as P1.
- **Expected result:** P1 >= P0, and the viewed evidence id now appears in `evidenceViewed`. Repeating step 2 with the same id (duplicate view) does not decrease progress on a third GET.
- **Priority:** high

## TC-10 — GET is non-mutating (repeat call is idempotent)

- **Covers spec point:** 5
- **Preconditions:** backend running, no writes in between
- **Steps / Input:** `GET /api/cases/047/investigation` twice in a row
- **Expected result:** both responses are byte-identical (aside from nothing time-dependent in the shape)
- **Priority:** medium

## TC-11 — No account/login endpoint exists for this flow

- **Covers spec point:** 7
- **Preconditions:** backend running
- **Steps / Input:** `GET /api/auth/login` (or any auth-shaped guess)
- **Expected result:** 404 — no such route registered (`backend/src/routes/index.js` mounts only case/evidence/suspects/timeline/connections/investigation/assistant/report routers, no auth router)
- **Priority:** low

## TC-12 (UI) — Dashboard renders only from the three GET responses

- **Covers spec point:** 6
- **Preconditions:** frontend running at :5173
- **Steps / Input:** load `/dashboard` in a browser; visually/structurally compare displayed suspect/evidence/event counts, objectives text, and the leads list against the raw `GET /api/cases/047`, `GET /api/cases/047/investigation`, and `GET /api/cases/047/evidence` responses fetched at the same time
- **Expected result:** every number, label and lead shown on screen matches a value present in one of the three API responses; nothing on screen that isn't traceable to them; view page source / component code to confirm no literal suspect name, evidence title, or count is hardcoded in JSX
- **Priority:** high

---
Total: 12 cases (10 API, 1 UI, 1 mixed). High priority: 6.
