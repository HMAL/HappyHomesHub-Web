@echo off
set "NODE_PATH=C:\Users\Banu.Kommuri\AppData\Local\Programs\nodejs"
set "PATH=%NODE_PATH%;%PATH%"

echo Node version:
node --version
echo npm version:
npm --version
echo.
echo Starting HappyHomesHub dev server...
cd /d "%~dp0"
npm run dev
