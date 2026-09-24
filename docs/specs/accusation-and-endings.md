# SPEC — Accusation, Endings and Report

## What it does

At `/case/:caseId/accuse` the player picks who did it (or "cannot determine"),
presents the evidence that proves it, and confirms; the accusation is final. Time
running out forces this screen. The backend fixes one of five endings from what the
player did, then the report is generated from their actual connections, evidence,
contradictions and reviewed timeline. Play Again / New Investigation resets the case.

## Endpoints involved

```
PUT  /api/cases/:caseId/theory        { text }
POST /api/cases/:caseId/conclusion    { suspectId | null, evidenceIds }
GET  /api/cases/:caseId/report
POST /api/cases/:caseId/reset
GET  /api/cases
```

## What "correct" means

1. `PUT /theory { text }` saves the text and returns the whole investigation state;
   the theory persists across refresh. A non-string `text` is a 400.
2. `POST /conclusion` with a malformed body (e.g. `suspectId` a string but
   `evidenceIds` missing or empty) is a 400.
3. `{ suspectId: null }` ("cannot determine") needs no evidence and is accepted with
   ending `criminal_escapes`.
4. An unknown suspect id, or a cited exhibit that doesn't exist or is locked, is a
   422.
5. Any other well-formed accusation is accepted (200) with `{ suspectId,
   evidenceIds, ending }`, where `ending` is one of `perfect_investigation`,
   `true_criminal`, `criminal_escapes`, `wrong_suspect`, `innocent_accused`.
   Duplicate cited ids are collapsed.
6. A second `POST /conclusion` after one is accepted is a 422 (case closed), and
   `investigation.conclusion` holds the accepted one.
7. Rejection or acceptance never names what evidence is missing, and a wrong
   suspect with thin evidence cannot be told apart from the right suspect with thin
   evidence (both are accepted with an ending).
8. `GET /report` before a conclusion is accepted is a 422; after, it returns `case`,
   `title`, `primarySuspect` (null for cannot-determine), `ending` (`id`, `title`,
   `stamp`, `verdict`, `narrative`, and `whatHappened` only for
   `perfect_investigation` / `true_criminal`, else null), `theory`,
   `supportingEvidence`, `timeline`, `contradictions`, `connections`.
9. The report reflects what was actually done: `supportingEvidence` is exactly the
   cited exhibits; `contradictions` and `connections` match investigation state; the
   ending copy has the accused's name filled in.
10. After acceptance, `GET /cases` shows this case `status: "closed"` with the
    ending `id`/`title`/`stamp`; interview choices and travel/search are 422s.
11. `POST /reset` returns a fresh investigation state (no conclusion, no connections,
    no contradictions, minutesUsed 0), after which the case is `new` again in
    `GET /cases` and the accusation can be made again.
12. Ending outcomes can be exercised at least for: cannot determine
    (`criminal_escapes`), and one innocent accused with no support
    (`innocent_accused`). Do not attempt to learn the culprit by elimination via
    repeated accusations; reset between attempts is allowed. Any ending that
    can't be reached without knowing the answer key is marked BLOCKED, not guessed.
13. In the browser: the accusation is a choice list with a confirm step before it
    is final; the ending screen shows the ending's title/stamp/verdict from the API;
    the report opens after it; the closed state is shown on reload; Play Again resets
    and clears the board layout.
14. Time up: when `minutesLeft` is 0 the UI forces the accusation screen (mark
    BLOCKED with the reason if the clock can't be run out in a practical way).

## Out of scope

Ending screen animation; culprit-specific evidence coverage.
