# .claude/hooks/check-absolute-backend-url.ps1
# PostToolUse hook: After writing/editing frontend files, checks for
# absolute backend URLs. CLAUDE.md: "Frontend proxies /api to :4000;
# never call the backend on an absolute URL."

$callInput = [Console]::In.ReadToEnd() | ConvertFrom-Json
$filePath = $null

if ($callInput.tool_input.file_path) {
    $filePath = $callInput.tool_input.file_path
}
elseif ($callInput.tool_input.path) {
    $filePath = $callInput.tool_input.path
}

if (-not $filePath) { exit 0 }

# Only check frontend source files
if ($filePath -notmatch 'frontend[/\\]src[/\\]') { exit 0 }
# Skip vite.config.js which legitimately references localhost:4000
if ($filePath -match 'vite\.config') { exit 0 }

if (-not (Test-Path $filePath)) { exit 0 }

$content = Get-Content $filePath -Raw -ErrorAction SilentlyContinue
if (-not $content) { exit 0 }

# Check for absolute backend URLs
if ($content -match 'http://localhost:4\d{3}' -or
    $content -match 'http://127\.0\.0\.1:4\d{3}' -or
    $content -match 'https?://localhost:\d+/api') {
    @{
        hookSpecificOutput = @{
            hookEventName = "PostToolUse"
        }
        notification = "WARNING in $filePath`: Found an absolute backend URL (localhost:4000). The frontend must use the Vite proxy - call /api, never an absolute URL. See CLAUDE.md."
    } | ConvertTo-Json -Depth 5
}
else {
    exit 0
}
