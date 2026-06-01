/**
 * relay.js — Servidor de relay para mensagens em tempo real
 *
 * Funciona como intermediário entre Evolution API e o browser:
 *   1. Fica na porta 8079 (ngrok aponta aqui)
 *   2. Recebe webhooks do Evolution API em /relay/webhook
 *   3. Publica eventos no Pusher (WebSocket gerenciado — browser recebe instantâneo)
 *   4. Transmite via SSE local em /relay/events (fallback)
 *   5. Faz proxy de TUDO o mais para o Evolution API na porta 8080
 *   6. Mantém polling de estado de conexão a cada 10s
 */

'use strict'

const http   = require('http')
const https  = require('https')
const crypto = require('crypto')

// ── Configuração ──────────────────────────────────────────────────────────────
const RELAY_PORT = 8079
const EVO_PORT   = 8081  // whatsapp-web.js API (substitui Evolution API na 8080)
const EVO_HOST   = 'localhost'
const EVO_KEY    = '7d81fe0ea44f6eb6dda650cccd79ed8f65dfab3182b31a5f1d8481701e305bc2'
const INSTANCE   = 'sofi'

// ── Pusher ────────────────────────────────────────────────────────────────────
const PUSHER = {
  appId:   '2161236',
  key:     'e86cbcb6b0359bab789f',
  secret:  '616cabdc538dcd018e80',
  cluster: 'sa1',
  channel: 'whatsapp-sofi',
}

/**
 * Publica um evento no Pusher via HTTP REST API.
 * Usa apenas crypto + https (built-ins do Node.js — sem npm).
 * Ref: https://pusher.com/docs/channels/library_auth_reference/rest-api/
 */
function pusherPublish(eventName, data) {
  try {
    const body    = JSON.stringify({ name: eventName, channel: PUSHER.channel, data: JSON.stringify(data) })
    const bodyMd5 = crypto.createHash('md5').update(body).digest('hex')
    const ts      = Math.floor(Date.now() / 1000)
    const path    = `/apps/${PUSHER.appId}/events`
    const params  = `auth_key=${PUSHER.key}&auth_timestamp=${ts}&auth_version=1.0&body_md5=${bodyMd5}`
    const toSign  = ['POST', path, params].join('\n')
    const sig     = crypto.createHmac('sha256', PUSHER.secret).update(toSign).digest('hex')

    const req = https.request({
      hostname: `api-${PUSHER.cluster}.pusher.com`,
      port: 443,
      path: `${path}?${params}&auth_signature=${sig}`,
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      if (res.statusCode === 200) {
        console.log(`[Pusher] ✓ "${eventName}" publicado`)
        return
      }
      let b = ''; res.on('data', d => b += d)
      res.on('end', () => console.error(`[Pusher] Erro ${res.statusCode}: ${b.substring(0, 200)}`))
    })
    req.on('error', e => console.error('[Pusher] Erro de rede:', e.message))
    req.write(body)
    req.end()
  } catch (e) {
    console.error('[Pusher] Exception:', e.message)
  }
}

// ── Clientes SSE locais (fallback) ────────────────────────────────────────────
/** @type {Set<import('http').ServerResponse>} */
const clients = new Set()

function broadcast(eventName, data) {
  const msg = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`
  let count = 0
  for (const res of [...clients]) {
    try { res.write(msg); count++ }
    catch { clients.delete(res) }
  }
  if (count > 0) console.log(`[Relay] ▶ "${eventName}" → ${count} SSE cliente(s)`)
  return count
}

// ── Polling de estado de conexão ──────────────────────────────────────────────
function pollConnectionState() {
  const opts = {
    hostname: EVO_HOST,
    port: EVO_PORT,
    path: `/status`,
    method: 'GET',
    headers: { apikey: EVO_KEY, 'User-Agent': 'APS-EDU-Relay/1.0' },
  }
  const req = http.request(opts, res => {
    let body = ''
    res.on('data', d => body += d)
    res.on('end', () => {
      try {
        const j = JSON.parse(body)
        const state = j?.instance?.state || 'close'
        const stateData = {
          connected: state === 'open',
          ready:     state === 'open',
          state,
          provider:  'evolution',
          mode:      'live',
        }
        broadcast('state', stateData)
        pusherPublish('state', stateData)
      } catch {}
    })
  })
  req.on('error', () => {})
  req.end()
}

// Polling inicial após 2s e depois a cada 10s
setTimeout(pollConnectionState, 2000)
setInterval(pollConnectionState, 10000)

// ── Servidor HTTP principal ───────────────────────────────────────────────────
const server = http.createServer((req, res) => {

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, apikey, authorization, ngrok-skip-browser-warning')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return
  }

  // ── /relay/events — SSE local (fallback) ────────────────────────────────────
  if (req.url === '/relay/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    })
    res.write('event: connected\ndata: {"ok":true}\n\n')
    clients.add(res)
    console.log(`[Relay] SSE conectado (${clients.size} cliente(s))`)
    pollConnectionState()

    const hb = setInterval(() => {
      try { res.write(': hb\n\n') }
      catch { clients.delete(res); clearInterval(hb) }
    }, 25000)

    req.on('close', () => {
      clients.delete(res); clearInterval(hb)
      console.log(`[Relay] SSE desconectado (${clients.size} restante(s))`)
    })
    return
  }

  // ── /relay/webhook — recebe eventos do Evolution API → publica no Pusher ────
  if (req.url === '/relay/webhook' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > 2 * 1024 * 1024) { req.destroy(); return }
    })
    req.on('end', () => {
      try {
        const payload   = JSON.parse(body)
        const eventName = (payload.event || 'update').replace(/\./g, '_')

        // ── Strip payload para Pusher (limite: 10KB) ──────────────────────
        // Extrai apenas os campos essenciais — o payload completo é muito grande
        let slim = payload
        if (eventName === 'messages_upsert') {
          const data = payload.data || payload
          const items = Array.isArray(data) ? data : [data]
          slim = {
            event: payload.event,
            instance: payload.instance,
            data: items.map(m => ({
              key:              m.key,
              pushName:         m.pushName,
              messageTimestamp: m.messageTimestamp,
              message: {
                conversation:         m.message?.conversation,
                extendedTextMessage:  m.message?.extendedTextMessage
                  ? { text: m.message.extendedTextMessage.text } : undefined,
                imageMessage:         m.message?.imageMessage
                  ? { caption: m.message.imageMessage.caption } : undefined,
                audioMessage:         m.message?.audioMessage ? {} : undefined,
                videoMessage:         m.message?.videoMessage
                  ? { caption: m.message.videoMessage.caption } : undefined,
                documentMessage:      m.message?.documentMessage
                  ? { title: m.message.documentMessage.title } : undefined,
                stickerMessage:       m.message?.stickerMessage ? {} : undefined,
              },
            })),
          }
        } else if (eventName === 'connection_update') {
          slim = { event: payload.event, instance: payload.instance, data: { state: payload.data?.state } }
        } else if (eventName === 'qrcode_updated') {
          // Envia apenas o sinal — browser busca o QR via API (base64 é muito grande para Pusher)
          slim = { event: payload.event, instance: payload.instance }
        } else if (eventName === 'chats_update' || eventName === 'chats_upsert') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true, clients: 0 }))
          return // ignora — não precisa no browser
        }

        // Publica payload enxuto no Pusher
        pusherPublish(eventName, slim)

        // SSE local (fallback)
        const pushed = broadcast(eventName, payload)

        console.log(`[Relay] Webhook "${payload.event}" → Pusher + ${pushed} SSE`)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, clients: pushed }))
      } catch (e) {
        console.error('[Relay] Webhook JSON inválido:', e.message)
        res.writeHead(400); res.end('Bad JSON')
      }
    })
    return
  }

  // ── Proxy para Evolution API (tudo o mais) ────────────────────────────────
  const opts = {
    hostname: EVO_HOST,
    port:     EVO_PORT,
    path:     req.url,
    method:   req.method,
    headers:  { ...req.headers, host: `${EVO_HOST}:${EVO_PORT}` },
  }

  const proxy = http.request(opts, evoRes => {
    res.writeHead(evoRes.statusCode || 200, evoRes.headers)
    evoRes.pipe(res, { end: true })
  })

  proxy.on('error', err => {
    console.error('[Relay] Proxy error:', err.message)
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Evolution API indisponível', details: err.message }))
    }
  })

  req.pipe(proxy, { end: true })
})

server.listen(RELAY_PORT, () => {
  console.log('═'.repeat(60))
  console.log('  Relay Server — Mensagens em Tempo Real (Pusher)')
  console.log('═'.repeat(60))
  console.log(`  Porta:   ${RELAY_PORT}`)
  console.log(`  Pusher:  canal "${PUSHER.channel}" @ cluster ${PUSHER.cluster}`)
  console.log(`  Proxy:   → Evolution API :${EVO_PORT}`)
  console.log(`  Webhook: POST http://localhost:${RELAY_PORT}/relay/webhook`)
  console.log('═'.repeat(60))
})
