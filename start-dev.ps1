# HappyHomesHub — Portable Dev Server
# Run this if npm/node is not in your system PATH.
# Uses the portable Node.js installation directly.

$NodePath = "C:\Users\Banu.Kommuri\AppData\Local\Programs\nodejs"
$env:PATH = "$NodePath;$env:PATH"

Write-Host "Node version: $(& node --version)" -ForegroundColor Cyan
Write-Host "npm  version: $(& npm --version)"  -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting HappyHomesHub dev server..." -ForegroundColor Green

Set-Location $PSScriptRoot
& npm run dev
