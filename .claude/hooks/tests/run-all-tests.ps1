# ============================================================================
# TEST CASES FOR MYSTERY_DESK CLAUDE CODE HOOKS
# ============================================================================
# Simulates what Claude Code sends to each hook (JSON on stdin)
# and checks that the hook returns the correct response.
#
# How hooks work:
#   Claude Code fires an EVENT -> sends JSON via STDIN -> script responds
#   PreToolUse hooks return permissionDecision:"deny" to BLOCK, or exit 0 to ALLOW
# ============================================================================

$hooksDir = Join-Path $PSScriptRoot ".."
$passed = 0
$failed = 0
$total = 0

function Test-Hook {
    param(
        [string]$TestName,
        [string]$HookScript,
        [string]$InputJson,
        [string]$ExpectResult,
        [string]$Description
    )

    $script:total++
    Write-Host ""
    Write-Host "--- TEST $($script:total): $TestName ---" -ForegroundColor Cyan
    Write-Host "  Hook:   $HookScript"
    Write-Host "  Expect: $ExpectResult"
    Write-Host "  Why:    $Description"

    $scriptPath = Join-Path $hooksDir $HookScript

    if (-not (Test-Path $scriptPath)) {
        Write-Host "  RESULT: FAIL - script not found" -ForegroundColor Red
        $script:failed++
        return
    }

    try {
        $output = $InputJson | powershell.exe -NoProfile -ExecutionPolicy Bypass -File $scriptPath 2>&1
        $outputStr = ($output | Out-String).Trim()

        if ($ExpectResult -eq "deny") {
            if ($outputStr -match 'permissionDecision' -and $outputStr -match 'deny') {
                Write-Host "  RESULT: PASS - hook correctly DENIED" -ForegroundColor Green
                $script:passed++
            } else {
                Write-Host "  RESULT: FAIL - expected deny" -ForegroundColor Red
                Write-Host "  Got: $outputStr" -ForegroundColor Red
                $script:failed++
            }
        }
        elseif ($ExpectResult -eq "allow") {
            if ($outputStr -eq "" -or (-not ($outputStr -match 'deny'))) {
                Write-Host "  RESULT: PASS - hook correctly ALLOWED" -ForegroundColor Green
                $script:passed++
            } else {
                Write-Host "  RESULT: FAIL - expected allow" -ForegroundColor Red
                Write-Host "  Got: $outputStr" -ForegroundColor Red
                $script:failed++
            }
        }
    }
    catch {
        Write-Host "  RESULT: FAIL - exception: $_" -ForegroundColor Red
        $script:failed++
    }
}


Write-Host ""
Write-Host "========================================================" -ForegroundColor Yellow
Write-Host "  MYSTERY_DESK - CLAUDE CODE HOOKS TEST SUITE" -ForegroundColor Yellow
Write-Host "  Proving each hook fires on the correct event" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Yellow


# ============================================================================
# HOOK 1: block-solution-edit.ps1 (PreToolUse on Edit|Write)
# ============================================================================
Write-Host ""
Write-Host "=== HOOK 1: block-solution-edit.ps1 ===" -ForegroundColor Yellow

$json1a = @'
{"tool_name":"Edit","tool_input":{"file_path":"data/solution.json","old_string":"S02","new_string":"S03"}}
'@
Test-Hook -TestName "DENY editing solution.json" -HookScript "block-solution-edit.ps1" -InputJson $json1a -ExpectResult "deny" -Description "solution.json is the answer key - must never be edited"

$json1b = @'
{"tool_name":"Write","tool_input":{"file_path":"c:/project/data/solution.json","content":"{}"}}
'@
Test-Hook -TestName "DENY writing solution.json" -HookScript "block-solution-edit.ps1" -InputJson $json1b -ExpectResult "deny" -Description "Write tool targeting solution.json also blocked"

$json1c = @'
{"tool_name":"Edit","tool_input":{"file_path":"data/evidence.json","old_string":"foo","new_string":"bar"}}
'@
Test-Hook -TestName "ALLOW editing evidence.json" -HookScript "block-solution-edit.ps1" -InputJson $json1c -ExpectResult "allow" -Description "Non-solution files should pass through"

$json1d = @'
{"tool_name":"Write","tool_input":{"file_path":"c:/project/data/cases/047/solution.json","content":"{}"}}
'@
Test-Hook -TestName "DENY writing Case 047's moved solution.json" -HookScript "block-solution-edit.ps1" -InputJson $json1d -ExpectResult "deny" -Description "Case 047's answer key stays locked in its case folder"

$json1e = @'
{"tool_name":"Write","tool_input":{"file_path":"c:\\project\\data\\cases\\048\\solution.json","content":"{}"}}
'@
Test-Hook -TestName "ALLOW authoring a new case's solution.json" -HookScript "block-solution-edit.ps1" -InputJson $json1e -ExpectResult "allow" -Description "Owner-approved: new cases may be authored"


# ============================================================================
# HOOK 2: block-unauthorized-deps.ps1 (PreToolUse on Bash)
# ============================================================================
Write-Host ""
Write-Host "=== HOOK 2: block-unauthorized-deps.ps1 ===" -ForegroundColor Yellow

$json2a = @'
{"tool_name":"Bash","tool_input":{"command":"npm install tailwindcss"}}
'@
Test-Hook -TestName "DENY npm install tailwindcss" -HookScript "block-unauthorized-deps.ps1" -InputJson $json2a -ExpectResult "deny" -Description "tailwindcss is not in the approved 6-package list"

$json2b = @'
{"tool_name":"Bash","tool_input":{"command":"npm i axios"}}
'@
Test-Hook -TestName "DENY npm i axios" -HookScript "block-unauthorized-deps.ps1" -InputJson $json2b -ExpectResult "deny" -Description "axios not approved - api.js uses native fetch()"

$json2c = @'
{"tool_name":"Bash","tool_input":{"command":"npm install express"}}
'@
Test-Hook -TestName "ALLOW npm install express" -HookScript "block-unauthorized-deps.ps1" -InputJson $json2c -ExpectResult "allow" -Description "express IS in the approved list"

$json2d = @'
{"tool_name":"Bash","tool_input":{"command":"npm install"}}
'@
Test-Hook -TestName "ALLOW bare npm install" -HookScript "block-unauthorized-deps.ps1" -InputJson $json2d -ExpectResult "allow" -Description "Bare npm install = install from package.json, always OK"


# ============================================================================
# HOOK 3: block-typescript-tailwind.ps1 (PreToolUse on Write)
# ============================================================================
Write-Host ""
Write-Host "=== HOOK 3: block-typescript-tailwind.ps1 ===" -ForegroundColor Yellow

$json3a = @'
{"tool_name":"Write","tool_input":{"file_path":"frontend/src/App.tsx","content":"export default function App() {}"}}
'@
Test-Hook -TestName "DENY creating .tsx file" -HookScript "block-typescript-tailwind.ps1" -InputJson $json3a -ExpectResult "deny" -Description "Project uses plain JS only - no TypeScript"

$json3b = @'
{"tool_name":"Write","tool_input":{"file_path":"backend/src/server.ts","content":"import express"}}
'@
Test-Hook -TestName "DENY creating .ts file" -HookScript "block-typescript-tailwind.ps1" -InputJson $json3b -ExpectResult "deny" -Description "No TypeScript files per CLAUDE.md"

$json3c = @'
{"tool_name":"Write","tool_input":{"file_path":"frontend/tailwind.config.js","content":"module.exports = {}"}}
'@
Test-Hook -TestName "DENY creating tailwind.config.js" -HookScript "block-typescript-tailwind.ps1" -InputJson $json3c -ExpectResult "deny" -Description "No Tailwind - uses hand-written CSS"

$json3d = @'
{"tool_name":"Write","tool_input":{"file_path":"frontend/src/pages/NewPage/NewPage.jsx","content":"export default function NewPage() {}"}}
'@
Test-Hook -TestName "ALLOW creating .jsx file" -HookScript "block-typescript-tailwind.ps1" -InputJson $json3d -ExpectResult "allow" -Description ".jsx is the correct format for this project"


# ============================================================================
# HOOK 4: block-test-files.ps1 (PreToolUse on Write)
# ============================================================================
Write-Host ""
Write-Host "=== HOOK 4: block-test-files.ps1 ===" -ForegroundColor Yellow

$json4a = @'
{"tool_name":"Write","tool_input":{"file_path":"backend/src/services/investigation.test.js","content":"test()"}}
'@
Test-Hook -TestName "DENY creating .test.js file" -HookScript "block-test-files.ps1" -InputJson $json4a -ExpectResult "deny" -Description "Owner said: Don't write tests yet"

$json4b = @'
{"tool_name":"Write","tool_input":{"file_path":"frontend/src/App.spec.jsx","content":"describe()"}}
'@
Test-Hook -TestName "DENY creating .spec.jsx file" -HookScript "block-test-files.ps1" -InputJson $json4b -ExpectResult "deny" -Description "Spec files are test files - blocked"

$json4c = @'
{"tool_name":"Write","tool_input":{"file_path":"vitest.config.js","content":"export default {}"}}
'@
Test-Hook -TestName "DENY creating vitest.config.js" -HookScript "block-test-files.ps1" -InputJson $json4c -ExpectResult "deny" -Description "No test framework config until approved"

$json4d = @'
{"tool_name":"Write","tool_input":{"file_path":"backend/src/services/new.service.js","content":"export function foo() {}"}}
'@
Test-Hook -TestName "ALLOW creating normal .js file" -HookScript "block-test-files.ps1" -InputJson $json4d -ExpectResult "allow" -Description "Regular service files pass through"


# ============================================================================
# HOOK 5: block-destructive-commands.ps1 (PreToolUse on Bash)
# ============================================================================
Write-Host ""
Write-Host "=== HOOK 5: block-destructive-commands.ps1 ===" -ForegroundColor Yellow

$json5a = @'
{"tool_name":"Bash","tool_input":{"command":"rm -rf backend"}}
'@
Test-Hook -TestName "DENY rm -rf backend" -HookScript "block-destructive-commands.ps1" -InputJson $json5a -ExpectResult "deny" -Description "Recursive delete of backend/ destroys the API"

$json5b = @'
{"tool_name":"Bash","tool_input":{"command":"rm -rf ."}}
'@
Test-Hook -TestName "DENY rm -rf . (project root)" -HookScript "block-destructive-commands.ps1" -InputJson $json5b -ExpectResult "deny" -Description "Deleting project root is catastrophic"

$json5c = @'
{"tool_name":"Bash","tool_input":{"command":"rm temp.log"}}
'@
Test-Hook -TestName "ALLOW rm single file" -HookScript "block-destructive-commands.ps1" -InputJson $json5c -ExpectResult "allow" -Description "Deleting a single non-critical file is fine"

$json5d = @'
{"tool_name":"Bash","tool_input":{"command":"npm run dev"}}
'@
Test-Hook -TestName "ALLOW npm run dev" -HookScript "block-destructive-commands.ps1" -InputJson $json5d -ExpectResult "allow" -Description "Normal dev commands are not blocked"


# ============================================================================
# HOOK 6: UPDATED REPO TESTS (friend's changes: sound.js, motion.js, ui updates)
# Verify hooks still work correctly with the new files
# ============================================================================
Write-Host ""
Write-Host "=== HOOK 6: UPDATED REPO - New Files Validation ===" -ForegroundColor Yellow

$json6a = @'
{"tool_name":"Write","tool_input":{"file_path":"frontend/src/utils/sound.js","content":"export const playClick = () => {}"}}
'@
Test-Hook -TestName "ALLOW editing sound.js (new utility)" -HookScript "block-typescript-tailwind.ps1" -InputJson $json6a -ExpectResult "allow" -Description "sound.js is plain JS - should be allowed"

$json6b = @'
{"tool_name":"Write","tool_input":{"file_path":"frontend/src/utils/motion.js","content":"export const prefersReducedMotion = () => false"}}
'@
Test-Hook -TestName "ALLOW editing motion.js (new utility)" -HookScript "block-typescript-tailwind.ps1" -InputJson $json6b -ExpectResult "allow" -Description "motion.js is plain JS - should be allowed"

$json6c = @'
{"tool_name":"Write","tool_input":{"file_path":"frontend/src/utils/sound.ts","content":"export const playClick = (): void => {}"}}
'@
Test-Hook -TestName "DENY creating sound.ts (TypeScript version)" -HookScript "block-typescript-tailwind.ps1" -InputJson $json6c -ExpectResult "deny" -Description "Even new utils must stay .js, not .ts"

$json6d = @'
{"tool_name":"Bash","tool_input":{"command":"npm install howler"}}
'@
Test-Hook -TestName "DENY npm install howler (audio library)" -HookScript "block-unauthorized-deps.ps1" -InputJson $json6d -ExpectResult "deny" -Description "sound.js uses Web Audio API, no audio libs allowed"

$json6e = @'
{"tool_name":"Bash","tool_input":{"command":"npm install framer-motion"}}
'@
Test-Hook -TestName "DENY npm install framer-motion" -HookScript "block-unauthorized-deps.ps1" -InputJson $json6e -ExpectResult "deny" -Description "motion.js uses native APIs, no animation libs allowed"

$json6f = @'
{"tool_name":"Edit","tool_input":{"file_path":"frontend/src/components/ui/ui.jsx","old_string":"playClick","new_string":"playClick"}}
'@
Test-Hook -TestName "ALLOW editing ui.jsx (SoundToggle component)" -HookScript "block-solution-edit.ps1" -InputJson $json6f -ExpectResult "allow" -Description "ui.jsx is a normal component file, not solution.json"


# ============================================================================
# RESULTS SUMMARY
# ============================================================================
Write-Host ""
Write-Host ""
Write-Host "========================================================" -ForegroundColor Yellow
Write-Host "                 TEST RESULTS SUMMARY" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Total tests:  $total"
Write-Host "  Passed:       $passed" -ForegroundColor Green
Write-Host "  Failed:       $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($failed -eq 0) {
    Write-Host "  ALL HOOKS FIRE ON THE CORRECT EVENTS!" -ForegroundColor Green
} else {
    Write-Host "  Some hooks need attention." -ForegroundColor Red
}

Write-Host ""
Write-Host "  How this works:" -ForegroundColor Gray
Write-Host "    - Each test pipes JSON (simulating Claude Code input)" -ForegroundColor Gray
Write-Host "      into a hook script via stdin" -ForegroundColor Gray
Write-Host "    - deny  = hook BLOCKS the action (PreToolUse)" -ForegroundColor Gray
Write-Host "    - allow = hook PERMITS the action (exit 0)" -ForegroundColor Gray
Write-Host ""
