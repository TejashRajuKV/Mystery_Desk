# SPEC — Conclusion & Final Report

## What it does

The player saves a working theory, then submits a primary suspect plus the
evidence that proves it. The backend validates the conclusion against
`data/solution.json` (never exposed to the client) without revealing what's
missing on a rejection. Once accepted, a report is generated from what the player
actually did — not pre-written copy.

## Endpoints involved

```
PUT  /api/cases/:caseId/theory        { text: "..." }
POST /api/cases/:caseId/conclusion    { suspectId, evidenceIds: [...] }
GET  /api/cases/:caseId/report
```

## Inputs

- `PUT /theory` body: `{ "text": "<free text>" }`.
- `POST /conclusion` body: `{ "suspectId": "<suspect id>", "evidenceIds": ["<evidence id>", ...] }`.

## What "correct" means — validation order (PRD §12)

1. Malformed body (`suspectId` not a string, `evidenceIds` missing/not an array/
   empty array) → **400**.
2. `suspectId` does not exist → **422**.
3. Any id in `evidenceIds` does not exist → **422**.
4. Well-formed, suspect and evidence all exist, but the suspect is **not** the
   culprit, OR is the culprit but cited evidence doesn't cover
   `solution.requiredEvidence` → **422** with a reason — and a wrong-suspect
   rejection and a right-suspect-too-little-evidence rejection return the **same**
   reason text (so the answer can't be found by elimination — this is a security
   property, test it explicitly).
5. Suspect + evidence correct, but the required connections (PRD §6:
   `requiredConnections`, matching in either direction) were never made on the
   board → **422** with a reason that never names the missing connection.
6. All of the above pass → **200** with `{ suspectId, evidenceIds }` as saved;
   duplicate ids in `evidenceIds` are collapsed.
7. `GET /report` before any conclusion has been accepted → **422**.
8. `GET /report` after acceptance → 200 with `case`, `title`, `primarySuspect`,
   `theory` (the saved text), `supportingEvidence[]` (exactly what was cited),
   `timeline[]` (events the player actually viewed, in view order), `contradictions[]`
   and `connections[]` (only what the player actually found/made) — never
   pre-written narrative unconnected to the player's actual investigation.
9. No response at any step — success or 422 — ever contains `solution.json`
   content (culprit name before acceptance, required evidence list, required
   connections list). Confirm by diffing rejection-reason text against the raw
   solution file.

## Out of scope

Revising an already-accepted conclusion via a dedicated endpoint (the PRD only
documents prefill/re-submit through the same `POST /conclusion`); multiple
concurrent conclusions.
