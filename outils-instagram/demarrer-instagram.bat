@echo off
chcp 65001 >nul
title Instagram vers MP4 - Carnet de patrons
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python n'est pas installe. Installez-le depuis https://www.python.org/downloads/
  echo et cochez "Add python.exe to PATH" pendant l'installation.
  pause
  exit /b
)
where cloudflared >nul 2>nul
if errorlevel 1 (
  echo cloudflared n'est pas installe. Ouvrez un terminal et tapez :
  echo     winget install Cloudflare.cloudflared
  echo Puis relancez ce fichier.
  pause
  exit /b
)

echo Mise a jour de yt-dlp...
python -m pip install -U yt-dlp
start "Serveur Instagram" cmd /k python instagram_server.py
timeout /t 3 >nul

echo.
echo ==============================================================
echo  Copiez l'adresse https://xxxx.trycloudflare.com affichee
echo  ci-dessous et collez-la dans l'appli :
echo  Outils ^> Video Instagram ^> Service de telechargement.
echo  Gardez les deux fenetres ouvertes pendant l'utilisation.
echo  L'adresse change a chaque lancement.
echo ==============================================================
echo.
cloudflared tunnel --url http://localhost:9000
pause
