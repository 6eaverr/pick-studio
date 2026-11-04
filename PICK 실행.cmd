@echo off
setlocal
pushd "%~dp0"
if errorlevel 1 goto folder_error
set "PICK_NODE="
for %%N in (node.exe) do set "PICK_NODE=%%~$PATH:N"
if defined PICK_NODE goto run
if exist "%ProgramFiles%\nodejs\node.exe" set "PICK_NODE=%ProgramFiles%\nodejs\node.exe"
if defined PICK_NODE goto run
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "PICK_NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if defined PICK_NODE goto run
echo Node.js 22 or later is required.
echo Install Node.js from https://nodejs.org/ and try again.
goto failed
:folder_error
echo Could not open the PICK folder. Extract the entire ZIP first.
goto failed
:run
if not exist "launcher.mjs" goto missing_files
"%PICK_NODE%" "launcher.mjs" %*
if errorlevel 1 goto failed
popd
exit /b 0
:missing_files
echo Missing program files. Extract the entire ZIP, then run this file inside it.
:failed
echo.
echo PICK could not finish. Please send the message above for support.
pause
exit /b 1
