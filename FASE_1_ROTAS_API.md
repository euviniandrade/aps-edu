# 🔌 REFERÊNCIA COMPLETA - ROTAS API FASE 1

**Base URL:** `http://localhost:3000/api/whatsapp`  
**Autenticação:** Header `x-wa-key: aps-edu-whatsapp`

---

## 📋 ÍNDICE

1. [Conversas](#conversas)
2. [Mensagens](#mensagens)
3. [IA & Sugestões](#ia--sugestões)
4. [Envio em Massa](#envio-em-massa)
5. [Métricas & Saúde](#métricas--saúde)

---

## 🗣️ CONVERSAS

### GET /conversations
Lista todas as conversas com paginação.

**Request:**
```bash
GET /api/whatsapp/conversations?skip=0&take=50
Host: localhost:3000
x-wa-key: aps-edu-whatsapp
Content-Type: application/json
```

**Query Parameters:**
| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| skip | number | 0 | Offset (paginação) |
| take | number | 50 | Limite de resultados |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "clh7x8j9k0123456789abcde",
      "leadId": "clh7x8j9k0123456789abcda",
      "lead": {
        "id": "clh7x8j9k0123456789abcda",
        "phoneNumber": "5511987654321",
        "contactName": "João Silva",
        "stage": "inbox"
      },
      "title": "João Silva",
      "lastMessage": "Olá, tudo bem?",
      "lastMessageAt": "2026-06-07T15:30:00.000Z",
      "messageCount": 5,
      "archived": false
    }
  ],
  "total": 42
}
```

**Erros Possíveis:**
| Status | Erro | Causa |
|--------|------|-------|
| 401 | Não autorizado | API key inválida/ausente |
| 500 | Database error | Erro no Prisma |

---

### GET /conversations/:id/messages
Carrega histórico de mensagens de uma conversa.

**Request:**
```bash
GET /api/whatsapp/conversations/clh7x8j9k0123456789abcde/messages?skip=0&take=50
Host: localhost:3000
x-wa-key: aps-edu-whatsapp
Content-Type: application/json
```

**Path Parameters:**
| Param | Descrição |
|-------|-----------|
| id | ID da conversa (CUID) |

**Query Parameters:**
| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| skip | number | 0 | Offset |
| take | number | 50 | Limite |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "clh7x8j9k0123456789abcd1",
      "conversationId": "clh7x8j9k0123456789abcde",
      "content": "Olá, tudo bem?",
      "contentType": "text",
      "messageId": "3EB0D6457C1DEB23A0A3",
      "timestamp": "2026-06-07T15:25:00.000Z",
      "fromPhone": "lead",
      "ackStatus": 3,
      "createdAt": "2026-06-07T15:25:00.000Z"
    }
  ]
}
```

---

## 💬 MENSAGENS

### POST /messages/reply/:conversationId
Envia resposta para uma conversa específica.

**Request:**
```bash
POST /api/whatsapp/messages/reply/clh7x8j9k0123456789abcde
Host: localhost:3000
x-wa-key: aps-edu-whatsapp
Content-Type: application/json

{
  "text": "Olá! Recebi sua mensagem. Como posso ajudar?"
}
```

**Body Parameters:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| text | string | ✅ | Texto da resposta (max 650 caracteres) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "clh7x8j9k0123456789abcd2",
    "conversationId": "clh7x8j9k0123456789abcde",
    "content": "Olá! Recebi sua mensagem. Como posso ajudar?",
    "contentType": "text",
    "messageId": "3EB0D6457C1DEB23A0A4",
    "timestamp": "2026-06-07T15:30:00.000Z",
    "fromPhone": "bot",
    "ackStatus": 1
  },
  "note": "Mensagem foi sanitizada (PII removido)"
}
```

**Erros Possíveis:**
| Status | Erro | Causa |
|--------|------|-------|
| 400 | Mensagem vazia | Body text vazio |
| 404 | Conversa não encontrada | ID inválido |
| 409 | WhatsApp não conectado | Device não conectado |
| 422 | Falha na validação | Padrão de injeção detectado |

---

## 🤖 IA & SUGESTÕES

### POST /ai/suggest/:conversationId
Gera sugestão de resposta usando IA (Gemini).

**Request:**
```bash
POST /api/whatsapp/ai/suggest/clh7x8j9k0123456789abcde
Host: localhost:3000
x-wa-key: aps-edu-whatsapp
Content-Type: application/json

{
  "userMessage": "Como faço para renovar meu cadastro?"
}
```

**Body Parameters:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| userMessage | string | ❌ | Mensagem do usuário (se omitido, usa última) |

**Response (200 OK):**
```json
{
  "success": true,
  "suggestion": "Você pode renovar seu cadastro através do portal online ou entrando em contato com nosso suporte.",
  "contextUsed": {
    "leadStage": "inbox",
    "leadScore": 75,
    "recentMessagesCount": 3
  }
}
```

**Features:**
- ✅ Integrado com Google Generative AI (Gemini)
- ✅ Respeita contexto do lead (estágio, score)
- ✅ Rate limit: 30 sugestões/hora
- ✅ Sanitização automática de PII

**Erros Possíveis:**
| Status | Erro | Causa |
|--------|------|-------|
| 404 | Conversa não encontrada | ID inválido |
| 429 | Limite atingido | > 30 sugestões/hora |
| 500 | Erro da IA | Gemini API indisponível |

---

## 📤 ENVIO EM MASSA

### POST /messages/bulk
Inicia envio em massa para múltiplos contatos.

**Request:**
```bash
POST /api/whatsapp/messages/bulk
Host: localhost:3000
x-wa-key: aps-edu-whatsapp
Content-Type: application/json

{
  "recipientIds": [
    "clh7x8j9k0123456789abcd1",
    "clh7x8j9k0123456789abcd2",
    "clh7x8j9k0123456789abcd3"
  ],
  "template": "Olá! Confira nossa promoção especial: 50% OFF. Link: https://..."
}
```

**Body Parameters:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| recipientIds | string[] | ✅ | Array de IDs de leads/conversas |
| template | string | ✅ | Mensagem a enviar (max 650 chars) |

**Response (200 OK):**
```json
{
  "success": true,
  "jobId": "bulk:1718030400000",
  "status": "processing",
  "message": "Envio em massa iniciado para 3 leads"
}
```

**Features:**
- ✅ Processamento em background (BullMQ)
- ✅ Prioridade média (3)
- ✅ Timeout: 30 minutos
- ✅ Retry automático: 2 tentativas
- ✅ Rate limiting automático (40 msgs/min)

**Erros Possíveis:**
| Status | Erro | Causa |
|--------|------|-------|
| 400 | Forneça recipientIds | Array vazio ou ausente |
| 400 | Forneça template | Template vazio |
| 422 | Padrão de injeção | Template contém SQL/XSS |

---

### GET /bulk/:jobId
Verifica status de um envio em massa.

**Request:**
```bash
GET /api/whatsapp/bulk/bulk:1718030400000
Host: localhost:3000
x-wa-key: aps-edu-whatsapp
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "bulk:1718030400000",
    "total": 3,
    "sent": 2,
    "failed": 0,
    "pending": 1,
    "status": "processing",
    "progress": 67
  }
}
```

---

## 📊 MÉTRICAS & SAÚDE

### GET /metrics
Retorna métricas operacionais do sistema.

**Request:**
```bash
GET /api/whatsapp/metrics
Host: localhost:3000
x-wa-key: aps-edu-whatsapp
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "success": true,
  "metrics": {
    "uptime": 3600000,
    "requests": 142,
    "errors": 3,
    "errorRate": 2.1,
    "avgResponseTime": 45,
    "aiRequests": 12,
    "aiSuccessRate": 92,
    "cacheHitRate": 78,
    "messagesSent": 28,
    "messagesReceived": 34,
    "queues": {
      "sendMessage": { "count": 0, "delayed": 0, "failed": 0 },
      "bulkSend": { "count": 1, "delayed": 0, "failed": 0 },
      "aiReply": { "count": 0, "delayed": 0, "failed": 0 }
    },
    "cache": {
      "enabled": true,
      "hitRate": 78,
      "hits": 98,
      "misses": 27,
      "sets": 125
    }
  }
}
```

**Métricas Disponíveis:**
| Métrica | Descrição |
|---------|-----------|
| uptime | Tempo que servidor está rodando (ms) |
| requests | Total de requisições processadas |
| errors | Total de erros |
| errorRate | Percentual de erros |
| avgResponseTime | Tempo médio de resposta (ms) |
| aiRequests | Total de requisições IA |
| aiSuccessRate | Taxa de sucesso IA (%) |
| cacheHitRate | Taxa de cache hits (%) |

---

### GET /health/extended
Status estendido do sistema.

**Request:**
```bash
GET /api/whatsapp/health/extended
Host: localhost:3000
x-wa-key: aps-edu-whatsapp
Content-Type: application/json
```

**Response (200 OK):**
```json
{
  "whatsapp": {
    "connected": true,
    "ready": true,
    "lastEvent": "2026-06-07T15:45:00.000Z"
  },
  "database": {
    "type": "Prisma/SQLite",
    "leads": 42,
    "conversations": 15,
    "messages": 234
  },
  "cache": {
    "enabled": true,
    "hitRate": 78,
    "hits": 98,
    "misses": 27,
    "sets": 125
  },
  "queues": {
    "sendMessage": { "count": 0, "delayed": 0, "failed": 0 },
    "bulkSend": { "count": 1, "delayed": 0, "failed": 0 },
    "aiReply": { "count": 0, "delayed": 0, "failed": 0 }
  }
}
```

---

## 🔐 Autenticação

### Header Obrigatório

Todas as rotas requerem:
```
x-wa-key: aps-edu-whatsapp
```

**Para frontend** (via Next.js proxy):
```javascript
// Já adicionado automaticamente no utils.ts
const headers = {
  'x-api-key': API_KEY,
  'Authorization': `Bearer ${API_KEY}`,
}
```

---

## ⏱️ Rate Limits

| Recurso | Limite | Janela |
|---------|--------|--------|
| Mensagens | 40 msgs | 1 minuto |
| Sugestões IA | 30/hora | 1 hora |
| Requisições | Sem limite | - |

---

## 🧪 Exemplos de Uso (cURL)

### Listar Conversas
```bash
curl -X GET \
  'http://localhost:3000/api/whatsapp/conversations?skip=0&take=10' \
  -H 'x-wa-key: aps-edu-whatsapp'
```

### Enviar Resposta
```bash
curl -X POST \
  'http://localhost:3000/api/whatsapp/messages/reply/clh7x8j9k0123456789abcde' \
  -H 'x-wa-key: aps-edu-whatsapp' \
  -H 'Content-Type: application/json' \
  -d '{"text":"Olá! Recebi sua mensagem."}'
```

### Obter Sugestão IA
```bash
curl -X POST \
  'http://localhost:3000/api/whatsapp/ai/suggest/clh7x8j9k0123456789abcde' \
  -H 'x-wa-key: aps-edu-whatsapp' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

### Envio em Massa
```bash
curl -X POST \
  'http://localhost:3000/api/whatsapp/messages/bulk' \
  -H 'x-wa-key: aps-edu-whatsapp' \
  -H 'Content-Type: application/json' \
  -d '{
    "recipientIds": ["id1", "id2"],
    "template": "Olá! Confira nossa promoção..."
  }'
```

---

## 📝 Códigos de Status HTTP

| Status | Significado |
|--------|-------------|
| 200 | OK - Requisição bem-sucedida |
| 400 | Bad Request - Dados inválidos |
| 401 | Unauthorized - API key inválida |
| 404 | Not Found - Recurso não existe |
| 409 | Conflict - WhatsApp não conectado |
| 422 | Unprocessable Entity - Validação falhou |
| 429 | Too Many Requests - Rate limit atingido |
| 500 | Server Error - Erro interno |

---

**Atualizado em:** 07/06/2026  
**Versão:** 1.0  
**Status:** ✅ Completo
