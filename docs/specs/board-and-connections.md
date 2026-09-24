# SPEC — Investigation Board and Connections

## What it does

The board (`/case/:caseId/board`) is where the player pins cards (evidence, suspects,
timeline events, locations, statement claims) and links two of them with a string.
Which cards are pinned and where is per-viewer UI state in `localStorage`, keyed per
case. The connections themselves are backend state. The backend validates a link but
never says whether it is "right".

## Endpoints involved

```
GET    /api/cases/:caseId/connections
POST   /api/cases/:caseId/connections            { source, target, relationship? }
DELETE /api/cases/:caseId/connections/:id
GET    /api/cases/:caseId/investigation
POST   /api/cases/:caseId/reset
```

## What "correct" means

1. A fresh investigation has no connections (`GET /connections` returns `[]`).
2. `POST /connections` with two valid, distinct ids returns 201 with `{ id, source,
   target, relationship }`, where `id` is `C\d+` and `relationship` defaults to
   `linked_to`.
3. `source` and `target` may each be an evidence (`E`), suspect (`S`), timeline
   event (`T`), location (`L`) id, or a statement claim id (`ST02-A` form), provided
   it exists for this case (and an exhibit must be unlocked).
4. Unknown ids are rejected (422); a self-link is rejected (422); a duplicate is
   rejected (422) in either direction (A→B then B→A). A missing `source` or `target`
   is a 400.
5. Rejection reasons never say whether a link is right or wrong for the case.
6. `DELETE /connections/:id` returns 204 and the connection disappears from
   `GET /connections` and `investigation.connections`; an unknown id is a 404.
7. Connection ids are not reused in a confusing way after deletion (public IDs);
   a new connection after a delete still gets a unique `C\d+` id.
8. `investigation.connections` matches `GET /connections`.
9. In the browser: cards can be pinned and dragged; clicking two cards creates a
   connection through the API (a line is drawn); refreshing keeps both the
   connections (server) and the pinned layout (localStorage); removing a connection
   removes the line and the API record; layout for one case does not appear in
   another case.
10. Layout in `localStorage` is cleared by Play Again / reset; connections are
    cleared by `POST /reset`.

## Out of scope

Drag physics; the line-draw animation.
