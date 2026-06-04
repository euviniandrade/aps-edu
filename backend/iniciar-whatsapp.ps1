# iniciar-whatsapp.ps1
# Inicia o servidor WhatsApp + túnel Cloudflare e mantém ambos sempre rodando
# Execute com: powershell -ExecutionPolicy Bypass -File iniciar-whatsapp.ps1

Set-Location $PSScriptRoot

Write-Host ""
Write-Host "=== APS-EDU WhatsApp Server ===" -ForegroundColor Green
Write-Host ""

# Instala PM2 globalmente se nao tiver
$pm2 = Get-Command pm2 -ErrorAction SilentlyContinue
if (-not $pm2) {
    Write-Host "Instalando PM2..." -ForegroundColor Yellow
    npm install -g pm2
}

# Para processos anteriores
pm2 delete whatsapp-aps 2>$null
pm2 delete cloudflare-tunnel 2>$null

# Inicia servidor WhatsApp com PM2 (reinicia automaticamente se cair)
Write-Host "Iniciando servidor WhatsApp (porta 8081)..." -ForegroundColor Cyan
pm2 start whatsapp.js --name whatsapp-aps --restart-delay 3000 --max-restarts 10

# Aguarda o servidor subir
Start-Sleep -Seconds 4

# Inicia tunel cloudflared
Write-Host "Iniciando tunel Cloudflare..." -ForegroundColor Cyan
pm2 start "cloudflared tunnel --url http://localhost:8081" --name cloudflare-tunnel --interpreter none --restart-delay 5000

# Salva lista de processos (reinicia apos reboot do Windows)
pm2 save

Write-Host ""
Write-Host "✅ Servidor e tunel iniciados!" -ForegroundColor Green
Write-Host ""
Write-Host "Para ver os logs:" -ForegroundColor White
Write-Host "  pm2 logs whatsapp-aps" -ForegroundColor Gray
Write-Host ""
Write-Host "Para ver a URL do tunel:" -ForegroundColor White
Write-Host "  pm2 logs cloudflare-tunnel" -ForegroundColor Gray
Write-Host ""
Write-Host "Para parar tudo:" -ForegroundColor White
Write-Host "  pm2 delete all" -ForegroundColor Gray
Write-Host ""

# Mostra logs em tempo real
pm2 logs
