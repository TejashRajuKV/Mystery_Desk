# SPEC — Detective's Notes

## What it does

The Notes page (`/case/:caseId/notes`, formerly the Assistant) is a rule-based
analyst. The player never types a question: they pick from predefined prompts (what
doesn't add up, review a suspect's statement, review a half-hour window, compare two
clues, review my theory). Answers come only from evidence the player has examined,
never name the culprit, and always have a fixed shape. `POST /assistant/query`
still exists with an unchanged shape.

## Endpoints involved

```
GET  /api/cases/:caseId/notes
POST /api/cases/:caseId/notes            { promptId, items? }
GET  /api/cases/:caseId/facts/:suspectId
POST /api/cases/:caseId/assistant/query  { question }
POST /api/cases/:caseId/contradictions   { assertionId, evidenceId }
POST /api/cases/:caseId/reset
```

## What "correct" means

1. `GET /notes` returns prompts each with `id` and `label`; some (e.g. `connect`)
   carry `picks` (how many items to choose). Per-suspect statement prompts are
   ids of the form `statement:S0x`.
2. `POST /notes` with a valid prompt returns the assistant shape: `answer`,
   `confidence` (one of `high`, `medium`, `low`), `relatedEvidence`,
   `relatedSuspects`, `relatedEvents`, `contradiction` (boolean), plus `promptId`
   and `title`; `contradictions` is present only when `contradiction` is true; statement
   and theory prompts may also carry `facts`.
3. An unknown `promptId` is a 404; a malformed body or unknown/invalid `items` is
   a 400.
4. On a fresh investigation (nothing examined) notes answer without inventing
   facts: `confidence` is `low`, related lists are empty (or contain only what the
   player has examined). Every id in `relatedEvidence` is an unlocked exhibit.
5. Every id in the related lists exists in the case; every
   `contradictions[].assertionId/evidenceId` pair is a real contradiction the
   `POST /contradictions` endpoint would accept.
6. No answer, in any state, contains the culprit's identity as a conclusion or any
   `solution` data.
7. `GET /facts/:suspectId` returns `{ suspectId, name, lines }` where each line has
   `mark` (`✓` or `?`) and `text`; claims not yet disproved are `?`, and true
   claims stay `?` forever. Unknown suspect is a 404.
8. `POST /assistant/query` with an off-topic question returns 200 with
   `confidence: "low"`, empty related lists, and an answer saying what it can help
   with. A missing/empty `question` is a 400.
9. After examining evidence that contradicts a statement, the matching notes prompt
   returns `contradiction: true` with a pair, and logging it via the UI button
   records it in `investigation.contradictionsFound`.
10. In the browser: the prompts are buttons from the API (no free-text box);
    choosing one shows a typed/loaded answer; related ids render as clickable cards;
    a contradiction shows a "log this contradiction" button; the network-error state
    offers retry.

## Out of scope

Answer wording beyond the shape; the assistant's tone.
