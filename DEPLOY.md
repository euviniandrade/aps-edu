# Deploy — APS EDU no Fly.io + GitHub

## Visão geral

```
GitHub (main branch)
  ├── push em backend/  → GitHub Actions → Fly.io (aps-edu-api)
  └── push em web-admin/ → GitHub Actions → Fly.io (aps-edu-web)
```

URLs finais:
- **API**: https://aps-edu-api.fly.dev
- **Painel Web**: https://aps-edu-web.fly.dev
- **Docs API**: https://aps-edu-api.fly.dev/docs

---

## PASSO 1 — Instalar o Fly CLI

```bash
# Windows (PowerShell como Administrador)
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

Depois faça login:
```bash
fly auth login
```

---

## PASSO 2 — Criar repositório no GitHub

1. Acesse https://github.com/new
2. Crie um repositório chamado `aps-edu` (privado ou público)
3. Na pasta do projeto, execute:

```bash
cd C:\Users\vinicius.felix\Adventistas\aps-edu

git init
git add .
git commit -m "feat: APS EDU - projeto inicial completo"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/aps-edu.git
git push -u origin main
```

> Substitua `SEU_USUARIO` pelo seu nome de usuário do GitHub.

---

## PASSO 3 — Criar o banco de dados PostgreSQL no Fly.io

```bash
fly postgres create --name aps-edu-db --region gru --vm-size shared-cpu-1x --volume-size 3
```

Anote a `DATABASE_URL` que aparece no output — você vai precisar dela.

---

## PASSO 4 — Criar o Redis no Fly.io (Upstash)

```bash
fly ext upstash-redis create --name aps-edu-redis --region gru
```

Anote a `REDIS_URL` que aparece.

---

## PASSO 5 — Criar o app backend no Fly.io

```bash
cd backend
fly apps create aps-edu-api
```

Conectar ao banco:
```bash
fly postgres attach aps-edu-db --app aps-edu-api
```

Configurar as variáveis de ambiente (secrets):
```bash
fly secrets set --app aps-edu-api \
  JWT_SECRET="troque_por_uma_string_longa_e_aleatoria_32chars" \
  JWT_REFRESH_SECRET="outra_string_longa_e_aleatoria_diferente_32chars" \
  REDIS_URL="redis://SEU_REDIS_URL_AQUI" \
  NODE_ENV="production" \
  CORS_ORIGIN="https://aps-edu-web.fly.dev"
```

> Para gerar strings seguras: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## PASSO 6 — Criar o app web-admin no Fly.io

```bash
cd ../web-admin
fly apps create aps-edu-web
```

---

## PASSO 7 — Fazer o primeiro deploy manual

```bash
# Backend
cd backend
fly deploy

# Web Admin
cd ../web-admin
fly deploy
```

Aguarde o build e deploy (pode levar 3-5 minutos na primeira vez).

---

## PASSO 8 — Rodar o seed inicial (dados padrão)

Após o backend estar online:
```bash
cd backend
fly ssh console --app aps-edu-api -C "node src/prisma/seed.js"
```

Isso cria os usuários padrão, roles e todos os 50 selos.

---

## PASSO 9 — Configurar GitHub Actions (deploy automático)

Para que o GitHub faça deploy automático a cada push na branch `main`:

### 9.1 — Gerar tokens do Fly.io

```bash
# Token para o backend
fly tokens create deploy --app aps-edu-api --name "github-actions-backend"

# Token para o web-admin
fly tokens create deploy --app aps-edu-web --name "github-actions-web"
```

### 9.2 — Adicionar os tokens como Secrets no GitHub

1. Acesse: `https://github.com/SEU_USUARIO/aps-edu/settings/secrets/actions`
2. Clique em **New repository secret**
3. Adicione:
   - Nome: `FLY_API_TOKEN_BACKEND` → Valor: (token do backend)
   - Nome: `FLY_API_TOKEN_WEB` → Valor: (token do web-admin)

### 9.3 — Testar o pipeline

Faça qualquer alteração e dê push:
```bash
git add .
git commit -m "chore: testar pipeline de deploy"
git push
```

Acompanhe em: `https://github.com/SEU_USUARIO/aps-edu/actions`

---

## Fluxo de deploy automático

```
Você faz push na branch main
         ↓
GitHub Actions detecta mudanças
         ↓
   ┌─────┴─────┐
   ↓           ↓
backend/    web-admin/
mudou?       mudou?
   ↓           ↓
fly deploy  fly deploy
   ↓           ↓
aps-edu-api  aps-edu-web
.fly.dev     .fly.dev
```

Apenas o app que teve arquivos alterados é redeploy-ado.

---

## Verificar se está tudo funcionando

```bash
# Checar status do backend
fly status --app aps-edu-api

# Ver logs em tempo real
fly logs --app aps-edu-api

# Checar status do web-admin
fly status --app aps-edu-web
```

Acesse:
- API Health: https://aps-edu-api.fly.dev/health
- Swagger Docs: https://aps-edu-api.fly.dev/docs
- Painel Web: https://aps-edu-web.fly.dev

Login padrão:
- Email: `admin@aps.edu.br`
- Senha: `Admin@123`

---

## App Mobile — apontar para produção

Após o backend estar no ar, edite `mobile/lib/core/api/api_client.dart`:

```dart
// Troque:
const String kBaseUrl = 'http://10.0.2.2:3000/api';

// Por:
const String kBaseUrl = 'https://aps-edu-api.fly.dev/api';
```

Então gere o APK de produção:
```bash
cd mobile
flutter build apk --release
```

O APK estará em: `build/app/outputs/flutter-apk/app-release.apk`

---

## Comandos úteis do dia a dia

```bash
# Ver logs do backend
fly logs --app aps-edu-api

# Abrir console no servidor
fly ssh console --app aps-edu-api

# Ver variáveis de ambiente configuradas
fly secrets list --app aps-edu-api

# Escalar máquina (se precisar de mais recursos)
fly scale vm shared-cpu-1x --memory 1024 --app aps-edu-api

# Reiniciar o app
fly apps restart aps-edu-api
```
