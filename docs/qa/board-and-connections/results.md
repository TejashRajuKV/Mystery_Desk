# Results — board-and-connections
Run at: 2026-09-24T19:29:40+05:30
Backend reachable: yes (http://localhost:4001, /api/health returned {"ok":true}; the :5173 proxy also returned 200). All HTTP calls were sent directly to :4001. Each case's precondition was set up with `POST /reset` (and Setup A where stated) immediately before it. All five cases were reset again at the end and each returns `[]` for connections.

## TC-01 — Fresh case has no connections: PASS
- Command / action run: `GET /api/cases/047/connections` after reset
- Observed: 200 `[]`
- Verdict reason: Bare empty array.

## TC-02 — Fresh case has no connections in every case folder: PASS
- Command / action run: GET connections for 047-051 after reset
- Observed: All five: 200 `[]`
- Verdict reason: All empty arrays.

## TC-03 — Create a link between two suspects (relationship omitted): PASS
- Command / action run: POST 047 `{"source":"S01","target":"S02"}`
- Observed: 201 `{"id":"C01","source":"S01","target":"S02","relationship":"linked_to"}`
- Verdict reason: Exactly four keys, default relationship, id matches C\d+.

## TC-04 — Create a link with explicit relationship: PASS
- Command / action run: POST 047 `{"source":"S03","target":"S04","relationship":"linked_to"}`
- Observed: 201 `{"id":"C01","source":"S03","target":"S04","relationship":"linked_to"}`
- Verdict reason: As expected.

## TC-05 — Created link appears in GET /connections: PASS
- Command / action run: POST S01/S02, POST S03/S04, GET
- Observed: 201 C01, 201 C02; GET 200 array of [C01, C02] in creation order, deep-equal to the two POST bodies
- Verdict reason: Order and fields match.

## TC-06 — investigation.connections matches GET /connections: PASS
- Command / action run: GET /connections and GET /investigation (with two links, and on a fresh case)
- Observed: Deep-equal (JSON string compare) with two links; fresh: both `[]`
- Verdict reason: Identical.

## TC-07 — Link two locations: PASS
- Command / action run: POST `{"source":"L01","target":"L02"}`
- Observed: 201 `{"id":"C01","source":"L01","target":"L02",...}`
- Verdict reason: As expected.

## TC-08 — Link a statement claim to a suspect: PASS
- Command / action run: GET /statements contains "ST02-A" (true); POST `{"source":"ST02-A","target":"S02"}`
- Observed: 201 `{"id":"C02","source":"ST02-A","target":"S02","relationship":"linked_to"}`
- Verdict reason: As expected.

## TC-09 — Link two claims: PASS
- Command / action run: POST `{"source":"ST01-A","target":"ST02-A"}`
- Observed: 201 `{"id":"C03","source":"ST01-A","target":"ST02-A",...}`
- Verdict reason: As expected.

## TC-10 — Link an unlocked exhibit: PASS
- Command / action run: Reset, Setup A (travel L03, search L03-e002; GET /evidence lists [E002]); POST E002->S02; then fresh + Setup A, POST S02->E002
- Observed: 201 `{"id":"C01","source":"E002","target":"S02",...}`; 201 `{"id":"C01","source":"S02","target":"E002",...}`
- Verdict reason: Both directions accepted.

## TC-11 — Locked exhibit is rejected: PASS
- Command / action run: Fresh 047 (GET /evidence is `[]`); POST E002->S02 and S02->E002; GET /connections
- Observed: Both 422 `{"error":"One of those items isn't in this case."}`; GET `[]`
- Verdict reason: Exact R-UNKNOWN both ways, nothing created.

## TC-12 — Nonexistent exhibit id is rejected: PASS
- Command / action run: Setup A; POST E999->S02
- Observed: 422 `{"error":"One of those items isn't in this case."}`
- Verdict reason: As expected.

## TC-13 — Timeline event with no held exhibit is rejected: PASS
- Command / action run: Fresh 047: GET /timeline returned `[]` (no T08); POST T08->S02
- Observed: 422 `{"error":"One of those items isn't in this case."}`
- Verdict reason: As expected.

## TC-14 — Timeline event becomes linkable once an exhibit behind it is held: PASS
- Command / action run: Setup A (timeline now contains T08); POST T08->S02
- Observed: 201 `{"id":"C01","source":"T08","target":"S02",...}`
- Verdict reason: As expected.

## TC-15 — Unknown ids of every kind are rejected, in either position: PASS
- Command / action run: 16 POSTs: S01 paired with each of S99, L99, T99, ST99-A, ST02-Z, X01, C01, abc in both positions; then GET
- Observed: All 16 returned 422 `{"error":"One of those items isn't in this case."}`; GET `[]`
- Verdict reason: All exactly R-UNKNOWN.

## TC-16 — Bare statement id and search-spot id (spec ambiguity): PASS
- Command / action run: POST `{"source":"ST02","target":"S01"}` and `{"source":"L01-locker","target":"S01"}`
- Observed: Both 422 `{"error":"One of those items isn't in this case."}`; GET `[]`
- Verdict reason: Matches source-derived expectation; no deviation.

## TC-17 — Self-link is rejected: PASS
- Command / action run: POST `{"source":"S01","target":"S01"}`
- Observed: 422 `{"error":"An item can't be linked to itself."}`; GET `[]`
- Verdict reason: Exact R-SELF.

## TC-18 — Duplicate in the same direction is rejected: PASS
- Command / action run: Create S01/S02 (201 C01), POST again; GET
- Observed: 422 `{"error":"Those two are already linked."}`; GET has one item (C01)
- Verdict reason: Exact R-DUP.

## TC-19 — Duplicate in the reverse direction is rejected: PASS
- Command / action run: POST S02->S01 after S01->S02 exists; GET
- Observed: 422 `{"error":"Those two are already linked."}`; GET has one item, source S01 target S02
- Verdict reason: Exact R-DUP.

## TC-20 — Missing source is a 400: PASS
- Command / action run: POST `{"target":"S02"}`
- Observed: 400 `{"error":"Expected { source, target, relationship }"}`
- Verdict reason: Exact R-400.

## TC-21 — Missing target is a 400: PASS
- Command / action run: POST `{"source":"S01"}`
- Observed: 400 `{"error":"Expected { source, target, relationship }"}`
- Verdict reason: Exact R-400.

## TC-22 — Empty or absent body is a 400: PASS
- Command / action run: (a) POST `{}`; (b) POST empty body with Content-Type: application/json
- Observed: (a) 400 R-400; (b) 400 `{"error":"Expected { source, target, relationship }"}`
- Verdict reason: Both 400 with R-400; nothing created (GET `[]` after TC-20 to TC-26).

## TC-23 — Non-string source or target is a 400: PASS
- Command / action run: POST `{"source":1,...}`, `{"target":null}`, `{"source":["S01"],...}`, `{"target":{"id":"S02"}}`
- Observed: All four: 400 R-400
- Verdict reason: As expected.

## TC-24 — Unsupported relationship is rejected: PASS
- Command / action run: POST `{"source":"S01","target":"S02","relationship":"caused_by"}`
- Observed: 422 `{"error":"That kind of link isn't supported."}`
- Verdict reason: Exact R-REL.

## TC-25 — Non-string relationship is a 400: PASS
- Command / action run: POST with `"relationship":5`
- Observed: 400 `{"error":"Expected { source, target, relationship }"}`
- Verdict reason: Exact R-400.

## TC-26 — Empty-string ids (spec ambiguity): PASS
- Command / action run: POST `{"source":"","target":"S02"}` and `{"source":"S01","target":""}`
- Observed: Both 422 `{"error":"One of those items isn't in this case."}`; GET `[]`
- Verdict reason: Matches source-derived expectation (422, not 400); nothing created.

## TC-27 — Rejection messages never say whether a link is right or wrong: PASS
- Command / action run: Setup A, created S01/S02 and E002/S02; triggered unknown, locked exhibit (E003), self-link on S01 and S05, forward/reverse duplicates, duplicate of E002/S02, unsupported relationship, missing field; scanned bodies with the forbidden-word regex and key check
- Observed: Every body was exactly `{error: <R-* string>}`; the two self-link strings were identical and the three duplicate strings identical; forbidden-word hits: none; extra keys: none
- Verdict reason: Strings are constant per rejection type and free of verdict words.

## TC-28 — Successful creation carries no verdict: PASS
- Command / action run: Created S01/S02, S03/L01, ST01-A/S01
- Observed: All 201, keys for each: `id,source,target,relationship`
- Verdict reason: Identical four-key shape.

## TC-29 — Rejected requests change no state: PASS
- Command / action run: C01 created; then unknown, self, dup fwd, dup rev, missing source, bad relationship; GET /connections, GET /investigation; then POST S03/S04
- Observed: Both reads show only C01; next POST returned 201 `C02`
- Verdict reason: No state change, no ids consumed.

## TC-30 — DELETE returns 204 and removes the link from GET /connections: PASS
- Command / action run: C01 and C02 exist; DELETE C01; GET
- Observed: DELETE 204 with empty body; GET `[{"id":"C02",...}]`
- Verdict reason: As expected.

## TC-31 — DELETE removes the link from investigation.connections: PASS
- Command / action run: GET /investigation after the delete
- Observed: `connections` = only C02, deep-equal to GET /connections
- Verdict reason: As expected.

## TC-32 — DELETE of an unknown id is a 404: PASS
- Command / action run: With C01: DELETE C99, DELETE abc; GET
- Observed: Both 404 `{"error":"Connection not found"}`; GET still has C01
- Verdict reason: Exact R-404.

## TC-33 — Deleting the same id twice: PASS
- Command / action run: DELETE C01 twice
- Observed: 1st 204; 2nd 404 `{"error":"Connection not found"}`
- Verdict reason: As expected.

## TC-34 — New connection after a delete gets a fresh, unique id: PASS
- Command / action run: Create S01/S02, S03/S04, DELETE the second, create S05/L01, GET
- Observed: Ids C01, C02; DELETE 204; new id C03; GET has C01 and C03 only
- Verdict reason: D differs from B; unique.

## TC-35 — Deleting a lower id does not cause a collision: PASS
- Command / action run: Create three (C01, C02, C03), DELETE C01, create a fourth
- Observed: Fourth id C04; GET shows C02, C03, C04
- Verdict reason: All distinct.

## TC-36 — Same pair can be linked again after deletion: PASS
- Command / action run: Create S01/S02 (C01), DELETE, POST S02->S01
- Observed: 201 `{"id":"C02","source":"S02","target":"S01",...}`; GET has that one item
- Verdict reason: Accepted; new id differs.

## TC-37 — Connections are isolated per case: PASS
- Command / action run: Fresh 047 and 048; POST 047 S01/S02; GET 048 connections; GET 048 investigation; POST 048 S01/S02; GET 047
- Observed: 201 C01; 048 `[]`; 048 investigation connections `[]`; 048 POST 201 C01; 047 has one item
- Verdict reason: As expected.

## TC-38 — DELETE only acts within the case in the URL: PASS
- Command / action run: 047 has C01; DELETE 048/C01 (048 empty); then 048 gets its own C01 and DELETE 048/C01
- Observed: First: 404 R-404, 047 C01 intact. Second: 204, 048 list `[]`, 047 still has C01
- Verdict reason: Both branches of the case behave as expected.

## TC-39 — Reset clears all connections: PASS
- Command / action run: 047 with three links (S01/S02, S03/S04, E002/S02) after Setup A; POST /reset; GET /connections; GET /investigation
- Observed: Before: 3 links. Reset 200 with `connections: []`; GET `[]`; investigation.connections `[]`
- Verdict reason: As expected.

## TC-40 — Post-reset creation works and starts over: PASS
- Command / action run: After reset: POST S01/S02; POST E002/S02
- Observed: 201 `{"id":"C01",...}`; E002 link: 422 `{"error":"One of those items isn't in this case."}`
- Verdict reason: Counter restarted and evidence re-locked.

## TC-41 — Reset of one case leaves other cases' connections alone: PASS
- Command / action run: 047 S01/S02 and 048 S03/S04; reset 047; GET 048
- Observed: 048 still `[{"id":"C01","source":"S03","target":"S04","relationship":"linked_to"}]`
- Verdict reason: Unchanged.

## TC-42 — Unknown caseId is a 404 on all three connection routes: PASS
- Command / action run: GET, POST and DELETE on /api/cases/999/connections
- Observed: All three 404 `{"error":"Case not found"}`; 047 connections `[]` afterwards
- Verdict reason: As expected.

## Summary
Total: 42 | Pass: 42 | Fail: 0
Failures needing attention: none
Notes: ids are zero-padded (`C01`), consistent with the test-case notes. The empty-string id cases (TC-26) returned 422, not 400. The PRD path `DELETE /api/connections/:id` was not tested, as the test cases specify.
