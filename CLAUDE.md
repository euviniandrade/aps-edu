# CLAUDE.md — APS EDU / SOFI

Guia para agentes de IA (Claude Code, CODEX) trabalhando neste repositório.
Leia este arquivo inteiro antes de fazer qualquer mudança.

---

## O que é este projeto

**SOFI** é o sistema de gestão educacional da **Associação Paulista Sul (APS EDU)**.
Ele centraliza tarefas, pessoas, eventos, comunicados, gamificação, WhatsApp CRM e integrações externas para coordenadores, diretores e promotores das unidades escolares.

---

## Estrutura do monorepo

```
/
├── backend/          → API REST principal (Node.js + Fastify + Prisma)
├── web-admin/        → Painel web administrativo (Next.js 15 + TypeScript)
├── mobile/           → App iOS/Android (Flutter + Riverpod)
├── desktop/          → Wrapper desktop (Electron)
├── apps-script/      → Backend legado/alternativo em Google Sheets (não é o principal)
├── docs/             → Benchmark e documentação estratégica
└── docker-compose.yml → PostgreSQL + Redis + Adminer para dev local
```

> **apps-script/** é um backend alternativo para ambientes sem infraestrutura Node.
> O backend Node.js (`backend/`) é o canônico para produção.

---

## Backend (`backend/`)

### Stack
- **Runtime:** Node.js 20+
- **Framework:** Fastify 4 (não Express — não adicione rotas Express)
- **ORM:** Prisma 5 com SQLite em dev, PostgreSQL em produção
- **Auth:** JWT (access 15min) + Refresh Token (30 dias) via `@fastify/jwt`
- **Uploads:** Disco local em `backend/uploads/` servido via `@fastify/static`
- **Push:** Firebase Admin SDK (FCM)
- **IA:** Google Gemini (`@google/generative-ai`)
- **WhatsApp:** Baileys (`@whiskeysockets/baileys`) — conecta via QR Code
- **Cache/Filas:** Redis via `ioredis`

### Convenções de código

- **Cada módulo** vive em `src/modules/<nome>/` com dois arquivos: `<nome>.routes.js` e (quando necessário) `<nome>.service.js`
- Rotas são funções async exportadas como `module.exports = async function(fastify) { ... }`
- Autenticação: `preHandler: [authenticate]` em toda rota privada
- Autorização: verificar `request.currentUser.role.slug` dentro da rota ou usar `authorize(...slugs)`
- Slugs de roles: `admin`, `director`, `vice_director`, `coordinator`, `promoter`, `teacher`
- Admins = `['admin', 'director']`; Gestores = `['admin', 'director', 'vice_director', 'coordinator']`
- Erros: `reply.code(404).send({ error: 'Mensagem em português' })`
- Sucesso: `reply.send(data)` ou `reply.code(201).send(data)` para criações
- Gamificação: chamar `gamificationService.addPoints(userId, 'event_type')` após ações relevantes
- Notificações: chamar `notificationService.send({...})` quando o usuário precisa ser alertado

### Rodar localmente
```bash
# 1. Banco de dados (Docker)
docker-compose up -d

# 2. Backend
cd backend
npm install
npm run db:migrate   # aplica migrações Prisma
npm run db:seed      # popula dados iniciais
npm run dev          # inicia com nodemon na porta 3000
```

### Comandos úteis
```bash
npm run db:studio    # Prisma Studio (visualizar banco)
npm run db:reset     # reset completo do banco + seed
```

### Adicionar um novo módulo
1. Criar `src/modules/<nome>/<nome>.routes.js`
2. Registrar em `src/server.js`: `fastify.register(require('./modules/<nome>/<nome>.routes'), { prefix: '/api/<nome>' })`
3. Adicionar modelos Prisma em `prisma/schema.prisma` se necessário
4. Rodar `npm run db:migrate`

### Schema Prisma — modelos principais
| Modelo | Finalidade |
|---|---|
| `User` | Usuário do sistema com role e unit |
| `Role` | Perfil de acesso (slug único) |
| `Unit` | Unidade escolar |
| `Task` | Tarefa com checklists, comentários e evidências |
| `Event` | Evento com responsáveis |
| `Announcement` | Comunicado com rastreamento de leitura |
| `Notification` | Notificação push in-app |
| `UserPoints` / `Badge` / `UserBadge` | Sistema de gamificação |
| `Lead` / `Conversation` / `Message` | CRM WhatsApp |
| `ExternalIntegration` | OAuth Google / Microsoft / Apple por usuário |
| `KnowledgeBase` | Base de conhecimento para IA |

---

## Web Admin (`web-admin/`)

### Stack
- **Framework:** Next.js 15 (App Router)
- **Linguagem:** TypeScript (strict)
- **Estilos:** Tailwind CSS 3
- **HTTP:** Axios via `src/lib/api.ts` — **todas as chamadas passam pelo proxy Next.js `/api/[...path]`**, nunca direto para o backend externo
- **Charts:** Recharts
- **Auth:** Cookies via `js-cookie` (`accessToken`, `refreshToken`, `user`)
- **Toast:** `ToastContext` em `src/contexts/ToastContext.tsx`

### Convenções
- Pages em `src/app/<rota>/page.tsx` (App Router)
- Componentes reutilizáveis em `src/components/<domínio>/NomeComponente.tsx`
- Chamadas à API: sempre `import api from '@/lib/api'` — nunca axios direto
- Refresh de token: tratado automaticamente no interceptor de `api.ts`
- `'use client'` obrigatório em componentes com estado, hooks ou eventos
- Mensagens de erro e labels de UI em **português**

### Rodar localmente
```bash
cd web-admin
npm install
npm run dev    # porta 3001
```

### Rotas de API (proxy Next.js)
- `src/app/api/[...path]/route.ts` → proxy genérico para o backend Fastify
- `src/app/api/gemini/route.ts` → Gemini AI direto (client-side seguro)
- `src/app/api/integrations/` → OAuth flow Google/Microsoft
- `src/app/api/transcribe/route.ts` → transcrição de áudio

### Páginas existentes
`/dashboard`, `/tasks`, `/events`, `/announcements`, `/users`, `/units`, `/roles`,
`/gamification`, `/analytics`, `/reports`, `/feedback`, `/notificacoes`,
`/gestao`, `/meu-dia`, `/minha-area`, `/pessoas`, `/promotores`,
`/automacoes`, `/inovacao`, `/configuracoes`, `/escolar-financeiro`, `/estoque`

---

## Mobile (`mobile/`)

### Stack
- **Framework:** Flutter 3+ / Dart
- **State:** Riverpod 2 + riverpod_annotation (use `@riverpod` e `build_runner`)
- **Navegação:** go_router 14
- **HTTP:** Dio com pretty_dio_logger
- **Storage local:** Hive (auth box, settings box)
- **Push:** Firebase Messaging (FCM)
- **Charts:** fl_chart

### Convenções
- Providers gerados: rodar `flutter pub run build_runner build --delete-conflicting-outputs`
- Arquitetura: `lib/core/` (router, theme, api, providers) + `lib/features/<feature>/` (screens, widgets, providers)
- Strings de UI em português

### Rodar
```bash
cd mobile
flutter pub get
flutter run
```

---

## Desktop (`desktop/`)

Wrapper Electron que carrega o web-admin como webview. Modificações de UI devem ser feitas no web-admin, não aqui.

---

## Deploy

| Serviço | Plataforma | Trigger |
|---|---|---|
| Backend | Fly.io | Push em `main` com mudanças em `backend/**` |
| Web Admin | Vercel | Push em `main` com mudanças em `web-admin/**` |

- CI definido em `.github/workflows/deploy-backend.yml` e `deploy-web-admin.yml`
- Variáveis de ambiente de produção configuradas no Fly.io e Vercel — nunca commitar `.env` real

---

## Variáveis de ambiente

### Backend (`backend/.env`)
```
DATABASE_URL         # SQLite em dev, PostgreSQL em prod
REDIS_URL
JWT_SECRET           # Trocar em produção — nunca usar o valor de exemplo
JWT_REFRESH_SECRET   # Trocar em produção
JWT_EXPIRES_IN       # padrão: 15m
GEMINI_API_KEY
FIREBASE_PROJECT_ID / FIREBASE_PRIVATE_KEY / FIREBASE_CLIENT_EMAIL
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET / MICROSOFT_TENANT_ID
INTEGRATION_ENCRYPTION_KEY
CORS_ORIGIN          # lista separada por vírgula
WHATSAPP_ENABLED     # true para conectar Baileys no boot
```

### Web Admin (`web-admin/.env.local`)
```
NEXT_PUBLIC_API_URL  # URL base do backend (Fly.io em prod)
GEMINI_API_KEY
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET
```

---

## Regras para agentes de IA

### O que PODE fazer
- Adicionar novos módulos no backend seguindo o padrão `routes.js` + `service.js`
- Criar novas pages/components no web-admin seguindo App Router e TypeScript
- Adicionar modelos ao `schema.prisma` e rodar migrações
- Corrigir bugs em módulos existentes
- Adicionar validação de entrada com `zod` no backend

### O que NÃO fazer
- **Não** adicionar rotas Express — o backend usa **somente Fastify**
- **Não** commitar arquivos `.env` com valores reais
- **Não** usar `localStorage` no web-admin (app usa cookies para auth)
- **Não** modificar o `desktop/` para mudar comportamento de UI — use `web-admin/`
- **Não** usar `fetch` direto no web-admin — sempre `import api from '@/lib/api'`
- **Não** remover o interceptor de refresh token em `api.ts`
- **Não** alterar slugs de roles existentes (`admin`, `director`, etc.) — quebra autorização em todo o sistema
- **Não** alterar o schema Prisma sem criar uma migração (`npm run db:migrate`)
- **Não** commitar `backend/prisma/dev.db` (adicionar ao `.gitignore` se não estiver)

### Ao criar uma nova feature completa
1. Schema Prisma → migração
2. `<modulo>.routes.js` no backend (com authenticate, gamificação e notificação onde aplicável)
3. Registrar rota em `server.js`
4. Page e componentes no web-admin em TypeScript
5. Provider + Screen no mobile se a feature for mobile-first

---

## Credenciais de desenvolvimento (apenas local)

| Usuário | Email | Senha | Role |
|---|---|---|---|
| Admin | admin@aps.edu.br | Admin@123 | admin |
| Diretor | diretor@aps.edu.br | Diretor@123 | director |
| Coordenador | coord@aps.edu.br | Coord@123 | coordinator |

---

## Pontos de atenção conhecidos

1. **`express` no `package.json` do backend** — dependência não utilizada, pode ser removida com segurança
2. **`backend/prisma/dev.db`** — verificar se está no `.gitignore`; não deve ser commitado
3. **Sem testes automatizados** — ao adicionar features críticas (auth, pagamentos, gamificação), considere testes unitários com Jest no backend e widget tests no Flutter
4. **Apps Script** — mantido como fallback para ambientes sem infra. Não sincronizar schema com ele manualmente; o backend Node.js é a fonte da verdade
