@echo off
chcp 65001 >nul
title Instagram vers MP4 - Carnet de patrons (Tailscale)
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python n'est pas installe. Installez-le depuis https://www.python.org/downloads/
  echo et cochez "Add python.exe to PATH" pendant l'installation.
  pause
  exit /b
)
where tailscale >nul 2>nul
if errorlevel 1 (
  echo Tailscale n'est pas installe ou pas dans le PATH.
  echo Installez-le depuis https://tailscale.com/download puis relancez ce fichier.
  pause
  exit /b
)

echo Mise a jour de yt-dlp...
python -m pip install -U yt-dlp

echo.
echo Activation de l'adresse https privee Tailscale...
tailscale serve --bg 9000
echo.
tailscale serve status
echo.
echo ==============================================================
echo  Collez l'adresse https://....ts.net ci-dessus dans l'appli :
echo  Outils ^> Video Instagram ^> Service de telechargement.
echo  Elle ne change plus. Gardez cette fenetre ouverte, et activez
echo  Tailscale sur l'iPhone quand vous utilisez l'outil.
echo ==============================================================
echo.
python instagram_server.py
pause
