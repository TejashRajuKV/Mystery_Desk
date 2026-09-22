# .claude/hooks/block-test-files.ps1
# PreToolUse hook: Blocks creation of test files.
# CLAUDE.md: "Don't write tests for this yet; I'll say when."

$callInput = [Console]::In.ReadToEnd() | ConvertFrom-Json
$filePath = $null

if ($callInput.tool_input.file_path) {
    $filePath = $callInput.tool_input.file_path
}
elseif ($callInput.tool_input.path) {
    $filePath = $callInput.tool_input.path
}

if (-not $filePath) { exit 0 }

# Block test files: *.test.js, *.spec.js, *.test.jsx, *.spec.jsx, __tests__/
if ($filePath -match '\.(test|spec)\.(js|jsx)$' -or $filePath -match '__tests__') {
    @{
        hookSpecificOutput = @{
            hookEventName            = "PreToolUse"
            permissionDecision       = "deny"
            permissionDecisionReason = "BLOCKED: No automated tests yet. The owner has not approved writing tests. See CLAUDE.md working notes."
        }
    } | ConvertTo-Json -Depth 5
    exit 0
}

# Also block Jest/Vitest config files
if ($filePath -match 'jest\.config' -or $filePath -match 'vitest\.config') {
    @{
        hookSpecificOutput = @{
            hookEventName            = "PreToolUse"
            permissionDecision       = "deny"
            permissionDecisionReason = "BLOCKED: No test framework config. Tests have not been requested yet. See CLAUDE.md."
        }
    } | ConvertTo-Json -Depth 5
    exit 0
}

exit 0
