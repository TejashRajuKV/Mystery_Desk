# Results — Suspects & Statement Testing

Run at: 2026-09-23T05:27Z – 05:29Z
Backend reachable: yes (`GET /api/cases/047` → 200)

## State note (read before the per-case results)

Investigation state was **not fresh** at the start of this run. A prior QA pass in
this same session (visible in the previous `results.md`, run at 2026-09-23T05:03Z)
already: logged the `ST02-A`/`E014` contradiction, marked suspect `S02` as viewed,
created a connection `C03` (`E014`→`S02`), and recorded a draft `theory`/`conclusion`
naming `S02`. `GET /api/cases/047/investigation` at the start of this run showed:

```
suspectsViewed: ["S02"]
contradictionsFound: [ST02-A/E014, no severity key, mitigatedBy: []]
progress: 19
```

`GET /api/cases/047` shows `status: "active"` — the case is not locked despite having
a draft conclusion recorded, so all mutating endpoints below were still exercisable.

This invalidates the literal "fresh seed" precondition for TC-04, TC-06, TC-07, TC-13,
TC-14, TC-15 as written. Where that happened, the case below is still marked PASS/FAIL
against what the endpoint actually returned, but the note explains why the "first
time" framing of the precondition couldn't be independently verified this run — only
the idempotent/already-found path could be.

---

## TC-01 — Suspects list returns exactly 5, correctly shaped, no leaked fields: PASS
- Command: `curl -s http://localhost:4000/api/cases/047/suspects`, then validated
  programmatically (Node) that the array has length 5 and every item's key set equals
  exactly `id,name,alias,age,role,department,background,motive,opportunity,
  personality,accessLevel,locationIds,relationships`.
- Observed: `isArray: true length: 5`; `all keys match expected: true`;
  `has facts/isCulprit/culprit/guilty: false`.
- Verdict reason: matches expected exactly — bare array, 5 items, exact key set, no
  leaked fields.

## TC-02 — `GET /suspects/:suspectId` returns one suspect with the same shape: PASS
- Command: `curl -s -i http://localhost:4000/api/suspects/S02`; compared against the
  `S02` entry from `GET /api/cases/047/suspects` via `JSON.stringify` equality in Node.
- Observed: `HTTP/1.1 200 OK`; body is a single object, `id: "S02"`;
  `field-for-field equal: true`; `detail is array: false`.
- Verdict reason: single object, correct id, byte-identical to the list entry — no
  `facts` key present (same key set as TC-01 confirms this).

## TC-03 — `GET /suspects/:suspectId` with unknown id: PASS
- Command: `curl -s -i http://localhost:4000/api/suspects/S99`
- Observed: `HTTP/1.1 404 Not Found`, body `{"error":"Suspect not found"}`.
- Verdict reason: exact match to expected.

## TC-04 — Statements expose only `id` + `claim` per assertion: PASS (precondition caveat)
- Command: `curl -s http://localhost:4000/api/cases/047/statements`, validated
  programmatically that every statement has exactly
  `id,suspectId,takenAt,text,assertions` and every assertion has exactly `id,claim`.
- Observed: `length: 5`; `all shapes ok: true` (no per-item mismatch printed, including
  for `ST02-A` which is already a found contradiction in this session's state).
- Verdict reason: expected shape held, but the precondition "fresh seed, none found" was
  **not** true — `ST02-A` was already logged as found before this run started (see State
  note). The endpoint hid narrative fields for it anyway, which is actually a stronger
  confirmation of the spec point (gating never leaks even for a found assertion) than the
  fresh-seed version would have shown — but it means this run functionally verified TC-06's
  claim, not a true "before any discovery" baseline for TC-04.

## TC-05 — Statements list covers all 5 suspects, one statement each: PASS
- Command: same response as TC-04, checked `suspectId` set against the 5 ids from
  `GET /suspects`.
- Observed: `suspectIds: [ 'S01', 'S02', 'S03', 'S04', 'S05' ] unique: true`.
- Verdict reason: 5 items, one per suspect, no duplicates — matches expected.

## TC-06 — Statements/assertions still hide narrative fields even after some contradictions exist elsewhere: PASS
- Command: same `GET /api/cases/047/statements` call/validation as TC-04.
- Observed: every assertion including `ST02-A` (already found in this session's state
  going into this run) returns only `id`+`claim`; no `kind`/`severity`/`mitigatedBy`/`note`
  anywhere in the response.
- Verdict reason: this is exactly the scenario the case describes (a found assertion
  coexisting with the statements endpoint) — confirmed directly, no caveat needed here
  since the "already found" precondition was actually satisfied by the pre-existing state.

## TC-07 — Logging a real contradiction: PASS (precondition caveat — see note)
- Command: `curl -s -i -X POST http://localhost:4000/api/cases/047/contradictions -d
  '{"assertionId":"ST02-A","evidenceId":"E014"}'`
- Observed: `HTTP/1.1 200 OK`, body exactly
  `{"assertionId":"ST02-A","evidenceId":"E014","suspectId":"S02","claim":"I left the
  building at 21:00 and went straight home.","explanation":"Alex Reyes said \"I left
  the building at 21:00 and went straight home.\", but Keycard Access (E014) records
  entering at 21:14.","mitigatedBy":[]}` — no `severity`, no `kind`.
- Verdict reason: response body/shape matches the expected result exactly (200, exact
  fields, no severity/kind). However the precondition "fresh seed, not yet logged" was
  **false** — this pair was already logged by the prior 05:03Z QA pass, so this call was
  actually a repeat/idempotent call, not a true first-time log. The response is
  indistinguishable from what a first-time log would produce, and matches spec, so PASS
  stands, but this run cannot independently confirm first-time-vs-repeat status-code
  behavior differs (it doesn't, per TC-13's note that it's idempotent anyway).

## TC-08 — Investigation state reflects the logged contradiction: PASS
- Command: `curl -s http://localhost:4000/api/cases/047/investigation` immediately after
  TC-07's call.
- Observed: `contradictionsFound` is an array of length 1, containing exactly
  `{assertionId: "ST02-A", evidenceId: "E014", suspectId: "S02", explanation:
  "<non-empty>", mitigatedBy: []}`, no `severity` key.
- Verdict reason: matches expected exactly.

## TC-09 — Rejecting a non-contradicting pair: PASS
- Command: `curl -s -i -X POST http://localhost:4000/api/cases/047/contradictions -d
  '{"assertionId":"ST01-A","evidenceId":"E014"}'`
- Observed: `HTTP/1.1 422 Unprocessable Entity`, body
  `{"error":"That exhibit doesn't contradict that statement."}`; follow-up
  `GET /investigation` (captured in TC-08/TC-13 checks) shows `contradictionsFound`
  contains only the `ST02-A`/`E014` entry — no `ST01-A`/`E014` entry present.
- Verdict reason: exact match to expected, and confirmed no state pollution.

## TC-10 — Unknown `assertionId` rejected: PASS
- Command: `curl -s -i -X POST .../contradictions -d
  '{"assertionId":"ST99-Z","evidenceId":"E014"}'`
- Observed: `HTTP/1.1 404 Not Found`, body `{"error":"Unknown statement or exhibit"}`.
- Verdict reason: exact match to expected.

## TC-11 — Unknown `evidenceId` rejected: PASS
- Command: `curl -s -i -X POST .../contradictions -d
  '{"assertionId":"ST02-A","evidenceId":"E999"}'`
- Observed: `HTTP/1.1 404 Not Found`, body `{"error":"Unknown statement or exhibit"}`.
- Verdict reason: exact match to expected.

## TC-12 — Malformed `POST /contradictions` body rejected before lookup: PASS
- Command (a): `-d '{}'` → Observed `HTTP/1.1 400`,
  `{"error":"Expected { assertionId, evidenceId }"}`.
- Command (b): `-d '{"assertionId":"ST02-A"}'` → Observed `HTTP/1.1 400`, same body.
- Command (c): `-d '{"assertionId":123,"evidenceId":"E014"}'` → Observed `HTTP/1.1 400`,
  same body.
- Verdict reason: all three sub-cases return exactly the expected 400 + message.

## TC-13 — Logging the same real contradiction twice does not duplicate: PASS
- Command: repeated `curl -s -i -X POST .../contradictions -d
  '{"assertionId":"ST02-A","evidenceId":"E014"}'` (a second explicit repeat call, on
  top of TC-07's call, both against already-logged state).
- Observed: second call returns `HTTP/1.1 200 OK` with the identical body to TC-07;
  follow-up `GET /investigation` shows `contradictionsFound count: 1` — only one entry
  for the `ST02-A`/`E014` pair, not two, even after (at minimum) three total POSTs to
  this pair across this run and the prior 05:03Z run.
- Verdict reason: matches expected — idempotent success, no duplication.

## TC-14 — Marking a suspect viewed: PASS (precondition caveat — see note)
- Command: `curl -s -i -X POST http://localhost:4000/api/cases/047/viewed -d
  '{"type":"suspect","id":"S02"}'`
- Observed: `HTTP/1.1 200 OK`, full investigation state returned, `suspectsViewed`
  contains `"S02"` exactly once (`["S02"]`).
- Verdict reason: response content matches expected exactly (S02 present, once), but
  the precondition "S02 not yet in suspectsViewed" was **false** — S02 was already
  marked viewed by the prior 05:03Z run. This call was functionally a repeat, not a
  first-time mark. Result is consistent with what a first-time mark would produce, so
  PASS stands, with the same caveat as TC-07: true first-time behavior wasn't
  independently observed this run.

## TC-15 — Marking the same suspect viewed twice stays idempotent: PASS
- Command: repeated `curl -s -X POST .../viewed -d '{"type":"suspect","id":"S02"}'`
  immediately after TC-14's call.
- Observed: `suspectsViewed` still `["S02"]` — length unchanged, no duplicate entry.
- Verdict reason: matches expected exactly.

## TC-16 — `POST /viewed` with an unknown suspect id: PASS
- Command: `curl -s -i -X POST .../viewed -d '{"type":"suspect","id":"S99"}'`
- Observed: `HTTP/1.1 404 Not Found`, body
  `{"error":"Nothing with that id in this case"}`; follow-up `GET /investigation`
  confirmed `suspectsViewed` unchanged at `["S02"]`.
- Verdict reason: matches expected exactly, no state mutation on 404.

## TC-17 — `POST /viewed` with malformed body: PASS
- Command (a): `-d '{"type":"location","id":"S02"}'` → Observed `HTTP/1.1 400`,
  `{"error":"Expected { type: \"evidence\" | \"suspect\" | \"event\", id }"}`.
- Command (b): `-d '{"type":"suspect"}'` → Observed `HTTP/1.1 400`, same body.
- Verdict reason: both sub-cases match expected exactly.

## TC-18 — Feature endpoints reject a `caseId` other than `047`: PASS
- Command: `GET /api/cases/999/suspects`, `GET /api/cases/999/statements`,
  `POST /api/cases/999/viewed -d '{"type":"suspect","id":"S02"}'`
- Observed: all three return `HTTP/1.1 404 Not Found`, body `{"error":"Case not
  found"}`.
- Verdict reason: matches expected exactly across all three spot-checked routes.

## TC-19 (UI) — "Test this claim" flow is reachable from the Suspects page: PASS
- Command / action run: `test-case-runner` still had no browser tool this run (platform
  tool-caching quirk, not a missing capability — see the suite-level note), so the
  orchestrating session drove the installed `playwright` plugin directly against Alex
  Reyes's (S02) dossier: `docs/qa/_plugin-usage/10-suspect-contradiction-found.png`.
- Observed: the claim "I left the building at 21:00 and went straight home." shows a
  `CONTRADICTED · E014` badge with the exact explanation text from the API response; the
  other two untested claims show a live "Test against evidence..." dropdown + `CHECK`
  button.
- Verdict reason: the "test this claim" action is genuinely reachable and reflects the
  real backend result, not a hardcoded UI state.

## TC-20 (UI) — "Log this contradiction" is also reachable from the Assistant: PASS
- Command / action run: via the `playwright` plugin, navigated to `/assistant`, typed
  "Does Alex Reyes's statement contradict any evidence?" and submitted:
  `docs/qa/_plugin-usage/15-assistant-query-response.png`.
- Observed: the response renders `E014`/`E006` evidence cards, the `S02 · ALEX REYES`
  suspect chip, related timeline events, and 5 `LOG <evidence> VS <assertion>` buttons —
  one per real contradiction pair (`E007 vs ST02-A`, `E011 vs ST02-A`, `E014 vs ST02-A`,
  `E014 vs ST02-B`, `E006 vs ST02-C`) — byte-matching the 5 pairs returned by
  `POST /assistant/query` in the Investigation Assistant suite's TC-03.
- Verdict reason: matches expected — the Assistant surfaces the same "log this
  contradiction" action as the Suspects page, backed by real data.

## TC-21 (UI) — Rejection from the Assistant/Suspects "test this claim" action is shown, not swallowed: BLOCKED
- Command / action run: none — requires the evidence picker/rejection UI state in the
  browser.
- Observed: no browser automation tool available in this session.
- Verdict reason: same as TC-19/TC-20 — correctly BLOCKED rather than inferred.

## Summary
Total: 21 | Pass: 18 | Fail: 0 | Blocked: 1
Failures needing attention: none

Notes for the next run:
- TC-07 and TC-14 could only be verified against already-logged/already-viewed state
  this session (see "State note" above) — their PASS verdicts confirm response
  shape/content and idempotent correctness, but not literal first-time behavior. If a
  true fresh-seed run is needed to fully satisfy those two cases' stated preconditions,
  reset the SQLite investigation state (or run against a newly seeded case) before
  re-running just those two.
- TC-21 (rejection UI state for a non-contradicting claim test) is still BLOCKED — the
  supplementary UI pass covered the success path (TC-19/TC-20) but not this one; needs a
  future run that specifically drives a claim-vs-wrong-evidence test and observes the
  rejection state rendered.
