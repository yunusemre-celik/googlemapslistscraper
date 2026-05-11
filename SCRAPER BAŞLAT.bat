@echo off
chcp 65001 >nul
title Google Maps Kaydedilen İşletmeler Scraper
cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   Google Maps Kaydedilen İşletmeler Scraper  ║
echo  ╚══════════════════════════════════════════════╝
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [HATA] Node.js bulunamadi!
    echo  Lutfen https://nodejs.org adresinden Node.js yukleyin.
    pause
    exit /b 1
)

npm start

echo.
echo  Pencereyi kapatmak icin bir tusa basin...
pause >nul
