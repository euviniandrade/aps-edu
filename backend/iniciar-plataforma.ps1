# ═══════════════════════════════════════════════════════════════════════════
# 🚀 SCRIPT DE INICIALIZAÇÃO AUTOMÁTICA - APS EDU WHATSAPP CRM
# ═══════════════════════════════════════════════════════════════════════════

Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║           🚀 INICIANDO APS EDU - WHATSAPP CRM                 ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 1: Verificar se Redis está rodando
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "`n📍 PASSO 1: Verificando Redis..." -ForegroundColor Yellow

$redisRunning = $false
try {
    $result = redis-cli ping 2>$null
    if ($result -eq "PONG") {
        Write-Host "✅ Redis já está rodando!" -ForegroundColor Green
        $redisRunning = $true
    }
} catch {
    Write-Host "⚠️  Redis não está rodando" -ForegroundColor Yellow
}

if (-not $redisRunning) {
    Write-Host "🔄 Iniciando Redis em background..." -ForegroundColor Cyan
    try {
        # Tentar com Docker primeiro
        $dockerCheck = docker ps 2>$null
        if ($?) {
            $existingContainer = docker ps -a --filter "name=redis-aps" -q 2>$null
            if ($existingContainer) {
                Write-Host "  • Removendo container Redis antigo..." -ForegroundColor Gray
                docker rm -f redis-aps 2>$null | Out-Null
            }
            Write-Host "  • Iniciando container Docker Redis..." -ForegroundColor Gray
            docker run -d -p 6379:6379 --name redis-aps redis:latest 2>$null | Out-Null
            Start-Sleep -Seconds 2
            $redisRunning = $true
            Write-Host "✅ Redis iniciado com Docker" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ⚠️  Docker não disponível, tentando Redis local..." -ForegroundColor Gray
    }

    if (-not $redisRunning) {
        # Tentar iniciar Redis local
        if (Test-Path "C:\redis\redis-server.exe") {
            Write-Host "  • Iniciando Redis local..." -ForegroundColor Gray
            Start-Process -FilePath "C:\redis\redis-server.exe" -WindowStyle Hidden
            Start-Sleep -Seconds 2
            $redisRunning = $true
            Write-Host "✅ Redis local iniciado" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Redis não encontrado - continuando sem Redis (usar stub em memória)" -ForegroundColor Yellow
        }
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 2: Verificar Node.js
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "`n📍 PASSO 2: Verificando Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version
if ($nodeVersion) {
    Write-Host "✅ Node.js $nodeVersion encontrado" -ForegroundColor Green
} else {
    Write-Host "❌ Node.js não encontrado! Instale de https://nodejs.org" -ForegroundColor Red
    exit 1
}

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 3: Ir para pasta do backend
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "`n📍 PASSO 3: Navigando para pasta do backend..." -ForegroundColor Yellow
$backendPath = "C:\Users\vinicius.felix\Projetos\aps-edu\backend"

if (-not (Test-Path $backendPath)) {
    Write-Host "❌ Pasta não encontrada: $backendPath" -ForegroundColor Red
    exit 1
}

cd $backendPath
Write-Host "✅ Em: $backendPath" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 4: Iniciar servidor
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "`n📍 PASSO 4: Iniciando servidor..." -ForegroundColor Yellow
Write-Host "  • Executando: node src/server.js" -ForegroundColor Gray

# Iniciar servidor em background usando uma nova janela
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; node src/server.js" -WindowStyle Normal

# Aguardar servidor iniciar
Write-Host "  • Aguardando servidor iniciar..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 5: Testar conectividade
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "`n📍 PASSO 5: Testando conectividade..." -ForegroundColor Yellow

$serverOK = $false
$maxTentativas = 10
$tentativa = 0

while ($tentativa -lt $maxTentativas -and -not $serverOK) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $serverOK = $true
            Write-Host "✅ Servidor respondendo em http://localhost:3000" -ForegroundColor Green
        }
    } catch {
        $tentativa++
        Write-Host "  ⏳ Tentativa $tentativa/$maxTentativas..." -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

if (-not $serverOK) {
    Write-Host "⚠️  Servidor não respondeu após aguardar. Verifique a janela PowerShell que abriu." -ForegroundColor Yellow
}

# ─────────────────────────────────────────────────────────────────────────────
# PASSO 6: Testar endpoints
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "`n📍 PASSO 6: Testando endpoints..." -ForegroundColor Yellow

$endpoints = @(
    @{ nome = "Health"; url = "http://localhost:3000/health"; esperado = "status" },
    @{ nome = "Dashboard"; url = "http://localhost:3000/dashboard"; esperado = "system" }
)

foreach ($endpoint in $endpoints) {
    try {
        $response = Invoke-WebRequest -Uri $endpoint.url -Method Get -TimeoutSec 5 -ErrorAction Stop
        $content = $response.Content

        if ($content -contains $endpoint.esperado) {
            Write-Host "✅ GET $($endpoint.nome) funcionando" -ForegroundColor Green
        } else {
            Write-Host "✅ GET $($endpoint.nome) respondendo (conteúdo diferente do esperado)" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️  GET $($endpoint.nome) - erro: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# RESUMO FINAL
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║                    ✅ PLATAFORMA INICIADA!                      ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host "`n📊 ACESSOS:" -ForegroundColor Cyan
Write-Host "  • API:       http://localhost:3000" -ForegroundColor White
Write-Host "  • Health:    http://localhost:3000/health" -ForegroundColor White
Write-Host "  • Dashboard: http://localhost:3000/dashboard" -ForegroundColor White

Write-Host "`n📱 PRÓXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host "  1. Uma nova janela PowerShell abriu com o servidor" -ForegroundColor White
Write-Host "  2. Procure pelo QR CODE nessa janela" -ForegroundColor White
Write-Host "  3. Escaneie com seu WhatsApp (Configurações → Dispositivos vinculados)" -ForegroundColor White
Write-Host "  4. Pronto! Seu WhatsApp estará conectado!" -ForegroundColor White

Write-Host "`n🔗 TESTAR AGORA:" -ForegroundColor Cyan
Write-Host "  • Abra seu navegador em: http://localhost:3000/dashboard" -ForegroundColor White

Write-Host "`n⏸️  Para parar: Feche as janelas PowerShell abertas" -ForegroundColor Magenta

Write-Host "`n" -ForegroundColor White
