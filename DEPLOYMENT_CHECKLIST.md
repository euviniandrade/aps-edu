# ✅ DEPLOYMENT CHECKLIST

## 🚀 ANTES DE COMEÇAR

```
☐ Você tem conta GitHub com repositório 'aps-edu'
☐ Você tem conta no Railway.app (ou Render.com)
☐ Você tem API Key do Google Generative AI (Gemini)
☐ Você tem Vercel conectado ao GitHub
```

---

## 📋 RAILWAY DEPLOYMENT (Backend)

### Setup Railway

```
☐ Acesse https://railway.app
☐ Login com GitHub
☐ New Project → Deploy from GitHub repo
☐ Selecione 'aps-edu' repository
☐ Autorize Railway acessar seu GitHub
```

### Configurar PostgreSQL

```
☐ Clique "Add Service"
☐ Selecione "PostgreSQL"
☐ Railway cria DATABASE_URL automaticamente
☐ Status mudou para "Running" (verde)?
```

### Configurar Variáveis de Ambiente

```
☐ Railway Dashboard → Environment
☐ Adicione todas as variáveis:

  PORT=3000
  NODE_ENV=production
  JWT_SECRET=seu-secreto-forte-aqui
  WHATSAPP_ENABLED=true
  WHATSAPP_API_KEY=aps-edu-whatsapp
  CORS_ORIGIN=https://aps-edu.vercel.app
  GEMINI_API_KEY=sua-api-key-aqui

☐ DATABASE_URL foi criada automaticamente? (deixe como está)
```

### Fazer Deploy

```
☐ Railway faz deploy automático
☐ Aguarde 3-5 minutos
☐ Status mudou para "Running"?
☐ Copie a URL do backend (em "Domain")
   Exemplo: https://aps-edu-production-xxxx.railway.app
```

---

## 🌐 VERCEL DEPLOYMENT (Frontend)

### Atualizar Código

```
☐ Abra: web-admin/src/app/api/v1/[...slug]/route.ts
☐ Encontre: const BACKEND_URL = ...
☐ Mude para sua URL do Railway
☐ Salve o arquivo
```

### Fazer Push

```bash
# No seu PC
cd C:\Users\vinicius.felix\Projetos\aps-edu

☐ git add web-admin/src/app/api/v1/\[...-slug\]/route.ts
☐ git commit -m "Deploy: Atualizar URL backend"
☐ git push origin main
```

### Vercel Auto-Deploy

```
☐ Acesse https://vercel.com/dashboard
☐ Selecione projeto 'aps-edu'
☐ Aguarde "Building"
☐ Status mudou para "Ready"?
```

---

## 🧪 TESTES FINAIS

### Teste 1: Backend Respondendo?

```bash
curl https://SEU-BACKEND-URL/api/whatsapp/health/extended \
  -H "x-wa-key: aps-edu-whatsapp"
```

```
☐ Retornou 200 OK?
☐ JSON com dados de saúde?
```

### Teste 2: Frontend Acessível?

```
Acesse: https://aps-edu.vercel.app/whatsapp
```

```
☐ Página carrega sem erro?
☐ Mostra "WhatsApp" no título?
☐ Pode escanear QR?
```

### Teste 3: QR Code Funcionando?

```
https://aps-edu.vercel.app/whatsapp/qr-html
```

```
☐ QR code aparece?
☐ Escaneie com seu telefone
☐ Status mudou para "Conectado"?
```

### Teste 4: Mensagens Funcionando?

```
☐ Envie uma mensagem via WhatsApp
☐ Vá em https://aps-edu.vercel.app/whatsapp
☐ A mensagem aparece na conversa?
☐ Pode responder?
```

### Teste 5: API Metrics

```
https://SEU-BACKEND-URL/api/whatsapp/metrics
```

```
☐ Retorna JSON com métricas?
☐ Mostra requestCount > 0?
☐ Cache hit rate exibido?
```

---

## 🚨 TROUBLESHOOTING

### Erro: "Cannot connect to backend"

```
☐ Verifique a URL do Railway está correta
☐ Railway status está "Running"?
☐ CORS_ORIGIN está configurado?
☐ Aguarde mais 5 minutos (Railway pode estar deployando)
```

### Erro: "Database Error"

```
☐ PostgreSQL status está "Running"?
☐ DATABASE_URL está preenchida?
☐ Vá em Railway Dashboard → PostgreSQL → Logs
☐ Procure por erro específico
```

### Erro: "401 Unauthorized"

```
☐ x-wa-key está correto? (aps-edu-whatsapp)
☐ Header está sendo enviado?
☐ Verifique CORS_ORIGIN no backend
```

### Erro: "502 Bad Gateway"

```
☐ Backend está rodando? (Railway logs)
☐ Procure por erros em Railway → Logs
☐ Reinicie o dyno (Redeploy)
```

---

## 📞 VERIFICAÇÃO RÁPIDA

```
Tudo funcionando? Veja:

[ ] Vercel: https://vercel.com/dashboard → aps-edu → Status "Ready"
[ ] Railway: https://railway.app → Dashboard → Backend "Running"
[ ] Site: https://aps-edu.vercel.app/whatsapp → Carrega
[ ] WhatsApp: Conectado (QR escaneado)
[ ] Mensagens: Podem enviar/receber
[ ] Métricas: API retorna dados
```

---

## ✨ PRONTO!

Se todos os testes passaram:

```
✅ Backend em produção
✅ Frontend em produção
✅ WhatsApp funcionando
✅ Tudo integrado
```

---

## 🎯 PRÓXIMAS AÇÕES

```
1. Conectar mais dispositivos WhatsApp
2. Implementar FASE 2 (Envio em Massa)
3. Implementar FASE 3 (IA Automática)
4. Implementar FASE 4 (Dashboard)
```

---

**Data:** 07/06/2026  
**Status:** Pronto para deployment
