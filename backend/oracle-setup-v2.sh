#!/bin/bash
set -e

echo ""
echo "================================================"
echo "  APS-EDU — Setup Oracle Linux 9 — v2"
echo "================================================"
echo ""

# ── [1/7] Node.js 20 via NodeSource ──────────────────────
echo "=== [1/7] Node.js 20 (NodeSource) ==="
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
node -v && npm -v && echo "✓ Node OK" || { echo "✗ Node ERRO"; exit 1; }

# ── [2/7] Chromium ───────────────────────────────────────
echo ""
echo "=== [2/7] Chromium ==="
sudo dnf install -y chromium || sudo dnf install -y chromium-browser || true
CHROMIUM_PATH=$(which chromium 2>/dev/null || which chromium-browser 2>/dev/null || echo "")
if [ -n "$CHROMIUM_PATH" ]; then
  echo "✓ Chromium: $CHROMIUM_PATH"
  $CHROMIUM_PATH --version || true
else
  echo "⚠ Chromium não encontrado — tentando snap..."
  sudo dnf install -y snapd 2>/dev/null || true
fi

# ── [3/7] PostgreSQL ─────────────────────────────────────
echo ""
echo "=== [3/7] PostgreSQL ==="
sudo dnf install -y postgresql-server postgresql-contrib
sudo postgresql-setup --initdb 2>/dev/null || echo "(já inicializado)"
sudo systemctl enable postgresql --now
sleep 2
sudo -u postgres psql -c "CREATE USER aps_user WITH PASSWORD 'aps_secure_2025';" 2>/dev/null || echo "(user já existe)"
sudo -u postgres psql -c "CREATE DATABASE aps_edu OWNER aps_user;" 2>/dev/null || echo "(db já existe)"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE aps_edu TO aps_user;" 2>/dev/null || true
sudo -u postgres psql -c "\l" | grep aps_edu && echo "✓ PostgreSQL OK"

# ── [4/7] Redis ──────────────────────────────────────────
echo ""
echo "=== [4/7] Redis ==="
sudo dnf install -y redis
sudo systemctl enable redis --now
redis-cli ping && echo "✓ Redis OK" || echo "⚠ Redis não responde ainda"

# ── [5/7] PM2 ────────────────────────────────────────────
echo ""
echo "=== [5/7] PM2 ==="
sudo npm install -g pm2
pm2 --version && echo "✓ PM2 OK"
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u opc --hp /home/opc 2>/dev/null || true

# ── [6/7] Git + build tools ──────────────────────────────
echo ""
echo "=== [6/7] Git + dependências ==="
sudo dnf install -y git gcc-c++ make
git --version && echo "✓ Git OK"

# ── [7/7] Firewall ───────────────────────────────────────
echo ""
echo "=== [7/7] Firewall ==="
sudo firewall-cmd --permanent --add-port=3000/tcp 2>/dev/null || true
sudo firewall-cmd --permanent --add-port=5432/tcp 2>/dev/null || true
sudo firewall-cmd --reload 2>/dev/null || true
echo "✓ Porta 3000 liberada"

# ── Resumo ───────────────────────────────────────────────
echo ""
echo "================================================"
echo "  SETUP CONCLUIDO!"
echo ""
echo "  Node:  $(node -v)"
echo "  npm:   $(npm -v)"
echo "  PM2:   $(pm2 --version)"
echo "  Redis: $(redis-cli ping)"
echo "  PG:    $(sudo -u postgres psql -tAc 'SELECT version()' | head -c 40)..."
CHROM=$(which chromium 2>/dev/null || which chromium-browser 2>/dev/null || echo "NÃO ENCONTRADO")
echo "  Chrom: $CHROM"
echo "================================================"
echo ""
echo "Próximo passo: rodar /tmp/aps-deploy.sh"
echo ""
