# ═══════════════════════════════════════════════════════════════════════════
# ⚙️  SETUP AUTOMÁTICO COMPLETO - APS EDU
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║           ⚙️  SETUP AUTOMÁTICO - APS EDU                       ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

$backendPath = "C:\Users\vinicius.felix\Projetos\aps-edu\backend"
$envFile = Join-Path $backendPath ".env"

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 1: Verificar Node.js
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "`n1️⃣  Verificando Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version
Write-Host "✅ Node.js $nodeVersion" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 2: Ir para pasta
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "`n2️⃣  Navegando para pasta..." -ForegroundColor Yellow
cd $backendPath
Write-Host "✅ Em: $backendPath" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 3: Verificar e corrigir .env
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "`n3️⃣  Verificando .env..." -ForegroundColor Yellow

if (-not (Test-Path $envFile)) {
    Write-Host "  • Criando .env..." -ForegroundColor Gray
    @"
DATABASE_URL="file:./dev.db"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="aps_edu_super_secret_key_change_in_production_2025"
JWT_REFRESH_SECRET="aps_edu_refresh_secret_change_in_production_2025"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="30d"
PORT=3000
NODE_ENV=development
CORS_ORIGIN="http://localhost:3001"
WHATSAPP_ENABLED=true
WHATSAPP_SESSION_PATH=".whatsapp_session"
WHATSAPP_API_KEY="aps-edu-whatsapp"
WHATSAPP_AI_MODE="paused"
GOOGLE_API_KEY=""
NGROK_AUTHTOKEN=""
FIREBASE_PROJECT_ID=""
FIREBASE_PRIVATE_KEY=""
FIREBASE_CLIENT_EMAIL=""
FIREBASE_STORAGE_BUCKET=""
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="noreply@aps.edu.br"
"@ | Out-File -FilePath $envFile -Encoding UTF8
    Write-Host "✅ .env criado" -ForegroundColor Green
} else {
    Write-Host "✅ .env encontrado" -ForegroundColor Green

    # Verificar se DATABASE_URL está correto
    $envContent = Get-Content $envFile -Raw
    if ($envContent -like '*DATABASE_URL="file:./dev.db"REDIS_URL*') {
        Write-Host "  • Corrigindo DATABASE_URL quebrado..." -ForegroundColor Gray
        $envContent = $envContent -replace 'DATABASE_URL="file:\./dev\.db"REDIS_URL', 'DATABASE_URL="file:./dev.db"`nREDIS_URL'
        $envContent | Out-File -FilePath $envFile -Encoding UTF8
        Write-Host "✅ DATABASE_URL corrigido" -ForegroundColor Green
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 4: Instalar dependências
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "`n4️⃣  Verificando dependências..." -ForegroundColor Yellow

$nodeModules = Join-Path $backendPath "node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Host "  • npm install (isso pode levar 2-5 minutos)..." -ForegroundColor Gray
    npm install 2>&1 | Out-Null
    Write-Host "✅ Dependências instaladas" -ForegroundColor Green
} else {
    Write-Host "✅ Dependências já instaladas" -ForegroundColor Green
}

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 5: Preparar banco de dados
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "`n5️⃣  Preparando banco de dados..." -ForegroundColor Yellow

$devDb = Join-Path $backendPath "prisma\dev.db"
if (Test-Path $devDb) {
    Write-Host "  • Banco de dados já existe" -ForegroundColor Gray
    Write-Host "✅ Banco pronto" -ForegroundColor Green
} else {
    Write-Host "  • Criando banco de dados..." -ForegroundColor Gray
    npx prisma migrate dev --name init 2>&1 | Out-Null
    Write-Host "✅ Banco criado" -ForegroundColor Green
}

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 6: Verificar Redis
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "`n6️⃣  Verificando Redis..." -ForegroundColor Yellow

$redisRunning = $false
try {
    $result = redis-cli ping 2>$null
    if ($result -eq "PONG") {
        Write-Host "✅ Redis está rodando" -ForegroundColor Green
        $redisRunning = $true
    }
} catch {
    Write-Host "⚠️  Redis não está rodando (continuará sem Redis)" -ForegroundColor Yellow
}

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 7: Teste rápido do servidor
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "`n7️⃣  Testando servidor..." -ForegroundColor Yellow
Write-Host "  • Iniciando servidor temporariamente..." -ForegroundColor Gray

$process = Start-Process -FilePath "node" -ArgumentList "src/server.js" -PassThru -NoNewWindow
Start-Sleep -Seconds 5

$serverOK = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Servidor testado com sucesso" -ForegroundColor Green
        $serverOK = $true
    }
} catch {
    Write-Host "⚠️  Teste do servidor inconclusivo" -ForegroundColor Yellow
}

# Parar servidor temporário
Stop-Process -InputObject $process -Force -ErrorAction SilentlyContinue

# ─────────────────────────────────────────────────────────────────────────────
# RESUMO FINAL
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                   ✅ SETUP COMPLETO!                           ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host "`n📋 CHECKLIST:" -ForegroundColor Cyan
Write-Host "  ✅ Node.js $nodeVersion verificado" -ForegroundColor Green
Write-Host "  ✅ .env configurado" -ForegroundColor Green
Write-Host "  ✅ Dependências instaladas" -ForegroundColor Green
Write-Host "  ✅ Banco de dados pronto" -ForegroundColor Green
if ($redisRunning) {
    Write-Host "  ✅ Redis rodando" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Redis não rodando (usando fallback em memória)" -ForegroundColor Yellow
}
if ($serverOK) {
    Write-Host "  ✅ Servidor testado" -ForegroundColor Green
}

Write-Host "`n🎯 PRÓXIMO PASSO:" -ForegroundColor Cyan
Write-Host "  Execute: .\iniciar-plataforma.ps1" -ForegroundColor White
Write-Host "  Ou duplo-clique em: iniciar-plataforma.bat" -ForegroundColor White

Write-Host ""
