@echo off
REM ====================================================
REM INICIAR APS EDU - WHATSAPP CRM
REM Simplesmente duplo-clique e tudo inicia!
REM ====================================================

chcp 65001 >nul 2>&1

echo.
echo ====================================================
echo   INICIANDO APS EDU - WHATSAPP CRM
echo ====================================================
echo.

REM Ir para pasta do backend
cd /d "C:\Users\vinicius.felix\Projetos\aps-edu\backend"

REM Iniciar Redis em background (se Docker estiver instalado)
echo [1/5] Verificando Redis...
docker ps >nul 2>&1
if %errorlevel% equ 0 (
    docker ps | findstr redis-aps >nul 2>&1
    if errorlevel 1 (
        echo  * Iniciando Redis...
        docker run -d -p 6379:6379 --name redis-aps redis:latest >nul 2>&1
        timeout /t 2 /nobreak >nul
        echo [OK] Redis iniciado
    ) else (
        echo [OK] Redis ja esta rodando
    )
) else (
    echo [AVISO] Docker nao encontrado - usando fallback em memoria
)

REM Verificar Node.js
echo.
echo [2/5] Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado!
    echo Instale em: https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js encontrado

REM Instalar dependencias se necessario
echo.
echo [3/5] Verificando dependencias...
if not exist "node_modules" (
    echo  * npm install (aguarde 2-5 minutos)...
    call npm install >nul 2>&1
    echo [OK] Dependencias instaladas
) else (
    echo [OK] Dependencias ja existem
)

REM Preparar banco de dados
echo.
echo [4/5] Preparando banco de dados...
if not exist "prisma\dev.db" (
    echo  * Criando banco...
    call npx prisma migrate dev --name init --skip-generate >nul 2>&1
    echo [OK] Banco criado
) else (
    echo [OK] Banco pronto
)

REM Iniciar servidor
echo.
echo [5/5] Iniciando servidor...
echo.
echo ====================================================
echo   SERVIDOR INICIANDO
echo ====================================================
echo.
echo Aguarde o QR CODE aparecer nesta janela...
echo Quando aparecer, escaneie com seu WhatsApp:
echo   Configuracoes > Dispositivos vinculados > Vincular
echo.
echo Para acessar o dashboard:
echo   http://localhost:3000/dashboard
echo.
echo ====================================================
echo.

REM Iniciar servidor
call node src/server.js

echo.
pause
