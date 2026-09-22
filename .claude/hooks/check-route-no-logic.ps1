# .claude/hooks/check-route-no-logic.ps1
# PostToolUse hook: After editing a backend route file, warns if the route
# handler contains business logic instead of delegating to a service.
# CLAUDE.md: "Routes stay thin — they parse the request and call a service.
# Logic goes in services/, never in a route handler."

$callInput = [Console]::In.ReadToEnd() | ConvertFrom-Json
$filePath = $null

if ($callInput.tool_input.file_path) {
    $filePath = $callInput.tool_input.file_path
}
elseif ($callInput.tool_input.path) {
    $filePath = $callInput.tool_input.path
}

if (-not $filePath) { exit 0 }

# Only check backend route files
if ($filePath -notmatch 'backend[/\\]src[/\\]routes[/\\]') { exit 0 }
# Skip index.js (the router aggregator)
if ($filePath -match 'routes[/\\]index\.js$') { exit 0 }

if (-not (Test-Path $filePath)) { exit 0 }

$content = Get-Content $filePath -Raw -ErrorAction SilentlyContinue
if (-not $content) { exit 0 }

$warnings = @()

# Check for direct database access in routes
if ($content -match 'db\.(prepare|exec|run)\(' -or $content -match "from\s+['\"].*database") {
    $warnings += "Direct database access in route file — use a service"
}

# Check for complex logic patterns (multiple if/else, loops over data)
$ifCount = ([regex]::Matches($content, '\bif\s*\(')).Count
if ($ifCount -gt 4) {
    $warnings += "Route has $ifCount conditionals — business logic belongs in services/"
}

if ($warnings.Count -gt 0) {
    $warningText = $warnings -join "; "
    @{
        hookSpecificOutput = @{
            hookEventName = "PostToolUse"
        }
        notification = "ARCHITECTURE WARNING in $filePath`: $warningText. Per CLAUDE.md, routes stay thin: parse the request, call a service."
    } | ConvertTo-Json -Depth 5
}
else {
    exit 0
}
