# .claude/hooks/check-api-response-shape.ps1
# PostToolUse hook: After writing/editing backend route or controller files,
# checks that responses aren't wrapped in { data: ... }.
# CLAUDE.md: "Responses are the resource itself, not wrapped in { data: ... }"

$callInput = [Console]::In.ReadToEnd() | ConvertFrom-Json
$filePath = $null

if ($callInput.tool_input.file_path) {
    $filePath = $callInput.tool_input.file_path
}
elseif ($callInput.tool_input.path) {
    $filePath = $callInput.tool_input.path
}

if (-not $filePath) { exit 0 }

# Only check backend route and controller files
if ($filePath -notmatch 'backend[/\\]src[/\\](routes|controllers)[/\\]') { exit 0 }

if (-not (Test-Path $filePath)) { exit 0 }

$content = Get-Content $filePath -Raw -ErrorAction SilentlyContinue
if (-not $content) { exit 0 }

# Check for wrapped responses: res.json({ data: ... })
if ($content -match 'res\.json\(\s*\{\s*data\s*:') {
    @{
        hookSpecificOutput = @{
            hookEventName = "PostToolUse"
        }
        notification = "API SHAPE WARNING in $filePath`: Found res.json({ data: ... }). Per CLAUDE.md, the response body IS the resource - never wrap it in { data: ... }. Errors use { error: 'message' }."
    } | ConvertTo-Json -Depth 5
}
else {
    exit 0
}
