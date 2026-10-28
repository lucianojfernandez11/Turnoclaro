@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Apagando TurnoClaro...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":300[0-9] .*LISTENING"') do taskkill /F /T /PID %%p >nul 2>nul
if exist .next rmdir /s /q .next
echo Listo. TurnoClaro quedo apagado.
timeout /t 3 >nul
