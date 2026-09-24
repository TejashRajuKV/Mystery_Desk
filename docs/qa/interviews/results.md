# Results — interviews
Run at: 2026-09-24T13:36:16Z
Backend reachable: yes (http://localhost:4001; `/api/health` returned `{"ok":true}`, `/api/cases/047` returned 200; frontend :5173 returned 200)

Run notes:
- The test-cases file names :4000; this run used the shared backend on :4001 (same code). All HTTP calls were made with `fetch` from throwaway Node scripts (kept outside the repo) and compared byte-for-byte against the expected bodies.
- Where a case's precondition is "state from TC-nn", I ran the cases in that order (TC-14 -> 15 -> 17; TC-24 -> 25 -> 26) or rebuilt the same state on a fresh reset (TC-31, TC-36). Case states were reset before each state-dependent case.
- TC-18 needs a backend stop/start. The shared :4001 backend was not touched. I used a temporary instance (`PORT=4102`, its own scratch SQLite file), ran the steps, killed it, started it again on the same DB file, and re-checked. The temp instance and its DB file are gone. Same source code as :4001.
- No browser automation tool (no `mcp__plugin_playwright_playwright__*` or `mcp__Claude_Browser__*`) is available in this session, so every [UI] case is BLOCKED.
- `solution.json` was never read. All five cases (047-051) and 047 were reset at the end (`POST /reset` -> 200 each; 047 investigation is back to minutesUsed 0, no flags, no unlocks).

## TC-01 — Suspects list shape for Case 047: PASS
- Command / action run: `GET /api/cases/047/suspects`
- Observed: 200; JSON array of 5; ids S01..S05; names Dr. Maren Voss, Alex Reyes, Victor Lang, Nina Okafor, Daniel Cho; aliases The Architect, The Technician, The Chairman, The Night Watch, The Wire; `id/name/alias/role/motive` all non-empty strings (objects also carry extra fields such as age, background, look, voice).
- Verdict reason: every stated field and order matches; extra fields are not forbidden by the case.

## TC-02 — Every case has five suspects: PASS
- Command / action run: `GET /api/cases/{047..051}/suspects`
- Observed: all five calls 200, each an array of 5 with `^S\d+$` ids, unique, and non-empty name/alias/role/motive.
- Verdict reason: matches expected.

## TC-03 — No answer-key data in suspect, statement or dialogue responses: PASS
- Command / action run: for each case 047..051 (after `POST /reset`): `GET /suspects`, `GET /statements`, `GET /dialogue/{id}` for all 5 suspects (7 calls per case, 35 total); case-insensitive text search for `culprit`, `guilty`, `solution`, `requiredEvidence`, `requiredConnections`; recursive key scan for `culprit`, `isCulprit`, `guilty`, `solution`.
- Observed: all 35 calls 200; zero substring hits and zero forbidden keys in every case.
- Verdict reason: no answer-key leakage found.

## TC-04 — Single suspect fetch and 404s: PASS
- Command / action run: `GET /cases/047/suspects/S02`, `.../suspects/S99`, `GET /cases/999/suspects/S02`
- Observed: (1) 200, `id S02`, `Alex Reyes`, `The Technician`, `Senior Lab Technician`, non-empty motive, equal to list element on the five fields. (2) 404 `{"error":"Suspect not found"}`. (3) 404 `{"error":"Case not found"}`.
- Verdict reason: matches.

## TC-05 — Statements list shape for Case 047: PASS
- Command / action run: `GET /api/cases/047/statements`
- Observed: 200; 5 statements ST01..ST05 with suspectIds S01..S05; takenAt e.g. `1984-03-10T10:20:00` for ST02; assertion ids ST01-A|B, ST02-A|B|C, ST03-A, ST04-A, ST05-A; `ST02-A.claim` = `I left the building at 21:00 and went straight home.`
- Verdict reason: matches.

## TC-06 — Statement assertions leak no kind or parameters: PASS
- Command / action run: same `GET /statements`, key inspection and raw-text search.
- Observed: statement keys are exactly `assertions,id,suspectId,takenAt,text`; assertion keys exactly `claim,id`; none of `"kind"`, `"severity"`, `"mitigatedBy"`, `"note"`, `"actions"`, `"target"`, `"from"`, `"to"`, `"time"` occur in the raw text.
- Verdict reason: matches.

## TC-07 — Opening dialogue node for a fresh interview (S02): PASS
- Command / action run: reset, then `GET /cases/047/dialogue/S02`
- Observed: 200; `nodeId a-start`, speaker S02 / Alex Reyes, mood neutral, narration and text exactly as specified, `canPresent true`, `voice: null`; choice ids in order `a-start-friday, a-start-prototype, a-start-parked, a-start-access, a-start-voss, a-start-nina, a-start-leave`; each choice has exactly `id,label,asked,leaves`; all `asked` false; only `a-start-leave` leaves; no `next/requires/consequences/present` keys; no `a-start-e0*` choices.
- Verdict reason: matches.

## TC-08 — Choices and text follow story state; GET changes nothing: PASS
- Command / action run: reset; `GET /dialogue/S01` twice; `GET /investigation`; `POST /file/F1/read`; `GET /dialogue/S01`
- Observed: (1) both GETs identical; `v-start`, mood angry, text starts "You haven't even read the incident report, have you?"; choices `v-start-prototype, v-start-kw, v-start-alex, v-start-accuse, v-start-leave`; minutesUsed 0. (2) POST 200; minutesUsed 20; `storyFlags["file.F1"]` true. (3) mood suspicious; text starts "Six years of my life were in that case, Detective."; choices `v-start-discovery, v-start-prototype, v-start-kw, v-start-alex, v-start-accuse, v-start-leave`.
- Verdict reason: matches.

## TC-09 — Dialogue for unknown suspect or case is a 404: PASS
- Command / action run: `GET /cases/047/dialogue/S99`; `GET /cases/999/dialogue/S02`
- Observed: 404 `{"error":"Suspect not found"}`; 404 `{"error":"Case not found"}`.
- Verdict reason: matches.

## TC-10 — Every suspect in every case has a well-formed opening node: PASS
- Command / action run: for each case 047..051, reset then `GET /dialogue/{id}` for all 5 suspects (25 calls).
- Observed: all 25 are 200; suspectId matches; speaker is a suspect of that case with matching speakerName; mood in the allowed set; non-empty text; narration string or null; boolean `canPresent`; at least 1 choice, unique ids, keys exactly `id,label,asked,leaves`, at least one leaving choice.
- Verdict reason: matches.

## TC-11 — Malformed choice bodies are a 400: PASS
- Command / action run: fresh state; `POST /dialogue/S05/choice` with `{}`, `{"choiceId":5}`, `{"presentEvidenceId":7}`, `{"choiceId":"c-start-prototype","presentEvidenceId":"E010"}`, and no body (also with JSON content type and no body).
- Observed: all 400 with body `{"error":"Expected { choiceId } or { presentEvidenceId }"}`. Afterwards minutesUsed 0, interviewedSuspects `[]`.
- Verdict reason: matches.

## TC-12 — Choice for an unknown suspect is a 404: PASS
- Command / action run: `POST /dialogue/S99/choice {"choiceId":"c-start-prototype"}`
- Observed: 404 `{"error":"Suspect not found"}`.
- Verdict reason: matches.

## TC-13 — Cannot question someone who is not where the player is: PASS
- Command / action run: fresh; `POST /dialogue/S05/choice {"choiceId":"c-start-prototype"}`; `POST /travel {"locationId":"L01"}`; repeat; `GET /dialogue/S05`; `POST /dialogue/S02/choice {"choiceId":"a-start-friday"}`
- Observed: (1) 422 `{"error":"They aren't here. Go and find them."}`. (2) travel 200, minutesUsed 30; repeat 422 same body; S05 still `c-start`, minutesUsed 30. (3) 200, `dialogue.nodeId a-friday`.
- Verdict reason: matches.

## TC-14 — Asking a question: new node, asked flag, time, interview bookkeeping: PASS
- Command / action run: fresh, travel L02, `POST /dialogue/S05/choice {"choiceId":"c-start-prototype"}`, then `GET /dialogue/S05`
- Observed: 200; keys `dialogue, ended, presented, effects, investigation`; ended false; presented null; effects `{"unlockedEvidence":[],"contradictions":[]}`; nodeId `c-prototype`, speaker S05, Daniel Cho, mood neutral, exact text; sole choice `c-prototype-back` (asked false, leaves false); minutesUsed 40, minutesLeft 920; interviewedSuspects `["S05"]`; interviewLeads.S05 2; GET equals POST's dialogue.
- Verdict reason: matches.

## TC-15 — Returning to the opening line is free and marks the question as asked: PASS
- Command / action run: `POST /dialogue/S05/choice {"choiceId":"c-prototype-back"}` then GET
- Observed: 200; `c-start`; ended false; minutesUsed 40; choices `c-start-camera(false), c-start-prototype(true), c-start-management(false), c-start-leave(false)`; interviewLeads.S05 2.
- Verdict reason: matches.

## TC-16 — Leaving the interview: PASS
- Command / action run: fresh, travel L02, `POST /dialogue/S05/choice {"choiceId":"c-start-leave"}`, GET
- Observed: 200; ended true; nodeId `c-start`; minutesUsed 30; `c-start-leave` asked false, leaves true.
- Verdict reason: matches.

## TC-17 — Re-asking an already-asked question (spec ambiguity): PASS
- Command / action run: from TC-15 state, `POST /dialogue/S05/choice {"choiceId":"c-start-prototype"}`
- Observed: 200; nodeId `c-prototype`; `investigation.clock.minutesUsed` = 50 (the value the case predicted); interviewLeads.S05 2.
- Verdict reason: matches the predicted value of 50. The spec ambiguity itself (does a repeat cost time?) is unresolved: the code charges 10 min for a repeat question, which should be confirmed with the spec owner.

## TC-18 — Interview progress lives on the server and survives a backend restart: PASS
- Command / action run: temporary backend on :4102 with a scratch DB (not the shared :4001): reset, travel L02, `POST /dialogue/S05/choice {"choiceId":"c-start-camera"}`, GET dialogue (`c-camera`), killed the process (health check then failed), started it again on the same DB file, `GET /dialogue/S05`, `GET /investigation`.
- Observed: before restart `nodeId c-camera`, text starts "Recorder three? Service mode happens."; after restart the same nodeId and text, `locationId "L02"`, `minutesUsed 40`, `unlockedEvidence ["E010"]`.
- Verdict reason: matches. Caveat: the restart was performed on a separate temp instance of the same code (as instructed), not on the dev :4001 server.

## TC-19 — A choice with an unlock consequence hands over the exhibit: PASS
- Command / action run: fresh, travel L02; `GET /evidence` (`[]`), `GET /evidence/E010` (404); `c-start-camera`; `c-camera-back`; `c-start-camera`; `GET /evidence`, `GET /evidence/E010`.
- Observed: (1) 200, `effects.unlockedEvidence` = `[{"id":"E010","title":"Modem Dial-In Log"}]`, investigation.unlockedEvidence `["E010"]`, node `c-camera`. (2) 200, `c-start`, effects empty. (3) 200, effects empty, E010 once. (4) evidence list `["E010"]`, single fetch 200.
- Verdict reason: matches.

## TC-20 — A choice id that is not on the current node is a 422: PASS
- Command / action run: fresh, travel L02, `c-start-camera` (minutesUsed 40); then `c-start-management`, `does-not-exist`, `""`
- Observed: each 422 with exactly `{"error":"That isn't something you can do at this point in the interview."}`; afterwards node `c-camera`, minutesUsed 40, no `grudge.S05` flag.
- Verdict reason: matches.

## TC-21 — Unmet-requires and evidence-reaction ids are refused with the same generic reason: PASS
- Command / action run: fresh, travel L01; `S01 v-start-discovery`, `S01 v-start-e017`, `S02 a-start-latch`, `S02 a-start-e014`
- Observed: all four 422 with the identical generic body; minutesUsed 30; S01 on `v-start`, S02 on `a-start`.
- Verdict reason: matches.

## TC-22 — A consequence flag locks routes and changes how the person reacts (S01 turns hostile): PASS
- Command / action run: fresh, travel L01; `v-start-accuse`; `v-accused-leave`; GET; `v-start-alex`; `v-start-accuse`
- Observed: (1) 200, `v-accused`, mood angry, `storyFlags["hostile.S01"]` true, minutesUsed 40, only choice `v-accused-leave` (leaves true). (2) 200, ended true, minutesUsed 40, `v-start`. (3) mood angry, text "I said we were finished. Ask your questions and go.", choices `v-start-prototype, v-start-kw, v-start-leave`. (4) and (5) 422 generic body; minutesUsed still 40.
- Verdict reason: matches.

## TC-23 — `evidenceViewed` requirement needs the exhibit examined, not just unlocked (S03): PASS
- Command / action run: travel L05, search `L05-exec`, travel L04 (minutesUsed 75); GET dialogue; present E008; `l-e008-back`; GET; `POST /viewed` E009; GET; `l-start-sale`
- Observed: (2) choices `l-start-friday, l-start-prototype, l-start-voss, l-start-leave`. (3) 200; presented `{"id":"E008",...,"reaction":"reaction"}`; node `l-e008`; unlock E009; one contradiction `ST03-A`/`E008`; minutesUsed 85. (4) `l-start`; no `l-start-sale`; E009 unlocked but not viewed. (5) `/viewed` 200 with E009 in evidenceViewed; GET lists `l-start-sale` between `l-start-voss` and `l-start-leave`. (6) 200, node `l-sale`, unlocks E016, minutesUsed 95.
- Verdict reason: matches.

## TC-24 — Presenting an unlocked exhibit: reaction, viewed, time, contradiction, flag, unlock (S05, E010): PASS
- Command / action run: fresh, travel L02, search `L02-modem` (minutesUsed 45, `c-start`, canPresent true, evidenceViewed `[]`); `POST /dialogue/S05/choice {"presentEvidenceId":"E010"}`
- Observed: 200; presented `{"id":"E010","title":"Modem Dial-In Log","reaction":"reaction"}`; node `c-e010`, mood surprised, ended false; E010 in evidenceViewed; minutesUsed 55; one contradiction `ST05-A`/`E010`/`S05` with the exact claim and explanation from the case; unlocks E006; contradictionsFound has the pair; `confessed.S05` true; choices `c-e010-who, c-e010-back`.
- Verdict reason: matches.

## TC-25 — Person reacts to story state with a variant line (S05 after confessing): PASS
- Command / action run: from TC-24 state `c-e010-back`, GET; then after a reset, GET
- Observed: after back: `c-start`, mood defeated, narration "Daniel Cho has stopped talking quite so fast.", text "Ask me anything. I did the ticket. That's all I did. I've got nothing left to hide." Fresh: mood nervous, text starts "I was at home all night, okay?".
- Verdict reason: matches.

## TC-26 — Presenting an exhibit the person has no reaction to gets the "unmoved" line: PASS
- Command / action run: from TC-25 state (minutesUsed 55, E006 unlocked, not viewed), `POST /dialogue/S05/choice {"presentEvidenceId":"E006"}`
- Observed: 200; presented reaction `unmoved`; node `c-unmoved`; text "That's not... I mean, that's not mine. Is it? No. I've never seen that."; minutesUsed 65; E006 in evidenceViewed; effects `{"unlockedEvidence":[],"contradictions":[]}`; contradictionsFound length unchanged (1).
- Verdict reason: matches.

## TC-27 — Presenting is refused for locked, unknown, or not-presentable situations: PASS
- Command / action run: fresh, travel L02, search modem (minutesUsed 45); present E005; present E999; `c-start-camera`; present E010
- Observed: (1) and (2) 422 `{"error":"That exhibit isn't in your case file."}` (identical). (3) `c-start-camera` 200, minutesUsed 55; then present E010 422 with the generic interview message. End state: minutesUsed 55, evidenceViewed `[]`, contradictionsFound `[]`.
- Verdict reason: matches.

## TC-28 — One exhibit can expose two claims; a route can lock (S02, E014): PASS
- Command / action run: F2 read, travel L03, search `L03-reader`, travel L01 (minutesUsed 95); present E014; `a-e014-press`; `a-e014-press-back`; GET; `a-start-parked`
- Observed: (2) 200, node `a-e014`, contradictions `ST02-A`/E014 and `ST02-B`/E014, both in contradictionsFound, minutesUsed 105. (3) `lawyered.S02` true and 115; after back node `a-start`, 115. (4) mood defensive, text "My lawyer says I've answered enough about cards and doors. I'll help where I can."; choices `a-start-friday, a-start-prototype, a-start-access, a-start-nina, a-start-leave` (no `a-start-parked`/`a-start-voss`). (5) 422 generic.
- Verdict reason: matches.

## TC-29 — After the case is closed, interview choices are a 422: PASS
- Command / action run: fresh, travel L02, search modem (45); `POST /conclusion {"suspectId":null,"evidenceIds":[]}`; choice `c-start-prototype`; present E010; `{}`; `GET /investigation`; then `POST /reset` and the same choice
- Observed: conclusion 200; choice and present both 422 with body exactly `{"error":"This case is closed. The interviews are over."}`; `{}` 400 with the Expected-body message; conclusion non-null, minutesUsed 45, evidenceViewed/contradictionsFound/interviewedSuspects empty; after reset the choice is 422 `They aren't here. Go and find them.`
- Verdict reason: matches.

## TC-30 — Log a real contradiction manually; duplicates are recorded once: PASS
- Command / action run: fresh, travel L02, search modem; `POST /contradictions {"assertionId":"ST05-A","evidenceId":"E010"}` twice; `GET /investigation`
- Observed: both 200 with `assertionId, evidenceId, suspectId S05`, exact claim and explanation, no `severity` key; contradictionsFound length 1.
- Verdict reason: matches. Out-of-spec observation: the response body also carries `"mitigatedBy":["E006"]`, and at that moment only E010 was unlocked (E006 still locked). See Summary note.

## TC-31 — Interview-revealed contradictions are real pairs and never duplicate: PASS
- Command / action run: fresh setup, present E010 to S05 (state as TC-24, rebuilt); `POST /contradictions` ST05-A/E010; `c-e010-back`; present E010 again; GET investigation; re-POST every pair in contradictionsFound
- Observed: (1) 200. (2) 200; `effects.contradictions` `[]`; reaction `reaction`. (3) contradictionsFound length 1; re-POST of every entry 200.
- Verdict reason: matches.

## TC-32 — A pair that is not a real contradiction is a 422 and is not recorded: PASS
- Command / action run: fresh, travel L02, search modem and recorder; `ST05-A`/`E005`; `ST01-A`/`E010`
- Observed: both 422 `{"error":"That exhibit doesn't contradict that statement."}`; contradictionsFound `[]`.
- Verdict reason: matches.

## TC-33 — Contradiction requests with unknown, locked or missing parts: PASS
- Command / action run: fresh, travel L02, search modem only; `ST05-A`/`E005` (locked); `ST99-Z`/`E010`; `{"assertionId":"ST05-A"}`
- Observed: (1) 404 `{"error":"Unknown statement or exhibit"}`; (2) 404 same body; (3) 400 `{"error":"Expected { assertionId, evidenceId }"}`; contradictionsFound `[]`.
- Verdict reason: matches. The case itself flags the locked-exhibit 404 as taken from source; the spec owner should confirm it.

## TC-34 — Suspect viewed: recorded once, in first-viewed order; GET does not record: PASS
- Command / action run: fresh; `GET /suspects/S04` then investigation; `POST /viewed` suspect S03, S01, S03
- Observed: suspectsViewed `[]` after GET; then `["S03"]`, `["S03","S01"]`, `["S03","S01"]`; every POST 200 with the full investigation object (evidenceViewed, contradictionsFound, clock, progress present); minutesUsed 0.
- Verdict reason: matches.

## TC-35 — Viewed rejects unknown ids and bad bodies: PASS
- Command / action run: `POST /viewed` `{"type":"suspect","id":"S99"}`, `{"type":"suspect"}`, `{"type":"person","id":"S01"}`
- Observed: 404 `{"error":"Nothing with that id in this case"}`; then two 400s with `{"error":"Expected { type: \"evidence\" | \"suspect\" | \"event\", id }"}`; suspectsViewed `[]`.
- Verdict reason: matches.

## TC-36 — Reset returns interviews to their opening state: PASS
- Command / action run: rebuilt the TC-26 state (present E010, back, present E006), then `POST /reset`, `GET /dialogue/S05`, `GET /investigation`
- Observed: reset 200 returning the investigation; S05 `c-start`, mood nervous, all `asked` false; storyFlags `{}`, unlockedEvidence `[]`, contradictionsFound `[]`, evidenceViewed `[]`, interviewedSuspects `[]`, interviewLeads.S05 3, conclusion null, locationId null, minutesUsed 0.
- Verdict reason: matches.

## Summary
Total: 36 | Pass: 36 | Fail: 0
Failures needing attention: none
Observations for the spec owner (not failures against any stated expected result):
- `POST /contradictions` (TC-30) and the `effects.contradictions` items returned by an interview (TC-23, TC-24) include a `mitigatedBy` array of exhibit ids. In TC-30 the array was `["E006"]` while only E010 was unlocked, so a response names the id of an exhibit the player does not hold yet. `GET /investigation`'s stored `contradictionsFound` entries showed `mitigatedBy` as `[]` in the same state, so the id appears only in the POST response body. CLAUDE.md says locked evidence "doesn't exist as far as the player is concerned"; worth checking whether that leak is intended. `GET /statements` correctly omits `mitigatedBy` (TC-06).
- TC-17: a repeated already-asked question costs another 10 minutes (observed 50); the spec is silent.
- TC-33: locked exhibit in `POST /contradictions` returns 404, not 422; the spec is silent on this.
- TC-18 was verified on a temporary instance, not by restarting the shared dev backend.
