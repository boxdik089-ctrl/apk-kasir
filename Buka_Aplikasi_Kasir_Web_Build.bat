@echo off
title Aplikasi Kasir Pro POS - Mode Web Production (Preview)
color 0b
cls
echo =======================================================================
echo     APLIKASI KASIR PRO POS - MODE WEB PRODUCTION BUILD (PREVIEW)
echo =======================================================================
echo.
echo  [1] Membangun bundle produksi (Production Build)...
echo.
cd /d "%~dp0"
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Gagal melakukan build. Periksa pesan error di atas.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo =======================================================================
echo  [2] Build berhasil! Membuka Server Preview Web di port 4173...
echo  [3] Browser akan terbuka otomatis.
echo.
echo  * Siap diuji coba di browser PC, laptop, maupun HP / Tablet (Wi-Fi).
echo  * Tekan Ctrl + C untuk menghentikan server web preview.
echo =======================================================================
echo.

call npx vite preview --host --open
pause

