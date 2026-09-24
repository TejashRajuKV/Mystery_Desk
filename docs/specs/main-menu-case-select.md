# SPEC — Main Menu and Case Select

## What it does

`/` is the game's main menu (a noir office scene with menu choices, including a
"How to play" casebook). `/cases` is the desk: one folder per case (047 industrial
theft, 048 murder, 049 bank heist, 050 grand theft auto, 051 poisoning). Each folder
shows the case's title, crime, difficulty, teaser and a status (new / in progress /
closed, plus the ending stamp once closed). Selecting a folder shows the brief with a
READ MORE option, and a way to take the case, which goes to `/case/:caseId`. Any URL
that matches no route redirects to `/`.

## Endpoints involved

```
GET /api/cases
GET /api/cases/:caseId
```

## What "correct" means

1. `GET /api/cases` returns exactly 5 cases with ids `047`, `048`, `049`, `050`, `051`.
   Each has `id`, `title`, `crime`, `difficulty`, `teaser`, `summary`, `openedAt`,
   `site`, `deadlineNote`, `suspectCount`, `evidenceCount`, `locationCount`,
   `clockHours`, `status`, and `ending` (null unless closed).
2. Every case has 5 people and 6 places. Evidence counts per case are 18 (047),
   15 (048), 16 (049), 14 (050), 15 (051).
3. `status` is `new` for an untouched case, `in_progress` once any time has been
   spent or a file page read, `closed` once a conclusion is accepted. A closed case's
   `ending` carries `id`, `title` and `stamp`.
4. No `GET /cases` or `GET /cases/:caseId` response contains a solution, culprit,
   `requiredEvidence`, `requiredConnections`, or the file page bodies.
5. `GET /api/cases/999` is a 404 with `{ "error": "..." }`.
6. In the browser, `/` renders the main menu with no console errors, and reaching
   `/cases` shows five folders whose titles match the API.
7. Opening a folder shows the brief text from the API (not text hardcoded in the UI);
   READ MORE reveals more of the brief.
8. Taking the case navigates to `/case/<id>`; refreshing the page there keeps the
   player in the same case with state intact.
9. The How to play casebook opens from the main menu, explains mechanics only, and
   does not name any case's suspects or culprit.
10. Unknown routes (e.g. `/nowhere`) redirect to `/`; `/case/999` shows an error or
    not-found state, not a blank page or endless spinner.
11. With the backend unreachable, `/cases` shows an error state with a retry, not an
    infinite spinner.

## Out of scope

Sound and animation timing; the exact wording of the tutorial.
