const prisma = require('../../shared/config/prisma')
const { encrypt, decrypt } = require('../../shared/utils/secret-box')

function clean(value) {
  return typeof value === 'string' ? value.replace(/^\uFEFF/, '').trim() : value
}

function getGoogleConfig() {
  return {
    clientId: clean(process.env.GOOGLE_CLIENT_ID),
    clientSecret: clean(process.env.GOOGLE_CLIENT_SECRET),
    tokenUrl: 'https://oauth2.googleapis.com/token',
  }
}

function getMicrosoftConfig() {
  const tenant = clean(process.env.MICROSOFT_TENANT_ID) || 'common'
  return {
    clientId: clean(process.env.MICROSOFT_CLIENT_ID),
    clientSecret: clean(process.env.MICROSOFT_CLIENT_SECRET),
    tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
  }
}

function parseMeta(meta) {
  if (!meta) return {}
  try {
    return JSON.parse(meta)
  } catch {
    return {}
  }
}

function xmlDecode(value = '') {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function basicAuth(valueA = '', valueB = '') {
  return `Basic ${Buffer.from(`${valueA}:${valueB}`).toString('base64')}`
}

function formatIcsDate(value) {
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function escapeIcs(value = '') {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function parseIcsField(block, field) {
  const match = block.match(new RegExp(`${field}(?:;[^:]+)?:([^\\r\\n]+)`))
  return match ? match[1].trim() : ''
}

function normalizeIcsDate(value) {
  if (!value) return ''
  if (value.includes('T') && value.includes('-')) return value
  const raw = value.replace('Z', '')
  if (!/^\d{8}T\d{6}$/.test(raw)) return value
  const normalized = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:${raw.slice(13, 15)}${value.endsWith('Z') ? 'Z' : ''}`
  return normalized
}

function buildIcsPayload(payload, uid) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//APS EDU//Sofi//PT-BR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
    `DTSTART:${formatIcsDate(payload.start)}`,
    `DTEND:${formatIcsDate(payload.end)}`,
    `SUMMARY:${escapeIcs(payload.title || 'Evento APS EDU')}`,
    `DESCRIPTION:${escapeIcs(payload.description || '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

function serializeIntegration(record) {
  if (!record) return null
  return {
    ...record,
    accessToken: decrypt(record.accessToken),
    refreshToken: decrypt(record.refreshToken),
    meta: parseMeta(record.meta),
  }
}

async function storeOAuthIntegration({
  userId,
  provider,
  tokenData,
  email,
  externalAccountId,
  meta = {},
}) {
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + Number(tokenData.expires_in) * 1000)
    : null

  const saved = await prisma.externalIntegration.upsert({
    where: { userId_provider: { userId, provider } },
    create: {
      userId,
      provider,
      email: email || null,
      externalAccountId: externalAccountId || null,
      accessToken: encrypt(tokenData.access_token),
      refreshToken: encrypt(tokenData.refresh_token),
      tokenType: tokenData.token_type || 'Bearer',
      scope: typeof tokenData.scope === 'string' ? tokenData.scope : null,
      expiresAt,
      meta: JSON.stringify(meta || {}),
    },
    update: {
      email: email || undefined,
      externalAccountId: externalAccountId || undefined,
      accessToken: encrypt(tokenData.access_token),
      refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : undefined,
      tokenType: tokenData.token_type || 'Bearer',
      scope: typeof tokenData.scope === 'string' ? tokenData.scope : undefined,
      expiresAt,
      meta: JSON.stringify(meta || {}),
    },
  })

  return serializeIntegration(saved)
}

async function storeIcloudIntegration({ userId, appleId, appPassword, calendarUrl, contactsUrl }) {
  const saved = await prisma.externalIntegration.upsert({
    where: { userId_provider: { userId, provider: 'icloud' } },
    create: {
      userId,
      provider: 'icloud',
      email: appleId,
      externalAccountId: appleId,
      accessToken: encrypt(appPassword),
      refreshToken: null,
      tokenType: 'basic',
      scope: 'caldav carddav',
      expiresAt: null,
      meta: JSON.stringify({
        appleId,
        calendarUrl: calendarUrl || 'https://caldav.icloud.com',
        contactsUrl: contactsUrl || 'https://contacts.icloud.com',
      }),
    },
    update: {
      email: appleId,
      externalAccountId: appleId,
      accessToken: encrypt(appPassword),
      tokenType: 'basic',
      scope: 'caldav carddav',
      meta: JSON.stringify({
        appleId,
        calendarUrl: calendarUrl || 'https://caldav.icloud.com',
        contactsUrl: contactsUrl || 'https://contacts.icloud.com',
      }),
    },
  })

  return serializeIntegration(saved)
}

async function getUserIntegrations(userId) {
  const records = await prisma.externalIntegration.findMany({
    where: { userId },
    orderBy: { provider: 'asc' },
  })
  return records.map(serializeIntegration)
}

async function getIntegration(userId, provider) {
  const record = await prisma.externalIntegration.findUnique({
    where: { userId_provider: { userId, provider } },
  })
  return serializeIntegration(record)
}

function isExpiringSoon(expiresAt) {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() - Date.now() < 60 * 1000
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) return {}
  return response.json()
}

async function fetchMicrosoftProfile(accessToken) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) return {}
  return response.json()
}

async function refreshAccessToken(integration) {
  if (!integration?.refreshToken) return integration

  let config = null
  if (integration.provider === 'google') config = getGoogleConfig()
  if (integration.provider === 'microsoft') config = getMicrosoftConfig()
  if (!config?.clientId || !config?.clientSecret) return integration

  const body = new URLSearchParams()
  body.set('client_id', config.clientId)
  body.set('client_secret', config.clientSecret)
  body.set('grant_type', 'refresh_token')
  body.set('refresh_token', integration.refreshToken)

  const tokenResponse = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text().catch(() => '')
    throw new Error(`Falha ao atualizar token ${integration.provider}: ${detail}`)
  }

  const tokenData = await tokenResponse.json()
  const merged = {
    ...tokenData,
    refresh_token: tokenData.refresh_token || integration.refreshToken,
  }

  return storeOAuthIntegration({
    userId: integration.userId,
    provider: integration.provider,
    tokenData: merged,
    email: integration.email,
    externalAccountId: integration.externalAccountId,
    meta: integration.meta,
  })
}

async function ensureAccess(userId, provider) {
  const integration = await getIntegration(userId, provider)
  if (!integration) throw new Error(`Integração ${provider} não conectada`)
  if (provider !== 'icloud' && (!integration.accessToken || isExpiringSoon(integration.expiresAt))) {
    return refreshAccessToken(integration)
  }
  return integration
}

async function listIcloudCalendarEvents(integration, from, to) {
  const meta = integration.meta || {}
  if (!meta.appleId || !meta.calendarUrl || !integration.accessToken) return []

  const response = await fetch(meta.calendarUrl, {
    method: 'REPORT',
    headers: {
      Authorization: basicAuth(meta.appleId, integration.accessToken),
      Depth: '1',
      'Content-Type': 'application/xml; charset=utf-8',
    },
    body: `<?xml version="1.0" encoding="utf-8" ?>
      <c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
        <d:prop>
          <d:getetag />
          <c:calendar-data />
        </d:prop>
        <c:filter>
          <c:comp-filter name="VCALENDAR">
            <c:comp-filter name="VEVENT">
              <c:time-range start="${formatIcsDate(from)}" end="${formatIcsDate(to)}" />
            </c:comp-filter>
          </c:comp-filter>
        </c:filter>
      </c:calendar-query>`,
  })

  if (!response.ok) {
    throw new Error(`Falha ao listar eventos do iCloud: ${await response.text()}`)
  }

  const xml = await response.text()
  const matches = [...xml.matchAll(/<d:response[\s\S]*?<\/d:response>/g)]

  return matches
    .map(match => {
      const block = match[0]
      const href = (block.match(/<d:href>([\s\S]*?)<\/d:href>/)?.[1] || '').trim()
      const calendarData = xmlDecode(block.match(/<c:calendar-data[^>]*>([\s\S]*?)<\/c:calendar-data>/)?.[1] || '')
      if (!calendarData) return null
      return {
        provider: 'icloud',
        id: href || parseIcsField(calendarData, 'UID') || `icloud-${Date.now()}`,
        title: parseIcsField(calendarData, 'SUMMARY') || 'Evento iCloud',
        start: parseIcsField(calendarData, 'DTSTART'),
        end: parseIcsField(calendarData, 'DTEND'),
      }
    })
    .filter(Boolean)
    .map(item => ({
      ...item,
      start: normalizeIcsDate(item.start),
      end: normalizeIcsDate(item.end),
    }))
}

async function createIcloudCalendarEvent(integration, payload) {
  const meta = integration.meta || {}
  if (!meta.appleId || !meta.calendarUrl || !integration.accessToken) {
    throw new Error('Configuração do iCloud incompleta para operação de calendário')
  }

  const uid = `aps-edu-${Date.now()}@sofi`
  const response = await fetch(`${meta.calendarUrl.replace(/\/$/, '')}/${uid}.ics`, {
    method: 'PUT',
    headers: {
      Authorization: basicAuth(meta.appleId, integration.accessToken),
      'Content-Type': 'text/calendar; charset=utf-8',
      'If-None-Match': '*',
    },
    body: buildIcsPayload(payload, uid),
  })

  if (!response.ok && response.status !== 201 && response.status !== 204) {
    throw new Error(`Falha ao criar evento no iCloud: ${await response.text()}`)
  }

  return {
    provider: 'icloud',
    event: {
      id: uid,
      title: payload.title,
      start: payload.start,
      end: payload.end,
    },
  }
}

async function createCalendarEvent(userId, payload) {
  const preferred = payload.provider || 'google'
  let integration = null
  try {
    integration = await ensureAccess(userId, preferred)
  } catch {
    const fallbackProviders = ['google', 'microsoft', 'icloud'].filter(item => item !== preferred)
    for (const provider of fallbackProviders) {
      try {
        integration = await ensureAccess(userId, provider)
        break
      } catch {}
    }
  }

  if (!integration) throw new Error('Nenhum provedor de calendário conectado')

  if (integration.provider === 'google') {
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        summary: payload.title,
        description: payload.description,
        start: { dateTime: payload.start, timeZone: payload.timeZone || 'America/Sao_Paulo' },
        end: { dateTime: payload.end, timeZone: payload.timeZone || 'America/Sao_Paulo' },
      }),
    })
    if (!response.ok) throw new Error(await response.text())
    return { provider: 'google', event: await response.json() }
  }

  if (integration.provider === 'microsoft') {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        subject: payload.title,
        body: { contentType: 'HTML', content: payload.description || '' },
        start: { dateTime: payload.start, timeZone: payload.timeZone || 'E. South America Standard Time' },
        end: { dateTime: payload.end, timeZone: payload.timeZone || 'E. South America Standard Time' },
      }),
    })
    if (!response.ok) throw new Error(await response.text())
    return { provider: 'microsoft', event: await response.json() }
  }

  if (integration.provider === 'icloud') {
    return createIcloudCalendarEvent(integration, payload)
  }

  throw new Error('Provedor de calendário não suportado')
}

async function listCalendarEvents(userId, from, to) {
  const integrations = await getUserIntegrations(userId)
  const results = []

  for (const integration of integrations.filter(item => ['google', 'microsoft', 'icloud'].includes(item.provider))) {
    const active = await ensureAccess(userId, integration.provider)
    if (active.provider === 'google') {
      const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
      url.searchParams.set('timeMin', from)
      url.searchParams.set('timeMax', to)
      url.searchParams.set('singleEvents', 'true')
      url.searchParams.set('orderBy', 'startTime')
      const response = await fetch(url, { headers: { Authorization: `Bearer ${active.accessToken}` } })
      if (!response.ok) continue
      const data = await response.json()
      results.push(...(data.items || []).map((item) => ({
        provider: 'google',
        id: item.id,
        title: item.summary,
        start: item.start?.dateTime || item.start?.date,
        end: item.end?.dateTime || item.end?.date,
      })))
    }

    if (active.provider === 'microsoft') {
      const url = new URL('https://graph.microsoft.com/v1.0/me/calendarView')
      url.searchParams.set('startDateTime', from)
      url.searchParams.set('endDateTime', to)
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${active.accessToken}`,
          Prefer: 'outlook.timezone="E. South America Standard Time"',
        },
      })
      if (!response.ok) continue
      const data = await response.json()
      results.push(...(data.value || []).map((item) => ({
        provider: 'microsoft',
        id: item.id,
        title: item.subject,
        start: item.start?.dateTime,
        end: item.end?.dateTime,
      })))
    }

    if (active.provider === 'icloud') {
      const items = await listIcloudCalendarEvents(active, from, to).catch(() => [])
      results.push(...items)
    }
  }

  return results.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
}

async function sendMail(userId, payload) {
  const provider = payload.provider || 'google'
  let integration = null
  try {
    integration = await ensureAccess(userId, provider)
  } catch {
    integration = await ensureAccess(userId, provider === 'google' ? 'microsoft' : 'google')
  }

  if (integration.provider === 'google') {
    const message = [
      `To: ${payload.to}`,
      `Subject: ${payload.subject || 'Mensagem APS EDU'}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      payload.html || payload.body || '',
    ].join('\r\n')
    const raw = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    })
    if (!response.ok) throw new Error(await response.text())
    return { provider: 'google', data: await response.json() }
  }

  if (integration.provider === 'microsoft') {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: payload.subject || 'Mensagem APS EDU',
          body: { contentType: 'HTML', content: payload.html || payload.body || '' },
          toRecipients: [{ emailAddress: { address: payload.to } }],
        },
        saveToSentItems: true,
      }),
    })
    if (!response.ok) throw new Error(await response.text())
    return { provider: 'microsoft', data: { sent: true } }
  }

  throw new Error('Provedor de e-mail não suportado')
}

async function createDriveFolder(userId, payload) {
  const provider = payload.provider || 'google'
  let integration = null
  try {
    integration = await ensureAccess(userId, provider)
  } catch {
    if (payload.allowProviderFallback === false) throw new Error(`Integração ${provider} não conectada`)
    integration = await ensureAccess(userId, provider === 'google' ? 'microsoft' : 'google')
  }

  if (integration.provider === 'google') {
    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: payload.name,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    })
    if (!response.ok) throw new Error(await response.text())
    return { provider: 'google', folder: await response.json() }
  }

  if (integration.provider === 'microsoft') {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: payload.name,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename',
      }),
    })
    if (!response.ok) throw new Error(await response.text())
    return { provider: 'microsoft', folder: await response.json() }
  }

  throw new Error('Provedor de arquivos não suportado')
}

function sanitizeDriveName(value) {
  return String(value || 'arquivo-aps-edu')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140) || 'arquivo-aps-edu'
}

function buildMultipartBody(metadata, content, mimeType = 'application/octet-stream') {
  const boundary = `aps-edu-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const parts = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata || {}),
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    '',
    typeof content === 'string' ? content : Buffer.from(content || '').toString('utf8'),
    `--${boundary}--`,
    '',
  ]

  return {
    boundary,
    body: parts.join('\r\n'),
  }
}

async function uploadDriveFile(userId, payload) {
  const provider = payload.provider || 'google'
  let integration = null
  try {
    integration = await ensureAccess(userId, provider)
  } catch {
    if (payload.allowProviderFallback === false) throw new Error(`Integração ${provider} não conectada`)
    integration = await ensureAccess(userId, provider === 'google' ? 'microsoft' : 'google')
  }

  const fileName = sanitizeDriveName(payload.name)
  const mimeType = payload.mimeType || 'application/json'
  const content = payload.content || ''

  if (integration.provider === 'google') {
    const { boundary, body } = buildMultipartBody(
      {
        name: fileName,
        mimeType,
        ...(payload.parentId ? { parents: [payload.parentId] } : {}),
      },
      content,
      mimeType,
    )

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,modifiedTime', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        'content-type': `multipart/related; boundary=${boundary}`,
      },
      body,
    })
    if (!response.ok) throw new Error(await response.text())
    return { provider: 'google', file: await response.json() }
  }

  if (integration.provider === 'microsoft') {
    const targetPath = encodeURIComponent(fileName)
    const uploadUrl = payload.parentId
      ? `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(payload.parentId)}:/${targetPath}:/content`
      : `https://graph.microsoft.com/v1.0/me/drive/root:/${targetPath}:/content`
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        'content-type': mimeType,
      },
      body: typeof content === 'string' ? content : Buffer.from(content || ''),
    })
    if (!response.ok) throw new Error(await response.text())
    return { provider: 'microsoft', file: await response.json() }
  }

  throw new Error('Provedor de arquivos não suportado')
}

async function buildStatus(userId) {
  const integrations = await getUserIntegrations(userId)
  const byProvider = Object.fromEntries(integrations.map(item => [item.provider, item]))

  return {
    providers: [
      {
        id: 'google',
        name: 'Google Workspace',
        services: ['Gmail', 'Google Drive', 'Google Agenda', 'Google Docs', 'Google Sheets'],
        envReady: Boolean(getGoogleConfig().clientId && getGoogleConfig().clientSecret),
        connected: Boolean(byProvider.google),
        scopes: ['gmail', 'drive', 'calendar'],
        setup: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
        connectUrl: '/api/integrations/oauth/start?provider=google',
        account: byProvider.google?.email || null,
        lastSync: byProvider.google?.updatedAt || null,
        operational: Boolean(byProvider.google),
      },
      {
        id: 'microsoft',
        name: 'Microsoft 365',
        services: ['Outlook', 'OneDrive', 'Calendario Microsoft', 'SharePoint', 'Planner'],
        envReady: Boolean(getMicrosoftConfig().clientId && getMicrosoftConfig().clientSecret),
        connected: Boolean(byProvider.microsoft),
        scopes: ['mail', 'files', 'calendar'],
        setup: ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET', 'MICROSOFT_TENANT_ID'],
        connectUrl: '/api/integrations/oauth/start?provider=microsoft',
        account: byProvider.microsoft?.email || null,
        lastSync: byProvider.microsoft?.updatedAt || null,
        operational: Boolean(byProvider.microsoft),
      },
      {
        id: 'icloud',
        name: 'Apple iCloud',
        services: ['Calendario iCloud', 'Contatos iCloud', 'Lembretes via CalDAV/CardDAV'],
        envReady: true,
        connected: Boolean(byProvider.icloud),
        scopes: ['caldav', 'carddav'],
        setup: ['APPLE_ID', 'ICLOUD_APP_SPECIFIC_PASSWORD'],
        connectUrl: null,
        account: byProvider.icloud?.email || null,
        lastSync: byProvider.icloud?.updatedAt || null,
        operational: Boolean(byProvider.icloud?.meta?.calendarUrl),
        note: 'iCloud fica configurado com credenciais persistidas; a operação CalDAV/CardDAV pode ser ativada por URL específica da conta.',
      },
    ],
    tokenVault: {
      ready: true,
      detail: 'Tokens e segredos são persistidos no backend e criptografados antes de ir para o banco.',
    },
  }
}

module.exports = {
  buildStatus,
  createCalendarEvent,
  createDriveFolder,
  uploadDriveFile,
  fetchGoogleProfile,
  fetchMicrosoftProfile,
  getIntegration,
  listCalendarEvents,
  sendMail,
  storeIcloudIntegration,
  storeOAuthIntegration,
}
