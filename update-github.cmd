@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "GIT=git"
where git >nul 2>&1
if errorlevel 1 set "GIT=C:\Program Files\Git\cmd\git.exe"
if not exist "%GIT%" if "%GIT%" neq "git" (
  echo Git est introuvable. Installe Git puis relance ce fichier.
  if not defined CI pause
  exit /b 1
)

call :GenerateVersion

echo === Mise a jour de My Little RPG ===
echo Version active : %APP_VERSION%
echo.

"%GIT%" rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo Ce fichier doit rester a la racine du projet Git.
  if not defined CI pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$version = '%APP_VERSION%'; $game = (Get-Content -Path 'game.js' -Raw); $game = [regex]::Replace($game, \"const APP_VERSION = '.*?'\", \"const APP_VERSION = '$version'\"); Set-Content -Path 'game.js' -Value $game -Encoding UTF8; $html = (Get-Content -Path 'index.html' -Raw); $html = [regex]::Replace($html, '<meta name=\"app-version\" content=\"[^\"]+\" />', '<meta name=\"app-version\" content=\"' + $version + '\" />'); $html = [regex]::Replace($html, 'style\.css\?v=[^\"]+', 'style.css?v=' + $version); $html = [regex]::Replace($html, 'game\.js\?v=[^\"]+', 'game.js?v=' + $version); Set-Content -Path 'index.html' -Value $html -Encoding UTF8; $json = '{\"version\": \"' + $version + '\"}'; Set-Content -Path 'version.json' -Value $json -Encoding UTF8"
if errorlevel 1 goto :failed

"%GIT%" add -A
"%GIT%" diff --cached --quiet
if errorlevel 1 (
  set "MESSAGE=Update du jeu"
  if not defined CI set /p "MESSAGE=Message du commit [Update du jeu] : "
  if not defined MESSAGE set "MESSAGE=Update du jeu"
  "%GIT%" commit -m "!MESSAGE!"
  if errorlevel 1 goto :failed
) else (
  echo Aucun changement local a committer.
)

set "BRANCH="
for /f "delims=" %%B in ('"%GIT%" rev-parse --abbrev-ref HEAD 2^>nul') do set "BRANCH=%%B"
if not defined BRANCH set "BRANCH=main"
"%GIT%" rev-parse --verify main >nul 2>&1
if errorlevel 1 (
  "%GIT%" rev-parse --verify master >nul 2>&1
  if not errorlevel 1 set "BRANCH=master"
)

echo.
echo Recuperation des changements GitHub...
"%GIT%" pull --rebase origin "%BRANCH%"
if errorlevel 1 goto :failed

echo.
echo Envoi vers GitHub...
"%GIT%" push origin "%BRANCH%"
if errorlevel 1 goto :failed

echo.
echo GitHub est a jour.
"%GIT%" status --short --branch
if not defined CI pause
exit /b 0

:GenerateVersion
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy.MM.dd.HHmmssfff"') do set "APP_VERSION=%%I"
exit /b 0

:failed
echo.
echo La mise a jour a echoue. Consulte le message ci-dessus.
echo En cas de conflit, ouvre le projet dans VS Code pour le resoudre.
if not defined CI pause
exit /b 1