@echo off
title Aplikasi Kasir Pro POS - 100% Offline
color 0b
echo ========================================================
echo        MEMULAI APLIKASI KASIR PRO POS (100%% OFFLINE)
echo ========================================================
echo.
echo Sedang membuka aplikasi kasir desktop...
echo Silakan tunggu sebentar...
echo.
cd /d "%~dp0"
call npm start
pause
