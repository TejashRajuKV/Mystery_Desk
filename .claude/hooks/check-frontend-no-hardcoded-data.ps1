# .claude/hooks/check-frontend-no-hardcoded-data.ps1
# PostToolUse hook: After writing/editing a frontend .jsx file, checks for
# hardcoded case data. CLAUDE.md: "A suspect name, an evidence ID or a
# timestamp typed into a .jsx file is a bug, not a placeholder, in every phase."

$callInput = [Console]::In.ReadToEnd() | ConvertFrom-Json
$filePath = $null

if ($callInput.tool_input.file_path) {
    $filePath = $callInput.tool_input.file_path
}
elseif ($callInput.tool_input.path) {
    $filePath = $callInput.tool_input.path
}

if (-not $filePath) { exit 0 }

# Only check frontend JSX files (not services/api.js which legitimately has CASE_ID)
if ($filePath -notmatch 'frontend[/\\]src[/\\]' -or $filePath -notmatch '\.jsx$') {
    exit 0
}

# Skip api.js and useCase.jsx which legitimately reference the case ID
if ($filePath -match 'services[/\\]api\.js$' -or $filePath -match 'hooks[/\\]useCase\.jsx$') {
    exit 0
}

if (-not (Test-Path $filePath)) { exit 0 }

$content = Get-Content $filePath -Raw -ErrorAction SilentlyContinue
if (-not $content) { exit 0 }

$warnings = @()

# Check for hardcoded suspect names from the case (data/suspects.json)
$suspectNames = @('Maren Voss', 'Alex Reyes', 'Victor Lang', 'Nina Okafor', 'Daniel Cho')
foreach ($name in $suspectNames) {
    if ($content -match [regex]::Escape($name) -and $content -notmatch "//.*$([regex]::Escape($name))") {
        $warnings += "Hardcoded suspect name '$name' found"
    }
}

# Check for hardcoded evidence IDs (E001-E018 as string literals, not in comments)
if ($content -match "'E0\d{2}'" -or $content -match '"E0\d{2}"') {
    $warnings += "Hardcoded evidence ID found (E0xx pattern)"
}

# Check for hardcoded timestamps from the case (1984-03-xx patterns)
if ($content -match "'1984-03-" -or $content -match '"1984-03-') {
    $warnings += "Hardcoded 1984 timestamp found"
}

if ($warnings.Count -gt 0) {
    $warningText = $warnings -join "; "
    @{
        hookSpecificOutput = @{
            hookEventName = "PostToolUse"
        }
        notification = "WARNING in $filePath`: $warningText. Per CLAUDE.md, every screen gets its data from the backend - hardcoded case data in JSX is a bug."
    } | ConvertTo-Json -Depth 5
}
else {
    exit 0
}
