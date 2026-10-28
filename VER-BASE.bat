@echo off
chcp 65001 >nul
title TurnoClaro - Base de datos
cd /d "%~dp0"
echo.
echo  === TurnoClaro: ver la base de datos ===
echo.
echo  Se abre en el navegador: http://localhost:5555
echo  Elegi una tabla a la izquierda (Patient, Appointment...).
echo  Para ver datos nuevos, toca el boton de recargar de la tabla.
echo.
echo  OJO: lo que cambies o borres aca se cambia de verdad.
echo  Para cerrar, cerra esta ventana negra.
echo.
call npx prisma studio --port 5555 --browser default
pause
