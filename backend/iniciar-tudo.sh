#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# 🚀 SCRIPT AUTOMÁTICO: Inicia tudo
# ═══════════════════════════════════════════════════════════════════════════

clear

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║           🚀 INICIANDO APS EDU - WHATSAPP CRM                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Ir para pasta do backend
BACKEND_PATH="/c/Users/vinicius.felix/Projetos/aps-edu/backend"
cd "$BACKEND_PATH"

echo "📍 PASSO 1: Verificando Node.js..."
NODE_VERSION=$(node --version)
echo "✅ Node.js $NODE_VERSION"

echo ""
echo "📍 PASSO 2: Instalando dependências (se necessário)..."
if [ ! -d "node_modules" ]; then
    echo "  • npm install..."
    npm install >/dev/null 2>&1
    echo "✅ Dependências instaladas"
else
    echo "✅ Dependências já instaladas"
fi

echo ""
echo "📍 PASSO 3: Preparando banco de dados..."
if [ ! -f "prisma/dev.db" ]; then
    echo "  • Criando banco..."
    npx prisma migrate dev --name init >/dev/null 2>&1
    echo "✅ Banco criado"
else
    echo "✅ Banco já existe"
fi

echo ""
echo "📍 PASSO 4: Iniciando Redis (Docker)..."
docker ps | grep redis-aps >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Redis já está rodando"
else
    echo "  • Iniciando container Redis..."
    docker run -d -p 6379:6379 --name redis-aps redis:latest >/dev/null 2>&1
    sleep 2
    echo "✅ Redis iniciado"
fi

echo ""
echo "📍 PASSO 5: Iniciando servidor..."
echo "  • node src/server.js"
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                   ✅ PRONTO PARA USAR!                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Acesso: http://localhost:3000"
echo "📊 Dashboard: http://localhost:3000/dashboard"
echo ""
echo "Iniciando servidor..."
echo ""

# Iniciar servidor
node src/server.js
