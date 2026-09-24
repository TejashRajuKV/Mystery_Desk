# SPEC — Case Start, Case Clock and Case File

## What it does

`/case/:caseId` opens on CaseStart: the case brief and a choice of reading the case
file or going straight out to the city map. The case file (`/case/:caseId/file`) has
several pages; each unread page costs case time when read, its body is only revealed
once read, and reading a page sets a story flag (`file.<pageId>`) and may hand over
paperwork (its `attachments`), which unlocks those exhibits. Skipping the file has
consequences later (interviews check the file flags). A HUD shows the case clock.

## Endpoints involved

```
GET  /api/cases/:caseId
GET  /api/cases/:caseId/file
POST /api/cases/:caseId/file/:pageId/read
GET  /api/cases/:caseId/investigation
POST /api/cases/:caseId/reset
```

## What "correct" means

Time costs (minutes on the case clock): read a page 20, travel 30, search a spot 15,
question 10, present evidence 10. Case 047's clock is 16 hours from 08:15.

1. `GET /file` returns the pages with `id`, `title`, `read`, `body`, `attachments`.
   On a fresh investigation every `body` is null, `read` is false and
   `attachments` is empty. `GET /cases/:caseId` does not include the page bodies.
2. `POST /file/:pageId/read` returns the page (now with its body), the updated
   `investigation`, and `effects.unlockedEvidence` (possibly empty).
3. The first read of a page increases `investigation.clock.minutesUsed` by 20.
   Reading the same page again costs nothing and unlocks nothing new.
4. Reading a page that has attachments adds those exhibit ids to
   `investigation.unlockedEvidence`; reading a page without attachments unlocks none.
5. Reading a page sets `storyFlags["file.<pageId>"]` to true.
6. An unknown page id is a 404.
7. `investigation.clock` has `start`, `deadline`, `now`, `minutesUsed`,
   `minutesLeft`, `timeUp`; `deadline` is `start` plus `clockHours`, and
   `minutesLeft` decreases as actions are taken.
8. On a fresh case `unlockedEvidence` is empty (no exhibit is handed out for free)
   and `GET /evidence` returns an empty list.
9. After `POST /reset`, minutesUsed is 0, flags are cleared, pages are unread again
   and unlocked evidence is back to the default.
10. In the browser CaseStart shows the brief from the API and offers the two
    choices (read the file / go out). Reading a page in CaseFile reveals its body,
    updates the HUD clock, and shows a notice if paperwork was added.
11. The HUD clock in the browser matches `clock.now` / `minutesLeft` from the API and
    survives a page refresh.

## Out of scope

Page copy; the exact consequences of skipping the file inside interviews (see
`interviews`).
