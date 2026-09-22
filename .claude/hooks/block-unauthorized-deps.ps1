# .claude/hooks/block-unauthorized-deps.ps1
# PreToolUse hook: Blocks npm install of unapproved packages.
# Approved: react, react-dom, react-router-dom, vite, @vitejs/plugin-react, express.
# CLAUDE.md: "Ask before adding anything else."

$callInput = [Console]::In.ReadToEnd() | ConvertFrom-Json
$command = $callInput.tool_input.command

if (-not $command) { exit 0 }

# Check if this is an npm install command that adds a new package
if ($command -match 'npm\s+(install|i|add)\s+(?!--)(\S+)') {
    $pkg = $Matches[2]

    # Approved packages list
    $approved = @(
        'react',
        'react-dom',
        'react-router-dom',
        'vite',
        '@vitejs/plugin-react',
        'express'
    )

    # Allow bare npm install (no package name = install from package.json)
    if ($pkg -match '^-') { exit 0 }

    $isApproved = $false
    foreach ($a in $approved) {
        # Match exact name or scoped with version (e.g., react@18)
        if ($pkg -eq $a -or $pkg -match "^$([regex]::Escape($a))@") {
            $isApproved = $true
            break
        }
    }

    if (-not $isApproved) {
        @{
            hookSpecificOutput = @{
                hookEventName            = "PreToolUse"
                permissionDecision       = "deny"
                permissionDecisionReason = "BLOCKED: Package '$pkg' is not in the approved dependency list (react, react-dom, react-router-dom, vite, @vitejs/plugin-react, express). CLAUDE.md says: ask the user before adding anything else."
            }
        } | ConvertTo-Json -Depth 5
        exit 0
    }
}

exit 0
