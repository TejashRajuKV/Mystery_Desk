# .claude/hooks/block-solution-edit.ps1
# PreToolUse hook: Blocks any attempt to write/edit Case 047's answer key.
# solution.json is the answer key. Only ending.service reads it,
# no route returns it, the assistant never sees it.
# Narrowed 2026-09-23 with the owner's approval: new cases (data/cases/<id>/solution.json,
# id other than 047) may be authored; Case 047's key, in either location, stays locked.

$callInput = [Console]::In.ReadToEnd() | ConvertFrom-Json
$filePath = $null

# Extract file path depending on tool
if ($callInput.tool_input.file_path) {
    $filePath = $callInput.tool_input.file_path
}
elseif ($callInput.tool_input.path) {
    $filePath = $callInput.tool_input.path
}

$protected = $false
if ($filePath) {
    $isSolution = $filePath -match 'solution\.json$'
    $isNewCase = $filePath -match 'data[\\/]cases[\\/](?!047[\\/])[^\\/]+[\\/]solution\.json$'
    $protected = $isSolution -and -not $isNewCase
}

if ($protected) {
    @{
        hookSpecificOutput = @{
            hookEventName            = "PreToolUse"
            permissionDecision       = "deny"
            permissionDecisionReason = "BLOCKED: Case 047's solution.json is the answer key. It must never be edited directly. Only seed.js loads it, only ending.service reads it, and no route exposes it."
        }
    } | ConvertTo-Json -Depth 5
}
else {
    exit 0
}
