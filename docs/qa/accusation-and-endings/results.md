# Results — accusation-and-endings
Run at: 2026-09-24T14:22:52Z
Backend reachable: yes (this run used http://localhost:4001, not :4000; `GET /api/health` returned `{"ok":true}`, `GET /api/cases/047` returned 200, the Vite proxy at :5173 returned 200)

## Run notes

- Every HTTP case was run with real requests (Node `fetch` scripts kept in the session scratchpad, not in the repo) against `http://localhost:4001/api/cases`. All five cases were `new` at the start.
- `data/cases/*/solution.json` was never read. `evidence.json` (ids only, for the locked-exhibit cases) and `endings.json` (for TC-48) were read, as the test-case file allows.
- Accused suspect was always the first suspect returned by `GET /suspects` (`S01`), chosen arbitrarily, at most one named accusation per case per reset state. The endings observed for named accusations are recorded, not acted on. Every case was reset between attempts and again at the end; the final `GET /cases` shows all five as `new` with `ending` null, and 047's theory is empty and its conclusion null.
- Browser tools: none of the `mcp__plugin_playwright_playwright__*` or `mcp__Claude_Browser__*` tools exist in this session, so every UI case is BLOCKED and no UI result was inferred from the API.
- The shared :4001 backend and :5173 frontend were not stopped or restarted. For TC-02 (restart persistence) a temporary second backend was started on :4011 against a copy of the SQLite files in the scratchpad, then killed (port 4011 confirmed down afterward).
- Observed unlocked exhibits on a fresh 047 with the first search results: E015 (personIds `["S02"]`, so it does not name S01, matching TC-25's precondition).

## TC-01 — Save theory returns whole investigation state: PASS
- Command / action run: `PUT /api/cases/047/theory {"text":"The night guard let someone in."}` on a freshly reset 047
- Observed: 200; none of the 11 required keys missing; `theory` = "The night guard let someone in."; `conclusion` null; no `data` wrapper key.
- Verdict reason: Matches the expected whole-state shape and value.

## TC-02 — Theory persists across requests (refresh): PASS
- Command / action run: saved the theory on the shared backend, `GET /investigation` with a fresh curl; then started a separate backend process on :4011 with a copy of the DB files and `GET /api/cases/047/investigation` on it.
- Observed: both returned `theory` "The night guard let someone in."
- Verdict reason: Value survives a new request and a brand-new backend process. Caveat: the shared :4001 backend itself was not restarted (forbidden), so the "restart" leg used a temp instance on a copy of the DB.

## TC-03 — Non-string `text` is a 400: PASS
- Command / action run: `PUT /theory` with `{"text":123}`, `{"text":null}`, `{"text":true}`, `{"text":{"a":1}}`, `{"text":["x"]}` after saving "keep me".
- Observed: all five 400 `{"error":"Expected { text } of at most 5000 characters"}`; theory afterwards "keep me".
- Verdict reason: Exact status and message, state unchanged.

## TC-04 — Missing `text` key or empty body is a 400: PASS
- Command / action run: `PUT /theory` with `{}`, `{"txt":"x"}`, and no body / no Content-Type.
- Observed: all three 400 with the same error string; theory afterwards `""`.
- Verdict reason: All 400, theory unchanged.

## TC-05 — Theory length boundary: PASS
- Command / action run: `PUT /theory` with 5000 then 5001 `a` characters.
- Observed: 5000 -> 200, length 5000; 5001 -> 400 `{"error":"Expected { text } of at most 5000 characters"}`; length stayed 5000.
- Verdict reason: Limit is 5000 as stated.

## TC-06 — Empty string is a valid theory and a later save overwrites: PASS
- Command / action run: `PUT /theory` "first", "", "second".
- Observed: 200 each, `theory` "first", "", "second"; final GET "second".
- Verdict reason: Overwrites, no concatenation.

## TC-07 — `suspectId` string with `evidenceIds` missing is a 400: PASS
- Command / action run: `POST /conclusion {"suspectId":"S01"}`
- Observed: 400 `{"error":"Expected { suspectId, evidenceIds: [...] } with at least one exhibit, or { suspectId: null }"}`
- Verdict reason: Exact status and text.

## TC-08 — `suspectId` string with empty `evidenceIds` is a 400: PASS
- Command / action run: `POST /conclusion {"suspectId":"S01","evidenceIds":[]}`
- Observed: 400 with the TC-07 error string (exact match).
- Verdict reason: Matches.

## TC-09 — `suspectId` missing or the wrong type is a 400: PASS
- Command / action run: bodies `{}`, `{"evidenceIds":["E001"]}`, `{"suspectId":5,"evidenceIds":["E001"]}`, `{"suspectId":true,"evidenceIds":["E001"]}`.
- Observed: each 400 with the exact TC-07 error.
- Verdict reason: All four match.

## TC-10 — `evidenceIds` of the wrong type is a 400: PASS
- Command / action run: `evidenceIds` as `"E001"`, `[1,2]`, `{"0":"E001"}`, and `{"suspectId":null,"evidenceIds":"E001"}`.
- Observed: each 400 with the exact TC-07 error (the null suspect with a non-array is also 400).
- Verdict reason: Matches.

## TC-11 — No body and syntactically invalid JSON: PASS
- Command / action run: `POST /conclusion` with no body; `POST` with `Content-Type: application/json` body `{"suspectId":` .
- Observed: (a) 400 with the TC-07 error string. (b) 400 `{"error":"Unexpected end of JSON input"}`. No conclusion stored.
- Verdict reason: Both 400 with an `error` string; not 500.

## TC-12 — Shape check comes before reference checks: PASS
- Command / action run: `POST /conclusion {"suspectId":"S99"}`
- Observed: 400 with the exact TC-07 error, not 422.
- Verdict reason: Shape validation first.

## TC-13 — Rejected requests leave the case open: PASS
- Command / action run: after TC-07..12 and TC-18..22 (fresh 047 + R1): `GET /investigation`, `GET /cases`, `GET /report`. Repeated on a fresh state with only the rejected calls and no R1.
- Observed: `conclusion` null; report 422 `{"error":"No conclusion has been accepted yet."}`. With the R1 step (needed for TC-18..22) the 047 entry was `status: "in_progress"`, `ending: null`; with only rejected calls and no travel/search it was `status: "new"`, `ending: null`.
- Verdict reason: No rejected call consumed the accusation. Note: the test's expected `"new"` conflicts with its own precondition chain (R1 travel/search makes the case `in_progress`, as TC-37 says); the `new` value was confirmed on the no-R1 variant.

## TC-14 — `{ suspectId: null }` accepted with `criminal_escapes` (all five cases): PASS
- Command / action run: for 047, 048, 049, 050, 051: reset, `POST /conclusion {"suspectId":null}`.
- Observed: each 200 with body exactly `{"suspectId":null,"evidenceIds":[],"ending":"criminal_escapes"}` (string-compared).
- Verdict reason: All five match exactly.

## TC-15 — Explicit `{ suspectId: null, evidenceIds: [] }`: PASS
- Command / action run: reset 047, `curl -i -X POST http://localhost:4001/api/cases/047/conclusion -H "Content-Type: application/json" -d '{"suspectId":null,"evidenceIds":[]}'` (run after the main pass, then reset again)
- Observed: HTTP 200, body `{"suspectId":null,"evidenceIds":[],"ending":"criminal_escapes"}`
- Verdict reason: Exact match.

## TC-16 — Cannot determine after real work is still `criminal_escapes`: PASS
- Command / action run: reset 047, unlock E015 by play, save theory "my theory", `POST /connections` E015 -> S02 (201, C01), then `POST /conclusion {"suspectId":null}`.
- Observed: 200 `{"suspectId":null,"evidenceIds":[],"ending":"criminal_escapes"}`; investigation shows the same conclusion, C01 still present, theory "my theory".
- Verdict reason: Work done does not change the ending.

## TC-17 — Cannot determine with a cited exhibit: PASS
- Command / action run: reset, unlock E015, `POST /conclusion {"suspectId":null,"evidenceIds":["E015"]}`
- Observed: 200 `{"suspectId":null,"evidenceIds":["E015"],"ending":"criminal_escapes"}`; the exhibit is kept, not dropped. The report's `supportingEvidence` then listed E015.
- Verdict reason: Matches; recorded that cited exhibits are kept for a null accusation.

## TC-18 — Unknown suspect id is a 422: PASS
- Command / action run: `POST /conclusion {"suspectId":"S99","evidenceIds":["E015"]}`
- Observed: 422 `{"error":"That suspect isn't in this case."}`; conclusion still null.
- Verdict reason: Exact.

## TC-19 — Empty-string suspect id is a 422: PASS
- Command / action run: `POST /conclusion {"suspectId":"","evidenceIds":["E015"]}`
- Observed: 422 `{"error":"That suspect isn't in this case."}`
- Verdict reason: Exact.

## TC-20 — Non-existent exhibit id is a 422: PASS
- Command / action run: `POST /conclusion {"suspectId":"S01","evidenceIds":["E999"]}`
- Observed: 422 `{"error":"One of the cited exhibits isn't in this case."}`; conclusion null.
- Verdict reason: Exact.

## TC-21 — Locked exhibit id is a 422: PASS
- Command / action run: with E015 unlocked, picked E001 from `evidence.json` (not in `GET /evidence`); `GET /evidence/E001`, then `POST /conclusion {"suspectId":"S01","evidenceIds":["E001"]}`.
- Observed: `GET /evidence/E001` 404; POST 422 `{"error":"One of the cited exhibits isn't in this case."}`; conclusion null. (Run with one other exhibit unlocked, because a fully empty-unlock state was not separately tried; E001 was locked in both.)
- Verdict reason: Exact.

## TC-22 — One good plus one locked exhibit rejects the whole accusation: PASS
- Command / action run: `POST /conclusion {"suspectId":"S01","evidenceIds":["E015","E001"]}`
- Observed: 422 `{"error":"One of the cited exhibits isn't in this case."}`; conclusion null. A later valid accusation on the same state was not needed (TC-13 confirmed the case stayed open, then TC-14/others closed it).
- Verdict reason: Whole request rejected, nothing stored.

## TC-23 — Locked and non-existent exhibits are indistinguishable: PASS
- Command / action run: Call A `{"suspectId":"S01","evidenceIds":["E001"]}` (locked), Call B `... ["E999"]`.
- Observed: both 422, byte-identical body `{"error":"One of the cited exhibits isn't in this case."}`; no "locked" in the text.
- Verdict reason: Identical, no hint.

## TC-24 — No response body leaks the answer key or names what is missing: PASS
- Command / action run: collected the bodies of the 400s (TC-07..12), 422s (TC-18..23), the accepted null accusation, `GET /cases/047`, `GET /cases`, `GET /investigation`, and listed every JSON key recursively.
- Observed: none of `culprit, requiredEvidence, requiredConnections, solution, answer, missing` present. Distinct `error` strings: the TC-07 string, `That suspect isn't in this case.`, `One of the cited exhibits isn't in this case.`, plus `Unexpected end of JSON input` (the malformed-JSON body from TC-11, an allowed body-parser message). `GET /cases/047` has `filePages` as a count (4), no file bodies, and no key.
- Verdict reason: No leaks. Note: the test lists three exact strings but TC-11(b) legitimately adds the JSON parser message.

## TC-25 — A thin accusation is accepted with an ending: PASS
- Command / action run: reset 047, unlocked E015 (personIds `["S02"]`), `POST /conclusion {"suspectId":"S01","evidenceIds":["E015"]}` (S01 = first suspect, arbitrary).
- Observed: 200 `{"suspectId":"S01","evidenceIds":["E015"],"ending":"innocent_accused"}`
- Verdict reason: Ending is one of the two allowed values (recorded, not acted on).

## TC-26 — Accepted response has exactly `suspectId`, `evidenceIds`, `ending`: PASS
- Command / action run: inspected the TC-25 body.
- Observed: keys exactly `ending, evidenceIds, suspectId`; suspectId string, evidenceIds array of strings, ending string; none of `culprit, requiredEvidence, missing, correct, whatHappened, report`.
- Verdict reason: Matches.

## TC-27 — Duplicate cited ids are collapsed: PASS
- Command / action run: reset, unlocked E015 and E017, `POST /conclusion {"suspectId":"S01","evidenceIds":["E015","E015","E017","E015"]}`
- Observed: 200 with `evidenceIds` `["E015","E017"]`; `GET /investigation` `conclusion.evidenceIds` the same; report `supportingEvidence` ids `["E015","E017"]`.
- Verdict reason: First-seen order, no repeats.

## TC-28 — Status and shape do not depend on who is accused (all five cases): PASS
- Command / action run: for each of 047..051 reset, unlocked one exhibit by play, accused the first suspect (S01) with that exhibit once.
- Observed: all 200, key set exactly `ending, evidenceIds, suspectId`. Endings seen: `innocent_accused` in all five (047 E015, 048 E003, 049 E005, 050 E001, 051 E001). No message or field says whether the accusation was right.
- Verdict reason: Same shape and status everywhere; no spec-point-7 discrepancy was observed in this sample (no `criminal_escapes` from a named accusation appeared).

## TC-29 — Several exhibits cited: returned in the order sent: PASS
- Command / action run: `POST /conclusion {"suspectId":"S01","evidenceIds":["E017","E015"]}`
- Observed: 200 `{"suspectId":"S01","evidenceIds":["E017","E015"],"ending":"innocent_accused"}`
- Verdict reason: Order preserved.

## TC-30 — `innocent_accused` asserted specifically: PASS
- Command / action run: from the TC-25 state, `GET /report` and `GET /suspects/S01`.
- Observed: `X` was `innocent_accused`. `ending.title` "Innocent Person Accused", `ending.stamp` "WRONGFUL ARREST", `whatHappened` null, no `{accused}` in verdict or narrative, and the accused's name "Dr. Maren Voss" appears in the narrative.
- Verdict reason: Every assertion for the conditional case holds.

## TC-31 — Second `POST /conclusion` is a 422 (null then null): PASS
- Command / action run: null accusation accepted, then `POST /conclusion {"suspectId":null}` again.
- Observed: 422 `{"error":"This case is closed. The accusation on file is final."}`
- Verdict reason: Exact.

## TC-32 — Second accusation naming a suspect is a 422 and the first stands: PASS
- Command / action run: unlock E015, accept null, then `POST /conclusion {"suspectId":"S01","evidenceIds":["E015"]}`, then `GET /investigation`.
- Observed: 422 `{"error":"This case is closed. The accusation on file is final."}`; `conclusion` `{"suspectId":null,"evidenceIds":[],"ending":"criminal_escapes"}`.
- Verdict reason: First one stands.

## TC-33 — Second accusation after a named accusation is a 422: PASS
- Command / action run: after TC-25 accepted: `POST {"suspectId":null}`, then the identical named repeat, then `GET /investigation`.
- Observed: both 422 `{"error":"This case is closed. The accusation on file is final."}`; `conclusion` unchanged and equal to the TC-25 response.
- Verdict reason: Matches.

## TC-34 — Malformed second body is a 400, not a 422: PASS
- Command / action run: on closed 047, `POST /conclusion {}`
- Observed: 400 with the TC-07 error; conclusion unchanged (checked twice, on a null-closed and a named-closed state).
- Verdict reason: Shape check runs first.

## TC-35 — Two simultaneous submissions: exactly one wins: PASS
- Command / action run: two parallel `POST /conclusion {"suspectId":null}` (`Promise.all`) on a fresh 047.
- Observed: one 200 `{"suspectId":null,"evidenceIds":[],"ending":"criminal_escapes"}` and one 422 `{"error":"This case is closed. The accusation on file is final."}`; a single conclusion in `GET /investigation`.
- Verdict reason: Exactly one winner (one trial only; Node is single-threaded so this is a weak race test).

## TC-36 — `investigation.conclusion` holds the accepted one: PASS
- Command / action run: `GET /investigation` after TC-25, then again after further GETs.
- Observed: `conclusion` `{"suspectId":"S01","evidenceIds":["E015"],"ending":"innocent_accused"}`, equal to the POST response and stable.
- Verdict reason: Matches.

## TC-37 — `GET /cases` shows the closed status and ending: PASS
- Command / action run: before closing the 047 entry was `new`/null (fresh state); after `POST /conclusion {"suspectId":null}`, `GET /api/cases`.
- Observed: 047 `status: "closed"`, `ending` `{"id":"criminal_escapes","title":"Criminal Escapes","stamp":"UNSOLVED"}` (three keys); response is a bare array. (The `in_progress` step after a travel was seen in TC-13.)
- Verdict reason: Exact.

## TC-38 — Closing one case does not touch the others: PASS
- Command / action run: all five reset, closed 047, `GET /cases`, `GET /048/report`, `POST /048/conclusion {"suspectId":null}`, `GET /cases`.
- Observed: after closing 047 only, 048..051 were `new`/null; `GET /048/report` 422; the 048 accusation was 200; afterward 047 and 048 both `closed`.
- Verdict reason: Matches.

## TC-39 — Interview choices are 422 after closing: PASS
- Command / action run: on closed 047: `POST /dialogue/S01/choice` with `{"choiceId":"anything"}`, `{"presentEvidenceId":"E999"}`, `{}`.
- Observed: (a) 422 `{"error":"This case is closed. The interviews are over."}`; (b) the same; (c) 400 `{"error":"Expected { choiceId } or { presentEvidenceId }"}`.
- Verdict reason: Exact.

## TC-40 — Travel to another place is a 422 after closing: PASS
- Command / action run: on closed 047 (at L01, 65 minutes used): `POST /travel {"locationId":"L02"}` and `{"locationId":"L99"}`.
- Observed: (a) 422 `{"error":"This case is closed."}`; `locationId` still L01, `minutesUsed` still 65. (b) 404 `{"error":"There is no such place in this case"}`.
- Verdict reason: Matches.

## TC-41 — Searching an unsearched spot is a 422 after closing: PASS
- Command / action run: traveled to L01, left spot `L01-desk` unsearched, closed with null, `POST /places/L01/search {"spotId":"L01-desk"}`.
- Observed: 422 `{"error":"This case is closed."}`; `spotsSearched` still `["L01-locker"]` (a different spot searched before closing); `minutesUsed` 65 unchanged.
- Verdict reason: Exact.

## TC-42 — Reading an unread file page is a 422 after closing: PASS
- Command / action run: F1 read before closing, F2 left unread; after closing `POST /file/F2/read` and `POST /file/F99/read`.
- Observed: F2 -> 422 `{"error":"This case is closed."}`; `pagesRead` stayed `["F1"]`; F99 -> 404 `{"error":"There is no such page in the file"}`.
- Verdict reason: Matches.

## TC-43 — Repeating a free, already-done action after closing: FAIL
- Command / action run: after closing: `POST /travel {"locationId":"L01"}` (current place), `POST /places/L01/search {"spotId":"L01-locker"}` (already searched), `POST /file/F1/read` (already read).
- Observed: all three returned 200 (travel returned the place, search the spot text, read the page body); `minutesUsed` stayed 65.
- Verdict reason: Spec says travel/search are 422s after closing; observed 200 for all three (the test file's predicted source behaviour). No state changes, so it is a low-severity spec deviation, reported as a finding.

## TC-44 — Read-only endpoints still work after closing: PASS
- Command / action run: on closed 047 GET `/investigation`, `/evidence`, `/suspects`, `/timeline`, `/report`, and `/cases`.
- Observed: all 200 (checked on two separate closed states).
- Verdict reason: All 200.

## TC-45 — Report before a conclusion is a 422: PASS
- Command / action run: `GET /report` on fresh 047; after exploring plus a saved theory; after rejected accusations.
- Observed: each 422 `{"error":"No conclusion has been accepted yet."}`
- Verdict reason: Exact in every variant.

## TC-46 — Report is a 422 again after reset: PASS
- Command / action run: 047 closed with `GET /report` 200, then `POST /reset`, then `GET /report`.
- Observed: 200 before, then 422 `{"error":"No conclusion has been accepted yet."}`
- Verdict reason: Exact.

## TC-47 — Report shape after cannot determine: PASS
- Command / action run: `GET /api/cases/047/report` after `{"suspectId":null}`.
- Observed: top-level keys exactly `case, connections, contradictions, ending, primarySuspect, supportingEvidence, theory, timeline, title`; `case` "047"; `title` equals the `GET /cases/047` title; `primarySuspect` null; `ending` keys exactly `id, narrative, stamp, title, verdict, whatHappened`; id `criminal_escapes`; 3 narrative lines; `whatHappened` key present, null; `theory` `""`; the four arrays empty.
- Verdict reason: Matches every expectation.

## TC-48 — `criminal_escapes` copy comes from the ending file (all five cases): PASS
- Command / action run: for each of 047..051, null accusation then `GET /report`; compared to the case's `endings.json` `criminal_escapes` entry.
- Observed: title "Criminal Escapes", stamp "UNSOLVED" in all five; verdicts equal the five expected strings; `narrative` verbatim equal to the file's array in all five; no `{accused}` in any body.
- Verdict reason: All five match.

## TC-49 — Report after a named accusation: PASS
- Command / action run: after TC-25, `GET /report` and `GET /suspects/S01`.
- Observed: `primarySuspect` `{"id":"S01","name":"Dr. Maren Voss"}` (keys `id`, `name`), equal to the suspect endpoint; `ending.id` "innocent_accused" equals the stored conclusion ending; no `{accused}` left; the name is in the narrative; `whatHappened` null.
- Verdict reason: Matches.

## TC-50 — `supportingEvidence` is exactly the cited exhibits: PASS
- Command / action run: three exhibits unlocked (E005, E015, E017); accused S01 with `["E015","E005","E015"]`; compared with `GET /evidence/<id>`.
- Observed: 200 body `evidenceIds` `["E015","E005"]`; `supportingEvidence` ids `["E015","E005"]` in that order, keys exactly `id, location, summary, time, title`, title/time/location/summary equal to the evidence endpoint, uncited E017 absent, no duplicates. With a null accusation and no cited exhibits and one unlocked exhibit (TC-55a run), `supportingEvidence` was `[]`.
- Verdict reason: Matches. (With a null accusation that cites an exhibit, the exhibit is listed: see TC-17.)

## TC-51 — `contradictions` empty when none were logged: PASS
- Command / action run: `GET /report` and `GET /investigation` after a named accusation with no contradictions logged.
- Observed: `report.contradictions` `[]`; `contradictionsFound` `[]`.
- Verdict reason: Both empty.

## TC-52 — `contradictions` match the logged ones: PASS
- Command / action run: unlocked 12 exhibits by searching every spot, viewed them, `POST /notes {"promptId":"contradictions"}`, logged the first two listed pairs `POST /contradictions` (ST02-A/E007, ST04-A/E012; both 200), closed with a null accusation, `GET /report`.
- Observed: `report.contradictions` had 2 items, same count, same pairs, same order as `contradictionsFound`; keys exactly `assertionId, claim, evidenceId, explanation, suspectName`; each `claim` equals the statement text from `GET /statements` and each `suspectName` equals the suspect's name from `GET /suspects`.
- Verdict reason: Matches, nothing unlogged appears.

## TC-53 — `connections` match the board's connections: PASS
- Command / action run: created C01 (E015->S01), C02 (S01->S02), C03 (E015->S02); `DELETE /connections/C02` (204); accused; `GET /report`, `GET /connections`.
- Observed: `report.connections` = `[{E015,S01,linked_to},{E015,S02,linked_to}]` in creation order, equal to `GET /connections` minus `id`; deleted link absent. (`GET /connections` ids were C01 and C03.)
- Verdict reason: Matches. The no-links `[]` case was seen in TC-47.

## TC-54 — `timeline` contains exactly the reviewed events: PASS
- Command / action run: with three exhibits unlocked, `GET /timeline` returned T07 and T10; `POST /viewed {"type":"event","id":"T07"}` (200); null accusation; `GET /report`. Then a second run viewing T10 then T07.
- Observed: `report.timeline` ids `["T07"]`, keys exactly `description, id, time, timestamp, title`, fields equal to `GET /timeline`; T10 absent. Second run: viewed order T10, T07 but the report order was `["T07","T10"]`, the same as `GET /timeline`. No events viewed gave `[]` (TC-25 run).
- Verdict reason: Matches all three parts.

## TC-55 — `theory` in the report is the saved theory: PASS
- Command / action run: run 1 `PUT /theory {"text":"It was an inside job."}` then null accusation, `GET /report`; run 2 with no theory saved.
- Observed: run 1 `theory` "It was an inside job."; run 2 `theory` `""`.
- Verdict reason: Matches.

## TC-56 — `GET /report` is side-effect free and stable: PASS
- Command / action run: `GET /investigation`, `GET /report` twice, `GET /investigation`.
- Observed: the two report bodies are identical text; the two investigation snapshots deep-equal.
- Verdict reason: Stable, no side effects.

## TC-57 — Report and ending never leak the answer key: PASS
- Command / action run: key-scanned `GET /report`, `/investigation`, `/cases`, `/cases/047` for a null closure and for one thin named accusation (S01 with E015) on a separate reset.
- Observed: none of `culprit, requiredEvidence, requiredConnections, solution, answer, guilty, correctSuspect` in either run; `whatHappened` null in both; the report's `primarySuspect.id` "S01" equals the one sent.
- Verdict reason: No leak.

## TC-58 — `whatHappened` is null unless the ending named the culprit: PASS
- Command / action run: `GET /report` after a null closure and after a thin named accusation.
- Observed: both `ending.whatHappened` key present with value null; ending ids `criminal_escapes` and `innocent_accused`, neither perfect nor true.
- Verdict reason: Matches.

## TC-65 — Reset after closing returns a fresh state: PASS
- Command / action run: dirtied 047 (theory, three exhibits, one connection, event T07 viewed, suspect viewed, file page F1 read, 140 minutes used) and closed it with null; `POST /reset`; `GET /investigation`.
- Observed: 200; `conclusion` null; `connections`, `contradictionsFound`, `evidenceViewed`, `suspectsViewed`, `eventsViewed`, `pagesRead`, `placesVisited`, `spotsSearched`, `unlockedEvidence` all `[]`; `minutesUsed` 0, `minutesLeft` 960 (16 h x 60), `timeUp` false; `theory` `""`; `storyFlags` `{}`; `locationId` null; `progress` 0; body equals the following GET.
- Verdict reason: Every field matches.

## TC-66 — Reset on an untouched case and repeated reset: PASS
- Command / action run: `POST /reset` twice in a row on 047.
- Observed: both 200, identical bodies, matching the fresh state.
- Verdict reason: Idempotent.

## TC-67 — Case is `new` again after reset: PASS
- Command / action run: closed 047, reset, `GET /cases`.
- Observed: 047 `status: "new"`, `ending: null`.
- Verdict reason: Matches.

## TC-68 — The accusation can be made again after reset: PASS
- Command / action run: null accusation, `GET /report` (200), reset, `GET /report`, null again; then reset, unlock, thin named accusation (200), report, reset, report, `POST /travel`.
- Observed: null accusation 200 both times; report 200 after acceptance and 422 after each reset; the named accusation 200 (`innocent_accused`); post-reset `POST /travel` 200 with `minutesUsed` 30.
- Verdict reason: Matches for accusation, report and travel. Search and interview after reset were not separately exercised.

## TC-69 — Reset mid-investigation (no conclusion yet): PASS
- Command / action run: with an exhibit, connection and theory saved, `POST /reset`, `GET /evidence`, `GET /connections`.
- Observed: 200 with the fresh state (no discrepancies); `GET /evidence` `[]`; `GET /connections` `[]`.
- Verdict reason: Matches.

## TC-70 — Connection ids restart after reset: PASS
- Command / action run: made C01 and C02, reset, unlocked again, `POST /connections`.
- Observed: 201 with id `C01`; `GET /connections` holds only that one.
- Verdict reason: Ids restart.

## TC-71 — Resetting one case leaves the others untouched: PASS
- Command / action run: 047 and 048 both closed with theories saved (theory saved after closing; see finding below); `POST /047/reset`; `GET /048/investigation`, `GET /cases`.
- Observed: 048 theory "theory 048" unchanged, `conclusion` unchanged, `minutesUsed` 0 -> 0; `/cases` showed 047 `new`, 048 `closed`.
- Verdict reason: 048 untouched.

## TC-72 — Unknown case id is a 404 on every endpoint of this feature: PASS
- Command / action run: for `052` and `abc`: `PUT /theory`, `POST /conclusion`, `GET /report`, `POST /reset`.
- Observed: all eight calls 404 `{"error":"Case not found"}`; `GET /cases` still lists exactly 047..051.
- Verdict reason: Matches.

## TC-73 — Case clock runs out: accusation still accepted, legwork is not: PASS
- Command / action run: reset 047, unlocked one exhibit, alternated `POST /travel` between L01 and L02 (31 calls after the unlock) until `timeUp`; then `POST /travel`, then `POST /conclusion {"suspectId":null}`.
- Observed: clock `{"minutesUsed":975,"minutesLeft":0,"timeUp":true,"now":"1984-03-11T00:15:00","deadline":"1984-03-11T00:15:00"}`; travel 422 `{"error":"Time is up. The District Attorney wants a name."}`; accusation 200 `criminal_escapes`.
- Verdict reason: Matches. (`minutesUsed` overshoots the 960-minute budget to 975 because the last action costs more than the time left; `minutesLeft` is clamped at 0.)

## TC-74 — Reset after time is up restores the clock: PASS
- Command / action run: from the TC-73 closed time-up state, `POST /reset`, then `POST /travel`.
- Observed: after reset `minutesUsed` 0, `timeUp` false; travel 200 and `minutesUsed` 30.
- Verdict reason: Matches.

## Summary
Total: 68 | Pass: 67 | Fail: 1
Failures needing attention: TC-43 — after closing, travel to the current place, re-searching a searched spot and re-reading a read page all return 200, not the 422 the spec states (no state changes, `minutesUsed` unchanged).
Other findings (not test-case failures):
- `PUT /theory` still returns 200 on a closed case and changes the theory (observed on closed 048), so the report's `theory` can change after the accusation is filed. The spec says only the accusation and legwork close, so this is recorded as an observation.
- Every named accusation of S01 in this run gave `innocent_accused` (five cases). The ending id was recorded but not used to choose any later accusation.
- The seed data, per the runner rules, was never inspected for the culprit; the desk was left clean (all five cases `new`, ending null).
