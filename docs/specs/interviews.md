# SPEC — Interviews, Suspects and Statements

## What it does

The player questions people in person, in a full-screen InterviewScene, by choosing
from a list of questions (number keys work). A person's reactions depend on story
state: what evidence the player has examined and flags set by earlier choices, file
reading and searching. Some choices unlock evidence, set flags (a person may lawyer
up or turn hostile and lock routes), or reveal a contradiction. The player may put
an unlocked exhibit on the table for the person to react to. The People page
(`/case/:caseId/people`) lists the five suspects with their files and statements,
and lets the player test a statement's claim against an exhibit.

## Endpoints involved

```
GET  /api/cases/:caseId/suspects            GET /api/cases/:caseId/suspects/:id
GET  /api/cases/:caseId/statements
GET  /api/cases/:caseId/dialogue/:suspectId
POST /api/cases/:caseId/dialogue/:suspectId/choice   { choiceId } | { presentEvidenceId }
POST /api/cases/:caseId/contradictions       { assertionId, evidenceId }
POST /api/cases/:caseId/viewed               { type: "suspect", id }
POST /api/cases/:caseId/reset
```

## What "correct" means

1. `GET /suspects` returns 5 suspects, each with `id` (`S\d+`), `name`, `alias`,
   `role`, `motive`, and not any solution data. An unknown suspect id is a 404.
2. `GET /statements` returns one statement per suspect, each with `id` (`ST\d+`),
   `suspectId`, `takenAt`, `text`, and `assertions` of only `{ id, claim }`
   (no `kind` or parameters leaked).
3. `GET /dialogue/:suspectId` returns `nodeId`, `speaker`, `speakerName`, `text`,
   optional `narration`, `mood`, `canPresent`, and `choices` (each `id`, `label`,
   `asked`, `leaves`). Unknown suspect is a 404.
4. Only choices whose `requires` are met are listed; a choice with unmet
   `requires` submitted directly is a 422 with a generic reason.
5. `POST /choice { choiceId }` for a listed choice returns `{ dialogue, ended,
   effects, investigation }`; the new node follows the choice; `asked` becomes true
   for that choice afterward; `question` time (10 min) is spent for a new question.
6. A choice with an unlock consequence puts the exhibit into
   `effects.unlockedEvidence` and `investigation.unlockedEvidence`.
7. A choice id not on the current node, or a missing `choiceId`, is rejected
   (422 for a wrong id, 400 for missing).
8. `POST /choice { presentEvidenceId }` needs an unlocked exhibit (422 for a locked
   or unknown one), marks it viewed, costs 10 minutes, and returns `presented`
   with `reaction` of `"reaction"` or `"unmoved"`.
9. Leaving the interview and calling back resumes the same node (progress is server
   state); refreshing the page does not lose it.
10. Contradictions revealed through an interview appear in
    `investigation.contradictionsFound`, each backed by a real statement claim and
    exhibit pair. `POST /contradictions` with a real pair records it once (no
    duplicates); a pair that is not a real contradiction is a 422.
11. `POST /viewed { type: "suspect", id }` adds the id to `suspectsViewed` once, in
    first-viewed order; an unknown id is rejected.
12. After the case is closed, any interview choice is a 422.
13. In the browser: the interview scene shows the speaker name, typed text and
    choices from the API; the interviewee must be at the place the player is at;
    picking a choice advances the line; the evidence tray only lists unlocked
    exhibits; presenting one shows the presentation moment.
14. The People page lists 5 people matching the API; the statement test control
    lets a claim be tested against an exhibit and shows whether it holds up;
    a confirmed contradiction is logged and survives a refresh.
15. Interview error state: with the backend down, a choice shows an error with a
    retry instead of freezing.

## Out of scope

Voice audio files; portrait art; full coverage of every dialogue branch (test the
structure and a representative path per behaviour).
