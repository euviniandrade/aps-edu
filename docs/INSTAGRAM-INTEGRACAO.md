# Instagram CRM - Ativacao

Este modulo foi integrado no backend local `backend/whatsapp.js` e no frontend `web-admin/src/app/whatsapp/page.tsx` (aba `Instagram`).

## Variaveis de ambiente (backend)

Defina no backend local:

```env
INSTAGRAM_VERIFY_TOKEN=seu_token_de_verificacao
INSTAGRAM_PAGE_TOKEN=token_longo_da_pagina
INSTAGRAM_BUSINESS_ID=id_da_conta_business_instagram
INSTAGRAM_GRAPH_VERSION=v23.0
```

## Endpoints implementados

- `GET /instagram/webhook` - verificacao do webhook Meta (`hub.challenge`)
- `POST /instagram/webhook` - recebimento de eventos (comentarios e mensagens)
- `GET /instagram/state` - estado de configuracao
- `GET /instagram/rules` - lista de regras de palavra-chave
- `POST /instagram/rules` - salva regras
- `POST /instagram/control` - ativa/desativa automacao e gate de follow
- `GET /instagram/events` - historico dos ultimos eventos
- `GET /instagram/conversations` - conversas do Instagram em memoria
- `POST /instagram/send-dm` - envio manual de DM por user id

## Fluxo de automacao atual

1. Comentario chega no webhook.
2. Sistema encontra regra por palavra-chave.
3. Se automacao ativa:
   - Sem gate: envia private reply + DM.
   - Com gate: envia private reply pedindo follow e liberacao.
4. Evento e conversa sao armazenados e publicados via Pusher.

## Frontend

Aba `Instagram` dentro de `https://aps-edu.vercel.app/whatsapp` com:

- status de token/verificacao
- ativacao de automacao
- ativacao de gate de follow
- editor de regras
- envio de DM de teste
- feed de eventos

## Passo final para funcionar no Vercel

No `web-admin`, garanta `BACKEND_URL` apontando para o backend que contem esse codigo.
Se `BACKEND_URL` apontar para outro tunel/servidor, os endpoints `instagram-*` retornam vazio.
