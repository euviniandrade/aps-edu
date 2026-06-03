import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
export const dynamic    = 'force-dynamic'

// ?????? Config ???????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
const FALLBACK_TUNNEL = 'https://travelling-poly-clinics-persons.trycloudflare.com'

function normalizeBackendUrl(input: string): string {
  return String(input || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/\/api\/?$/, '')
    .replace(/\/$/, '')
}

const BACKEND_URLS = Array.from(
  new Set([
    normalizeBackendUrl(process.env.BACKEND_URL || ''),
    normalizeBackendUrl(process.env.NEXT_PUBLIC_API_URL || ''),
    normalizeBackendUrl(FALLBACK_TUNNEL),
  ].filter(Boolean)),
)

// ── Helpers ──────────────────────────────────────────────────────────────────
function evoHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: EVO_KEY,
    'ngrok-skip-browser-warning': 'true',
    'User-Agent': 'APS-EDU-Proxy/1.0',
  }
}

function shouldRetryWithFallback(status: number, text: string): boolean {
  if (status >= 500) return true
  return /fetch failed|bad gateway|unable to reach the origin service|cloudflared|origin service/i.test(text || '')
}

async function fetchFromBackendCandidates(path: string, init: RequestInit) {
  let lastError = ''

  for (const baseUrl of BACKEND_URLS) {
    try {
      const response = await fetch(`${baseUrl}${path}`, { ...init, cache: 'no-store' })

      if (response.ok) {
        const data = await response.json().catch(async () => {
          const text = await response.text().catch(() => '')
          throw new Error(text || 'invalid_json')
        })
        return { ok: true, data }
      }

      const text = await response.text().catch(() => '')
      lastError = text || `http_${response.status}`

      if (!shouldRetryWithFallback(response.status, text)) {
        return { ok: false, status: response.status, text }
      }
    } catch (e: any) {
      lastError = e?.message || 'fetch_failed'
    }
  }

  return {
    ok: false,
    status: 502,
    text: lastError || 'fetch_failed',
  }
}

async function evoGet(path: string): Promise<any> {
  const result = await fetchFromBackendCandidates(path, { headers: evoHeaders() })
  if (result.ok) return result.data
  return { ok: false, proxyError: true, status: result.status, path, message: String(result.text || '').slice(0, 500) }
}

async function evoPost(path: string, body: any): Promise<any> {
  const result = await fetchFromBackendCandidates(path, {
    method: 'POST',
    headers: evoHeaders(),
    body: JSON.stringify(body),
  })
  if (result.ok) return result.data
  return { ok: false, proxyError: true, status: result.status, path, message: String(result.text || '').slice(0, 500) }
}
function normPhone(id: string): string {
  return String(id || '').replace(/@[^@]*$/, '').replace(/\D/g, '')
}

/** Extrai texto legível de qualquer tipo de mensagem WhatsApp */
function extractText(message: any): string {
  if (!message) return ''
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.title ||
    message.documentWithCaptionMessage?.message?.documentMessage?.title ||
    (message.audioMessage        ? '🎤 Áudio'    : '') ||
    (message.imageMessage        ? '📷 Foto'     : '') ||
    (message.videoMessage        ? '🎥 Vídeo'    : '') ||
    (message.documentMessage     ? '📄 Arquivo'  : '') ||
    (message.stickerMessage      ? '🎴 Sticker'  : '') ||
    (message.contactMessage      ? '👤 Contato'  : '') ||
    (message.locationMessage     ? '📍 Localização' : '') ||
    (message.reactionMessage     ? `${message.reactionMessage.text} (reação)` : '') ||
    (message.pollCreationMessage ? `📊 ${message.pollCreationMessage.name}` : '') ||
    ''
  )
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async function getStatus() {
  const d = await evoGet(`/instance/connectionState/${INSTANCE}`)
  const state: string = d?.instance?.state || 'close'
  return {
    connected: state === 'open',
    ready:     state === 'open',
    qrDataUrl: null,
    error:     null,
    provider:  'evolution',
    mode:      'live',
    state,
  }
}

async function startConnect() {
  const d = await evoGet(`/instance/connectionState/${INSTANCE}`)
  const state: string = d?.instance?.state || 'close'
  if (state === 'open') return { connected: true, ready: true, qrDataUrl: null, error: null }
  const qr = await evoGet(`/instance/connect/${INSTANCE}`)
  return {
    connected: false,
    ready:     false,
    qrDataUrl: qr?.base64 || null,
    error:     qr?.base64 ? null : 'QR Code não disponível — verifique se o backend está rodando',
  }
}

async function getContacts() {
  // ── Fontes em paralelo ────────────────────────────────────────────────────
  const [chats, recentRaw, contactList, contactsAllRaw] = await Promise.all([
    // Sem limite — banco SQLite retorna todos os contatos e grupos
    evoGet(`/chat/findChats/${INSTANCE}`),
    evoPost(`/chat/findMessages/${INSTANCE}`, {}).catch(() => ({})),
    evoPost(`/chat/findContacts/${INSTANCE}`, {}).catch(() => []),
    evoGet('/contacts/all').catch(() => []),
  ])

  // ── Mapa: chatId → última mensagem (text) ─────────────────────────────────
  // As mensagens vêm em ordem decrescente; primeira por chatId = mais recente
  const lastMsgMap = new Map<string, string>()
  const rawMsgs: any[] =
    recentRaw?.messages?.records ||
    recentRaw?.messages ||
    (Array.isArray(recentRaw) ? recentRaw : [])

  for (const m of rawMsgs) {
    const cid = m.key?.remoteJid || ''
    if (!cid || lastMsgMap.has(cid)) continue
    const txt = extractText(m.message)
    if (txt) lastMsgMap.set(cid, txt)
  }

  // ── Mapa: chatId → nome do contato ────────────────────────────────────────
  const nameMap = new Map<string, string>()
  const avatarMap = new Map<string, string>()
  const nameByPhone = new Map<string, string>()
  const avatarByPhone = new Map<string, string>()
  for (const c of (Array.isArray(contactList) ? contactList : [])) {
    const key = c.id || c.remoteJid || ''
    const val = c.pushName || c.name || ''
    const phone = normPhone(key)
    if (key && val && !/^\d{10,}$/.test(val)) nameMap.set(key, val)
    if (key && c.avatarUrl) avatarMap.set(key, String(c.avatarUrl))
    if (phone && val && !/^\d{10,}$/.test(val)) nameByPhone.set(phone, val)
    if (phone && c.avatarUrl) avatarByPhone.set(phone, String(c.avatarUrl))
  }

  const contactsAll = Array.isArray(contactsAllRaw)
    ? contactsAllRaw
    : Array.isArray(contactsAllRaw?.contacts)
      ? contactsAllRaw.contacts
      : []
  for (const c of contactsAll) {
    const key = c.id || c.remoteJid || c.phone || ''
    const val = c.pushName || c.name || c.fullName || c.shortName || ''
    const phone = normPhone(key)
    if (key && val && !/^\d{10,}$/.test(val) && !nameMap.has(key)) nameMap.set(key, val)
    if (key && c.avatarUrl && !avatarMap.has(key)) avatarMap.set(key, String(c.avatarUrl))
    if (phone && val && !/^\d{10,}$/.test(val) && !nameByPhone.has(phone)) nameByPhone.set(phone, val)
    if (phone && c.avatarUrl && !avatarByPhone.has(phone)) avatarByPhone.set(phone, String(c.avatarUrl))
  }

  const seen   = new Set<string>()
  const result: any[] = []

  for (const chat of (Array.isArray(chats) ? chats : [])) {
    const id = chat.id || chat.remoteJid || ''
    if (!id || id === 'status@broadcast') continue

    const isGroup = chat.isGroup || id.endsWith('@g.us')
    // Para grupos: usa o id como chave única; para individuais: usa o phone
    const phone = isGroup ? id : normPhone(id)
    if (!phone || phone.length < 7 || seen.has(phone)) continue
    seen.add(phone)

    const name =
      nameMap.get(id) ||
      nameByPhone.get(phone) ||
      chat.name || chat.pushname || chat.verifiedName || ''

    // Timestamp — tenta todos os campos conhecidos
    const lm    = chat.lastMessage
    const rawTs =
      lm?.messageTimestamp ||
      chat.lastMsgTimestamp ||
      chat.lastMessageRecvTimestamp ||
      chat.updatedAt ||
      0

    // Tenta extrair lastMessage de todos os lugares possíveis
    const lastTxt =
      lastMsgMap.get(id) ||                    // do bulk findMessages
      extractText(lm?.message) ||             // do chat.lastMessage.message
      extractText(lm) ||                      // do chat.lastMessage direto
      chat.lastMessageText ||                 // campo alternativo
      (lm?.conversation as string) ||         // conversa direta
      ''

    result.push({
      id, chatId: id, phone,
      name:        name || phone,
      lastMessage: lastTxt,
      timestamp:   Number(rawTs),
      unreadCount: chat.unreadCount || 0,
      stage:       chat.stage || 'Inbox',
      isGroup,
      avatarUrl: avatarMap.get(id) || avatarByPhone.get(phone) || '',
    })
  }

  return result.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
}

async function getMessages(chatId: string, limit = 0) {
  const chatPhone = normPhone(chatId)
  const hasLimit = Number(limit) > 0
  const requestLimit = hasLimit ? Number(limit) + 40 : undefined

  // Tenta dois formatos de query que o Evolution API aceita
  const [d1, d2] = await Promise.all([
    evoPost(`/chat/findMessages/${INSTANCE}`, {
      where: { key: { remoteJid: chatId } },
      ...(hasLimit ? { limit: requestLimit } : {}),
    }),
    evoPost(`/chat/findMessages/${INSTANCE}`, {
      where: { remoteJid: chatId },
      ...(hasLimit ? { limit: requestLimit } : {}),
    }),
  ])

  const parse = (d: any): any[] =>
    d?.messages?.records || d?.messages || (Array.isArray(d) ? d : [])

  // Une resultados e remove duplicatas
  const byId = new Map<string, any>()
  for (const m of [...parse(d1), ...parse(d2)]) {
    const k = m.key?.id || JSON.stringify(m)
    if (!byId.has(k)) byId.set(k, m)
  }

  let msgs = [...byId.values()]

  // ── FILTRO OBRIGATÓRIO client-side ────────────────────────────────────────
  // Garante que só apareçam mensagens desta conversa, mesmo se o servidor
  // retornar mensagens de outros chats (comportamento do file store)
  msgs = msgs.filter((m: any) => {
    const jid = m.key?.remoteJid || m.remoteJid || ''
    return jid === chatId || normPhone(jid) === chatPhone
  })

  // Ordena do mais antigo para o mais recente (estilo WhatsApp)
  msgs.sort((a: any, b: any) =>
    Number(a.messageTimestamp || 0) - Number(b.messageTimestamp || 0)
  )

  return msgs
    .map((m: any) => ({
      id:     m.key?.id || String(Date.now() + Math.random()),
      chatId: m.key?.remoteJid || chatId,
      from:   m.key?.fromMe ? 'agent' : 'lead',
      text:   extractText(m.message),
      at:     m.messageTimestamp
                ? new Date(Number(m.messageTimestamp) * 1000).toISOString()
                : new Date().toISOString(),
      name:   m.pushName || '',
    }))
    .filter((m: any) => m.text)
}

async function sendMessage(chatId: string, phone: string, text: string) {
  const number = phone || normPhone(chatId)
  return evoPost(`/message/sendText/${INSTANCE}`, {
    number,
    options: { delay: 1200 },
    textMessage: { text },
  })
}

async function markRead(chatId: string, msgs: Array<{ id: string; fromMe: boolean }>) {
  if (!msgs.length) return {}
  return evoPost(`/chat/markMessageAsRead/${INSTANCE}`, {
    read_messages: msgs.map(m => ({ id: m.id, fromMe: m.fromMe, remoteJid: chatId })),
  })
}

async function archiveChat(chatId: string, archive: boolean) {
  return evoPost(`/chat/archiveChat/${INSTANCE}`, {
    lastMessage: { key: { remoteJid: chatId, id: '', fromMe: false } },
    archive,
  })
}

async function updateStage(chatId: string, phone: string, stage: string) {
  return evoPost('/crm/stage', { chatId, phone, stage })
}

async function getAiState() {
  return evoGet('/ai/state')
}

async function updateAiControl(body: any) {
  return evoPost('/ai/control', body)
}

async function addAiTraining(text: string) {
  return evoPost('/ai/training', { text })
}

async function setAiHandoff(chatId: string, paused: boolean) {
  return evoPost('/ai/handoff', { chatId, paused })
}

async function suggestAiReply(chatId: string, text: string) {
  return evoPost('/ai/suggest', { chatId, text })
}

async function getSegments() {
  return evoGet('/crm/segments')
}

async function getInstagramState() {
  return evoGet('/instagram/state')
}

async function getInstagramRules() {
  return evoGet('/instagram/rules')
}

async function getInstagramEvents() {
  return evoGet('/instagram/events')
}

async function getInstagramConversations() {
  return evoGet('/instagram/conversations')
}

async function updateInstagramRules(rules: any[]) {
  return evoPost('/instagram/rules', { rules })
}

async function updateInstagramControl(body: any) {
  return evoPost('/instagram/control', body)
}

async function sendInstagramDm(userId: string, text: string) {
  return evoPost('/instagram/send-dm', { userId, text })
}

async function deleteMessage(chatId: string, msgId: string, fromMe: boolean) {
  try {
    const r = await fetch(`${BACKEND_URL}/chat/deleteMessage/${INSTANCE}`, {
      method: 'DELETE', headers: evoHeaders(),
      body: JSON.stringify({ id: msgId, remoteJid: chatId, fromMe }),
      cache: 'no-store',
    })
    return await r.json()
  } catch { return {} }
}

async function getGroups() {
  const d = await evoGet(`/group/fetchAllGroups/${INSTANCE}?getParticipants=true`)
  const arr = Array.isArray(d) ? d : []
  return arr.map((g: any) => ({
    id:           g.id || g.groupJid || '',
    name:         g.subject || g.name || g.id || '',
    description:  g.desc || g.description || '',
    participants: (g.participants || []).length,
    members:      (g.participants || []).map((p: any) => ({
      id:    p.id || p.jid || '',
      phone: normPhone(p.id || p.jid || ''),
      admin: p.admin === 'admin' || p.admin === 'superadmin',
    })).filter((m: any) => m.phone && m.phone.length >= 7),
  }))
}

async function syncContacts() {
  return evoPost('/contacts/sync', {})
}

async function getAllContacts() {
  return evoGet('/contacts/all')
}

// ── SSE: proxy do relay local → Vercel → browser ─────────────────────────────
// Faz proxy da stream SSE do relay (localhost:8079/relay/events via ngrok)
// para o browser. Isso permite push em tempo real de webhooks do Evolution API.
async function makeRelaySSEStream(): Promise<ReadableStream<Uint8Array>> {
  const enc = new TextEncoder()
  const relayUrl = `${BACKEND_URL}/relay/events`

  return new ReadableStream({
    async start(controller) {
      let closed = false
      const close = () => {
        if (!closed) { closed = true; try { controller.close() } catch {} }
      }

      try {
        const upstream = await fetch(relayUrl, {
          headers: {
            Accept: 'text/event-stream',
            'ngrok-skip-browser-warning': 'true',
            'Cache-Control': 'no-cache',
          },
          cache: 'no-store',
          // @ts-ignore — Node 18+ fetch suporta duplex stream
          duplex: 'half',
        })

        if (!upstream.ok || !upstream.body) {
          controller.enqueue(enc.encode('event: error\ndata: {"msg":"relay unavailable"}\n\n'))
          close()
          return
        }

        const reader = upstream.body.getReader()
        // Timeout de segurança: fecha após 55s para o Vercel não matar (max 60s)
        const timeout = setTimeout(close, 55000)

        while (!closed) {
          const { done, value } = await reader.read()
          if (done || closed) break
          try { controller.enqueue(value) } catch { break }
        }

        clearTimeout(timeout)
        reader.cancel().catch(() => {})
      } catch (e) {
        // Relay indisponível — manda evento de erro e fecha
        try {
          controller.enqueue(enc.encode('event: error\ndata: {"msg":"relay unavailable"}\n\n'))
        } catch {}
      }

      close()
    },
  })
}

// ── SSE: polling de estado ────────────────────────────────────────────────────
// Fecha após 50s; o frontend reconecta automaticamente (sem flash de "offline")
function makeSSEStream(): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream({
    async start(controller) {
      let closed = false
      const push = (event: string, data: any) => {
        if (closed) return
        try { controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) } catch {}
      }

      let lastGoodState: any = null

      const poll = async () => {
        try {
          const s = await getStatus()
          lastGoodState = s
          push('state', s)
        } catch {
          // Falha de rede: não muda estado — mantém último estado conhecido
          if (lastGoodState) push('state', lastGoodState)
        }
      }

      await poll()
      const timer = setInterval(poll, 2000) // polling a cada 2s (fallback rápido)
      setTimeout(() => {
        closed = true
        clearInterval(timer)
        try { controller.close() } catch {}
      }, 50000)
    },
  })
}

// ── GET routes ────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const p0 = path[0]
  try {
    if (p0 === 'status')   return NextResponse.json(await getStatus())
    if (p0 === 'contacts') return NextResponse.json(await getContacts())
    if (p0 === 'groups')   return NextResponse.json(await getGroups())
    if (p0 === 'contacts-all') return NextResponse.json(await getAllContacts())
    if (p0 === 'ai-state') return NextResponse.json(await getAiState())
    if (p0 === 'segments') return NextResponse.json(await getSegments())
    if (p0 === 'instagram-state') return NextResponse.json(await getInstagramState())
    if (p0 === 'instagram-rules') return NextResponse.json(await getInstagramRules())
    if (p0 === 'instagram-events') return NextResponse.json(await getInstagramEvents())
    if (p0 === 'instagram-conversations') return NextResponse.json(await getInstagramConversations())
    if (p0 === 'messages') {
      const chatId = req.nextUrl.searchParams.get('chatId') || ''
      const limit  = Number(req.nextUrl.searchParams.get('limit') || '0')
      return NextResponse.json(await getMessages(chatId, limit))
    }
    if (p0 === 'events') {
      return new NextResponse(makeSSEStream() as any, {
        status: 200,
        headers: {
          'Content-Type':      'text/event-stream',
          'Cache-Control':     'no-cache',
          'Connection':        'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      })
    }
    // Proxy SSE do relay local (mensagens em tempo real via webhook)
    if (p0 === 'relay-events') {
      const stream = await makeRelaySSEStream()
      return new NextResponse(stream as any, {
        status: 200,
        headers: {
          'Content-Type':      'text/event-stream',
          'Cache-Control':     'no-cache',
          'Connection':        'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      })
    }
    return NextResponse.json({ error: `Endpoint desconhecido: ${p0}` }, { status: 404 })
  } catch (e: any) {
    console.error(`[EVO] GET /${p0}:`, e.message)
    return NextResponse.json({ error: e.message }, { status: 503 })
  }
}

// ── POST routes ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const p0 = path[0]
  try {
    if (p0 === 'start') return NextResponse.json(await startConnect())
    if (p0 === 'send') {
      const b = await req.json()
      return NextResponse.json({ ok: true, result: await sendMessage(b.chatId || '', b.phone || '', b.text || '') })
    }
    if (p0 === 'mark-read') {
      const b = await req.json()
      return NextResponse.json(await markRead(b.chatId || '', b.messages || []))
    }
    if (p0 === 'archive') {
      const b = await req.json()
      return NextResponse.json(await archiveChat(b.chatId || '', b.archive !== false))
    }
    if (p0 === 'stage') {
      const b = await req.json()
      return NextResponse.json(await updateStage(b.chatId || '', b.phone || '', b.stage || 'Inbox'))
    }
    if (p0 === 'contacts-sync') {
      return NextResponse.json(await syncContacts())
    }
    if (p0 === 'ai-control') {
      const b = await req.json()
      return NextResponse.json(await updateAiControl(b))
    }
    if (p0 === 'ai-training') {
      const b = await req.json()
      return NextResponse.json(await addAiTraining(b.text || ''))
    }
    if (p0 === 'ai-handoff') {
      const b = await req.json()
      return NextResponse.json(await setAiHandoff(b.chatId || '', b.paused !== false))
    }
    if (p0 === 'ai-suggest') {
      const b = await req.json()
      return NextResponse.json(await suggestAiReply(b.chatId || '', b.text || ''))
    }
    if (p0 === 'delete-message') {
      const b = await req.json()
      return NextResponse.json(await deleteMessage(b.chatId || '', b.msgId || '', b.fromMe !== false))
    }
    if (p0 === 'instagram-rules') {
      const b = await req.json()
      return NextResponse.json(await updateInstagramRules(Array.isArray(b.rules) ? b.rules : []))
    }
    if (p0 === 'instagram-control') {
      const b = await req.json()
      return NextResponse.json(await updateInstagramControl(b))
    }
    if (p0 === 'instagram-send-dm') {
      const b = await req.json()
      return NextResponse.json(await sendInstagramDm(b.userId || '', b.text || ''))
    }
    return NextResponse.json({ error: `Endpoint desconhecido: ${p0}` }, { status: 404 })
  } catch (e: any) {
    console.error(`[EVO] POST /${p0}:`, e.message)
    return NextResponse.json({ error: e.message }, { status: 503 })
  }
}
