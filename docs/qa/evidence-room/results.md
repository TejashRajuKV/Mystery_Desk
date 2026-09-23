# Results — Evidence Room

Run at: 2026-09-23T05:26:03Z
Backend reachable: yes (`GET /api/cases/047` → 200)

**Investigation state note:** Several test cases in `test-cases.md` say "Preconditions:
fresh seed" or implicitly assume an unviewed item. The live SQLite investigation state is
**not fresh** — it carries progress from earlier real testing this session. At the start of
this run, `GET /api/cases/047/investigation` returned:

```
evidenceViewed: ["E014","E015","E001","E002"]
suspectsViewed: ["S02"]
eventsViewed: ["T04","T08"]
connections: [{"id":"C03","source":"E014","target":"S02","relationship":"linked_to"}]
contradictionsFound: [ST02-A]
theory: set (non-empty)
conclusion: {"suspectId":"S02","evidenceIds":[...9 ids...]}
progress: 18
```

Where a case's exact test id (`E014`) was already viewed, this is called out explicitly per
case rather than silently treated as a fresh view. Evidence rows themselves are static seed
data (per TC-01's own precondition note), so read-only cases are unaffected.

## TC-01 — Evidence list returns exactly 18 items: PASS
- Command / action run: `curl -s http://localhost:4000/api/cases/047/evidence`
- Observed: 200; array of length 18; ids `E001`–`E018`, all matching `/^E\d+$/`, all with a
  non-empty `type`.
- Verdict reason: matches expected exactly.

## TC-02 — Evidence detail for a valid id has the full shape: PASS
- Command / action run: `curl -s -i http://localhost:4000/api/evidence/E014`
- Observed: `HTTP/1.1 200 OK`; body:
  `{"id":"E014","type":"keycard","title":"Keycard Access","timestamp":"1984-03-09T21:14:00","time":"21:14","locationId":"L03","location":"Storage Room B","personIds":["S02"],"people":["Alex Reyes"],"summary":"...","details":"...","source":"Storage Room B card reader","relatedEvidenceIds":["E002","E007","E013"]}`
- Verdict reason: all list fields present plus `details`, `source`, `relatedEvidenceIds`;
  `time` "21:14" correctly derived from `timestamp` "1984-03-09T21:14:00" as specified.

## TC-03 — Evidence detail for an unknown id: PASS
- Command / action run: `curl -s -i http://localhost:4000/api/evidence/E999`
- Observed: `HTTP/1.1 404 Not Found`; body `{"error":"Evidence not found"}`
- Verdict reason: exact status and body match.

## TC-04 — `GET /cases/:caseId/evidence` rejects a caseId other than 047: PASS
- Command / action run: `curl -s -i http://localhost:4000/api/cases/048/evidence`
- Observed: `HTTP/1.1 404 Not Found`; body `{"error":"Case not found"}`
- Verdict reason: exact status and body match; guard fires before evidence-specific logic.

## TC-05 — `facts` never leaks in any evidence response: PASS
- Command / action run: checked `"facts"` substring in `GET /api/cases/047/evidence`,
  `GET /api/evidence/E014`, `GET /api/evidence/E001`, `GET /api/evidence/E018`
  (`grep -o '"facts"' | wc -l` on each response body).
- Observed: 0 occurrences in all four responses.
- Verdict reason: `facts` key never appears in list or detail responses, including for
  `E014` which has non-empty `facts` in the seed data.

## TC-06 — Marking evidence viewed: PASS (with state caveat)
- Command / action run: `curl -s -i -X POST http://localhost:4000/api/cases/047/viewed -H "Content-Type: application/json" -d '{"type":"evidence","id":"E014"}'`
- Observed: `HTTP/1.1 200 OK`; full investigation state returned;
  `evidenceViewed: ["E014","E015","E001","E002"]` — contains `"E014"` as expected.
- Verdict reason: response shape and content match expected. Caveat: `E014` was **already**
  in `evidenceViewed` before this call (from earlier session activity), so this call did not
  demonstrate a fresh insertion — it demonstrated the idempotent/already-viewed path, which
  is really TC-07's behavior. The response shape still fully satisfies TC-06's expected
  result as written.

## TC-07 — Viewing the same evidence twice does not duplicate: PASS
- Command / action run: repeated the identical POST from TC-06 a second time.
- Observed: `HTTP/1.1 200 OK`; `evidenceViewed` still `["E014","E015","E001","E002"]` —
  `"E014"` appears exactly once, length unchanged between the two calls.
- Verdict reason: `UNIQUE` constraint / `INSERT OR IGNORE` behavior confirmed — no duplicate
  entry after repeated POSTs.

## TC-08 — `/viewed` rejects an unknown evidence id: PASS
- Command / action run: `curl -s -i -X POST http://localhost:4000/api/cases/047/viewed -H "Content-Type: application/json" -d '{"type":"evidence","id":"E999"}'`, then
  `curl -s http://localhost:4000/api/cases/047/investigation`
- Observed: `HTTP/1.1 404 Not Found`; body `{"error":"Nothing with that id in this case"}`.
  Follow-up `evidenceViewed: ["E014","E015","E001","E002"]` — no `"E999"` present.
- Verdict reason: exact status/body match TC-08's distinct error message (different from
  TC-03's "Evidence not found"); state unaffected as expected.

## TC-09 — `/viewed` rejects a missing `id`: PASS
- Command / action run: `curl -s -i -X POST http://localhost:4000/api/cases/047/viewed -H "Content-Type: application/json" -d '{"type":"evidence"}'`
- Observed: `HTTP/1.1 400 Bad Request`; body `{"error":"Expected { type: \"evidence\" | \"suspect\" | \"event\", id }"}`
- Verdict reason: exact status and body match.

## TC-10 — `/viewed` rejects a missing `type`: PASS
- Command / action run: `curl -s -i -X POST http://localhost:4000/api/cases/047/viewed -H "Content-Type: application/json" -d '{"id":"E014"}'`
- Observed: `HTTP/1.1 400 Bad Request`; body `{"error":"Expected { type: \"evidence\" | \"suspect\" | \"event\", id }"}` — identical to TC-09.
- Verdict reason: exact match.

## TC-11 — `/viewed` rejects an invalid `type` value: PASS
- Command / action run: `curl -s -i -X POST http://localhost:4000/api/cases/047/viewed -H "Content-Type: application/json" -d '{"type":"document","id":"E014"}'`
- Observed: `HTTP/1.1 400 Bad Request`; body identical to TC-09/TC-10.
- Verdict reason: not a silent 200; same 400 error body as expected; state unaffected
  (confirmed via the shared follow-up check in TC-08/TC-14).

## TC-12 — Viewing evidence never decreases progress: PASS
- Command / action run: `GET /api/cases/047/investigation` (progress before) →
  `POST /viewed {"type":"evidence","id":"E003"}` (an id confirmed unviewed in the current
  state, since the test-case's suggestion of "any unviewed id" required picking one that
  actually was unviewed — `E014`/`E015`/`E001`/`E002` were already viewed) → `GET
  /api/cases/047/investigation` again → `POST /viewed` the same `E003` again to confirm
  no decrease/duplication effect.
- Observed: progress 18 → 19 (after viewing new `E003`) → 19 (after re-viewing `E003`,
  unchanged). `evidenceViewed` grew from `["E014","E015","E001","E002"]` to
  `[...,"E003"]`, both integers in range.
- Verdict reason: progress is monotonic non-decreasing across both a fresh view (18→19) and
  a repeat view (19→19), matching expected. Also consistent with TC-06/TC-07 above, where
  re-viewing an already-viewed item left `progress` at 18 throughout.

## TC-13 — Evidence with `locationId: null` returns `location: null` in the API: PASS
- Command / action run: `curl -s http://localhost:4000/api/evidence/E015` and
  `curl -s http://localhost:4000/api/evidence/E016`
- Observed: both 200. `E015`: `"locationId":null,"location":null`, `"timestamp":"1984-03-05T00:00:00","time":"00:00"`.
  `E016`: `"locationId":null,"location":null`, `"timestamp":"1984-03-08T00:00:00","time":"00:00"`.
- Verdict reason: `locationId`/`location` are real JSON `null`, not omitted and not the
  string `"null"`; `timestamp`/`time` are populated (non-null) for both, matching expected.

## TC-14 — `POST /viewed` under a caseId other than 047 is rejected: PASS
- Command / action run: `curl -s -i -X POST http://localhost:4000/api/cases/048/viewed -H "Content-Type: application/json" -d '{"type":"evidence","id":"E014"}'`, then
  `curl -s http://localhost:4000/api/cases/047/investigation`
- Observed: `HTTP/1.1 404 Not Found`; body `{"error":"Case not found"}`. Follow-up
  `evidenceViewed` unchanged at `["E014","E015","E001","E002","E003"]` (reflecting TC-12's
  addition of `E003`, not any effect from this call).
- Verdict reason: caseId guard fires before evidence/viewed logic; call under case 048 had
  no effect on case 047's state, as expected.

## TC-15 (UI) — Null `locationId`/`timestamp` render without crashing: PASS
- Command / action run: `test-case-runner` itself still had no browser tool in this run
  (platform tool-caching quirk — see TC-17), so the orchestrating session drove the
  installed `playwright` plugin's MCP server directly against `E015` ("Loan Default
  Notice", `locationId: null`): `docs/qa/_plugin-usage/09-evidence-detail-null-fields.png`.
- Observed: the detail panel renders cleanly with `PLACE: Off-site` — a graceful fallback
  label, not a crash, not the literal string `"null"`. The card also correctly flipped to
  `[ EXAMINED ]`, confirming a real `POST /viewed` fired from the click.
- Verdict reason: matches expected — the null-`locationId` case renders gracefully,
  confirmed visually rather than inferred from source.

## TC-16 (UI, code audit) — No evidence title, summary or timestamp is hardcoded in a `.jsx` file: PASS
- Command / action run: `grep -rn "Keycard Access|Loan Default Notice|Telephone Company Call Records" frontend/src --include="*.jsx" --include="*.js"` and a broader sweep for
  distinctive `summary`/`details` substrings (`"opened Storage Room B"`, `"owes $38,500"`,
  `"Kessler-Ward"`); also manually read `frontend/src/pages/LandingPage/sections/Evidence.jsx`
  (an additional evidence-rendering `.jsx` found via `find frontend/src -iname "*evidence*"`)
  since it wasn't named in the test case but renders evidence items.
- Observed: zero matches in both greps. `EvidenceCard.jsx` and `EvidenceRoom.jsx` render only
  via `item.*`/`detail.*` props. `LandingPage/sections/Evidence.jsx` also renders only via
  `item.id`, `item.title`, `item.time`, `item.location` — no literal evidence copy.
- Verdict reason: matches expected — all evidence text is sourced from props/API data, never
  a hardcoded string literal, across every `.jsx` file found that touches evidence data.

## TC-17 (UI) — Client-side type filter narrows the visible list without a server call: PASS
- Command / action run: via the `playwright` plugin (same method as TC-15), navigated to
  `/evidence`, captured the network request list (12 requests, all the six `GET /cases/047*`
  endpoints fetched twice each — normal `useCase` hook behavior), clicked the `FORENSIC`
  filter tab by its exact accessibility ref, then captured the network list again.
- Observed: `docs/qa/_plugin-usage/17-evidence-filter.png` shows the list narrowed to exactly
  the 3 forensic items (`E001`, `E002`, `E013`) with the `FORENSIC` tab now active/highlighted.
  Network request count was unchanged (12 before, 12 after) — no new request fired for the
  filter click.
- Verdict reason: matches expected — filtering is purely client-side, confirmed by an
  unchanged network request count, not inferred from source.

## Summary
Total: 17 | Pass: 17 | Fail: 0 | Blocked: 0
Failures needing attention: none
- re-run with a browser tool (e.g. Playwright MCP) attached before sign-off, since TC-15
touches spec point 7's UI half and TC-17 is a smoke check on filter behavior.
