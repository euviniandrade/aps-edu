# APS-EDU - Estado Técnico Atual (2026-05-31)

## Caminho do projeto
- `C:\Users\vinicius.felix\Projetos\aps-edu`

## Branch atual
- `main`

## Últimos commits (topo)
1. `dc5bfb1` feat(local-server): servidor WhatsApp standalone para Windows
2. `052bd53` chore(backend): ecosystem.config.js com limite de memória PM2
3. `ecc58fa` refactor(whatsapp): página limpa sem dados fictícios
4. `703d724` fix(whatsapp-ui): normalizePhone no handler
5. `e7a18b0` fix(whatsapp): suporte a `@lid`

## Worktree local (não commitado)
- Alterados:
  - `backend/INICIAR-WHATSAPP.bat`
  - `backend/TUNEL-CLOUDFLARE.bat`
  - `backend/package.json`
  - `backend/src/modules/whatsapp/whatsapp.service.js`
  - `web-admin/.env.local`
  - `web-admin/package-lock.json`
  - `web-admin/package.json`
  - `web-admin/src/app/api/whatsapp-live/[...path]/route.ts`
  - `web-admin/src/app/whatsapp/page.tsx`
  - `web-admin/src/components/ai/AiAssistant.tsx`
- Novos (não rastreados):
  - `backend/ATUALIZAR-VERCEL.bat`
  - `backend/INICIAR-EVOLUTION.bat`
  - `backend/ecosystem.local.config.js`
  - `backend/ngrok-runner.js`
  - `backend/prisma/whatsapp.prisma`
  - `backend/relay.js`
  - `backend/whatsapp.js`
  - `backend/whatsapp.db`
  - diretórios de sessão/cache/binários (`backend/sessions`, `backend/.wwebjs_cache`, `backend/node_modules_node`, `backend/ngrok.exe`, etc.)
  - `evolution-api/` completo

## Arquiteturas ativas encontradas

### A) Stack local standalone (mais recente e alinhada ao pedido)
- Entrada WhatsApp: `backend/whatsapp.js`
  - `whatsapp-web.js` + Chrome headless
  - SQLite via Prisma (`backend/whatsapp.db`)
  - API local em `http://localhost:8081`
  - Publicação real-time no Pusher (`whatsapp-sofi`)
- Relay/túnel:
  - `backend/relay.js` na porta `8079`
  - proxy para `8081`
  - webhook + SSE fallback
  - ngrok/cloudflare via `.bat`
- Front:
  - `web-admin/src/app/whatsapp/page.tsx` com Pusher (`pusher-js`)
  - `web-admin/src/app/api/whatsapp-live/[...path]/route.ts` proxy para `ngrok`/backend

### B) Stack legado paralela (conflitante)
- `backend/src/modules/whatsapp/*` integrado ao Fastify principal.
- Essa implementação coexistindo com a stack A pode gerar ambiguidade operacional.

## Fluxo funcional detectado hoje
1. Mensagem chega no WhatsApp.
2. `backend/whatsapp.js` salva no SQLite (`waChat`, `waMessage`).
3. Evento é publicado no Pusher.
4. `web-admin/src/app/whatsapp/page.tsx` recebe e atualiza UI instantaneamente.
5. Para chamadas HTTP, Next route proxy encaminha para backend exposto por túnel.

## Riscos críticos identificados
1. Segredos expostos em arquivos locais (`.bat`, `relay.js`, etc.):
   - `GEMINI_API_KEY`
   - `WHATSAPP_API_KEY`
   - `PUSHER_SECRET`
2. Dois caminhos de backend WhatsApp concorrendo (stack A e B).
3. Diretórios pesados de sessão/cache/binários dentro do repo local (não devem ir para git remoto).

## Decisão recomendada para continuidade
1. Adotar oficialmente a Stack A (standalone local + SQLite + Pusher + túnel).
2. Isolar/arquivar a Stack B (Fastify whatsapp module) para evitar colisão.
3. Rotacionar imediatamente chaves expostas.
4. Criar `.gitignore` específico para:
   - `backend/sessions/`
   - `backend/.wwebjs_cache/`
   - `backend/whatsapp.db`
   - `backend/node_modules_node/`
   - `backend/*.exe`
5. Consolidar runbook único (start, tunnel, vercel env, webhook, health checks).

