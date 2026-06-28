@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  echo Installing APS-EDU Desktop dependencies...
  npm install
)

npm run build
