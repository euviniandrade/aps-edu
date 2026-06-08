# 🚀 GUIA DE DEPLOYMENT - FASE 1

**Data:** 07/06/2026  
**Status:** Pronto para deploy em produção

---

## 📋 RESUMO DO DEPLOYMENT

Você tem **2 aplicações** para fazer deploy:

1. **Backend** (Fastify) → Railway.app
2. **Frontend** (Next.js) → Vercel (já integrado)

---

## PASSO 1️⃣: Deploy Backend no Railway

### Pré-requisitos:
- ✅ Conta GitHub (já tem)
- ✅ Repositório aps-edu no GitHub

### Instruções:

1. **Acesse Railway.app:**
   ```
   https://railway.app
   ```

2. **Faça login com GitHub:**
   - Clique em "Login with GitHub"
   - Autorize o Railway

3. **Crie novo projeto:**
   - Clique em "Create a New Project"
   - Selecione "Deploy from GitHub repo"

4. **Selecione o repositório:**
   - Busque: `aps-edu`
   - Clique para selecionar
   - Autorize o Railway acessar o repo

5. **Configure as variáveis de ambiente:**
   - Clique em "Add Environment Variables"
   - Copie todas do arquivo `.env.example`:

   ```
   # .env.example do backend
   DATABASE_URL=postgresql://...  (deixe vazio, Railway cria)
   PORT=3000
   NODE_ENV=production
   JWT_SECRET=seu-secreto-aleatorio
   REDIS_URL=redis://...  (deixe vazio, Railway cria se usar Redis)
   WHATSAPP_ENABLED=true
   WHATSAPP_API_KEY=aps-edu-whatsapp
   GEMINI_API_KEY=sua-api-key-do-google
   CORS_ORIGIN=https://aps-edu.vercel.app
   ```

   **⚠️ IMPORTANTE:** 
   - `DATABASE_URL`: Railway cria automaticamente quando adicionar PostgreSQL
   - `GEMINI_API_KEY`: Pegue em https://makersuite.google.com/app/apikey

6. **Adicione Database PostgreSQL:**
   - Clique em "Add Service"
   - Selecione "PostgreSQL"
   - Railway configura `DATABASE_URL` automaticamente
   - Clique em "Deploy"

7. **Aguarde o deploy:**
   - Railway compila o Node.js
   - Executa `npx prisma migrate deploy`
   - Inicia o servidor
   - Status muda para "Running" (verde)

8. **Copie a URL do backend:**
   - Na seção "Deployment", encontre "Domain"
   - Copie a URL, algo como: `https://aps-edu-production-xxxx.railway.app`

---

## PASSO 2️⃣: Atualizar Frontend para apontar para o Backend

### Arquivos a modificar:

**Arquivo:** `web-admin/src/app/api/v1/[...slug]/route.ts`

**Mude:**
```typescript
// ANTES (localhost)
const BACKEND_URL = 'http://localhost:3000'

// DEPOIS (Railway)
const BACKEND_URL = 'https://aps-edu-production-xxxx.railway.app'
```

**Salve o arquivo!**

---

## PASSO 3️⃣: Deploy Frontend no Vercel

Vercel já está integrado com seu GitHub. Ele vai fazer deploy automaticamente quando você fizer push!

### Opção A: Push automático (recomendado)

```bash
cd C:\Users\vinicius.felix\Projetos\aps-edu

# Atualizar arquivo
# (já feito no passo anterior)

# Commit
git add web-admin/src/app/api/v1/\[...-slug\]/route.ts
git commit -m "Deploy: Apontar para backend Railway"

# Push
git push origin main

# Vercel faz deploy automaticamente!
```

### Opção B: Fazer push manualmente via Vercel Dashboard

1. Acesse: https://vercel.com/dashboard
2. Selecione projeto `aps-edu`
3. Vá em "Deployments"
4. Clique "Redeploy" (força novo deploy)

---

## PASSO 4️⃣: Verificar se tudo está funcionando

### Teste 1: Backend respondendo?

```bash
curl https://aps-edu-production-xxxx.railway.app/api/whatsapp/health/extended \
  -H "x-wa-key: aps-edu-whatsapp"
```

**Esperado:** 200 OK com JSON

### Teste 2: Frontend conectado ao backend?

```
https://aps-edu.vercel.app/whatsapp
```

**Esperado:**
- Página carrega ✅
- Conversas listam (ou vazias se nenhuma msg recebida)
- Status mostra WhatsApp desconectado (normal, precisa conectar)

### Teste 3: Conectar WhatsApp

```
https://aps-edu.vercel.app/whatsapp/qr-html
```

**Esperado:**
- QR code aparece
- Escaneie com seu telefone
- Status muda para "Conectado"

### Teste 4: Verificar métricas

```
https://aps-edu-production-xxxx.railway.app/api/whatsapp/metrics
```

**Esperado:** JSON com métricas do sistema

---

## 🔗 URLS FINAIS

| URL | Função |
|-----|--------|
| `https://aps-edu.vercel.app` | Site principal |
| `https://aps-edu.vercel.app/whatsapp` | WhatsApp CRM |
| `https://aps-edu-production-xxxx.railway.app/api/whatsapp/metrics` | Métricas backend |

---

## ⚠️ TROUBLESHOOTING

### Problema: "Cannot connect to backend"
**Causa:** Railway ainda deployando ou URL incorreta
**Solução:** 
1. Aguarde 2-3 minutos
2. Verifique a URL do Railway
3. Verifique `DATABASE_URL` está configurada

### Problema: "Database error"
**Causa:** PostgreSQL não sincronizado
**Solução:**
1. Vá em Railway Dashboard → PostgreSQL
2. Verifique se está "Running"
3. Railway auto-executa `prisma migrate deploy`

### Problema: "CORS error"
**Causa:** `CORS_ORIGIN` não está configurada no backend
**Solução:**
1. Railway → Backend → Environment Variables
2. Adicione: `CORS_ORIGIN=https://aps-edu.vercel.app`

---

## ✅ CHECKLIST FINAL

```
[ ] Repositório commitado no GitHub (main branch)
[ ] Conta Railway criada
[ ] Projeto Railway criado
[ ] PostgreSQL adicionado
[ ] Variáveis de ambiente configuradas
[ ] Deploy do backend concluído (status: Running)
[ ] URL do backend copiada
[ ] Frontend atualizado com URL do backend
[ ] Push do frontend feito (Vercel auto-deploya)
[ ] Todos os testes passando
[ ] WhatsApp conectado no site
[ ] Métricas respondendo
```

---

## 🎯 PRÓXIMOS PASSOS

Após confirmar que tudo está funcionando:

1. **FASE 2:** Implementar Envio em Massa (4-6h)
2. **FASE 3:** Implementar IA Automática (6-8h)
3. **FASE 4:** Dashboard & Analytics (8-10h)

---

## 📞 SUPORTE

**Dúvidas sobre o deployment?**

1. Verifique os logs no Railway Dashboard
2. Consulte documentação do Railway: https://docs.railway.app
3. Veja FASE_1_*.md para referência técnica

---

**Bom deployment!** 🚀
