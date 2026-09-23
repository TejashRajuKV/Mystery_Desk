# SPEC — Suspects & Statement Testing

## What it does

The player reviews dossiers for all 5 suspects and their recorded statements, each
broken into individually testable `assertions`. For any assertion, the player can
test it directly against a piece of evidence to see whether it holds up — this is
the "log this contradiction" action, both from the Suspects page and from the
Assistant.

## Endpoints involved

```
GET  /api/cases/:caseId/suspects
GET  /api/suspects/:suspectId
GET  /api/cases/:caseId/statements
POST /api/cases/:caseId/viewed           { type: "suspect", id: "S02" }
POST /api/cases/:caseId/contradictions   { assertionId: "ST02-A", evidenceId: "E014" }
```

## Inputs

- `POST /viewed` body: `{ "type": "suspect", "id": "<suspect id>" }`.
- `POST /contradictions` body: `{ "assertionId": "<statement assertion id>",
  "evidenceId": "<evidence id>" }` — this is the "test this claim against this
  evidence" action.

## What "correct" means

1. `GET /cases/047/suspects` returns exactly 5 suspects, each with `id`, `name`,
   `alias`, `motive`, `opportunity`, etc. — never `facts` or anything from
   `solution.json`.
2. `GET /statements` returns each statement's `assertions` with only `id` and
   `claim` text — never `kind`, its parameters, `severity`, `mitigatedBy` or `note`
   for an assertion that has not yet been logged as a found contradiction (PRD §6:
   these are narrative fields revealed only after discovery).
3. `POST /contradictions` with a real conflicting pair (per PRD §6's four claim
   kinds — e.g. `ST02-A` "departed_by 21:00" vs `E014`'s `enter L03` fact at 21:14)
   returns 200/201, and the returned investigation state's `contradictionsFound`
   includes an item with that `assertionId`/`evidenceId`, now including
   `explanation`.
4. `POST /contradictions` with a pair that does **not** actually contradict (e.g. an
   assertion and an unrelated evidence item) returns 422 with an `{ error }` message
   — it must not be silently accepted.
5. `POST /contradictions` with an unknown `assertionId` or `evidenceId` returns
   404/422, not a 500 or a silent success.
6. Logging the same real contradiction twice does not create duplicate entries in
   `contradictionsFound`.
7. `POST /viewed` with `{ type: "suspect", id: "S02" }` adds `"S02"` to
   `suspectsViewed` exactly once.

## Out of scope

Free-text "is this suspect guilty" verdicts here — guilt is only decided by
`POST /conclusion` (see the Conclusion & Report spec).
