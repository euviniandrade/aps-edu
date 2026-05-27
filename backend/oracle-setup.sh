#!/bin/bash
# ============================================================
#  APS EDU — Setup completo para Oracle Cloud VM Ubuntu 22.04
#  VM: aps-edu-whatsapp | Region: sa-saopaulo-1
#
#  Como usar:
#    1. Faça SSH na VM: ssh ubuntu@<IP_PUBLICO>
#    2. Copie este script: scp oracle-setup.sh ubuntu@<IP>:~
#    3. Execute: chmod +x oracle-setup.sh && ./oracle-setup.sh
# ============================================================

set -e
APP_DIR="/opt/aps-edu/backend"
SERVICE_USER="apsuser"

echo "======================================================"
echo "  APS EDU — Oracle Cloud Setup"
echo "======================================================"

# ── 1. Atualizar sistema ──────────────────────────────────
echo "[1/9] Atualizando pacotes..."
sudo apt-get update -y && sudo apt-get upgrade -y

# ── 2. Node.js 20 ─────────────────────────────────────────
echo "[2/9] Instalando Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "  Node: $(node -v) | npm: $(npm -v)"

# ── 3. Chromium para Puppeteer ────────────────────────────
echo "[3/9] Instalando Chromium + dependências do Puppeteer..."
sudo apt-get install -y \
  chromium-browser \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libasound2 \
  libpangocairo-1.0-0 libpango-1.0-0 libcairo2 \
  fonts-liberation libappindicator3-1 xdg-utils

echo "  Chromium: $(chromium-browser --version 2>/dev/null || echo 'instalado')"

# ── 4. PostgreSQL ──────────────────────────────────────────
echo "[4/9] Instalando PostgreSQL..."
sudo apt-get install -y postgresql postgresql-contrib

sudo systemctl enable postgresql
sudo systemctl start postgresql

# Criar usuário e banco
sudo -u postgres psql -c "CREATE USER aps_user WITH PASSWORD 'aps_secure_2025';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE aps_edu OWNER aps_user;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE aps_edu TO aps_user;" 2>/dev/null || true

echo "  PostgreSQL configurado: aps_edu / aps_user"

# ── 5. Redis ──────────────────────────────────────────────
echo "[5/9] Instalando Redis..."
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
echo "  Redis: $(redis-server --version)"

# ── 6. PM2 ────────────────────────────────────────────────
echo "[6/9] Instalando PM2..."
sudo npm install -g pm2

# ── 7. Preparar diretório da aplicação ────────────────────
echo "[7/9] Configurando diretório da aplicação..."
sudo mkdir -p "$APP_DIR"
sudo mkdir -p "$APP_DIR/.wwebjs_auth"

# Criar usuário de serviço
if ! id "$SERVICE_USER" &>/dev/null; then
  sudo useradd -r -s /bin/false "$SERVICE_USER" 2>/dev/null || true
fi
sudo chown -R "$USER:$USER" "$APP_DIR"

# ── 8. Firewall (ufw) ─────────────────────────────────────
echo "[8/9] Configurando firewall..."
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 3000/tcp  # API
sudo ufw --force enable
echo "  Firewall OK: porta 3000 aberta"
echo "  IMPORTANTE: Abra também a porta 3000 nas Security Lists do Oracle Cloud!"

# ── 9. Script de deploy ───────────────────────────────────
echo "[9/9] Criando script de deploy..."

cat > "$HOME/deploy-backend.sh" << 'DEPLOY'
#!/bin/bash
# Script de deploy — execute após atualizar o código
APP_DIR="/opt/aps-edu/backend"

echo "→ Parando serviço..."
pm2 stop aps-edu-backend 2>/dev/null || true

echo "→ Instalando dependências..."
cd "$APP_DIR"
npm install --production

echo "→ Rodando migrações..."
npx prisma migrate deploy

echo "→ Iniciando serviço..."
pm2 start src/server.js --name aps-edu-backend \
  --env production \
  --max-memory-restart 512M \
  --restart-delay 3000

pm2 save
echo "✓ Deploy concluído! API rodando em http://localhost:3000"
DEPLOY

chmod +x "$HOME/deploy-backend.sh"

# ── Resumo ────────────────────────────────────────────────
echo ""
echo "======================================================"
echo "  SETUP CONCLUÍDO!"
echo "======================================================"
echo ""
echo "  Próximos passos:"
echo ""
echo "  1. Copie o backend para a VM:"
echo "     scp -r backend/ ubuntu@<IP>:$APP_DIR"
echo ""
echo "  2. Crie o arquivo .env:"
echo "     cp $APP_DIR/.env.oracle.example $APP_DIR/.env"
echo "     nano $APP_DIR/.env"
echo "     (preencha JWT_SECRET, GEMINI_API_KEY, CORS_ORIGIN)"
echo ""
echo "  3. Execute o deploy:"
echo "     ~/deploy-backend.sh"
echo ""
echo "  4. Escaneie o QR Code:"
echo "     No painel web: clique em 'Conectar WhatsApp real'"
echo "     O QR vai aparecer — escaneie com seu celular"
echo ""
echo "  5. Configure BACKEND_URL no Vercel:"
echo "     BACKEND_URL=http://<IP_PUBLICO>:3000/api"
echo ""
echo "  URL da API: http://$(curl -s ifconfig.me 2>/dev/null || echo '<IP_PUBLICO>'):3000"
echo "  Docs: http://$(curl -s ifconfig.me 2>/dev/null || echo '<IP_PUBLICO>'):3000/docs"
echo ""
