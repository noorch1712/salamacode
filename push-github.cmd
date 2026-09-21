@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ================================================
echo   KIRIM KODE KE GITHUB
echo ================================================
echo.
echo Mengirim ke: github.com/noorch1712/salamacode
echo Jika muncul jendela login GitHub, ikuti saja.
echo.
git push -u origin main
echo.
if %errorlevel%==0 (
  echo [BERHASIL] Kode sudah terkirim ke GitHub.
) else (
  echo [GAGAL] Ada pesan error di atas. Screenshot lalu kirim ke asisten.
)
echo.
pause
