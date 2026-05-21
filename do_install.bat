@echo off
SET "PATH=C:\Xammp\nodejs;%PATH%"
echo [START] npm install starting...
npm install 2>&1
echo [DONE] npm install exit code: %ERRORLEVEL%
