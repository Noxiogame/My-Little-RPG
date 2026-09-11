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

echo === Mise a jour de My Little RPG ===
echo.
"%GIT%" rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo Ce fichier doit rester a la racine du projet Git.
  if not defined CI pause
  exit /b 1
)

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

echo.
echo Recuperation des changements GitHub...
"%GIT%" pull --rebase origin main
if errorlevel 1 goto :failed

echo.
echo Envoi vers GitHub...
"%GIT%" push origin main
if errorlevel 1 goto :failed

echo.
echo GitHub est a jour.
"%GIT%" status --short --branch
if not defined CI pause
exit /b 0

:failed
echo.
echo La mise a jour a echoue. Consulte le message ci-dessus.
echo En cas de conflit, ouvre le projet dans VS Code pour le resoudre.
if not defined CI pause
exit /b 1