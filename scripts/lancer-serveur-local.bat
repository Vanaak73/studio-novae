@echo off
chcp 65001 >nul
title Studio Novae - serveur local (fermer cette fenetre pour l'arreter)
cd /d "D:\projet\Studio-Novae"

rem Le serveur local doit toujours servir la branche apercu.
for /f "delims=" %%b in ('git branch --show-current') do set BRANCHE=%%b
if /i not "%BRANCHE%"=="apercu" (
  echo Branche actuelle : %BRANCHE% - passage sur apercu...
  git checkout apercu
  if errorlevel 1 (
    echo.
    echo Impossible de passer sur la branche apercu ^(modifications en cours ?^). Serveur non demarre.
    pause
    exit /b 1
  )
)

set PORT=3000
set RECHARGER=1
echo Studio Novae, branche apercu : http://localhost:%PORT%
echo Mode local : les modifications apparaissent en rechargeant la page (F5).
echo Fermez cette fenetre (ou Ctrl+C) pour arreter le serveur.
echo.
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:%PORT%"
node server.js
echo.
echo Le serveur s'est arrete.
pause
