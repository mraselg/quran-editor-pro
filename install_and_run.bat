@echo off
set "PATH=C:\Xammp\nodejs;%PATH%"
echo Node version:
node --version
echo NPM version:
npm --version
echo.
echo === Running npm install ===
npm install --fetch-retry-mintimeout 20000 --fetch-retry-maxtimeout 120000 --fetch-retries 5
echo.
echo === npm install done with exit code: %ERRORLEVEL% ===
