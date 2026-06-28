/**
 * setup-webhook.js — Registra o webhook no Evolution API apontando para o relay
 *
 * Executa uma vez após o Evolution API subir.
 * Pode ser rodado quantas vezes quiser (idempotente).
 */

'use strict'

const http = require('http')

const EVO_PORT = 8080
const EVO_HOST = 'localhost'
const EVO_KEY  = '7d81fe0ea44f6eb6dda650cccd79ed8f65dfab3182b31a5f1d8481701e305bc2'
const INSTANCE = 'sofi'
const RELAY_WEBHOOK = 'http://localhost:8079/relay/webhook'

const WEBHOOK_BODY = JSON.stringify({
  url: RELAY_WEBHOOK,
  webhook_by_events: false,
  webhook_base64: false,
  events: [
    'MESSAGES_UPSERT',
    'MESSAGES_UPDATE',
    'MESSAGES_DELETE',
    'SEND_MESSAGE',
    'CONNECTION_UPDATE',
    'QRCODE_UPDATED',
    'CALL',
    'CHATS_UPSERT',
    'CHATS_UPDATE',
    'CONTACTS_UPSERT',
  ],
})

function tryRegister(attempt = 1) {
  const options = {
    hostname: EVO_HOST,
    port: EVO_PORT,
    path: `/webhook/set/${INSTANCE}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(WEBHOOK_BODY),
      apikey: EVO_KEY,
    },
  }

  const req = http.request(options, res => {
    let body = ''
    res.on('data', d => body += d)
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`✅ Webhook registrado com sucesso!`)
        console.log(`   URL: ${RELAY_WEBHOOK}`)
        try { console.log('   Resposta:', JSON.stringify(JSON.parse(body), null, 2)) } catch {}
      } else {
        console.warn(`⚠️  Resposta inesperada (${res.statusCode}): ${body}`)
      }
    })
  })

  req.on('error', err => {
    if (attempt <= 5) {
      const delay = attempt * 3000
      console.log(`⏳ Tentativa ${attempt}: Evolution API não respondeu (${err.code}). Aguardando ${delay / 1000}s...`)
      setTimeout(() => tryRegister(attempt + 1), delay)
    } else {
      console.error('❌ Falhou após 5 tentativas. Verifique se o Evolution API está rodando.')
      process.exit(1)
    }
  })

  req.write(WEBHOOK_BODY)
  req.end()
}

console.log('🔗 Configurando webhook do Evolution API...')
console.log(`   Instância: ${INSTANCE}`)
console.log(`   Relay:     ${RELAY_WEBHOOK}`)
console.log()

tryRegister()
