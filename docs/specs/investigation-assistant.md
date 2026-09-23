# SPEC — Investigation Assistant

## What it does

A rule-based (not LLM-backed) analyst that answers three kinds of question from the
real case data: what contradicts a suspect's statement, what happened in a time
window, and what evidence ties a suspect to a location. It never sees
`solution.json` and never returns loose prose — always the fixed response shape.

## Endpoints involved

```
POST /api/assistant/query    { question: "<free text>" }
```

## Inputs

- `question`: free-text string. Recognized shapes (per PRD §10): a suspect name +
  "contradict"/"lie" wording, an `HH:MM`–`HH:MM` time window, a suspect name +
  location wording. Anything else falls through to the "low confidence" default.

## What "correct" means

1. Every response is exactly this shape — no loose text ever:
   `{ answer, confidence, relatedEvidence[], relatedSuspects[], relatedEvents[],
   contradiction, contradictions? }`.
2. `confidence` is always one of `"high" | "medium" | "low"` — never any other value.
3. A question naming a suspect and asking about lies/contradictions (e.g. "Does Alex
   Reyes's statement contradict any evidence?") returns `contradiction: true` when a
   real contradiction exists for that suspect, with `contradictions[]` populated,
   and every ID in `relatedEvidence`/`relatedSuspects`/`relatedEvents` existing in
   the DB (per PRD §10: "check every ID exists").
4. A question about a time window (e.g. "What happened between 21:00 and 22:00?")
   returns `relatedEvents` restricted to events whose `timestamp` falls in that
   window.
5. A question asking what ties a suspect to a location returns `relatedEvidence`
   items whose `personIds`/`locationId` actually connect that suspect and place.
6. A question matching none of the three kinds (e.g. "what's the weather") returns
   200 (never 4xx/5xx) with `confidence: "low"`, empty related-ID arrays, and an
   answer describing what it can help with.
7. `contradictions` is present in the JSON only when `contradiction` is `true` —
   absent (not `null`, not `[]`) otherwise, per the documented shape.
8. No network call is made and no API key is read — confirm by checking there is no
   outbound request when `/assistant/query` is called (this is a structural/code
   check, not just a runtime one).

## Out of scope

Open-ended conversation, follow-up context across turns, anything requiring the
solution key.
