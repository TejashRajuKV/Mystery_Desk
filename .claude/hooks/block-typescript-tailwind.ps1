# .claude/hooks/block-typescript-tailwind.ps1
# PreToolUse hook: Blocks creation of TypeScript files or Tailwind config.
# CLAUDE.md: "No TypeScript, no Tailwind, no component library, no ORM"

$callInput = [Console]::In.ReadToEnd() | ConvertFrom-Json
$filePath = $null

if ($callInput.tool_input.file_path) {
    $filePath = $callInput.tool_input.file_path
}
elseif ($callInput.tool_input.path) {
    $filePath = $callInput.tool_input.path
}

if (-not $filePath) { exit 0 }

# Block TypeScript files
if ($filePath -match '\.(ts|tsx)$' -and $filePath -notmatch '\.d\.ts$') {
    @{
        hookSpecificOutput = @{
            hookEventName            = "PreToolUse"
            permissionDecision       = "deny"
            permissionDecisionReason = "BLOCKED: This project uses plain JavaScript only, no TypeScript. Use .js or .jsx instead. See CLAUDE.md stack rules."
        }
    } | ConvertTo-Json -Depth 5
    exit 0
}

# Block Tailwind config files
if ($filePath -match 'tailwind\.config' -or $filePath -match 'postcss\.config') {
    @{
        hookSpecificOutput = @{
            hookEventName            = "PreToolUse"
            permissionDecision       = "deny"
            permissionDecisionReason = "BLOCKED: This project uses hand-written CSS only, no Tailwind, no PostCSS. See CLAUDE.md stack rules."
        }
    } | ConvertTo-Json -Depth 5
    exit 0
}

exit 0
