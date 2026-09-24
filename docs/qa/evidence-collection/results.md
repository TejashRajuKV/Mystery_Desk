# Results — evidence-collection
Run at: 2026-09-24 (local time, single session)
Backend reachable: yes (http://localhost:4001; `GET /api/health` returned `{"ok":true}`, `GET /api/cases/047` returned 200; frontend :5173 returned 200)

Notes on the run:
- The test cases name `:4000`; the backend in this environment is on `:4001`, so every `BASE` was `http://localhost:4001/api`.
- Every API case was executed with real HTTP calls (a single Node script using `fetch`, kept outside the repo). The case's own setup (reset, Setup A/B, unlock steps) was re-run before each case, so no case reinterpreted state left by an earlier one. Cases 047 and 048 were reset at the end; final state was `unlockedEvidence: []`, `evidenceViewed: []`, `progress: 0` for both.
- No browser automation tool (`mcp__plugin_playwright_playwright__*` or `mcp__Claude_Browser__*`) was available in this session, so every `[UI]` case is BLOCKED. No UI result was inferred from API calls or source.
- The forbidden-key walk (TC-26) and comparisons are structural; `solution.json` was never read.

## TC-01 — Fresh investigation: evidence list is empty: PASS
- Command / action run: `POST /cases/047/reset`; `GET /cases/047/evidence`
- Observed: 200, `content-type: application/json; charset=utf-8`, body `[]`
- Verdict reason: bare empty array with JSON content type, as expected.

## TC-02 — Fresh investigation: real exhibit ids are 404: PASS
- Command / action run: reset; `GET /cases/047/evidence/E014`; `GET /cases/047/evidence/E001`
- Observed: both 404 `{"error":"Evidence not found"}`
- Verdict reason: exact 404 body, no exhibit fields leaked.

## TC-03 — Unknown or malformed exhibit ids are the same 404 as locked ones: PASS
- Command / action run: Setup A; GET `E999`, `abc`, `e001`, `E014`, then `E001`
- Observed: the four ids each returned 404 `{"error":"Evidence not found"}`; `E001` returned 200
- Verdict reason: locked id is indistinguishable from nonexistent ones; unlocked id still readable.

## TC-04 — Unknown case is a 404 on every evidence endpoint: PASS
- Command / action run: `GET /cases/999/evidence`; `GET /cases/999/evidence/E001`; `POST /cases/999/viewed {"type":"evidence","id":"E001"}`
- Observed: all three 404 `{"error":"Case not found"}`
- Verdict reason: matches exactly.

## TC-05 — Exhibit found by searching a spot appears with the full list shape: PASS
- Command / action run: reset; travel L03; search `L03-e001`; `GET /cases/047/evidence`
- Observed: travel 200; search 200 with `effects.unlockedEvidence=[{"id":"E001","title":"Empty Prototype Case"}]`; list 200, one item `{"id":"E001","type":"physical","title":"Empty Prototype Case","timestamp":"1984-03-10T07:30:00","time":"07:30","locationId":"L03","location":"Storage Room B","personIds":["S01"],"people":["Dr. Maren Voss"],"summary":"The Argus-7 case, found open and empty on the shelf."}`
- Verdict reason: key set and every value match the expectation.

## TC-06 — Every list item matches the shape, detail-only fields absent: PASS
- Command / action run: Setup B; `GET /cases/047/evidence`
- Observed: 200, 9 items (E001, E002, E003, E004, E007, E012, E013, E014, E017); per-item checks (id pattern, non-empty strings, HH:MM time, array lengths, no `details`/`source`/`relatedEvidenceIds`) produced no problems
- Verdict reason: all shape rules hold for all nine items.

## TC-07 — Exhibit with a null locationId: PASS
- Command / action run: reset; travel L01; search `L01-locker`; `GET /evidence`; `GET /evidence/E015`
- Observed: list is one item E015 with `locationId:null`, `location:null`, `timestamp:"1984-03-05T00:00:00"`, `time:"00:00"`, `type:"financial"`, `title:"Loan Default Notice"`, `personIds:["S02"]`, `people:["Alex Reyes"]`; detail 200 with the same plus `details`, `source` ("Reyes's locker, Lab 2"), `relatedEvidenceIds:[]`
- Verdict reason: null keys are present (not missing) and no 500.

## TC-08 — Exhibit with a null timestamp (case 048): PASS
- Command / action run: reset 048; travel L03; search `L03-ashtray`; `GET /cases/048/evidence`
- Observed: 200, one item `{"id":"E009","type":"physical","title":"Cigar Band","timestamp":null,"time":null,"locationId":"L03","location":"Dressing Room 1","personIds":["S04"],"people":["Leonard Voight"],...}`
- Verdict reason: matches; time fields are null. (048 reset afterwards.)

## TC-09 — List contains only unlocked exhibits: PASS
- Command / action run: reset; travel L03; search `L03-e001`, `L03-e002`; `GET /evidence`
- Observed: 200, ids `["E001","E002"]`
- Verdict reason: exactly the two unlocked ids.

## TC-10 — Detail adds details, source and relatedEvidenceIds: PASS
- Command / action run: reset; unlock only E001; `GET /evidence/E001`
- Observed: 200; all TC-05 values equal; `details` and `source` ("Recovered by Dr. M. Voss") equal the expected strings exactly; `relatedEvidenceIds: []`; no forbidden keys
- Verdict reason: zero mismatched keys against the expected object.

## TC-11 — relatedEvidenceIds contains only unlocked ids and grows: PASS
- Command / action run: reset; travel L03; sequence of searches and `GET /evidence/<id>` per the steps (step 4: read F2, search `L03-reader`)
- Observed: step 1 E001 `[]`; step 2 E001 `["E002"]`, E002 `[]`; step 3 E001 `["E002","E013"]`, E002 `[]`, E013 `["E001"]`; step 4 (search 200) E002 `["E014"]`, E013 `["E001","E014"]`
- Verdict reason: every value equals the expected value; E014 absent until step 4.

## TC-12 — Exhibits with no place unlock from a file page (case 048): PASS
- Command / action run: reset 048; `GET /evidence/E002`; `POST /file/F2/read`; `GET /evidence`; `GET /evidence/E002`
- Observed: before 404 `{"error":"Evidence not found"}`; read 200 with `effects.unlockedEvidence=[{"id":"E002","title":"Medical Examiner's Note"}]`; list one item `type:"forensic"`, `timestamp:"1984-05-19T02:10:00"`, `time:"02:10"`, `locationId:null`, `location:null`, `personIds:[]`, `people:[]`; detail 200
- Verdict reason: matches on every point. (048 reset afterwards.)

## TC-13 — Gated search spot stays closed until the file page is read: PASS
- Command / action run: reset; travel L03; search `L03-reader`; list; read F2; search `L03-reader`; list; `GET /evidence/E014`
- Observed: first search 404 `{"error":"There is nothing like that to search here"}`; list `[]`; read 200; second search 200 `[{"id":"E014","title":"Keycard Access"}]`; list ids `["E014"]`; detail 200 title `Keycard Access`, `relatedEvidenceIds: []`
- Verdict reason: gate opens only after F2 read.

## TC-14 — Exhibit unlocked by an interview appears in the list: PASS
- Command / action run: reset; read F1; travel L01; `GET /dialogue/S01`; `POST /dialogue/S01/choice {"choiceId":"v-start-discovery"}`; `GET /evidence`
- Observed: F1 200; travel 200; dialogue 200; choice 200 with `effects.unlockedEvidence=[{"id":"E014","title":"Keycard Access"}]`; list one item E014, `type:"keycard"`, `1984-03-09T21:14:00`, `time:"21:14"`, `locationId:"L03"`, `location:"Storage Room B"`, `personIds:["S02"]`, `people:["Alex Reyes"]`
- Verdict reason: matches.

## TC-15 — Finding the same exhibit twice does not duplicate it: PASS
- Command / action run: reset; travel L03; search `L03-e001` twice; `GET /evidence`; `GET /investigation`
- Observed: second search 200 `effects.unlockedEvidence=[]`; list ids `["E001"]`; investigation `unlockedEvidence=["E001"]`
- Verdict reason: no duplicate anywhere.

## TC-16 — Reading the list or a detail does not mark anything viewed: PASS
- Command / action run: Setup A; GET list, `E001`, `E002`; `GET /investigation`
- Observed: GETs 200,200,200; `evidenceViewed=[]`, `progress=0`
- Verdict reason: GET is side-effect free.

## TC-17 — Viewing records the id once, in first-viewed order: PASS
- Command / action run: Setup A; POST viewed E002, E001, E002; `GET /investigation`
- Observed: 200 `["E002"]`; 200 `["E002","E001"]`; 200 `["E002","E001"]`; GET `["E002","E001"]`
- Verdict reason: exact expected sequences.

## TC-18 — Viewing a locked exhibit is rejected and records nothing: PASS
- Command / action run: Setup A; investigation; `POST /viewed E014`; investigation; then read F2, search `L03-reader`, `POST /viewed E014`
- Observed: before viewed `[]`, progress 0; POST 404 `{"error":"Nothing with that id in this case"}`; after viewed `[]`, progress 0; after unlock POST 200 with `evidenceViewed=["E014"]`
- Verdict reason: rejected while locked, accepted once unlocked, state unchanged by the rejection.

## TC-19 — Viewing an unknown exhibit id is rejected: PASS
- Command / action run: Setup A; POST viewed with ids `E999`, `e001`, `""`
- Observed: all 404 `{"error":"Nothing with that id in this case"}`; `evidenceViewed=[]`
- Verdict reason: matches (empty-string id is a 404, not a 400, as the case expects).

## TC-20 — Bad `type` is a 400: PASS
- Command / action run: Setup A; POST viewed with six bodies (`type` page / bogus / "" / missing / null / "Evidence")
- Observed: all six 400 `{"error":"Expected { type: \"evidence\" | \"suspect\" | \"event\", id }"}`; afterwards `evidenceViewed=[]`, `pagesRead=[]`
- Verdict reason: exact message and no state change.

## TC-21 — Missing or non-string `id` is a 400: PASS
- Command / action run: Setup A; POST viewed with `{"type":"evidence"}`, `id:null`, `id:1`, `id:["E001"]`, `{}`, no body (both without and with a JSON content-type header)
- Observed: all 400 with the same error string as TC-20; `evidenceViewed=[]`
- Verdict reason: matches.

## TC-22 — Malformed JSON body is a 400: PASS
- Command / action run: Setup A; `POST /viewed` with `Content-Type: application/json`, raw body `{"type":"evidence",`
- Observed: 400 `{"error":"Expected double-quoted property name in JSON at position 19 (line 1 column 20)"}`
- Verdict reason: 400 with a non-empty string error, not 500.

## TC-23 — POST /viewed returns the whole investigation state: PASS
- Command / action run: Setup A; `POST /viewed {"type":"evidence","id":"E001"}`; `GET /investigation`
- Observed: 200; none of the 11 required keys missing (extra keys such as `interviewedSuspects`, `interviewLeads`, `locationId`, `pagesRead`, `placesVisited`, `spotsSearched` also present); `evidenceViewed=["E001"]`, `unlockedEvidence=["E001","E002","E013"]`, `conclusion=null`, other arrays empty; POST body deep-equals the following GET
- Verdict reason: matches; extra fields are allowed by the project rules.

## TC-24 — Progress is an integer 0-100 and rises with evidence viewed: PASS
- Command / action run: Setup A; GET investigation; POST viewed E001, E002, E013, E001
- Observed: progress sequence `[0,1,3,4,4]`, all integers in range
- Verdict reason: equals the expected sequence.

## TC-25 — Progress returns to 0 after a reset: PASS
- Command / action run: Setup A; view E001, E002; `POST /reset`; `GET /investigation`
- Observed: before reset progress 3; reset 200 with `progress:0`, `evidenceViewed:[]`, `unlockedEvidence:[]`; GET progress 0
- Verdict reason: matches.

## TC-26 — No evidence payload contains facts or any solution field: PASS
- Command / action run: Setup B; GET list, GET each of E001, E002, E003, E004, E007, E012, E013, E014, E017; POST viewed E003; GET investigation; GET timeline; recursive key walk plus raw-text check on the list
- Observed: all 13 responses 200; forbidden keys found in each: none; list raw text contains neither `"facts"` nor `"requiredEvidence"`
- Verdict reason: no forbidden key at any depth.

## TC-27 — Timeline evidence references leave out locked exhibits: PASS
- Command / action run: reset; GET timeline; unlock E001, E002; GET timeline; unlock E013; GET timeline
- Observed: step 1 `[]`; step 2 `[{"id":"T08","evidenceIds":["E002"]},{"id":"T12","evidenceIds":["E001","E002"]}]`; step 3 `[{"id":"T08","evidenceIds":["E002","E013"]},{"id":"T12","evidenceIds":["E001","E002","E013"]}]`; every id is in `GET /evidence`
- Verdict reason: matches order and contents exactly.

## TC-28 — Reset re-locks everything and clears viewed: PASS
- Command / action run: Setup B; view E001, E014; `POST /reset`; list; `GET /evidence/E001`; timeline; investigation; travel L03; search `L03-e001`
- Observed: reset 200; list `[]`; detail 404 `{"error":"Evidence not found"}`; timeline `[]`; `evidenceViewed=[]`, `unlockedEvidence=[]`, `progress=0`; re-search 200 `[{"id":"E001","title":"Empty Prototype Case"}]`
- Verdict reason: matches, unlocking still works after reset.

## TC-29 — Evidence state is per case: PASS
- Command / action run: reset 047 and 048; unlock and view E001 in 047; read 048 list/detail/investigation; unlock E009 in 048; read 047 list; reset 048; read 047 list and investigation
- Observed: 048 list `[]`; 048 `E001` 404; 048 `evidenceViewed=[]`, `progress=0`; 047 list after 048 unlock `["E001"]`; after 048 reset `["E001"]`; 047 `evidenceViewed=["E001"]`
- Verdict reason: no cross-case leakage in either direction.

## TC-30 — investigation.unlockedEvidence agrees with the list: PASS
- Command / action run: Setup A; `GET /investigation`; `GET /evidence`
- Observed: `unlockedEvidence=["E001","E002","E013"]`; list ids the same set
- Verdict reason: matches.

## Summary
Total: 30 | Pass: 30 | Fail: 0
Failures needing attention: none
