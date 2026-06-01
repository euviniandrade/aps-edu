/**
 * whatsapp.js — Servidor WhatsApp Web para o CRM Sofi
 *
 * Arquitetura:
 *   1. whatsapp-web.js (Puppeteer) conecta ao WhatsApp
 *   2. Cada mensagem recebida/enviada é salva no banco SQLite (Prisma)
 *   3. API HTTP (porta 8081) serve dados DO BANCO — rápido, paginado
 *   4. Eventos em tempo real publicados no Pusher (Vinicius recebe instantâneo)
 *   5. Sincronização de fundo: ao conectar, carrega todos os chats no banco
 *
 * Resultado: funciona com 3000+ contatos sem travar
 */
'use strict'

const { Client, LocalAuth } = require('whatsapp-web.js')
const QRCode  = require('qrcode')
const http    = require('http')
const https   = require('https')
const crypto  = require('crypto')
const path    = require('path')
const fs      = require('fs')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })
require('dotenv').config({ path: path.join(__dirname, '.env') })
const { GoogleGenerativeAI } = require('@google/generative-ai')

// ── Prisma (SQLite local) ─────────────────────────────────────────────────────
const { PrismaClient } = require('./node_modules/.prisma/whatsapp-client/default.js')
const prisma = new PrismaClient()

// ── Pusher ────────────────────────────────────────────────────────────────────
const PUSHER = {
  appId: process.env.PUSHER_APP_ID || '2161236',
  key: process.env.PUSHER_KEY || 'e86cbcb6b0359bab789f',
  secret: process.env.PUSHER_SECRET || '616cabdc538dcd018e80',
  cluster: process.env.PUSHER_CLUSTER || 'sa1',
  channel: process.env.PUSHER_CHANNEL || 'whatsapp-sofi',
}

function pusherPublish(eventName, data) {
  try {
    const body    = JSON.stringify({ name: eventName, channel: PUSHER.channel, data: JSON.stringify(data) })
    const bodyMd5 = crypto.createHash('md5').update(body).digest('hex')
    const ts      = Math.floor(Date.now() / 1000)
    const p       = `/apps/${PUSHER.appId}/events`
    const params  = `auth_key=${PUSHER.key}&auth_timestamp=${ts}&auth_version=1.0&body_md5=${bodyMd5}`
    const sig     = crypto.createHmac('sha256', PUSHER.secret).update(['POST', p, params].join('\n')).digest('hex')
    const req = https.request({
      hostname: `api-${PUSHER.cluster}.pusher.com`, port: 443,
      path: `${p}?${params}&auth_signature=${sig}`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      if (res.statusCode !== 200) {
        let b = ''; res.on('data', d => b += d)
        res.on('end', () => console.error(`[Pusher] Erro ${res.statusCode}: ${b.substring(0,100)}`))
      }
    })
    req.on('error', e => console.error('[Pusher] Rede:', e.message))
    req.write(body); req.end()
  } catch (e) { console.error('[Pusher] Exception:', e.message) }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const PORT = 8081
const INSTAGRAM_MEMORY_PATH = path.join(__dirname, 'instagram-memory.json')

const DEFAULT_INSTAGRAM = {
  connected: false,
  businessId: process.env.INSTAGRAM_BUSINESS_ID || '',
  pageId: process.env.INSTAGRAM_PAGE_ID || '',
  pageToken: process.env.INSTAGRAM_PAGE_TOKEN || '',
  verifyToken: process.env.INSTAGRAM_VERIFY_TOKEN || '',
  hasPageToken: !!process.env.INSTAGRAM_PAGE_TOKEN,
  automationEnabled: true,
  requireFollowGate: false,
  autoReplyTemplate: 'Oi {name}, vi seu comentário. Vou te enviar o material no Direct.',
  followGateTemplate: 'Oi {name}, para liberar o material, siga o perfil e responda "LIBERAR" no Direct.',
  rules: [
    { id: 'material', keyword: 'material', action: 'dm_material', enabled: true, targetStage: 'Acompanhar' },
    { id: 'orcamento', keyword: 'orcamento', action: 'lead_sales', enabled: true, targetStage: 'Hoje' },
    { id: 'suporte', keyword: 'suporte', action: 'lead_support', enabled: true, targetStage: 'Acompanhar' },
  ],
  events: [],
  conversations: {},
}

function loadInstagramState() {
  try {
    const raw = JSON.parse(fs.readFileSync(INSTAGRAM_MEMORY_PATH, 'utf8'))
    return {
      ...DEFAULT_INSTAGRAM,
      ...raw,
      rules: Array.isArray(raw.rules) ? raw.rules : DEFAULT_INSTAGRAM.rules,
      events: Array.isArray(raw.events) ? raw.events.slice(-200) : [],
      conversations: raw.conversations && typeof raw.conversations === 'object' ? raw.conversations : {},
    }
  } catch {
    return { ...DEFAULT_INSTAGRAM }
  }
}

let instagramState = loadInstagramState()
const avatarCache = new Map()

function saveInstagramState() {
  try { fs.writeFileSync(INSTAGRAM_MEMORY_PATH, JSON.stringify(instagramState, null, 2)) } catch (e) {
    console.error('[IG] Erro ao salvar estado:', e.message)
  }
}

function addInstagramEvent(event) {
  instagramState.events = [...instagramState.events, { id: crypto.randomUUID(), at: new Date().toISOString(), ...event }].slice(-200)
  saveInstagramState()
  pusherPublish('instagram_event', event)
}

async function instagramGraph(pathname, method = 'GET', body = null) {
  const token = process.env.INSTAGRAM_PAGE_TOKEN || instagramState.pageToken || ''
  if (!token) throw new Error('INSTAGRAM_PAGE_TOKEN ausente')
  const version = process.env.INSTAGRAM_GRAPH_VERSION || 'v23.0'
  const baseUrl = `https://graph.facebook.com/${version}/${pathname}`
  const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`
  const reqInit = { method, headers: {} }
  if (body && method !== 'GET') {
    reqInit.headers['Content-Type'] = 'application/json'
    reqInit.body = JSON.stringify(body)
  }
  const res = await fetch(url, reqInit)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data)}`)
  return data
}

async function getAvatarUrlBestEffort(chatId) {
  const id = String(chatId || '').trim()
  if (!id || avatarCache.has(id) || !isReady) return avatarCache.get(id) || ''
  try {
    const url = await client.getProfilePicUrl(id).catch(() => '')
    const normalized = String(url || '')
    avatarCache.set(id, normalized)
    return normalized
  } catch {
    return ''
  }
}

function findInstagramRule(text) {
  const normalized = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return (instagramState.rules || []).find(rule => {
    if (!rule?.enabled || !rule.keyword) return false
    const key = String(rule.keyword).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    return normalized.includes(key)
  }) || null
}

async function sendInstagramDm(igUserId, text) {
  const businessId = process.env.INSTAGRAM_BUSINESS_ID || instagramState.businessId
  if (!businessId) throw new Error('INSTAGRAM_BUSINESS_ID ausente')
  return instagramGraph(`${businessId}/messages`, 'POST', {
    recipient: { id: String(igUserId) },
    message: { text: String(text || '') },
    messaging_type: 'RESPONSE',
  })
}

async function sendInstagramPrivateReply(commentId, text) {
  return instagramGraph(`${commentId}/private_replies`, 'POST', { message: String(text || '') })
}

async function tryResolveInstagramBusinessId() {
  const current = process.env.INSTAGRAM_BUSINESS_ID || instagramState.businessId || ''
  if (current) return current
  let pageId = process.env.INSTAGRAM_PAGE_ID || instagramState.pageId || ''
  if (!pageId) {
    try {
      const me = await instagramGraph('me?fields=id')
      pageId = String(me?.id || '').trim()
      if (pageId) {
        instagramState.pageId = pageId
        saveInstagramState()
      }
    } catch {}
  }
  if (!pageId) return ''
  try {
    const data = await instagramGraph(`${pageId}?fields=instagram_business_account`)
    const found = String(data?.instagram_business_account?.id || '').trim()
    if (found) {
      instagramState.businessId = found
      instagramState.connected = true
      saveInstagramState()
      return found
    }
  } catch {}
  return ''
}

function addInstagramConversation(igUserId, payload) {
  const id = String(igUserId || '')
  if (!id) return
  const current = instagramState.conversations[id] || { userId: id, name: payload.name || '', tags: [], stage: 'Inbox', messages: [] }
  const next = {
    ...current,
    name: cleanDisplayName(payload.name || current.name || '', ''),
    stage: payload.stage || current.stage || 'Inbox',
    tags: payload.tags || current.tags || [],
    updatedAt: new Date().toISOString(),
    messages: [...(current.messages || []), {
      at: new Date().toISOString(),
      direction: payload.direction || 'in',
      text: payload.text || '',
      source: payload.source || 'instagram',
    }].slice(-100),
  }
  instagramState.conversations[id] = next
  saveInstagramState()
}

function normPhone(jid) {
  return String(jid || '').replace(/@[^@]*$/, '').replace(/\D/g, '')
}

function normJid(num) {
  const raw = String(num || '')
  if (raw.includes('@g.us') || raw.includes('@c.us') || raw.includes('@s.whatsapp.net')) return raw
  const phone = normPhone(raw)
  return `${phone}@s.whatsapp.net`
}

function fixMojibake(text) {
  const value = String(text || '')
  if (!value) return ''
  if (!/[ÃÂâ]/.test(value)) return value
  try {
    const fixed = Buffer.from(value, 'latin1').toString('utf8')
    if (fixed && fixed !== value) return fixed
  } catch {}
  return value
}

function cleanDisplayName(name, fallback) {
  const fixed = fixMojibake(name)
  const trimmed = String(fixed || '').trim()
  return trimmed || String(fallback || '').trim()
}

async function readBody(req) {
  return new Promise(r => { let b = ''; req.on('data', d => b += d); req.on('end', () => r(b)) })
}

let contactsSyncRunning = false
let contactsSyncLastResult = null

async function syncAllContactNames() {
  if (!isReady) return { synced: 0, skipped: 0, total: 0 }
  const [contacts, chats] = await Promise.all([
    client.getContacts().catch(() => []),
    client.getChats().catch(() => []),
  ])
  const chatMap = new Map(chats.map(chat => [chat.id?._serialized, chat]))
  const seenPhones = new Set()
  const valid = contacts.filter(contact => {
    const chatId = contact.id?._serialized || ''
    const phone = normPhone(contact.number || chatId)
    if (!chatId || chatId === 'status@broadcast' || chatId.endsWith('@g.us')) return false
    if (!phone || phone.length < 8 || seenPhones.has(phone)) return false
    seenPhones.add(phone)
    return contact.isWAContact !== false
  })
  let synced = 0
  let skipped = 0
  const total = valid.length
  for (const contact of valid) {
    const chatId = contact.id._serialized
    const phone = normPhone(contact.number || chatId)
    const chat = chatMap.get(chatId)
    const contactName = cleanDisplayName(
      contact.name ||
      contact.pushname ||
      contact.shortName ||
      chat?.name ||
      phone,
      phone,
    )
    try {
      const updateData = {
        phone,
        contactName: contactName || null,
        lastMessage: chat?.lastMessage?.body || undefined,
        lastAt: chat?.timestamp ? new Date(chat.timestamp * 1000) : undefined,
        isGroup: false,
        syncedAt: new Date(),
        updatedAt: new Date(),
      }
      const existingByPhone = await prisma.waChat.findUnique({ where: { phone }, select: { id: true } }).catch(() => null)
      if (existingByPhone && existingByPhone.id !== chatId) {
        await prisma.waChat.update({ where: { phone }, data: updateData })
      } else {
        await prisma.waChat.upsert({
          where: { id: chatId },
          update: updateData,
          create: {
            id: chatId,
            phone,
            contactName: contactName || null,
            lastMessage: chat?.lastMessage?.body || null,
            lastAt: chat?.timestamp ? new Date(chat.timestamp * 1000) : null,
            isGroup: false,
            unreadCount: chat?.unreadCount || 0,
            syncedAt: new Date(),
          },
        })
      }
      synced += 1
      if (synced % 250 === 0) pusherPublish('contacts_sync_progress', { synced, skipped, total })
    } catch (e) {
      skipped += 1
    }
  }
  pusherPublish('contacts_sync_progress', { synced, skipped, total, done: true })
  return { synced, skipped, total, source: 'contacts+chats' }
}

function startContactsSyncInBackground() {
  if (contactsSyncRunning) {
    return { started: false, running: true, lastResult: contactsSyncLastResult }
  }

  contactsSyncRunning = true
  pusherPublish('contacts_sync_progress', { synced: 0, skipped: 0, total: 0, started: true })
  syncAllContactNames()
    .then(result => {
      contactsSyncLastResult = { ...result, finishedAt: new Date().toISOString() }
      pusherPublish('contacts_sync_progress', { ...result, done: true })
    })
    .catch(e => {
      contactsSyncLastResult = { error: e.message, finishedAt: new Date().toISOString() }
      pusherPublish('contacts_sync_progress', { error: e.message, done: true })
      console.error('[Contacts] Erro na sincronizacao:', e.message)
    })
    .finally(() => { contactsSyncRunning = false })

  return { started: true, running: true, lastResult: contactsSyncLastResult }
}

// Sofi IA - atendimento automatico, supervisionado e treinavel.
const AI_MEMORY_PATH = path.join(__dirname, 'sofi-ai-memory.json')
const AI_MODES = new Set(['paused', 'assist', 'auto'])
const DEFAULT_AI_CONFIG = {
  mode: process.env.WHATSAPP_AI_MODE || 'assist',
  tone: 'humana, educada, objetiva e acolhedora',
  maxChars: 700,
  allowGroups: false,
  cooldownMs: 15000,
  activePlaybook: 'suporte',
  playbooks: {
    vendas: [
      'Objetivo: entender a necessidade, qualificar interesse e conduzir para o proximo passo.',
      'Sempre confirme nome, unidade/interesse e melhor horario antes de prometer retorno.',
      'Use perguntas curtas, linguagem calorosa e finalize com uma chamada clara para acao.',
    ].join('\n'),
    suporte: [
      'Objetivo: resolver duvidas com rapidez, reduzir atrito e acionar humano quando necessario.',
      'Peça dados essenciais sem expor informacoes sensiveis. Se houver risco, encaminhe ao responsavel.',
      'Quando nao souber, diga que vai verificar e mantenha o contato informado.',
    ].join('\n'),
    pessoal: [
      'Objetivo: ajudar Vinicius a organizar conversas, compromissos e follow-ups pessoais.',
      'Se identificar prazo, pendencia, reuniao ou promessa, sugira uma acao objetiva.',
      'Mantenha tom natural, discreto e direto, sem parecer robo.',
    ].join('\n'),
  },
  training: [
    'A Sofi representa o Departamento de Educacao da Associacao Paulista Sul.',
    'Responda em portugues do Brasil, com clareza e naturalidade.',
    'Quando nao tiver certeza, assuma compromisso de verificar e encaminhar para um humano.',
  ],
}

function loadAiConfig() {
  try {
    const saved = JSON.parse(fs.readFileSync(AI_MEMORY_PATH, 'utf8'))
    return {
      ...DEFAULT_AI_CONFIG,
      ...saved,
      playbooks: { ...DEFAULT_AI_CONFIG.playbooks, ...(saved.playbooks || {}) },
      training: Array.isArray(saved.training) ? saved.training : DEFAULT_AI_CONFIG.training,
    }
  } catch {
    return { ...DEFAULT_AI_CONFIG }
  }
}

let aiConfig = loadAiConfig()
const lastAiReplyAt = new Map()
const handoffChats = new Set()

function saveAiConfig() {
  try { fs.writeFileSync(AI_MEMORY_PATH, JSON.stringify(aiConfig, null, 2)) } catch (e) {
    console.error('[AI] Erro ao salvar memoria:', e.message)
  }
}

function getGeminiModel() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!key) return null
  const genAI = new GoogleGenerativeAI(key)
  return genAI.getGenerativeModel({ model: process.env.WHATSAPP_AI_MODEL || 'gemini-2.0-flash' })
}

async function postJson(url, headers, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return r.json()
}

async function generateTextWithProviders(prompt) {
  const maxTokens = Math.min(900, Math.max(120, Number(aiConfig.maxChars || 700)))

  const gemini = getGeminiModel()
  if (gemini) {
    try {
      const result = await gemini.generateContent(prompt)
      const text = (result.response.text() || '').trim()
      if (text) return { provider: 'gemini', text }
    } catch (e) {
      console.warn('[AI] Gemini indisponivel, tentando fallback:', e.message)
    }
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (anthropicKey) {
    try {
      const data = await postJson('https://api.anthropic.com/v1/messages', {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      }, {
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = (data.content || []).map(part => part.text || '').join('\n').trim()
      if (text) return { provider: 'anthropic', text }
    } catch (e) {
      console.warn('[AI] Anthropic indisponivel, tentando fallback:', e.message)
    }
  }

  const mistralKey = process.env.MISTRAL_API_KEY
  if (mistralKey) {
    try {
      const data = await postJson('https://api.mistral.ai/v1/chat/completions', {
        Authorization: `Bearer ${mistralKey}`,
      }, {
        model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
      })
      const text = data.choices?.[0]?.message?.content?.trim()
      if (text) return { provider: 'mistral', text }
    } catch (e) {
      console.warn('[AI] Mistral indisponivel, tentando fallback:', e.message)
    }
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY
  if (deepseekKey) {
    try {
      const data = await postJson('https://api.deepseek.com/chat/completions', {
        Authorization: `Bearer ${deepseekKey}`,
      }, {
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
      })
      const text = data.choices?.[0]?.message?.content?.trim()
      if (text) return { provider: 'deepseek', text }
    } catch (e) {
      console.warn('[AI] DeepSeek indisponivel, tentando fallback:', e.message)
    }
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY
  if (openRouterKey) {
    try {
      const data = await postJson('https://openrouter.ai/api/v1/chat/completions', {
        Authorization: `Bearer ${openRouterKey}`,
        'HTTP-Referer': process.env.PUBLIC_APP_URL || 'https://aps-edu.vercel.app',
        'X-Title': 'APS-EDU Sofi',
      }, {
        model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
      })
      const text = data.choices?.[0]?.message?.content?.trim()
      if (text) return { provider: 'openrouter', text }
    } catch (e) {
      console.warn('[AI] OpenRouter indisponivel, tentando fallback:', e.message)
    }
  }

  const xaiKey = process.env.XAI_API_KEY
  if (xaiKey) {
    try {
      const data = await postJson('https://api.x.ai/v1/chat/completions', {
        Authorization: `Bearer ${xaiKey}`,
      }, {
        model: process.env.XAI_MODEL || 'grok-2-latest',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
      })
      const text = data.choices?.[0]?.message?.content?.trim()
      if (text) return { provider: 'xai', text }
    } catch (e) {
      console.warn('[AI] xAI indisponivel:', e.message)
    }
  }

  return { provider: 'none', text: '' }
}

function buildLocalFallbackReply(incomingText, pushName) {
  const text = String(incomingText || '').toLowerCase()
  const name = pushName ? `, ${pushName}` : ''
  if (/\b(urgente|hoje|prazo|agora|pendencia|pendência)\b/i.test(text)) {
    return `Bom dia${name}! Recebi sua mensagem e vou priorizar isso agora. Pode me confirmar, por favor, qual é o ponto principal e o prazo que precisamos considerar?`
  }
  if (/\b(reuniao|reunião|agenda|horario|horário)\b/i.test(text)) {
    return `Claro${name}! Vamos organizar. Pode me enviar o melhor horário e os pontos que precisam entrar na pauta?`
  }
  if (/\b(obrigado|obrigada|valeu|ok|resolvido)\b/i.test(text)) {
    return `Perfeito${name}! Fico à disposição. Se surgir mais algum ponto, pode me chamar por aqui.`
  }
  return `Oi${name}! Recebi sua mensagem. Vou verificar com atenção e já te retorno com o próximo passo.`
}

function shouldHandoff(text) {
  return /\b(humano|atendente|pessoa|vinicius|coordenador|ligar|telefone|reclamacao|reclamação|urgente)\b/i.test(text || '')
}

async function buildConversationContext(chatId) {
  const history = await prisma.waMessage.findMany({
    where: { chatId },
    orderBy: { ts: 'desc' },
    take: 12,
  })
  return history.reverse().map(m => `${m.fromMe ? 'APS/Sofi' : (m.pushName || 'Contato')}: ${m.text}`).join('\n')
}

async function generateSofiReply({ chatId, incomingText, pushName }) {
  const context = await buildConversationContext(chatId)
  const activePlaybook = aiConfig.activePlaybook || 'suporte'
  const playbook = aiConfig.playbooks?.[activePlaybook] || aiConfig.playbooks?.suporte || ''
  const prompt = [
    'Voce e a Sofi, agente de atendimento do APS-EDU no WhatsApp.',
    `Tom: ${aiConfig.tone}.`,
    `Limite: ate ${aiConfig.maxChars} caracteres.`,
    'Nao invente dados. Nao prometa prazos que nao conhece. Seja natural, rapida e util.',
    'Se a mensagem exigir decisao sensivel, diga que vai encaminhar para um responsavel.',
    '',
    'Treinamento ativo:',
    ...aiConfig.training.map(item => `- ${item}`),
    '',
    `Playbook ativo (${activePlaybook}):`,
    playbook || '(sem playbook especifico)',
    '',
    `Contato: ${pushName || 'sem nome'}`,
    'Historico recente:',
    context || '(sem historico)',
    '',
    `Mensagem recebida: ${incomingText}`,
    '',
    'Responda somente com a mensagem final para enviar no WhatsApp.',
  ].join('\n')

  const result = await generateTextWithProviders(prompt)
  if (result.provider !== 'none') pusherPublish('ai_provider_used', { provider: result.provider, chatId })
  const text = result.text || buildLocalFallbackReply(incomingText, pushName)
  return text.trim().slice(0, Number(aiConfig.maxChars || 700))
}

async function transcribeWhatsAppAudio(msg) {
  const key = process.env.GROQ_API_KEY
  if (!key || !msg.hasMedia) return ''
  try {
    const media = await msg.downloadMedia()
    const mimetype = media?.mimetype || ''
    if (!media?.data || !/audio|ogg|mpeg|mp4|webm/i.test(mimetype)) return ''
    const buffer = Buffer.from(media.data, 'base64')
    if (buffer.length > 25 * 1024 * 1024) return '[Audio recebido, mas acima do limite de transcricao]'

    const ext = mimetype.includes('ogg') ? 'ogg'
      : mimetype.includes('mpeg') ? 'mp3'
      : mimetype.includes('webm') ? 'webm'
      : 'm4a'
    const form = new FormData()
    form.append('file', new Blob([buffer], { type: mimetype || 'audio/ogg' }), `audio.${ext}`)
    form.append('model', process.env.GROQ_TRANSCRIBE_MODEL || 'whisper-large-v3')
    form.append('language', 'pt')
    form.append('response_format', 'json')

    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    })
    if (!r.ok) throw new Error(`${r.status}`)
    const data = await r.json()
    return String(data.text || '').trim()
  } catch (e) {
    console.error('[AI] Erro ao transcrever audio:', e.message)
    return ''
  }
}

async function extractIncomingText(msg) {
  const body = String(msg.body || '').trim()
  if (body) return body
  if (msg.hasMedia && /audio|ptt/i.test(String(msg.type || ''))) {
    const transcript = await transcribeWhatsAppAudio(msg)
    return transcript ? `[Audio transcrito]\n${transcript}` : '[Audio recebido]'
  }
  if (msg.hasMedia) return `[Midia recebida: ${msg.type || 'arquivo'}]`
  return ''
}

function inferStageByIntent(text) {
  const t = String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/\b(urgente|agora|hoje|prazo|vence|atrasad|em cima da hora)\b/.test(t)) return 'Hoje'
  if (/\b(retorno|acompanhar|follow|follow-up|amanha|depois|cobrar|lembrar|pendente)\b/.test(t)) return 'Acompanhar'
  if (/\b(familia|pessoal|casa|privado|particular)\b/.test(t)) return 'Pessoal'
  if (/\b(concluido|resolvido|feito|finalizado|obrigado|obrigada|valeu|ok)\b/.test(t)) return 'Concluido'
  if (/\b(pausar|parar|cancelar|sem retorno|nao quero|deixa quieto)\b/.test(t)) return 'Pausado'
  return null
}

async function routeChatByIntent(chatId, phone, text) {
  const stage = inferStageByIntent(text)
  if (!stage || !chatId) return
  try {
    const chat = await prisma.waChat.findUnique({ where: { id: chatId }, select: { stage: true } })
    const current = chat?.stage || 'Inbox'
    if (current !== 'Inbox' && current !== 'Novo' && stage !== 'Hoje') return
    await prisma.waChat.updateMany({ where: { id: chatId }, data: { stage, updatedAt: new Date() } })
    pusherPublish('crm_stage_updated', { chatId, phone, stage, reason: 'intent' })
  } catch (e) {
    console.error('[CRM] Erro no roteamento por intencao:', e.message)
  }
}

async function maybeAutoReply(msg, text) {
  if (aiConfig.mode !== 'auto') return
  if (!isReady || !text || msg.fromMe || msg.isStatus) return
  if (msg.from?.endsWith('@g.us') && !aiConfig.allowGroups) return
  if (handoffChats.has(msg.from)) return
  if (shouldHandoff(text)) {
    handoffChats.add(msg.from)
    pusherPublish('ai_state', { mode: aiConfig.mode, handoffChatId: msg.from, reason: 'handoff_keyword' })
    return
  }
  const last = lastAiReplyAt.get(msg.from) || 0
  if (Date.now() - last < Number(aiConfig.cooldownMs || 15000)) return

  try {
    lastAiReplyAt.set(msg.from, Date.now())
    const reply = await generateSofiReply({ chatId: msg.from, incomingText: text, pushName: msg._data?.notifyName || '' })
    if (!reply) return
    const sent = await client.sendMessage(msg.from, reply)
    await saveMessage(msg.from, sent.id.id, true, reply, 'Sofi IA', Math.floor(Date.now() / 1000))
    pusherPublish('messages_upsert', {
      event: 'messages.upsert', instance: 'sofi',
      data: [{
        key: { remoteJid: msg.from, fromMe: true, id: sent.id.id },
        pushName: 'Sofi IA',
        messageTimestamp: Math.floor(Date.now() / 1000),
        message: { conversation: reply },
      }],
    })
    pusherPublish('ai_replied', { chatId: msg.from, chars: reply.length })
  } catch (e) {
    console.error('[AI] Erro ao responder:', e.message)
  }
}

// ── Salva mensagem no banco ───────────────────────────────────────────────────
async function saveMessage(chatId, msgId, fromMe, text, pushName, timestamp) {
  if (!text || !chatId || !msgId) return
  const phone = normPhone(chatId)
  const ts    = new Date(Number(timestamp) * 1000)

  try {
    // Salva mensagem (upsert evita duplicata)
    await prisma.waMessage.upsert({
      where:  { id: msgId },
      update: {},
      create: { id: msgId, chatId, phone, fromMe, text, pushName: pushName || '', ts },
    })

    // Atualiza o chat (última mensagem, timestamp, badge de não lidos)
    await prisma.waChat.upsert({
      where:  { id: chatId },
      update: {
        lastMessage:  text,
        lastAt:       ts,
        updatedAt:    new Date(),
        ...(fromMe ? {} : { unreadCount: { increment: 1 } }),
      },
      create: {
        id: chatId, phone,
        contactName:  pushName || null,
        lastMessage:  text,
        lastAt:       ts,
        unreadCount:  fromMe ? 0 : 1,
      },
    })
  } catch (e) {
    console.error('[DB] Erro ao salvar mensagem:', e.message)
  }
}

// ── Estado global ─────────────────────────────────────────────────────────────
let isReady   = false
let qrBase64  = null
let phoneInfo = null
let syncDone  = false

// ── Cliente WhatsApp Web ──────────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'sofi',
    dataPath: path.join(__dirname, 'sessions'),
  }),
  puppeteer: {
    headless: true,
    protocolTimeout: 120000, // 2 minutos — necessário para 3000+ contatos
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', '--disable-gpu',
      '--no-first-run', '--no-zygote',
    ],
  },
})

client.on('qr', async qr => {
  console.log('[WA] QR Code gerado')
  try {
    qrBase64 = await QRCode.toDataURL(qr)
    isReady  = false
    pusherPublish('qrcode_updated', { instance: 'sofi' })
  } catch (e) { console.error('[WA] QR error:', e.message) }
})

client.on('authenticated', () => {
  console.log('[WA] Autenticado')
  qrBase64 = null
})

client.on('ready', async () => {
  qrBase64  = null
  phoneInfo = { wuid: client.info.wid.user, name: client.info.pushname }
  console.log(`[WA] ✅ Conectado! ${phoneInfo.name} (${phoneInfo.wuid})`)

  // Aguarda 5s antes de liberar a API (WhatsApp precisa sincronizar)
  setTimeout(async () => {
    isReady = true
    pusherPublish('state', { connected: true, ready: true, state: 'open', provider: 'whatsapp-web.js', mode: 'live' })
    console.log('[WA] API pronta')

    // Sincroniza chats em background (não bloqueia)
    if (!syncDone) syncChatsBackground()
  }, 5000)
})

client.on('disconnected', reason => {
  isReady = false
  console.log('[WA] Desconectado:', reason)
  pusherPublish('state', { connected: false, ready: false, state: 'close' })
})

// ── Mensagem RECEBIDA ─────────────────────────────────────────────────────────
client.on('message', async msg => {
  if (msg.isStatus || msg.from === 'status@broadcast') return
  const text = await extractIncomingText(msg)
  if (!text) return

  await saveMessage(msg.from, msg.id.id, false, text, msg._data?.notifyName || '', msg.timestamp)
  await routeChatByIntent(msg.from, normPhone(msg.from), text)

  // Publica no Pusher (payload enxuto)
  pusherPublish('messages_upsert', {
    event: 'messages.upsert', instance: 'sofi',
    data: [{
      key: { remoteJid: msg.from, fromMe: false, id: msg.id.id },
      pushName: msg._data?.notifyName || '',
      messageTimestamp: msg.timestamp,
      message: { conversation: text },
    }],
  })

  maybeAutoReply(msg, text).catch(e => console.error('[AI] Auto reply:', e.message))

  console.log(`[WA] ← ${normPhone(msg.from)}: ${text.substring(0, 60)}`)
})

// ── Mensagem ENVIADA (do próprio número) ──────────────────────────────────────
client.on('message_create', async msg => {
  if (!msg.fromMe) return
  const text = msg.body || ''
  if (!text) return

  await saveMessage(msg.to, msg.id.id, true, text, '', msg.timestamp)

  pusherPublish('messages_upsert', {
    event: 'messages.upsert', instance: 'sofi',
    data: [{
      key: { remoteJid: msg.to, fromMe: true, id: msg.id.id },
      pushName: phoneInfo?.name || '',
      messageTimestamp: msg.timestamp,
      message: { conversation: text },
    }],
  })

  console.log(`[WA] → ${normPhone(msg.to)}: ${text.substring(0, 60)}`)
})

client.initialize()

// ── Sincronização em background ───────────────────────────────────────────────
// Carrega TODOS os chats do WhatsApp e salva no banco (roda uma vez ao conectar)
async function syncChatsBackground() {
  console.log('[DB] Iniciando sincronização de chats...')
  syncDone = true

  try {
    const allChats = await client.getChats()
    // Inclui TODOS: individuais + grupos (exclui só status@broadcast)
    const validChats = allChats.filter(c => c.id._serialized !== 'status@broadcast')
    console.log(`[DB] ${validChats.length} conversas para sincronizar (incluindo grupos)`)

    let count = 0
    for (const chat of validChats) {
      const chatId  = chat.id._serialized
      const isGroup = chat.isGroup || false
      // Para grupos: phone = o ID do grupo; para individuais: só dígitos
      const phone   = isGroup ? chatId : normPhone(chatId)
      const lastTs  = chat.timestamp ? new Date(chat.timestamp * 1000) : null
      const lastTxt = chat.lastMessage?.body || null
      const name    = chat.name || (isGroup ? chatId : null)

      try {
        await prisma.waChat.upsert({
          where:  { id: chatId },
          update: {
            contactName: name,
            lastMessage: lastTxt,
            lastAt:      lastTs,
            isGroup,
            syncedAt:    new Date(),
          },
          create: {
            id: chatId, phone,
            contactName: name,
            lastMessage: lastTxt,
            lastAt:      lastTs,
            isGroup,
            unreadCount: chat.unreadCount || 0,
            syncedAt:    new Date(),
          },
        })
        count++
      } catch {}

      if (count % 100 === 0) {
        console.log(`[DB] ${count}/${validChats.length} sincronizados...`)
        await new Promise(r => setTimeout(r, 100))
      }
    }

    console.log(`[DB] ✅ Sincronização concluída: ${count} conversas no banco`)
  } catch (e) {
    console.error('[DB] Erro na sincronização:', e.message)
    syncDone = false // permite tentar novamente
  }
}

// ── API HTTP (porta 8081) — serve dados DO BANCO ──────────────────────────────
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, apikey, authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const url = req.url || '/'
  const parsedUrl = new URL(url, 'http://localhost:8081')
  const pathname = parsedUrl.pathname
  const json = d => { res.writeHead(200); res.end(JSON.stringify(d)) }
  const params = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '')

  try {

    // ── Estado de conexão ───────────────────────────────────────────────────
    if (url.includes('/instance/connectionState') || pathname === '/status') {
      json({ instance: { state: isReady ? 'open' : qrBase64 ? 'qr' : 'close' } })
      return
    }

    // ── QR Code ─────────────────────────────────────────────────────────────
    if (url.includes('/instance/connect')) {
      if (isReady) { json({ connected: true, ready: true, qrDataUrl: null, error: null }); return }
      if (qrBase64) { json({ base64: qrBase64 }); return }
      json({ base64: null, error: 'Aguarde o QR Code...' })
      return
    }

    // ── Lista de chats (DO BANCO — sem limite, inclui grupos) ───────────────
    if (url.includes('/chat/findChats')) {
      const search   = params.get('q') || ''
      const onlyGrps = params.get('groups') === '1'

      const where = {
        archived: false,
        ...(onlyGrps ? { isGroup: true } : {}),
        ...(search ? { OR: [
          { contactName: { contains: search } },
          { phone:       { contains: search } },
          { lastMessage: { contains: search } },
        ]} : {}),
      }

      // Sem limite — serve TODOS os contatos e grupos do banco
      const chats = await prisma.waChat.findMany({
        where,
        orderBy: { lastAt: 'desc' },
      })

      json(chats.map(c => ({
        id:               c.id,
        name:             c.contactName || c.phone,
        pushname:         c.contactName || '',
        isGroup:          c.isGroup,
        unreadCount:      c.unreadCount,
        stage:            c.stage || 'Inbox',
        lastMsgTimestamp: c.lastAt ? Math.floor(c.lastAt.getTime() / 1000) : 0,
        lastMessage: c.lastMessage ? {
          messageTimestamp: c.lastAt ? Math.floor(c.lastAt.getTime() / 1000) : 0,
          message: { conversation: c.lastMessage },
        } : null,
      })))
      return
    }

    // ── Mensagens de um chat (DO BANCO) ────────────────────────────────────
    if (url.includes('/chat/findMessages')) {
      const body    = await readBody(req)
      let reqBody   = {}
      try { reqBody = JSON.parse(body || '{}') } catch {}

      const chatId = reqBody?.where?.key?.remoteJid || reqBody?.where?.remoteJid || reqBody?.chatId || ''
      const limit  = Math.min(Number(reqBody.limit || 120), 500)

      if (!chatId) { json({ messages: { records: [] } }); return }

      // Busca do banco primeiro
      const dbMsgsDesc = await prisma.waMessage.findMany({
        where:   { chatId },
        orderBy: { ts: 'desc' },
        take:    limit,
      })
      const dbMsgs = [...dbMsgsDesc].reverse()

      // Se não tiver no banco, busca do WhatsApp e salva
      if (dbMsgs.length === 0 && isReady) {
        try {
          const chat = await client.getChatById(chatId)
          const msgs = await chat.fetchMessages({ limit })
          for (const m of msgs) {
            if (m.body) await saveMessage(chatId, m.id.id, m.fromMe, m.body, m._data?.notifyName || '', m.timestamp)
          }
          // Retorna do banco agora
          const freshDesc = await prisma.waMessage.findMany({
            where: { chatId }, orderBy: { ts: 'desc' }, take: limit,
          })
          const fresh = [...freshDesc].reverse()
          json({ messages: { records: fresh.map(m => ({
            key:              { remoteJid: chatId, fromMe: m.fromMe, id: m.id },
            pushName:         m.pushName || '',
            message:          { conversation: m.text },
            messageTimestamp: Math.floor(m.ts.getTime() / 1000),
          })) } })
          return
        } catch {}
      }

      json({ messages: { records: dbMsgs.map(m => ({
        key:              { remoteJid: chatId, fromMe: m.fromMe, id: m.id },
        pushName:         m.pushName || '',
        message:          { conversation: m.text },
        messageTimestamp: Math.floor(m.ts.getTime() / 1000),
      })) } })
      return
    }

    // ── Contatos (DO BANCO) ────────────────────────────────────────────────
    if (url.includes('/chat/findContacts')) {
      const contacts = await prisma.waChat.findMany({
        select: { id: true, contactName: true, phone: true, isGroup: true, stage: true, lastMessage: true, lastAt: true, unreadCount: true },
        take: 5000,
      })
      const toResolve = contacts.filter(c => !avatarCache.has(c.id)).slice(0, 140)
      await Promise.allSettled(toResolve.map(c => getAvatarUrlBestEffort(c.id)))
      json(contacts.map(c => ({
        id: c.id,
        pushName: cleanDisplayName(c.contactName, c.phone),
        name: cleanDisplayName(c.contactName, c.phone),
        phone: c.phone,
        avatarUrl: avatarCache.get(c.id) || '',
        isGroup: c.isGroup,
        stage: c.stage || 'Inbox',
        lastMessage: c.lastMessage || '',
        lastMsgTimestamp: c.lastAt ? Math.floor(c.lastAt.getTime() / 1000) : 0,
        unreadCount: c.unreadCount || 0,
      })))
      return
    }

    if (url.includes('/contacts/sync') && req.method === 'POST') {
      const result = startContactsSyncInBackground()
      json({ ok: true, mode: 'background', ...result })
      return
    }

    if (url.includes('/contacts/all')) {
      const contacts = await prisma.waChat.findMany({
        where: { archived: false, isGroup: false },
        orderBy: { contactName: 'asc' },
        take: 5000,
      })
      const toResolve = contacts.filter(c => !avatarCache.has(c.id)).slice(0, 220)
      await Promise.allSettled(toResolve.map(c => getAvatarUrlBestEffort(c.id)))
      json(contacts.map(c => ({
        chatId: c.id,
        phone: c.phone,
        name: cleanDisplayName(c.contactName, c.phone),
        avatarUrl: avatarCache.get(c.id) || '',
        stage: c.stage || 'Inbox',
      })))
      return
    }

    // ── Enviar mensagem ────────────────────────────────────────────────────
    if (url.includes('/message/sendText') && req.method === 'POST') {
      if (!isReady) { res.writeHead(503); res.end(JSON.stringify({ error: 'WhatsApp não conectado' })); return }
      const body = await readBody(req)
      const { number, textMessage } = JSON.parse(body || '{}')
      const jid  = normJid(number)
      const text = textMessage?.text || ''
      if (!jid || !text) { res.writeHead(400); res.end(JSON.stringify({ error: 'number e text obrigatórios' })); return }
      const sent = await client.sendMessage(jid, text)
      json({ key: { id: sent.id.id, remoteJid: jid, fromMe: true } })
      return
    }

    // ── Marcar como lido (atualiza badge no banco) ─────────────────────────
    if (url.includes('/chat/markMessageAsRead') && req.method === 'POST') {
      const body    = await readBody(req)
      let reqBody   = {}
      try { reqBody = JSON.parse(body || '{}') } catch {}
      const chatId = reqBody?.read_messages?.[0]?.remoteJid || ''
      if (chatId) {
        await prisma.waChat.updateMany({ where: { id: chatId }, data: { unreadCount: 0 } })
        if (isReady) {
          try { const chat = await client.getChatById(chatId); await chat.sendSeen() } catch {}
        }
      }
      json({ ok: true })
      return
    }

    // ── Arquivar chat ──────────────────────────────────────────────────────
    if (url.includes('/chat/archiveChat') && req.method === 'POST') {
      const body    = await readBody(req)
      let reqBody   = {}
      try { reqBody = JSON.parse(body || '{}') } catch {}
      const chatId  = reqBody?.lastMessage?.key?.remoteJid || ''
      const archive = reqBody?.archive !== false
      if (chatId) await prisma.waChat.updateMany({ where: { id: chatId }, data: { archived: archive } })
      json({ ok: true })
      return
    }

    // CRM: etapa do Kanban persistida no SQLite
    if (url.includes('/crm/stage') && req.method === 'POST') {
      const body = await readBody(req)
      let reqBody = {}
      try { reqBody = JSON.parse(body || '{}') } catch {}
      const stage = String(reqBody.stage || 'Inbox')
      const chatId = reqBody.chatId || ''
      const phone = reqBody.phone || ''
      const where = chatId ? { id: chatId } : { phone: normPhone(phone) }
      await prisma.waChat.updateMany({ where, data: { stage, updatedAt: new Date() } })
      pusherPublish('crm_stage_updated', { chatId, phone, stage })
      json({ ok: true, stage })
      return
    }

    // Sofi IA: estado e configuracao
    if (url.includes('/ai/state')) {
      json({
        ok: true,
        mode: aiConfig.mode,
        tone: aiConfig.tone,
        maxChars: aiConfig.maxChars,
        allowGroups: aiConfig.allowGroups,
        activePlaybook: aiConfig.activePlaybook,
        playbooks: aiConfig.playbooks,
        training: aiConfig.training,
        handoffChats: [...handoffChats],
        hasGeminiKey: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
        providers: {
          gemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY),
          anthropic: !!process.env.ANTHROPIC_API_KEY,
          mistral: !!process.env.MISTRAL_API_KEY,
          deepseek: !!process.env.DEEPSEEK_API_KEY,
          openrouter: !!process.env.OPENROUTER_API_KEY,
          xai: !!process.env.XAI_API_KEY,
        },
      })
      return
    }

    if (url.includes('/ai/control') && req.method === 'POST') {
      const body = await readBody(req)
      let reqBody = {}
      try { reqBody = JSON.parse(body || '{}') } catch {}
      const nextMode = String(reqBody.mode || aiConfig.mode)
      if (AI_MODES.has(nextMode)) aiConfig.mode = nextMode
      if (typeof reqBody.tone === 'string') aiConfig.tone = reqBody.tone.slice(0, 300)
      if (Number(reqBody.maxChars) > 120) aiConfig.maxChars = Math.min(1200, Number(reqBody.maxChars))
      if (typeof reqBody.allowGroups === 'boolean') aiConfig.allowGroups = reqBody.allowGroups
      if (typeof reqBody.activePlaybook === 'string') aiConfig.activePlaybook = reqBody.activePlaybook.slice(0, 40)
      if (reqBody.playbooks && typeof reqBody.playbooks === 'object') {
        aiConfig.playbooks = {
          ...aiConfig.playbooks,
          vendas: String(reqBody.playbooks.vendas || aiConfig.playbooks.vendas || '').slice(0, 4000),
          suporte: String(reqBody.playbooks.suporte || aiConfig.playbooks.suporte || '').slice(0, 4000),
          pessoal: String(reqBody.playbooks.pessoal || aiConfig.playbooks.pessoal || '').slice(0, 4000),
        }
      }
      saveAiConfig()
      pusherPublish('ai_state', { mode: aiConfig.mode, tone: aiConfig.tone, allowGroups: aiConfig.allowGroups, activePlaybook: aiConfig.activePlaybook })
      json({ ok: true, ...aiConfig })
      return
    }

    if (url.includes('/ai/suggest') && req.method === 'POST') {
      const body = await readBody(req)
      let reqBody = {}
      try { reqBody = JSON.parse(body || '{}') } catch {}
      const chatId = reqBody.chatId || ''
      const text = String(reqBody.text || '').trim()
      if (!chatId) { res.writeHead(400); res.end(JSON.stringify({ error: 'chatId obrigatorio' })); return }
      const chat = await prisma.waChat.findUnique({ where: { id: chatId }, select: { contactName: true } }).catch(() => null)
      const reply = await generateSofiReply({
        chatId,
        incomingText: text || 'Sugira uma resposta para a ultima mensagem desta conversa.',
        pushName: chat?.contactName || '',
      })
      json({ ok: true, reply })
      return
    }

    if (url.includes('/ai/training') && req.method === 'POST') {
      const body = await readBody(req)
      let reqBody = {}
      try { reqBody = JSON.parse(body || '{}') } catch {}
      const text = String(reqBody.text || '').trim()
      if (text) {
        aiConfig.training = [text, ...aiConfig.training.filter(t => t !== text)].slice(0, 40)
        saveAiConfig()
      }
      json({ ok: true, training: aiConfig.training })
      return
    }

    if (url.includes('/ai/handoff') && req.method === 'POST') {
      const body = await readBody(req)
      let reqBody = {}
      try { reqBody = JSON.parse(body || '{}') } catch {}
      const chatId = reqBody.chatId || ''
      const paused = reqBody.paused !== false
      if (chatId) paused ? handoffChats.add(chatId) : handoffChats.delete(chatId)
      json({ ok: true, chatId, paused })
      return
    }

    // Segmentos prontos para filtros, extracao e envio em massa
    if (url.includes('/crm/segments')) {
      const rows = await prisma.waChat.groupBy({ by: ['stage'], _count: { stage: true }, where: { archived: false } })
      const [all, named, groups, unread] = await Promise.all([
        prisma.waChat.count({ where: { archived: false, isGroup: false } }),
        prisma.waChat.count({ where: { archived: false, isGroup: false, contactName: { not: null } } }),
        prisma.waChat.count({ where: { archived: false, isGroup: true } }),
        prisma.waChat.count({ where: { archived: false, unreadCount: { gt: 0 } } }),
      ])
      json({ all, named, groups, unread, stages: rows.map(r => ({ stage: r.stage || 'Inbox', count: r._count.stage })) })
      return
    }

    // ── Estatísticas do banco (debug) ──────────────────────────────────────
    if (pathname === '/db/stats') {
      const [chats, messages] = await Promise.all([
        prisma.waChat.count(),
        prisma.waMessage.count(),
      ])
      json({ chats, messages, ready: isReady, phone: phoneInfo })
      return
    }

    // ── Grupos ────────────────────────────────────────────────────────────
    if (url.includes('/group/fetchAllGroups')) {
      if (!isReady) { json([]); return }
      const chats  = await client.getChats()
      const groups = chats.filter(c => c.isGroup)
      json(await Promise.all(groups.map(async g => ({
        id:      g.id._serialized,
        subject: g.name || '',
        participants: (g.participants || []).map(p => ({
          id:    p.id?._serialized || '',
          admin: p.isAdmin || false,
        })),
      }))))
      return
    }

    if (pathname === '/instagram/webhook' && req.method === 'GET') {
      const mode = parsedUrl.searchParams.get('hub.mode') || ''
      const token = parsedUrl.searchParams.get('hub.verify_token') || ''
      const challenge = parsedUrl.searchParams.get('hub.challenge') || ''
      const expected = process.env.INSTAGRAM_VERIFY_TOKEN || instagramState.verifyToken || ''
      if (mode === 'subscribe' && token && token === expected) {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end(challenge)
      } else {
        res.writeHead(403, { 'Content-Type': 'text/plain' })
        res.end('forbidden')
      }
      return
    }

    if (pathname === '/instagram/webhook' && req.method === 'POST') {
      const bodyRaw = await readBody(req)
      let payload = {}
      try { payload = JSON.parse(bodyRaw || '{}') } catch {}
      addInstagramEvent({ type: 'webhook_received', payload: { object: payload.object || '', entries: (payload.entry || []).length } })
      const entries = Array.isArray(payload.entry) ? payload.entry : []
      for (const entry of entries) {
        const changes = Array.isArray(entry.changes) ? entry.changes : []
        for (const change of changes) {
          const field = change?.field || ''
          const value = change?.value || {}
          if (field === 'comments') {
            const text = String(value.text || '')
            const fromId = String(value.from?.id || value.from?.user_id || '')
            const fromName = String(value.from?.username || value.from?.name || '')
            const commentId = String(value.id || value.comment_id || '')
            const rule = findInstagramRule(text)
            addInstagramConversation(fromId, { direction: 'in', source: 'instagram_comment', text, name: fromName, stage: rule?.targetStage || 'Inbox' })
            addInstagramEvent({ type: 'comment', fromId, fromName, text, commentId, ruleId: rule?.id || null })
            if (instagramState.automationEnabled && rule) {
              const personalized = String(instagramState.autoReplyTemplate || '').replace('{name}', fromName || 'amigo(a)')
              try {
                if (instagramState.requireFollowGate) {
                  const gateMsg = String(instagramState.followGateTemplate || '').replace('{name}', fromName || 'amigo(a)')
                  if (commentId) await sendInstagramPrivateReply(commentId, gateMsg)
                  addInstagramEvent({ type: 'follow_gate_sent', fromId, ruleId: rule.id })
                } else {
                  if (commentId) await sendInstagramPrivateReply(commentId, personalized)
                  if (fromId) await sendInstagramDm(fromId, personalized)
                  addInstagramEvent({ type: 'automation_sent', fromId, ruleId: rule.id })
                }
              } catch (e) {
                addInstagramEvent({ type: 'automation_error', fromId, ruleId: rule.id, error: e.message })
              }
            }
          }
          if (field === 'messages') {
            const message = value.message || {}
            const text = String(message.text || value.text || '')
            const fromId = String(value.from?.id || '')
            const fromName = String(value.from?.username || value.from?.name || '')
            const rule = findInstagramRule(text)
            addInstagramConversation(fromId, { direction: 'in', source: 'instagram_dm', text, name: fromName, stage: rule?.targetStage || 'Inbox' })
            addInstagramEvent({ type: 'dm_received', fromId, fromName, text, ruleId: rule?.id || null })
          }
        }
      }
      json({ ok: true })
      return
    }

    if (pathname === '/instagram/state' && req.method === 'GET') {
      const businessId = await tryResolveInstagramBusinessId()
      json({
        ok: true,
        connected: !!(instagramState.connected || businessId),
        pageId: process.env.INSTAGRAM_PAGE_ID || instagramState.pageId || '',
        businessId: businessId || process.env.INSTAGRAM_BUSINESS_ID || instagramState.businessId || '',
        hasPageToken: !!(process.env.INSTAGRAM_PAGE_TOKEN || instagramState.pageToken),
        hasVerifyToken: !!(process.env.INSTAGRAM_VERIFY_TOKEN || instagramState.verifyToken),
        automationEnabled: !!instagramState.automationEnabled,
        requireFollowGate: !!instagramState.requireFollowGate,
        rules: instagramState.rules || [],
      })
      return
    }

    if (pathname === '/instagram/rules' && req.method === 'GET') {
      json({ ok: true, rules: instagramState.rules || [] })
      return
    }

    if (pathname === '/instagram/rules' && req.method === 'POST') {
      const body = await readBody(req)
      let reqBody = {}
      try { reqBody = JSON.parse(body || '{}') } catch {}
      const rules = Array.isArray(reqBody.rules) ? reqBody.rules : []
      instagramState.rules = rules.slice(0, 50).map((rule, idx) => ({
        id: String(rule.id || `rule_${idx + 1}`),
        keyword: String(rule.keyword || '').trim(),
        action: String(rule.action || 'dm_material').trim(),
        enabled: rule.enabled !== false,
        targetStage: String(rule.targetStage || 'Acompanhar'),
      })).filter(r => r.keyword)
      saveInstagramState()
      json({ ok: true, rules: instagramState.rules })
      return
    }

    if (pathname === '/instagram/control' && req.method === 'POST') {
      const body = await readBody(req)
      let reqBody = {}
      try { reqBody = JSON.parse(body || '{}') } catch {}
      if (typeof reqBody.pageId === 'string' && reqBody.pageId.trim()) instagramState.pageId = reqBody.pageId.trim()
      if (typeof reqBody.pageToken === 'string' && reqBody.pageToken.trim()) {
        instagramState.pageToken = reqBody.pageToken.trim()
        instagramState.hasPageToken = true
      }
      if (typeof reqBody.businessId === 'string' && reqBody.businessId.trim()) {
        instagramState.businessId = reqBody.businessId.trim()
        instagramState.connected = true
      }
      if (typeof reqBody.automationEnabled === 'boolean') instagramState.automationEnabled = reqBody.automationEnabled
      if (typeof reqBody.requireFollowGate === 'boolean') instagramState.requireFollowGate = reqBody.requireFollowGate
      if (typeof reqBody.autoReplyTemplate === 'string') instagramState.autoReplyTemplate = reqBody.autoReplyTemplate.slice(0, 500)
      if (typeof reqBody.followGateTemplate === 'string') instagramState.followGateTemplate = reqBody.followGateTemplate.slice(0, 500)
      saveInstagramState()
      json({
        ok: true,
        pageId: instagramState.pageId || '',
        businessId: instagramState.businessId || '',
        automationEnabled: instagramState.automationEnabled,
        requireFollowGate: instagramState.requireFollowGate,
      })
      return
    }

    if (pathname === '/instagram/events' && req.method === 'GET') {
      json({ ok: true, events: (instagramState.events || []).slice(-100).reverse() })
      return
    }

    if (pathname === '/instagram/conversations' && req.method === 'GET') {
      const list = Object.values(instagramState.conversations || {}).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      json({ ok: true, conversations: list.slice(0, 500) })
      return
    }

    if (pathname === '/instagram/send-dm' && req.method === 'POST') {
      const body = await readBody(req)
      let reqBody = {}
      try { reqBody = JSON.parse(body || '{}') } catch {}
      const userId = String(reqBody.userId || '').trim()
      const text = String(reqBody.text || '').trim()
      if (!userId || !text) { res.writeHead(400); res.end(JSON.stringify({ error: 'userId e text obrigatorios' })); return }
      const result = await sendInstagramDm(userId, text)
      addInstagramConversation(userId, { direction: 'out', source: 'instagram_dm', text })
      addInstagramEvent({ type: 'dm_sent', userId, text })
      json({ ok: true, result })
      return
    }

    res.writeHead(404); res.end(JSON.stringify({ error: `Não encontrado: ${url}` }))
  } catch (err) {
    console.error('[WA API] Erro:', err.message)
    res.writeHead(500); res.end(JSON.stringify({ error: err.message }))
  }
})

server.listen(PORT, () => {
  console.log('═'.repeat(60))
  console.log('  Sofi CRM — WhatsApp Web + SQLite')
  console.log('═'.repeat(60))
  console.log(`  API:     http://localhost:${PORT}`)
  console.log(`  Banco:   ${path.join(__dirname, 'whatsapp.db')}`)
  console.log(`  Pusher:  "${PUSHER.channel}" @ ${PUSHER.cluster}`)
  console.log('  Inicializando WhatsApp Web...')
  console.log('═'.repeat(60))
})
