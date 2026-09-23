---
description: Run the full spec-driven QA pipeline (write test cases, then run them) for one or more MysteryDesk features, chaining the test-case-writer and test-case-runner subagents automatically.
argument-hint: [feature-slug ...]  (matches docs/specs/<slug>.md; omit to run every spec in docs/specs/)
---

You are orchestrating the spec-driven QA pipeline for this project. Do not write test
cases or run tests yourself — that is what the two subagents below are for. Your job
here is sequencing, verification, and reporting.

Feature slugs requested: $ARGUMENTS

## Step 0 — Resolve the feature list

If no arguments were given, list every `*.md` file in `docs/specs/` and use each
filename (without `.md`) as a feature slug. Otherwise use exactly the slugs given.
For each slug, confirm `docs/specs/<slug>.md` exists; if it doesn't, report that slug
as skipped (missing spec) and continue with the rest — do not invent a spec.

## Step 1 — For each feature, in order

1. Use the **Task tool** to launch the `test-case-writer` subagent with an explicit
   instruction naming this feature: read `docs/specs/<slug>.md` and write
   `docs/qa/<slug>/test-cases.md`. Wait for it to finish before continuing.
2. Verify `docs/qa/<slug>/test-cases.md` now exists and is non-empty. If the subagent
   did not produce it, stop for this feature and report the failure — do not proceed
   to running tests that don't exist.
3. Use the **Task tool** to launch the `test-case-runner` subagent with an explicit
   instruction naming this feature: read `docs/qa/<slug>/test-cases.md`, run every
   case against the live app (backend `http://localhost:4000`, frontend
   `http://localhost:5173` — remind it to check both are up before starting), and
   write `docs/qa/<slug>/results.md`. Wait for it to finish.
4. Verify `docs/qa/<slug>/results.md` now exists. Read its `## Summary` section.

Process features strictly one at a time — do not launch the runner for a feature
before its writer has finished, and do not launch two features' subagents
concurrently, since they share the same running app/database state.

## Step 2 — Final report

After all requested features are processed, print a single table to the user:

| Feature | Test cases | Pass | Fail | Blocked |
|---|---|---|---|---|

sourced from each feature's `results.md` summary line, plus a short list of any
features that were skipped (missing spec) or where a subagent failed to produce its
file. Do not mark anything "done" that you didn't verify by reading the actual output
file.
