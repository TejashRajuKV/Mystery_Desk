# .claude/hooks/block-solution-edit.ps1
# PreToolUse hook: Blocks any attempt to write/edit data/solution.json
# solution.json is the answer key. Only validateConclusion reads it,
# no route returns it, the assistant never sees it.

$callInput = [Console]::In.ReadToEnd() | ConvertFrom-Json
$filePath = $null

# Extract file path depending on tool
if ($callInput.tool_input.file_path) {
    $filePath = $callInput.tool_input.file_path
}
elseif ($callInput.tool_input.path) {
    $filePath = $callInput.tool_input.path
}

if ($filePath -and ($filePath -match 'solution\.json')) {
    @{
        hookSpecificOutput = @{
            hookEventName            = "PreToolUse"
            permissionDecision       = "deny"
            permissionDecisionReason = "BLOCKED: solution.json is the answer key. It must never be edited directly. Only seed.js loads it, only validateConclusion reads it, and no route exposes it."
        }
    } | ConvertTo-Json -Depth 5
}
else {
    exit 0
}
