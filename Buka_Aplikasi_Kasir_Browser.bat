@echo off
title Aplikasi Kasir Pro POS - Mode Web Browser Testing
color 0b
cls
echo =======================================================================
echo          APLIKASI KASIR PRO POS - MODE WEB BROWSER TESTING
echo =======================================================================
echo.
echo  [1] Memulai Web Server Lokal...
echo  [2] Browser akan otomatis terbuka ke: http://localhost:5173
echo  [3] Anda juga dapat mengakses dari HP / Tablet / Perangkat lain
echo      di jaringan Wi-Fi yang sama lewat alamat IP Network di bawah ini.
echo.
echo  * Database (IndexedDB) berjalan 100%% offline di browser Anda.
echo  * Tekan Ctrl + C untuk menghentikan server web.
echo.
echo =======================================================================
echo.

cd /d "%~dp0"
call npx vite --host --open
pause
