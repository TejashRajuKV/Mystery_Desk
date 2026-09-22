# .claude/hooks/block-destructive-commands.ps1
# PreToolUse hook: Blocks destructive shell commands.
# Protects the SQLite database, seed data, and critical project files.

$callInput = [Console]::In.ReadToEnd() | ConvertFrom-Json
$command = $callInput.tool_input.command

if (-not $command) { exit 0 }

# Block rm -rf on project root or critical directories
if ($command -match 'rm\s+-rf\s+(\.|/|\\|backend|frontend|data|\.claude)' -or
    $command -match 'Remove-Item.*-Recurse.*(backend|frontend|data|\.claude)' -or
    $command -match 'rmdir\s+/s.*(backend|frontend|data|\.claude)') {
    @{
        hookSpecificOutput = @{
            hookEventName            = "PreToolUse"
            permissionDecision       = "deny"
            permissionDecisionReason = "BLOCKED: Recursive deletion of critical project directories is not allowed. Delete specific files instead."
        }
    } | ConvertTo-Json -Depth 5
    exit 0
}

# Block dropping all SQLite tables (wipe the DB by deleting the file instead per CLAUDE.md)
if ($command -match 'DROP\s+TABLE' -and $command -match 'investigations') {
    @{
        hookSpecificOutput = @{
            hookEventName            = "PreToolUse"
            permissionDecision       = "deny"
            permissionDecisionReason = "BLOCKED: Do not DROP tables. To reset the DB, delete backend/storage/mysterydesk.sqlite and restart. See CLAUDE.md."
        }
    } | ConvertTo-Json -Depth 5
    exit 0
}

exit 0
