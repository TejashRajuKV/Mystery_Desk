# Superseded test expectations — 2026-09-25

The 2026-09-25 fixes (plan: `docs/plans/2026-09-25-qa-bug-fixes.md`, owner decisions D1–D6) change what some
existing test cases expect. Those cases are **kept exactly as written**; this file records which expectation is now
out of date, what the app does instead, and why. Each suite's `test-cases.md` also ends with a
"Superseded by the 2026-09-25 fixes" section and a pointer here.

Decisions referenced: **D1-A** closed case freezes connections, contradictions and viewed · **D2-a** `presentEvidenceId: null`
is a spoken choice · **D3-b** oversized body is 413 "That request is too large." · **D4-B** evidence is findable at its own
place · **D5-a** the hostile 051 gardener needs E007 viewed · **D6** `/assistant/query` uses examined evidence only.

## Expectations that are now wrong

| Suite | Case | Old expectation | New behaviour | Cause |
| --- | --- | --- | --- | --- |
| board-and-connections | TC-43 | `POST /connections` on a closed case → 201 | 422 `{"error":"This case is closed."}` (new TC-57) | D1-A |
| board-and-connections | TC-44 | `DELETE /connections/:id` on a closed case → 204 | 422 closed for an existing id; unknown id still 404 (new TC-60/61) | D1-A |
| accusation-and-endings | TC-76 | `POST /connections` after close → 201 | 422 closed (new TC-92) | D1-A |
| accusation-and-endings | TC-77 | `DELETE /connections/:id` after close → 204 | 422 closed; unknown id still 404 (new TC-93) | D1-A |
| accusation-and-endings | TC-78 | `POST /contradictions` after close → 200 | 422 closed; unknown pair still 404 (new TC-94) | D1-A |
| accusation-and-endings | TC-79 | `POST /viewed` after close → 200 | 422 closed; unknown/locked still 404 (new TC-95) | D1-A |
| timeline-known-events | TC-23 | `POST /viewed` event on a closed case → 200 | 422 closed (new TC-32) | D1-A |
| interviews | TC-39 | `POST /viewed` suspect on a closed case → 200 | 422 closed (new TC-56) | D1-A |
| evidence-collection | TC-41 | `POST /viewed` evidence on a closed case → 200 | 422 closed (new TC-52) | D1-A |
| case-start-and-file | TC-27 (second half) | Re-reading an already-read page on a closed case → 200 | 422 closed (TC-47) | commit b45dd98 (before these fixes; listed for completeness) |
| edge-cases | EC-48 | Hostile gardener shown E005 alone gives up E006 | Needs E007 viewed first; alone he is unmoved (new EC-63) | D5-a |
| edge-cases | EC-59 | Oversized theory body → 413 `"request entity too large"` | 413 `"That request is too large."` | D3-b |
| edge-cases | EC-54 (viewed/contradictions line) | `POST /viewed` and `POST /contradictions` still 200 after close | 422 closed (new EC-69) | D1-A |

## Expectations that now pass (were failing or flagged on 2026-09-24)

| Suite | Case | Before | Now | Cause |
| --- | --- | --- | --- | --- |
| edge-cases | EC-20 | `{choiceId, presentEvidenceId: null}` → 422 | 200, a spoken choice | D2-a |
| edge-cases | EC-36 | Board not frozen after close | Frozen | D1-A |
| edge-cases | EC-42 / EC-43 | 050 windows missed events around and after midnight | Covered, dated labels on later days (new EC-67) | window fix |
| edge-cases | EC-47 | Five exhibits lockable by one bad choice | Each has a second route; seed check enforces it (new EC-64..66, EC-70) | D5-a + lockout check |
| edge-cases | EC-50 | 047 E005 found away from its place | Found at its place; seed check enforces it | D4-B |
| detective-notes | TC-75 | `/assistant/query` used unlocked-but-unviewed evidence | Examined evidence only (new TC-79) | D6 |

## Notes from the writers

- **edge-cases EC-50:** its check only looks at search spots, so it now passes for exhibits found through an interview
  too (047 E006). The new seed check covers interviews; widening EC-50 itself is left to its author.
- **detective-notes, city-map-and-places:** no existing expectation was made wrong by these fixes.
- **city-map-and-places TC-63 / TC-67** flag a possible gap in case 049 (threatening S04 before visiting `L06-sister`);
  the 2026-09-25 re-run settles it with a live test.
