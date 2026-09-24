# SPEC — City Map, Travel, Places and Searching

## What it does

The city map (`/case/:caseId/map`) is a street plan drawn from the case data, with
the case's six places on it. The player travels to a place (costs time), which opens
`/case/:caseId/place/:locationId`. A place shows an arrival description, the people
who can be found there, and spots to search. Searching a spot (costs time, once per
spot) can turn up evidence or set flags. You can only talk to someone where they
are. Evidence is collected in the field, never handed out.

## Endpoints involved

```
GET  /api/cases/:caseId/places
POST /api/cases/:caseId/travel               { locationId }
GET  /api/cases/:caseId/places/:locationId
POST /api/cases/:caseId/places/:locationId/search   { spotId }
POST /api/cases/:caseId/reset
```

## What "correct" means

Case 047 has places L01 Main Laboratory (people S01, S02), L02 Communications Room
(S05), L03 Storage Room B (nobody), L04 Executive Office (S03), L05 Parking Garage
(nobody), L06 Lobby & Security Desk (S04). Verify against the API, not this list.

1. `GET /places` returns 6 places, each with `id`, `name`, `floor`, `description`,
   `map` (x, y, kind), `people` (id, name, role, alias), `visited`, `here`.
2. On a fresh investigation no place is `visited`.
3. `POST /travel { locationId }` to a new place costs 30 minutes, sets that place
   `here: true` and `visited: true`, and returns `{ place, investigation }`.
4. Travelling to the place you are already at costs 0 minutes.
5. `travel` with a missing `locationId` is a 400; an unknown place id is a 404.
6. `GET /places/:locationId` for a place you are not standing in is a 422 ("go there
   first"); for the current place it returns `arrival`, `people`, and `spots` with
   `id`, `label`, `searched`.
7. `POST .../search { spotId }` costs 15 minutes the first time, marks the spot
   `searched`, and returns the spot's text plus `effects.unlockedEvidence` for any
   exhibit newly found. Searching the same spot again costs 0 and unlocks nothing new.
8. Searching from a place you are not at is a 422; a missing `spotId` is a 400; a
   spot id that isn't in this place is a 404.
9. Evidence unlocked by a search appears in `GET /evidence` and
   `investigation.unlockedEvidence`; evidence not yet found does not.
10. When `minutesLeft` reaches 0, further travel/search is a 422 ("Time is up").
    (Exercise this by spending time with repeated actions or noting how it was
    reached; if impractical to reach, mark BLOCKED with the reason.)
11. In the browser the map shows six labelled places whose names match the API,
    clicking one travels there (scene transition), and the place page shows arrival
    text, people and spots from the API. Searching a spot shows what turned up and
    a notice for new evidence; the HUD clock advances by the right amount.
12. Loading `/case/047/place/L01` directly without having travelled there shows a
    sensible state (redirect to map or a message), not a crash.

## Out of scope

Map artwork; per-case street names.
