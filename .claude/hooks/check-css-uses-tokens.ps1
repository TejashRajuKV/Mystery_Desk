# .claude/hooks/check-css-uses-tokens.ps1
# PostToolUse hook: After writing/editing a component CSS file, warns if
# raw color values are used instead of CSS custom property tokens.
# CLAUDE.md: "component CSS uses tokens, not raw values"

$callInput = [Console]::In.ReadToEnd() | ConvertFrom-Json
$filePath = $null

if ($callInput.tool_input.file_path) {
    $filePath = $callInput.tool_input.file_path
}
elseif ($callInput.tool_input.path) {
    $filePath = $callInput.tool_input.path
}

if (-not $filePath) { exit 0 }

# Only check component/page CSS files in the frontend (not tokens.css itself or index.css)
if ($filePath -notmatch 'frontend[/\\]src[/\\](components|pages)[/\\]') { exit 0 }
if ($filePath -notmatch '\.css$') { exit 0 }

if (-not (Test-Path $filePath)) { exit 0 }

$content = Get-Content $filePath -Raw -ErrorAction SilentlyContinue
if (-not $content) { exit 0 }

$warnings = @()

# Check for raw hex colors (allow #fff, #000 as they're universal)
$hexMatches = [regex]::Matches($content, '#[0-9a-fA-F]{3,8}\b') |
    Where-Object { $_.Value -notin @('#fff', '#000', '#ffffff', '#000000') }

if ($hexMatches.Count -gt 3) {
    $warnings += "$($hexMatches.Count) raw hex colors found - use var(--token-name) from tokens.css"
}

# Check for raw rgb/rgba values
if ($content -match 'rgba?\(\s*\d') {
    $warnings += "Raw rgb/rgba values found - use CSS custom properties from tokens.css"
}

if ($warnings.Count -gt 0) {
    $warningText = $warnings -join "; "
    @{
        hookSpecificOutput = @{
            hookEventName = "PostToolUse"
        }
        notification = "STYLE WARNING in $filePath`: $warningText. Per CLAUDE.md, component CSS uses tokens from tokens.css, not raw values."
    } | ConvertTo-Json -Depth 5
}
else {
    exit 0
}
