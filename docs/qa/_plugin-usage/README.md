# Installed plugin: `playwright` (Claude Code, official marketplace)

## What and why

Installed from `claude-plugins-official` at **project scope** (`claude plugin install
playwright@claude-plugins-official -s project`), so it's registered in
`.claude/settings.json` under `enabledPlugins` and any teammate who clones this repo
and runs Claude Code here gets it too. It bundles Microsoft's Playwright MCP server
(`npx @playwright/mcp@latest`) — real browser automation: navigate, click, fill forms,
take screenshots, read the accessibility tree, read console/network output.

It's relevant here because MysteryDesk is explicitly a screen-by-screen, data-driven
UI (CLAUDE.md: "Do not build a frontend mockup... every screen gets its data from the
backend") with **no automated tests in the repo**. The `test-case-runner` subagent
(`.claude/agents/test-case-runner.md`) needs a way to verify UI-level spec points —
"no hardcoded case data", "renders a null field without crashing", "the board really
is empty until something is pinned" — that a `curl` call against the API can't see.
Playwright is that way in.

## Proof it fired

This Claude session's own tool registry couldn't hot-load the plugin's MCP server
mid-session (MCP servers are normally wired up at session start), and a nested
`claude -p` session hit an expired OAuth token on this machine — so instead of
skipping the "actually use it" requirement, the exact server command the plugin
declares in its manifest (`.claude-plugin/plugin.json` / `.mcp.json`:
`npx @playwright/mcp@latest`) was driven directly over the MCP protocol (JSON-RPC 2.0
over stdio) from a small script, run twice:

1. **First fire** — `initialize` → `tools/list` (returned the real 25-tool Playwright
   MCP surface: `browser_navigate`, `browser_click`, `browser_take_screenshot`,
   `browser_snapshot`, `browser_evaluate`, `browser_network_requests`, …) →
   `browser_navigate` to `http://localhost:5173/` → `browser_take_screenshot`.
   Full JSON-RPC transcript, including the server's own `serverInfo` (`"name":
   "Playwright"`, real version string), is not committed (transient, machine-specific)
   but the resulting screenshot and console capture are: [`00-first-fire-landing.png`](00-first-fire-landing.png),
   [`first-fire-console.log`](first-fire-console.log).
2. **Full tour** — the same server driven through all 8 screens of the real, running
   app (backend on :4000, frontend on :5173, both started from this repo's own
   `npm run dev`): [`01-case-entry.png`](01-case-entry.png) through
   [`08-report.png`](08-report.png), plus [`tour-log.json`](tour-log.json) (the
   Playwright MCP server's own per-step text report — page title, URL, console/network
   event references).

Every screenshot shows **real seeded data** (case #047, "THE MISSING PROTOTYPE", the
five real objectives, 0/18 · 0/5 · 0/12 counts, a genuinely empty board with the real
"PIN TO BOARD" control) served by this repo's own backend — not a mock or a
placeholder image.

3. **Full subagent pipeline + UI supplementary pass** — after this was written, the
   harness's custom-agent registry synced up (it refreshes between conversation turns,
   not mid-turn) and `test-case-writer`/`test-case-runner` became genuinely invokable via
   the Task tool, with the plugin's own tools (`mcp__plugin_playwright_playwright__*`)
   appearing too. `test-case-runner.md`'s tool allowlist was updated to include them —
   but each spawned runner still reported only `Bash, Read, Write, Glob`, confirming a
   real platform quirk: a subagent type's tool list is snapshotted the first time it's
   discovered, and editing the `.md` file afterward doesn't reach new spawns within the
   same session. Rather than leave every UI-marked test case `BLOCKED` on that account,
   the orchestrating session drove the plugin directly (same method as above) to fill
   them in for real: [`13-dashboard-current-state.png`](13-dashboard-current-state.png),
   [`14-timeline-t10-empty-personids.png`](14-timeline-t10-empty-personids.png),
   [`15-assistant-query-response.png`](15-assistant-query-response.png) (a real submitted
   question rendered as interactive cards, matching the API response field-for-field),
   [`16-board-state.png`](16-board-state.png) (confirms the `mysterydesk:board:047`
   `localStorage` key and that board layout survives a reload byte-identically), and
   [`17-evidence-filter.png`](17-evidence-filter.png) (confirms the type filter is
   client-side — network request count unchanged before/after).

## How `test-case-runner` uses it going forward

`test-case-runner.md`'s tool allowlist now includes the Playwright plugin's tools by
name. A **fresh** `claude` session started in this repo (not one already mid-session
when the plugin was installed or the agent file was edited) should have both the
top-level session and any subagents it spawns pick up the current tool list from the
start, avoiding the snapshot issue described above. If a UI case still comes back
`BLOCKED` in a future run, check whether the runner's own tool list actually contains
`mcp__plugin_playwright_playwright__*` before assuming the plugin isn't installed.
