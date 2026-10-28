@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Recreando el consultorio de demostracion con turnos de hoy...
call node "prisma\seed.mjs"
pause
