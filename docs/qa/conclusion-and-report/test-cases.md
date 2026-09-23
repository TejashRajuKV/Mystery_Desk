# Test cases — Conclusion & Final Report

Source spec: `docs/specs/conclusion-and-report.md`
Cross-checked against: `docs/PRD.md` §12–13, `backend/src/services/investigation.service.js`
(`validateConclusion`, `saveTheory`, `validateConnection`), `backend/src/services/report.service.js`,
`backend/src/models/investigation.model.js`, `backend/src/database/seed.js`.

## State caveat — read before running

This suite's DB may already have an accepted conclusion for case 047 from a prior
session (a conclusion was accepted once already for testing purposes). Every case
below is worded to work either way. The one exception is TC-12, which genuinely
needs `conclusion IS NULL` — see its Preconditions for how to reach that state.

Two facts from source, not assumption, back this:
- `backend/src/database/seed.js` — `seed()` reloads only case/evidence/suspect/
  timeline/statement/solution tables and comments "Player state is never touched";
  it does `INSERT OR IGNORE INTO investigations`, so an existing `investigations`
  row (and its `conclusion`/`theory` columns) survives `npm run seed` untouched.
- `backend/src/database/db.js` re-runs `schema.sql` on every server start but
  never drops tables, so a plain restart doesn't clear it either. Only deleting
  the SQLite file itself resets it.
- `submitConclusion` (in `investigation.service.js`) never checks for an existing
  conclusion before saving — it always overwrites. So re-running an acceptance
  case against an already-solved DB is safe and meaningful, not a no-op.

## TC-01 — Save a theory

- **Covers spec point:** workflow step "saves a working theory" (endpoint list); not one of the numbered validation points
- **Preconditions:** none (works whether or not a conclusion is already accepted — theory can be saved before or after)
- **Steps / Input:** `PUT /api/cases/047/theory` `{ "text": "test theory" }`
- **Expected result:** 200; the response body itself (per PRD §7, `PUT /theory` returns the full investigation state) has `theory === "test theory"` — no follow-up `GET /investigation` call needed to confirm, though one may be used as a cross-check
- **Priority:** medium

## TC-02 — Save theory rejects invalid input → 400

- **Covers spec point:** general error contract (PRD §4: "400 malformed request"); implied edge case around the theory endpoint, not itemized in the spec's numbered list — flagged here as inferred, not literally spelled out
- **Preconditions:** none
- **Steps / Input:** `PUT /theory` with, in turn: (a) `{}` (missing `text`), (b) `{ "text": 12345 }` (non-string), (c) `{ "text": "<a string of 5001 characters>" }`
- **Expected result:** all three return 400 with `{ "error": "Expected { text } of at most 5000 characters" }` (exact string, from `investigation.service.js: saveTheory`); a string of exactly 5000 characters is accepted (200) — boundary check
- **Priority:** medium

## TC-03 — Malformed conclusion body → 400

- **Covers spec point:** 1
- **Preconditions:** none
- **Steps / Input:** `POST /api/cases/047/conclusion`, in turn: (a) `{ "suspectId": 123, "evidenceIds": ["E014"] }` (suspectId not a string), (b) `{ "evidenceIds": ["E014"] }` (suspectId missing), (c) `{ "suspectId": "S02" }` (evidenceIds missing), (d) `{ "suspectId": "S02", "evidenceIds": "E014" }` (evidenceIds not an array), (e) `{ "suspectId": "S02", "evidenceIds": [] }` (empty array), (f) `{ "suspectId": "S02", "evidenceIds": ["E014", 7] }` (array contains a non-string element)
- **Expected result:** all six return 400 with `{ "error": "Expected { suspectId, evidenceIds: [...] } with at least one exhibit" }` (exact string, from `investigation.service.js: validateConclusion`)
- **Priority:** high

## TC-04 — Unknown suspect → 422

- **Covers spec point:** 2
- **Preconditions:** none
- **Steps / Input:** `POST /conclusion` `{ "suspectId": "S99", "evidenceIds": ["E014"] }`
- **Expected result:** 422, `{ "error": "That suspect isn't in this case." }` (exact string)
- **Priority:** high

## TC-05 — Unknown evidence id → 422

- **Covers spec point:** 3
- **Preconditions:** a real suspect id (any of S01–S05)
- **Steps / Input:** `POST /conclusion` with (a) `{ "suspectId": "<real suspect>", "evidenceIds": ["E999"] }` (single unknown id) and (b) `{ "suspectId": "<real suspect>", "evidenceIds": ["E001", "E999"] }` (one real id mixed with one unknown id)
- **Expected result:** both return 422, `{ "error": "One of the cited exhibits isn't in this case." }` (exact string) — the mixed case confirms a single bad id fails the whole request, not just that id
- **Priority:** high

## TC-06 — Validation order: unknown suspect is reported before unknown evidence

- **Covers spec point:** 1–3 (the "in order" ordering the spec and PRD §12 both specify — an implied edge case: what happens when two validation failures apply at once)
- **Preconditions:** none
- **Steps / Input:** `POST /conclusion` `{ "suspectId": "S99", "evidenceIds": ["E999"] }` (both the suspect id and the evidence id are unknown)
- **Expected result:** 422 with the suspect-not-found message, `{ "error": "That suspect isn't in this case." }` — not the evidence message, confirming `validateConclusion` checks suspect existence before evidence existence
- **Priority:** high

## TC-07 — Wrong suspect vs. right-suspect-insufficient-evidence give the SAME reason text

- **Covers spec point:** 4 (security)
- **Preconditions:** none
- **Steps / Input:** `POST /conclusion` `{ "suspectId": "<id>", "evidenceIds": ["<any single real evidence id>"] }` for each of S01–S05 in turn (one evidence item is not enough to satisfy `requiredEvidence` for any suspect, so every suspect should hit the same branch unless the evidence id happens to satisfy a single-item requirement — if any suspect instead returns 200, treat that as a separate finding, not a suite failure, and re-run the other four with a different single evidence id)
- **Expected result:** every 422 response's `error` string is byte-identical: `"There isn't enough evidence linked to this suspect."` (exact string, from `validateConclusion`) — confirms a wrong suspect and a right-suspect-too-little-evidence rejection are indistinguishable. Do not record in this file which suspect is the actual culprit; record only whether the strings matched.
- **Priority:** high

## TC-08 — Required connections gate acceptance

- **Covers spec point:** 5
- **Preconditions:** a suspect + evidence combination that would otherwise pass step 4 (i.e. the culprit suspect with `requiredEvidence` fully cited — found by legitimate play, not by reading `data/solution.json`), with the board connection(s) needed for that suspect currently in place. Note the connection's id(s) before deleting so they can be restored.
- **Steps / Input:** 1) `DELETE /api/connections/:connectionId` for the connection(s) needed for acceptance; 2) `POST /conclusion` with the otherwise-correct suspect/evidence body
- **Expected result:** 422, `{ "error": "Your board doesn't yet connect the evidence to this suspect." }` (exact string) — must not name which evidence/suspect pair is missing beyond what the caller already submitted
- **Cleanup:** `POST /connections` to recreate the deleted connection(s) before running TC-09/TC-10, so their preconditions still hold
- **Priority:** high

## TC-09 — Duplicate evidenceIds are collapsed on a valid submission

- **Covers spec point:** 6 (duplicate collapsing)
- **Preconditions:** same as TC-10 (culprit suspect, full required evidence, required connections in place)
- **Steps / Input:** `POST /conclusion` with the correct suspect and an `evidenceIds` array where at least one required evidence id appears twice, e.g. `[..., "<requiredId>", "<requiredId>", ...]`
- **Expected result:** 200; the response's `evidenceIds` array contains that id exactly once (length of response array = number of *distinct* ids sent, per `[...new Set(evidenceIds)]` in `validateConclusion`)
- **Priority:** high

## TC-10 — A fully correct conclusion is accepted

- **Covers spec point:** 6
- **Preconditions:** derive the correct suspect, required evidence, and required connections independently from seed data + the `findContradictions`/`findSuspectConnections` logic and the board — do not open `data/solution.json` directly; make the required connection(s) on the board first. Safe to run whether or not case 047 already has an accepted conclusion (`submitConclusion` always overwrites, no existing-conclusion guard in source).
- **Steps / Input:** `POST /conclusion` with the correct suspect + full required evidence set, after making the required connection(s)
- **Expected result:** 200, `{ "suspectId": "<culprit>", "evidenceIds": [...] }` exactly as sent (deduped if duplicates were sent)
- **Priority:** high

## TC-11 — Re-submitting POST /conclusion after acceptance overwrites the saved conclusion

- **Covers spec point:** "Out of scope" note — a dedicated revise endpoint is out of scope, but the spec explicitly frames re-submission through the same `POST /conclusion` as the supported path ("the PRD only documents prefill/re-submit through the same POST /conclusion"). This is an inference from that note, flagged as such rather than a literal numbered point.
- **Preconditions:** a conclusion has already been accepted (either from TC-10 in this run, or already true from a prior session)
- **Steps / Input:** `POST /conclusion` again with a valid, fully-correct body (same or different valid evidence set for the culprit, connections still in place)
- **Expected result:** 200 again (not an error) — confirms the endpoint accepts re-submission rather than rejecting with a "already solved" style error, which the source (`investigation.service.js: submitConclusion`) does not implement. If this ever returns a non-200, that's a spec/behavior mismatch worth flagging, not a silent fail.
- **Priority:** medium

## TC-12 — GET /report before any conclusion has ever been accepted → 422

- **Covers spec point:** 7
- **Preconditions:** `investigations.conclusion` for case 047 is `NULL` — this requires a genuinely fresh database, which the current session's DB is **not** (a conclusion was already accepted in it). Reaching this state requires: stop the backend; delete the SQLite file at `backend/storage/mysterydesk.sqlite` (and any `-wal`/`-shm` sidecar files alongside it — `DB_PATH` in `backend/src/config/index.js`); restart the backend (`npm run dev` / `npm run start`), which re-runs `schema.sql` and `seed()` against the now-missing file and creates a brand-new `investigations` row with `conclusion = NULL`. `npm run seed` alone, or a plain restart without deleting the file, is **not** sufficient — confirmed from `seed.js`'s "Player state is never touched" and its `INSERT OR IGNORE INTO investigations`. Run this case first in that fresh instance, before any `POST /conclusion` call (including TC-10/TC-11) reaches it.
- **Steps / Input:** `GET /api/cases/047/report`
- **Expected result:** 422, `{ "error": "No conclusion has been accepted yet." }` (exact string, from `report.service.js: getReport`)
- **Priority:** high

## TC-13 — Report after acceptance reflects real player actions

- **Covers spec point:** 8
- **Preconditions:** case 047 currently has an accepted conclusion — true already if the DB is in its normal (already-solved) session state, or freshly true after running TC-10 above
- **Steps / Input:** `GET /api/cases/047/report`
- **Expected result:** 200 with exactly these top-level keys: `case` ("047"), `title`, `primarySuspect` (`{ id, name }` matching the accepted suspect), `theory` (matches the exact text most recently saved via `PUT /theory`), `supportingEvidence[]` (exactly the `evidenceIds` from the accepted conclusion, each item shaped `{ id, title, time, location, summary }`), `timeline[]` (only events actually present in `GET /investigation`'s `eventsViewed`, in that same order), `contradictions[]` (only pairs actually present in `contradictionsFound`, i.e. logged via `POST /contradictions` — not every contradiction the assistant may have surfaced but never logged), `connections[]` (only connections actually created, each `{ source, target, relationship }`)
- **Priority:** high

## TC-14 — Report timeline excludes events the player never formally viewed

- **Covers spec point:** 8 (negative check — "events the player actually viewed", not all events)
- **Preconditions:** an accepted conclusion exists (see TC-13); identify at least one timeline event id from `GET /cases/047/timeline` that is NOT in `GET /investigation`'s `eventsViewed` list
- **Steps / Input:** `GET /report`; inspect `timeline[]`
- **Expected result:** the unviewed event's id does not appear anywhere in the report's `timeline[]` array, even though it exists in the case's full timeline
- **Priority:** high

## TC-15 — Report contradictions/connections show only found/made items, not everything derivable

- **Covers spec point:** 8 (negative check — "never pre-written narrative unconnected to the player's actual investigation")
- **Preconditions:** an accepted conclusion exists; confirm via `InvestigationService.findContradictions()` behavior (or the Assistant, which surfaces contradictions without logging them) that at least one contradiction exists in the case data that was never submitted via `POST /contradictions` in this session
- **Steps / Input:** `GET /report`; compare `contradictions[]` against the full derivable set
- **Expected result:** `contradictions[]` contains only pairs previously logged via `POST /contradictions` (present in `GET /investigation`'s `contradictionsFound`) — the known-but-unlogged contradiction does not appear. Same logic applies to `connections[]`: only connections actually created via `POST /connections` appear, never an inferred or "correct" one that was never made.
- **Priority:** high

## TC-16 — No response ever leaks solution content

- **Covers spec point:** 9 (security)
- **Preconditions:** the full set of 422 `error` strings collected across TC-03 through TC-09 (and TC-12), plus the 200 bodies from TC-10/TC-11/TC-13
- **Steps / Input:** review every response body collected in this run
- **Expected result:** every `error` string is one of exactly: `"Expected { suspectId, evidenceIds: [...] } with at least one exhibit"`, `"That suspect isn't in this case."`, `"One of the cited exhibits isn't in this case."`, `"There isn't enough evidence linked to this suspect."`, `"Your board doesn't yet connect the evidence to this suspect."`, `"No conclusion has been accepted yet."` — none of them, and no 200 body outside of `supportingEvidence`/`connections` reflecting the caller's own accepted submission, contains an evidence id, suspect id, or connection pair that the caller did not itself already submit or that wasn't independently confirmed as correct by a prior 200. In particular, no *rejection* response (400/422) at any point in the suite contains any evidence/suspect/connection id at all beyond echoing back what the caller sent.
- **Priority:** high

---
Total: 16 cases, all API-level. High priority: 13, medium priority: 3, low priority: 0.
Run order matters for state-dependent cases: TC-08 must restore the connection(s) it
deletes before TC-09/TC-10; TC-12 requires a deliberately fresh (file-deleted) DB and
should be run in its own instance, not interleaved with the rest of this suite.
