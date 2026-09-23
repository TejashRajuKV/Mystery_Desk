# Results — Investigation Assistant

Run at: 2026-09-23T05:38Z
Backend reachable: yes (`curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/cases/047` → `200`)

**Investigation state note:** this SQLite instance is NOT fresh — `GET /api/cases/047/investigation`
shows `evidenceViewed: 5`, `suspectsViewed: 1`, `eventsViewed: 12`, `connections: 3`,
`contradictionsFound: 1`, a saved `theory`, and a submitted `conclusion` (suspect `S02`, 9 cited
evidence ids) from earlier sessions. This is called out per standing instructions rather than
silently reinterpreting "fresh seed" preconditions. In practice it does not change any result below:
`backend/src/services/assistant.service.js`'s `query()` only reads `cases.*` (suspects/evidence/
statements/timeline, all static seed files) and `investigation.findContradictions()` (also computed
live from static seed data — see `investigation.service.js`), never `investigation.model.js`'s
viewed/connections/theory/conclusion rows. Confirmed by reading both source files before running the
suite. So every API-level case below reflects the same result it would on a truly fresh seed; only
TC-23 (UI) would plausibly be state-sensitive, and it's BLOCKED anyway (no browser tool).

**Factual correction to the test-case document's "Fixed facts" section:** live queries below show
Alex Reyes (S02) actually has **5** real derived contradiction pairs across **3** assertions
(`ST02-A`×`E007`, `ST02-A`×`E011`, `ST02-A`×`E014`, `ST02-B`×`E014`, `ST02-C`×`E006`), not the 3 pairs
on `ST02-A` alone stated in the doc's "Fixed facts" preamble. Likewise Nina Okafor's (S04) real pair is
`ST04-A`×`E012` (mitigated by `E018`), not `ST04-A`×`E018` as stated. These are re-derivable from
`data/statements.json`/`data/evidence.json` directly (not from `data/solution.json`, which was not
read for this run) — flagging as a doc bug in `test-cases.md`, not an application bug. This directly
drives the TC-03 verdict below; TC-04/05/07/08/26 still pass because their assertions use "contains"
language or otherwise don't depend on the undercount.

---

## TC-01 — Response always matches the fixed shape: PASS
- Command / action run: `curl -s -i -X POST http://localhost:4000/api/assistant/query -d '{"question":"Does Alex Reyes'\''s statement contradict any evidence?"}'`
- Observed: `200`; parsed keys sorted: `answer,confidence,contradiction,contradictions,relatedEvents,relatedEvidence,relatedSuspects`. No internal names (`evidence`, `suspectIds`, `events`, `pairs`) leaked. All non-`answer` fields are structured (booleans/arrays/strings), no loose prose.
- Verdict reason: exact key set matches expected; `contradictions` present because `contradiction: true`, consistent with TC-19.

## TC-02 — `confidence` always one of high/medium/low across 4 question kinds: PASS
- Command / action run: 4 separate `POST /api/assistant/query` calls (Alex Reyes contradiction / Victor Lang contradiction / 21:00–22:00 window / "what's the weather like")
- Observed: `"high"`, `"medium"`, `"high"`, `"low"` respectively — every value one of the three allowed strings, never `true`/number/other string.
- Verdict reason: matches expected enum constraint and matches the per-case predicted values from TC-03/TC-04(medium, not TC-03's high — see below)/TC-09/TC-17.

## TC-03 — Contradiction question, suspect with only major-severity contradictions: FAIL
- Command / action run: `POST /api/assistant/query {"question":"Does Alex Reyes's statement contradict any evidence?"}`
- Observed: `contradiction: true`, `confidence: "high"` (matches expected so far); `contradictions` = `[{"ST02-A","E007"},{"ST02-A","E011"},{"ST02-A","E014"},{"ST02-B","E014"},{"ST02-C","E006"}]` — 5 entries, only 3 of which have `assertionId: "ST02-A"`; `relatedEvidence: ["E007","E011","E014","E006"]` (contains the 3 required ids, plus an extra, unexpected `E006`); `relatedSuspects: ["S02"]` (matches).
- Verdict reason: Expected result requires "every one with `assertionId: "ST02-A"`" — false, 2 of the 5 real pairs are on `ST02-B`/`ST02-C`. This is a real discrepancy between the test-case doc's "Fixed facts" (which undercounts Alex Reyes's real derived contradictions) and the live seed data/app behavior — not a bug in the assistant itself (`answerContradictions` is working correctly; it's just returning more real pairs than the doc anticipated). Confidence, contradiction flag, and the suspect/evidence "contains" checks all pass; only the strict "every element" assertion pairing fails.

## TC-04 — Contradiction question, suspect whose only real contradiction is minor and mitigated: PASS
- Command / action run: `POST /assistant/query {"question":"Does Victor Lang's statement contradict any evidence?"}`
- Observed: `{"answer":"Victor Lang said \"I stayed in the building until at least 22:00.\", but Garage Barrier Log, Executive Bay (E008) records leaving at 20:55. E009 may explain it.","confidence":"medium","relatedEvidence":["E008"],"relatedSuspects":["S03"],"relatedEvents":["T03"],"contradiction":true,"contradictions":[{"assertionId":"ST03-A","evidenceId":"E008"}]}`
- Verdict reason: exact match — `confidence: "medium"`, `contradictions` exactly `{ST03-A, E008}`, answer contains softener id `E009`, `relatedEvidence` contains `E008`, `relatedSuspects` contains `S03`.

## TC-05 — Contradiction question, suspect whose only real contradiction is minor and unmitigated: PASS
- Command / action run: `POST /assistant/query {"question":"Does Dr. Maren Voss's statement contradict any evidence?"}`
- Observed: `{"answer":"Dr. Maren Voss said \"I have never heard of Kessler-Ward.\", but Voss's Lab Notebook (E017) records knowing of it at 00:00.","confidence":"medium","relatedEvidence":["E017"],"relatedSuspects":["S01"],"relatedEvents":[],"contradiction":true,"contradictions":[{"assertionId":"ST01-B","evidenceId":"E017"}]}`
- Verdict reason: exact match — `confidence: "medium"`, `contradictions` exactly `{ST01-B, E017}`, answer has no "may explain it" softener clause, `relatedSuspects` contains `S01`.

## TC-06 — Every related ID in a contradiction response resolves to a real record: PASS
- Command / action run: TC-03's request, then `GET /api/evidence/E007`, `/E011`, `/E014`, `/E006`; `GET /api/suspects/S02`; `GET /api/cases/047/timeline` and membership check for `T01,T06,T07,T08,T11`
- Observed: all 4 evidence GETs → `200`; suspect GET → `200`; all 5 timeline ids present (`true`) in the timeline list.
- Verdict reason: every id referenced in TC-03's response (even the unexpected extra `E006`/`ST02-B`/`ST02-C` from the FAIL above) resolves to a real record — no dangling/invented id, which is exactly what this case checks (it does not require the id *set* to match a prediction, only that each id is real).

## TC-07 — Contradiction question naming no suspect aggregates across all suspects: PASS
- Command / action run: `POST /assistant/query {"question":"Does anyone's statement contradict the evidence on file?"}`
- Observed: `contradiction: true`; `confidence: "high"`; `relatedSuspects: ["S01","S02","S03","S04","S05"]` (all 5, length 5 ≥ 2); `relatedEvidence: ["E017","E007","E011","E014","E006","E008"]` — length exactly 6; `contradictions` has 9 entries (one per real pair across all 5 suspects, including the corrected S02/S04 counts noted above).
- Verdict reason: matches every literal assertion in "Expected result" (`contradiction: true`, `confidence: "high"`, `relatedSuspects.length >= 2` with all 5 present, `relatedEvidence.length === 6` exactly via `MAX_RELATED` truncation) — even though the underlying unique-evidence set differs from the doc's stated 7-id set (actual unique set across all suspects is 8 ids: `E017,E007,E011,E014,E006,E008,E012,E010`), the measurable length-6 truncation still holds, so the case passes on its actual assertions.

## TC-08 — Naming a suspect with no contradiction wording still triggers the contradiction-analysis path: PASS
- Command / action run: `POST /assistant/query {"question":"Tell me about Alex Reyes."}`
- Observed: response byte-identical to TC-03's (`contradiction: true`, `confidence: "high"`, same 5-entry `contradictions` array, same `relatedEvidence`/`relatedSuspects`/`relatedEvents`).
- Verdict reason: expected result uses "containing" language (not "exactly") and explicitly says "identical in shape to TC-03" — both hold literally, confirming the routing gap (mere suspect mention, no contradiction wording, still routes into `answerContradictions`) is real.

## TC-09 — Time-window question restricts `relatedEvents` to that window: PASS
- Command / action run: `POST /assistant/query {"question":"What happened between 21:00 and 22:00?"}`
- Observed: `confidence: "high"`; `contradiction: false`; no `contradictions` key; `relatedEvents: ["T04","T05","T06","T07","T08","T09"]` (6 of the 8 events in-window, `T10`/`T11` truncated by `MAX_RELATED`); cross-checked against `GET /api/cases/047/timeline` — all 6 timestamps (`21:00,21:05,21:07,21:10,21:14,21:25` on `1984-03-09`) fall inside `21:00:00`–`22:00:00`; `relatedEvidence: ["E003","E004","E012","E018","E007","E005"]` — the first 6 of the union of evidence ids across all 8 in-window events (union computed pre-cap, then truncated), consistent with `answerWindow`'s implementation.
- Verdict reason: matches expected on every literal assertion.

## TC-10 — Reversed time window still normalizes and returns the correct events: PASS
- Command / action run: `POST /assistant/query {"question":"What happened between 22:00 and 21:00?"}`
- Observed: response identical to TC-09's (`answer` text identical, same `relatedEvents`, same `relatedEvidence`, same `relatedSuspects`, `confidence: "high"`).
- Verdict reason: `from`/`to` swap in `answerWindow` confirmed working — byte-identical result to the forward-order window.

## TC-11 — A single clock time is not a window and falls through to the fallback: PASS
- Command / action run: `POST /assistant/query {"question":"What happened around 21:00?"}`
- Observed: `confidence: "low"`; `relatedEvidence`, `relatedSuspects`, `relatedEvents` all `[]`; `contradiction: false`; `answer` equals the generic help text.
- Verdict reason: exact match to expected — single clock time correctly fails the `times.length >= 2` check.

## TC-12 — Malformed clock time inside a window falls back to low confidence, not an error: PASS
- Command / action run: `POST /assistant/query {"question":"What happened between 21:99 and 22:00?"}`
- Observed: `200` (not 4xx/5xx); `confidence: "low"`; all related arrays empty; `contradiction: false`; `answer` is the generic help text.
- Verdict reason: matches expected — out-of-range minute correctly makes `toTimestamp` return `null`, falling through to the fallback rather than erroring.

## TC-13 — Time-window questions are silently anchored to the incident's first day: PASS
- Command / action run: `POST /assistant/query {"question":"What happened between 07:00 and 08:00?"}`
- Observed: `{"answer":"Nothing is recorded between 07:00 and 08:00.","confidence":"low","relatedEvidence":[],"relatedSuspects":[],"relatedEvents":[],"contradiction":false}`
- Verdict reason: exact match to expected — confirms the documented gap: the real `T12` event at `1984-03-10T07:30:00` is never surfaced because the window is always evaluated against `1984-03-09`. This is a real, reproduced functional gap, correctly predicted by the test-case doc.

## TC-14 — Suspect-to-location question returns evidence that actually ties them: PASS
- Command / action run: `POST /assistant/query {"question":"What ties Alex Reyes to Storage Room B?"}`
- Observed: `{"answer":"2 exhibits tie Alex Reyes to Storage Room B: Fingerprint Report (E013); Keycard Access (E014).","confidence":"high","relatedEvidence":["E013","E014"],"relatedSuspects":["S02"],"relatedEvents":["T08","T12"],"contradiction":false}`
- Verdict reason: `relatedEvidence` contains `E014` as required; `relatedSuspects` is exactly `["S02"]`; `confidence: "high"`; `contradiction: false`, no `contradictions` key. (Response also includes `E013`, which the expected result's "contains" phrasing allows.)

## TC-15 — Suspect-to-location question, real suspect and location, but no tie: PASS
- Command / action run: `POST /assistant/query {"question":"What ties Nina Okafor to the Executive Office?"}`
- Observed: `{"answer":"No exhibit places Nina Okafor at Executive Office.","confidence":"medium","relatedEvidence":[],"relatedSuspects":["S04"],"relatedEvents":[],"contradiction":false}`
- Verdict reason: exact match to expected on every field.

## TC-16 — Location-only mention is not a recognized question shape: PASS
- Command / action run: `POST /assistant/query {"question":"What happened at Storage Room B?"}`
- Observed: `confidence: "low"`; all related arrays empty; `contradiction: false`; `answer` = generic help text.
- Verdict reason: matches expected — connection branch correctly requires both a suspect and a location.

## TC-17 — Unrecognized question still returns 200 with the documented fallback: PASS
- Command / action run: `POST /assistant/query {"question":"what's the weather like"}`
- Observed: `200`; `confidence: "low"`; all related arrays empty; `contradiction: false`; `answer` equals exactly `"I can compare a suspect's statement with the records, walk through what happened between two times, or show what ties a suspect to a place. Try one of those."`
- Verdict reason: exact string match.

## TC-18 — Unrecognized/odd input never produces a 4xx/5xx: PASS
- Command / action run: 3 separate calls with `"🔍👀"`, `"12345"`, `"asdkjfh qweoiru"`
- Observed: all 3 return `200` with the identical fallback shape (`confidence: "low"`, empty related arrays, `contradiction: false`, same generic `answer`).
- Verdict reason: matches expected robustness guarantee.

## TC-19 — `contradictions` present only when `contradiction` is true: PASS
- Command / action run: inspected TC-03's raw JSON keys
- Observed: `'contradictions' in body` → true; array is non-empty (5 entries).
- Verdict reason: matches expected.

## TC-20 — `contradictions` absent whenever `contradiction` is false: PASS
- Command / action run: inspected raw JSON keys for TC-09 (window), TC-15 (no tie), TC-17 (fallback)
- Observed: parsed key sets for all three: `answer,confidence,contradiction,relatedEvents,relatedEvidence,relatedSuspects` — `contradictions` entirely absent (not present as `null`, not `[]`) in all three.
- Verdict reason: matches expected exactly.

## TC-21 — Real suspect with zero derived contradictions (documented as currently unreachable): PASS
- Command / action run: live-queried contradiction status for all 5 suspects this session (TC-03/04/05/07/08 plus direct Nina Okafor and Daniel Cho queries: `POST /assistant/query {"question":"Does Nina Okafor's statement contradict any evidence?"}` → `contradiction: true` (`ST04-A`×`E012`); `POST /assistant/query {"question":"Does Daniel Cho's statement contradict any evidence?"}` → `contradiction: true` (`ST05-A`×`E010`))
- Observed: all 5 suspects (S01–S05) confirmed to have at least one real derived contradiction this run, via live queries, not by re-reading the doc's claim.
- Verdict reason: the doc's claim that this path is currently unreachable is independently verified true against the live app this session — no suspect currently returns `contradiction: false` when named directly. Marking PASS as "documentation accurately reflects live behavior," consistent with the test case's own N/A framing (nothing to execute beyond this verification).

## TC-22 (code inspection) — No network call, no API key, no HTTP client dependency: PASS
- Command / action run: `grep -nE "fetch\(|http\.|https\.|axios|XMLHttpRequest|node-fetch|process\.env" backend/src/services/assistant.service.js backend/src/controllers/assistant.controller.js backend/src/routes/assistant.routes.js` and inspected `backend/package.json`
- Observed: grep found zero matches (exit code 1 / no output) across all 3 files; `backend/package.json` `dependencies` contains only `"express": "^4.21.2"`.
- Verdict reason: matches expected — confirms the assistant is genuinely rule-based with no external network/credential surface.

## TC-23 (UI) — AssistantPanel renders structured response as cards: PASS
- Command / action run: `test-case-runner` had no browser tool this run (platform
  tool-caching quirk, not a missing capability), so the orchestrating session drove the
  `playwright` plugin directly: navigated to `/assistant`, typed "Does Alex Reyes's
  statement contradict any evidence?" into the question box, and submitted it:
  `docs/qa/_plugin-usage/15-assistant-query-response.png`.
- Observed: the response renders as structured cards — an `E014` "KEYCARD ACCESS" card and
  an `E006` "MAINTENANCE W..." card (each with a "VIEW EVIDENCE →" link), an `S02 · ALEX
  REYES` suspect chip, timeline chips (`T01 · 17:30`, `T06 · 21:07`, `T07 · 21:10`, `T08 ·
  21:14`, `T11 · 21:44`), and 5 `LOG <evidence> VS <assertion>` buttons — not loose prose.
  The card contents match `POST /assistant/query`'s real response from this same session
  (TC-03) field-for-field.
- Verdict reason: matches expected — `AssistantPanel` turns the structured API response
  into interactive cards, confirmed visually against real, live data.

## TC-24 — Malformed body: missing `question`: PASS
- Command / action run: `curl -s -i -X POST http://localhost:4000/api/assistant/query -d '{}'`
- Observed: `HTTP/1.1 400 Bad Request`; body `{"error":"Expected { question } of 1–500 characters"}`
- Verdict reason: exact match to expected status and body.

## TC-25 — Malformed body: wrong type, empty, whitespace-only, over-length: PASS
- Command / action run: 4 separate `POST /api/assistant/query` calls with `{"question":12345}`, `{"question":""}`, `{"question":"   "}`, and `{"question":"<501 a's>"}`
- Observed: all 4 return `HTTP/1.1 400 Bad Request` with body exactly `{"error":"Expected { question } of 1–500 characters"}`
- Verdict reason: exact match to expected for all 4 sub-cases.

## TC-26 — Suspect and location name matching is case-insensitive: PASS
- Command / action run: `POST /assistant/query {"question":"does ALEX reyes's STATEMENT contradict any evidence?"}`
- Observed: response byte-identical to TC-03's/TC-08's (same `contradiction: true`, `confidence: "high"`, same 5-entry `contradictions` array containing `ST02-A`×`E007`/`E011`/`E014`).
- Verdict reason: expected result uses "equivalent to TC-03's" + "containing" language — both satisfied; case-insensitive matching (`hasWord`'s `i` flag) confirmed working.

---

## Summary
Total: 26 | Pass: 25 | Fail: 1 | Blocked: 0
Failures needing attention:
- TC-03: the test-case doc's "Fixed facts" preamble undercounts Alex Reyes's (S02) real derived
  contradictions (states 3 pairs, all on `ST02-A`; live app returns 5 pairs across `ST02-A`/`ST02-B`/
  `ST02-C`) and separately misstates Nina Okafor's (S04) real pair as `ST04-A`×`E018` when it is
  actually `ST04-A`×`E012` (mitigated by `E018`). This is a doc-accuracy issue in `test-cases.md`
  worth a fix in the next revision, not an application bug — `answerContradictions` itself is behaving
  correctly against the real seed data in both cases.

Blocked:
- TC-23: no browser automation tool (`mcp__playwright__*` / `mcp__Claude_Browser__*`) available in
  this session — needs a rerun with a browser tool attached to actually verify AssistantPanel's
  rendering.
