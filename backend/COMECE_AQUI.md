# 🚀 COMECE AQUI - GUIA DE EXECUÇÃO

## ⚡ FORMA MAIS RÁPIDA (2 CLIQUES)

### Windows:

**Duplo-clique em:**
```
iniciar-plataforma.bat
```

**Pronto!** O script vai:
- ✅ Verificar Node.js
- ✅ Iniciar Redis
- ✅ Iniciar servidor
- ✅ Testar tudo
- ✅ Mostrar instruções

---

## 🔧 ALTERNATIVA: PowerShell

Abra PowerShell e rode:

```powershell
cd "C:\Users\vinicius.felix\Projetos\aps-edu\backend"
.\iniciar-plataforma.ps1
```

---

## 📝 ALTERNATIVA: Manual no Terminal

Se quiser controlar tudo manualmente:

### Terminal 1: Redis
```powershell
docker run -d -p 6379:6379 --name redis-aps redis:latest
redis-cli ping
# Esperado: PONG
```

### Terminal 2: Servidor
```powershell
cd "C:\Users\vinicius.felix\Projetos\aps-edu\backend"
node src/server.js
```

**Você verá:**
```
Server listening at http://0.0.0.0:3000
🔐 QR CODE GERADO - ESCANEIE PARA CONECTAR
[QR CODE ASCII aqui]
```

### Terminal 3: Testes
```powershell
curl http://localhost:3000/health
curl http://localhost:3000/dashboard
```

---

## 📱 CONECTAR WHATSAPP

Quando vir o QR CODE no terminal:

1. **Abra WhatsApp no celular**
2. Vá em **Configurações** ⚙️
3. **Dispositivos vinculados**
4. **Vincular um dispositivo**
5. **Aponte a câmera para o QR CODE** que apareceu no terminal
6. Pronto! ✅ WhatsApp conectado!

---

## 🌐 ACESSAR DASHBOARD

Abra seu navegador em:

```
http://localhost:3000/dashboard
```

Você verá **métricas em tempo real**:
- 📊 Mensagens recebidas
- 💾 Cache hit rate
- ⚡ Latência
- 📱 Status do WhatsApp
- 🔴 Taxa de erro

---

## 🧪 TESTAR TUDO FUNCIONANDO

### Teste 1: Health Check
```powershell
curl http://localhost:3000/health
```

Esperado: JSON com `status: "ok"`

### Teste 2: Enviar Mensagem
```powershell
$body = @{
    chatId = "5511999999999@c.us"
    text = "Teste!"
} | ConvertTo-Json

curl -X POST http://localhost:3000/messages/send `
  -H "Content-Type: application/json" `
  -Body $body
```

Esperado: JSON com `jobId`

### Teste 3: Busca Knowledge Base
```powershell
curl "http://localhost:3000/kb/search?q=teste"
```

Esperado: Array de artigos

---

## 📁 ARQUIVOS CRIADOS PARA VOCÊ

```
backend/
├── iniciar-plataforma.bat      ← Duplo-clique AQUI!
├── iniciar-plataforma.ps1      ← Alternativa PowerShell
├── setup-automatico.ps1        ← Setup apenas
├── iniciar-tudo.sh             ← Para WSL/Linux
├── COMECE_AQUI.md             ← Este arquivo
├── .env                        ← Configurações
├── prisma/dev.db              ← Banco de dados SQLite
└── src/server.js              ← Servidor principal
```

---

## 🐛 SE ALGO DER ERRO

### Porta 3000 já está em uso?
```powershell
netstat -ano | findstr 3000
taskkill /PID [PID] /F
```

### Redis não conecta?
```powershell
docker ps                    # Ver containers
docker stop redis-aps        # Parar container
docker rm redis-aps          # Remover
docker run -d -p 6379:6379 --name redis-aps redis:latest  # Reiniciar
```

### Banco de dados corrompido?
```powershell
rm prisma/dev.db
npx prisma migrate dev --name init
```

### Servidor não inicia?
```powershell
# Verifique logs no terminal
node src/server.js
# Procure por erros
```

---

## ✅ PRÓXIMOS PASSOS

Depois que tudo estiver rodando:

1. **Integrar sua IA** (OpenAI, Claude, etc)
   - Editar: `backend/src/server.js`
   - Adicionar sua API key em `.env`

2. **Adicionar artigos na Knowledge Base**
   ```powershell
   curl -X POST http://localhost:3000/kb/article `
     -H "Content-Type: application/json" `
     -d '{
       "title": "Como fazer...",
       "content": "Instruções...",
       "category": "categoria"
     }'
   ```

3. **Configurar Telegram para alertas**
   - Adicionar `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` no `.env`

4. **Monitorar em real-time**
   - Dashboard: http://localhost:3000/dashboard

---

## 📞 DOCUMENTAÇÃO

Consulte também:
- `IMPLEMENTACAO_PARTE_1.md` - Estabilidade WhatsApp
- `IMPLEMENTACAO_PARTE_2.md` - Performance & Cache
- `IMPLEMENTACAO_PARTE_3.md` - IA & Operacional
- `SERVER_INTEGRATION.md` - Integração completa
- `CHECKLIST_PRODUCAO.md` - Antes de produção

---

## 🎊 SUCESSO!

Se conseguiu conectar WhatsApp e ver o dashboard, **você tem uma plataforma profissional funcionando!** 🚀

**Parabéns!** 🎉

