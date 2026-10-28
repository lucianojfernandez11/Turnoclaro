@echo off
chcp 65001 >nul
title TurnoClaro
cd /d "%~dp0"
echo.
echo  === TurnoClaro ===
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  Falta instalar Node.js. Se abre la pagina de descarga:
  echo  baja la version "LTS", instalala con todo por defecto
  echo  y despues volve a hacer doble clic en INICIAR.bat
  start "" https://nodejs.org/es
  pause
  exit /b
)

if not exist .env copy env-inicial.txt .env >nul
findstr /c:"PEGAR-ACA" .env >nul 2>nul
if not errorlevel 1 (
  findstr /c:"PEGAR-ACA" env-inicial.txt >nul 2>nul
  if errorlevel 1 copy /y env-inicial.txt .env >nul
)

findstr /c:"PEGAR-ACA" .env >nul 2>nul
if not errorlevel 1 (
  echo  Falta pegar la conexion de Neon en el archivo .env
  echo  Se abre el archivo: pegala en DATABASE_URL, guarda con Ctrl+G y cerralo.
  echo  Despues volve a hacer doble clic en INICIAR.bat
  notepad .env
  pause
  exit /b
)

if not exist "node_modules\prisma\build\index.js" (
  echo  [1/3] Instalando lo necesario. La primera vez tarda unos minutos...
  call npm install
  if errorlevel 1 goto error
)

echo  Cerrando cualquier TurnoClaro que haya quedado abierto...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":300[0-9] .*LISTENING"') do taskkill /F /T /PID %%p >nul 2>nul
timeout /t 2 >nul

echo  [2/3] Conectando con la base de datos (si estaba dormida, tarda unos segundos)...
set intentos=0
:migrar
set /a intentos+=1
call node "node_modules\prisma\build\index.js" migrate deploy > inicio.log 2>&1
if not errorlevel 1 goto migrado
if %intentos% geq 4 (
  type inicio.log
  goto error
)
echo  La base todavia no responde. Reintento %intentos% de 3...
timeout /t 8 >nul
goto migrar
:migrado
echo  Base de datos lista.
call node "node_modules\prisma\build\index.js" generate >> inicio.log 2>&1
if errorlevel 1 (
  echo  No se pudo preparar la conexion con la base. Cerra todas las ventanas negras y volve a intentar.
  type inicio.log
  goto error
)

if not exist .demo-cargada (
  echo  Cargando el consultorio de demostracion...
  call node "prisma\seed.mjs" >> inicio.log 2>&1
  if errorlevel 1 (
    type inicio.log
    goto error
  )
  echo ok> .demo-cargada
)

if exist .next rmdir /s /q .next

echo.
echo  [3/3] Arrancando. En unos segundos se abre el navegador.
echo  Usuario: demo@turnoclaro.com   Clave: demo1234
echo  Para apagarlo, cerra esta ventana o usa APAGAR.bat
echo.
start "" cmd /c "timeout /t 10 >nul & start http://localhost:3000/login"
call node "node_modules\next\dist\bin\next" dev -p 3000
goto fin

:error
echo.
echo  *** Algo fallo. Avisale a Claude: el detalle quedo guardado en inicio.log ***
pause
:fin
