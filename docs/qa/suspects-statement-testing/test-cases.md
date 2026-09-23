# Test cases — Suspects & Statement Testing

Source spec: `docs/specs/suspects-statement-testing.md`
Cross-checked against: `docs/PRD.md` §6/§7/§9, `backend/src/services/case.service.js`,
`backend/src/services/investigation.service.js`, `backend/src/models/investigation.model.js`,
`backend/src/routes/index.js`, `backend/src/middleware/errorHandler.js`,
`data/statements.json`, `data/evidence.json`, `data/suspects.json`.

Notes on source findings that changed cases below vs. the prior draft:

- `flagContradiction` never sets a 201 status — the controller does `res.json(...)`, which
  is always 200. The spec's "200/201" is loosened by the code; test cases below assert 200
  exactly and flag the spec's "200/201" wording as worth tightening.
- Unknown `assertionId`/`evidenceId` on `POST /contradictions` is always **404** in the
  current code (`'Unknown statement or exhibit'`), never 422 — the spec's "404/422" is
  correspondingly loosened; tests assert 404.
- The recorded contradiction (both the direct POST response and the item inside
  `contradictionsFound`) strips `severity` (`const { severity, ...recorded } = hit`), in
  addition to the `kind`/params/`mitigatedBy`-gating already called out in the spec for
  *unfound* assertions. `mitigatedBy` and `explanation` **are** present once found — that's
  correct per PRD §8's example shape, not a leak.
- Logging the same real contradiction twice is not rejected — `addFound` is `INSERT OR
  IGNORE`, and `flagContradiction` recomputes the hit fresh each time, so a repeat call
  still returns 200 with the same body. It is idempotent success, not an error.
- `case.service.js`'s `listSuspects()` returns the suspect records unshaped (straight from
  `data/suspects.json` via the model) — there is no field-stripping step for this endpoint.
  Point 1's guarantee holds today only because `suspects.json` itself never contains
  `facts`/solution fields; this is a thinner guardrail than the statements endpoint (which
  does actively strip fields), so it's tested explicitly and separately.
- `GET /api/suspects/:suspectId` is listed in the spec's "Endpoints involved" but had no
  test case in the prior draft — added.
- Any route under `/cases/:caseId/...` 404s at a shared router-level guard
  (`routes/index.js`) if `caseId !== "047"`, independent of the sub-resource — one
  representative case added for this feature's endpoints.
- Confirmed real contradicting pair (safe to hardcode — derived from `data/statements.json`
  + `data/evidence.json`, not `solution.json`): `ST02-A` ("I left the building at 21:00...",
  `departed_by` 21:00) vs `E014` (fact: `S02` `enter` `L03` at 21:14). This is also the
  exact example the PRD walks through in §9, so it's stable to depend on.
- Confirmed real non-contradicting pair: `ST01-A` (a claim by suspect `S01`) vs `E014`
  (whose only fact is about `S02`) — `matchClaim` filters evidence facts by the statement's
  own `suspectId`, so a claim and an evidence item about two different suspects never
  match, without needing to reason about the four claim kinds.

---

## TC-01 — Suspects list returns exactly 5, correctly shaped, no leaked fields

- **Covers spec point:** 1
- **Preconditions:** fresh seed
- **Steps / Input:** `GET /api/cases/047/suspects`
- **Expected result:** 200; response body is a bare array (not `{ data: [...] }`) of length
  5; every item has exactly the keys `id`, `name`, `alias`, `age`, `role`, `department`,
  `background`, `motive`, `opportunity`, `personality`, `accessLevel`, `locationIds`,
  `relationships` — no `facts` key, no `isCulprit`/`culprit`/`guilty` or any other key not
  in that list
- **Priority:** high

## TC-02 — `GET /suspects/:suspectId` returns one suspect with the same shape

- **Covers spec point:** 1 (endpoint listed in spec but untested in prior draft)
- **Preconditions:** fresh seed
- **Steps / Input:** `GET /api/suspects/S02`
- **Expected result:** 200; body is a single object (not an array) with `id: "S02"` and the
  same key set as TC-01, matching the `S02` entry from the list endpoint field-for-field;
  no `facts` key
- **Priority:** high

## TC-03 — `GET /suspects/:suspectId` with unknown id

- **Covers spec point:** 1 (implied — not-found handling for the suspect detail endpoint)
- **Steps / Input:** `GET /api/suspects/S99`
- **Expected result:** 404; body `{ "error": "Suspect not found" }`
- **Priority:** medium

## TC-04 — Statements expose only `id` + `claim` per assertion

- **Covers spec point:** 2
- **Preconditions:** fresh seed (assertions not yet logged as found — none have been, on a
  fresh case)
- **Steps / Input:** `GET /api/cases/047/statements`
- **Expected result:** 200; every `assertions[]` item across all 5 statements has exactly
  the keys `id` and `claim` — no `kind`, `time`, `target`, `from`, `to`, `actions`,
  `severity`, `mitigatedBy`, or `note`. Each statement object itself has exactly `id`,
  `suspectId`, `takenAt`, `text`, `assertions` — no extra narrative field at the statement
  level either.
- **Priority:** high

## TC-05 — Statements list covers all 5 suspects, one statement each

- **Covers spec point:** 2 (data completeness implied by "statements for all 5 suspects" in
  the spec's "What it does")
- **Steps / Input:** `GET /api/cases/047/statements`
- **Expected result:** 200; response array has 5 items; the set of `suspectId` values
  equals the set of 5 suspect ids from `GET /suspects`, with no duplicates
- **Priority:** low

## TC-06 — Statements/assertions still hide narrative fields even after some contradictions exist elsewhere

- **Covers spec point:** 2 (the "not yet logged as found" qualifier — verifies the field
  gating is per-assertion, not a case-wide switch)
- **Preconditions:** log the real contradiction from TC-07 first (`ST02-A`/`E014` found),
  leave all other assertions unfound
- **Steps / Input:** `GET /api/cases/047/statements`
- **Expected result:** 200; **every** assertion, including `ST02-A` itself, still returns
  only `id` and `claim` — this endpoint never reveals `kind`/`severity`/`mitigatedBy`/`note`
  even for a found assertion; that narrative detail only ever appears via
  `contradictionsFound` in `GET /investigation` (see TC-08), never here
- **Priority:** high

## TC-07 — Logging a real contradiction

- **Covers spec point:** 3
- **Preconditions:** fresh seed, `ST02-A`/`E014` not yet logged
- **Steps / Input:** `POST /api/cases/047/contradictions` `{ "assertionId": "ST02-A",
  "evidenceId": "E014" }`
- **Expected result:** 200 (not 201 — the controller never sets a 201 status for this
  route); response body is exactly `{ assertionId: "ST02-A", evidenceId: "E014", suspectId:
  "S02", claim: "I left the building at 21:00 and went straight home.", explanation:
  "<non-empty string>", mitigatedBy: [] }` — no `severity` key, no `kind` key
- **Priority:** high

## TC-08 — Investigation state reflects the logged contradiction

- **Covers spec point:** 3
- **Preconditions:** TC-07 has just run
- **Steps / Input:** `GET /api/cases/047/investigation`
- **Expected result:** 200; `contradictionsFound` is an array containing exactly one item
  with `assertionId: "ST02-A"`, `evidenceId: "E014"`, `suspectId: "S02"`, a non-empty
  `explanation`, and `mitigatedBy: []`; that item has no `severity` key
- **Priority:** high

## TC-09 — Rejecting a non-contradicting pair

- **Covers spec point:** 4
- **Preconditions:** fresh seed
- **Steps / Input:** `POST /api/cases/047/contradictions` `{ "assertionId": "ST01-A",
  "evidenceId": "E014" }` (a real assertion and a real evidence item that do not conflict —
  `E014`'s only fact concerns suspect `S02`, not `S01`)
- **Expected result:** 422; body `{ "error": "That exhibit doesn't contradict that
  statement." }`; a follow-up `GET /investigation` shows `contradictionsFound` does NOT
  contain an item with `assertionId: "ST01-A"`/`evidenceId: "E014"`
- **Priority:** high

## TC-10 — Unknown `assertionId` rejected

- **Covers spec point:** 5
- **Steps / Input:** `POST /api/cases/047/contradictions` `{ "assertionId": "ST99-Z",
  "evidenceId": "E014" }` (valid evidence id, unknown assertion id)
- **Expected result:** 404; body `{ "error": "Unknown statement or exhibit" }` — not 500,
  not a silent success
- **Priority:** high

## TC-11 — Unknown `evidenceId` rejected

- **Covers spec point:** 5
- **Steps / Input:** `POST /api/cases/047/contradictions` `{ "assertionId": "ST02-A",
  "evidenceId": "E999" }` (valid assertion id, unknown evidence id)
- **Expected result:** 404; body `{ "error": "Unknown statement or exhibit" }` — not 500,
  not a silent success
- **Priority:** high

## TC-12 — Malformed `POST /contradictions` body rejected before lookup

- **Covers spec point:** 5 (edge case implied — malformed input, not just unknown ids)
- **Steps / Input:** three sub-cases against `POST /api/cases/047/contradictions`:
  (a) `{}`, (b) `{ "assertionId": "ST02-A" }` (missing `evidenceId`), (c)
  `{ "assertionId": 123, "evidenceId": "E014" }` (wrong type)
- **Expected result:** each returns 400 with body `{ "error": "Expected { assertionId,
  evidenceId }" }`
- **Priority:** medium

## TC-13 — Logging the same real contradiction twice does not duplicate

- **Covers spec point:** 6
- **Preconditions:** TC-07 has already logged `ST02-A`/`E014`
- **Steps / Input:** repeat `POST /api/cases/047/contradictions` `{ "assertionId":
  "ST02-A", "evidenceId": "E014" }`
- **Expected result:** the second call still returns 200 with the same body as TC-07 (it is
  idempotent success, not an error/409); `GET /investigation` afterward shows
  `contradictionsFound` with exactly one entry for that `assertionId`/`evidenceId` pair, not
  two
- **Priority:** medium

## TC-14 — Marking a suspect viewed

- **Covers spec point:** 7
- **Preconditions:** fresh seed, `S02` not yet in `suspectsViewed`
- **Steps / Input:** `POST /api/cases/047/viewed` `{ "type": "suspect", "id": "S02" }`
- **Expected result:** 200; response is the full investigation state (per PRD §7); its
  `suspectsViewed` array contains `"S02"` exactly once
- **Priority:** high

## TC-15 — Marking the same suspect viewed twice stays idempotent

- **Covers spec point:** 7
- **Preconditions:** TC-14 has just run (`S02` already viewed)
- **Steps / Input:** repeat `POST /api/cases/047/viewed` `{ "type": "suspect", "id": "S02"
  }`
- **Expected result:** 200; `suspectsViewed` still contains `"S02"` exactly once (length
  unchanged from TC-14), not twice
- **Priority:** medium

## TC-16 — `POST /viewed` with an unknown suspect id

- **Covers spec point:** 7 (edge case implied)
- **Steps / Input:** `POST /api/cases/047/viewed` `{ "type": "suspect", "id": "S99" }`
- **Expected result:** 404; body `{ "error": "Nothing with that id in this case" }`;
  `suspectsViewed` is unchanged
- **Priority:** medium

## TC-17 — `POST /viewed` with malformed body

- **Covers spec point:** 7 (edge case implied)
- **Steps / Input:** two sub-cases: (a) `{ "type": "location", "id": "S02" }` (type not one
  of `evidence`/`suspect`/`event`), (b) `{ "type": "suspect" }` (missing `id`)
- **Expected result:** each returns 400; body `{ "error": "Expected { type: \"evidence\" |
  \"suspect\" | \"event\", id }" }`
- **Priority:** medium

## TC-18 — Feature endpoints reject a `caseId` other than `047`

- **Covers spec point:** general (PRD §4 error convention — 404 for any `caseId` other than
  `047`, applies to every route in this spec)
- **Steps / Input:** `GET /api/cases/999/suspects` (also spot-check `GET
  /api/cases/999/statements` and `POST /api/cases/999/viewed`)
- **Expected result:** each returns 404; body `{ "error": "Case not found" }`
- **Priority:** low

## TC-19 (UI) — "Test this claim" flow is reachable from the Suspects page

- **Covers spec point:** whole feature, UI path ("What it does" — the action is reachable
  from the Suspects page)
- **Preconditions:** frontend running against the real backend
- **Steps / Input:** open a suspect's dossier, open their statement, trigger the
  claim-vs-evidence test action for the `ST02-A` claim against `E014`
- **Expected result:** the UI reflects the real backend response — on success, the claim UI
  moves to a "contradiction found" state that now shows narrative detail (e.g. the
  explanation text) that was not visible before logging; this must be driven by the actual
  `POST /contradictions` response, not a hardcoded/optimistic update that ignores it
- **Priority:** medium

## TC-20 (UI) — "Log this contradiction" is also reachable from the Assistant

- **Covers spec point:** whole feature, UI path ("What it does" explicitly says this action
  is available "both from the Suspects page and from the Assistant")
- **Preconditions:** frontend running against the real backend; ask the Assistant a question
  that surfaces the `ST02-A`/`E014` contradiction (per PRD §10/§7, the assistant response
  includes a `contradictions` array and the UI offers a "log this contradiction" button per
  pair)
- **Steps / Input:** in the Assistant panel, trigger "log this contradiction" for the
  `ST02-A`/`E014` pair returned by the assistant's answer
- **Expected result:** this calls the same `POST /api/cases/047/contradictions` endpoint;
  after it resolves, the Suspects page for `S02`'s statement (TC-19) shows the same
  contradiction as already found — state is shared, not duplicated per-surface
- **Priority:** medium

## TC-21 (UI) — Rejection from the Assistant/Suspects "test this claim" action is shown, not swallowed

- **Covers spec point:** 4, UI path
- **Preconditions:** frontend running against the real backend
- **Steps / Input:** trigger the "test this claim" action against a claim/evidence pair that
  does not conflict (e.g. the UI equivalent of TC-09's pair, if reachable through the
  evidence picker)
- **Expected result:** the UI shows a clear rejection state (not a silent no-op, not a false
  "found" state) reflecting the backend's 422, and does not add the pair to any
  "found contradictions" list in the UI
- **Priority:** low

---
Total: 21 cases (16 API, 5 UI). High priority: 9.
