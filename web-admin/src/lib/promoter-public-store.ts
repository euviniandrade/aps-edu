import { createSign, randomUUID } from 'crypto'

type PublicSubmissionPayload = {
  promoterName?: string
  unit?: string
  role?: string
  email?: string
  phone?: string
  birthDate?: string
  address?: string
  notes?: string
  answers?: Record<string, unknown>
  computed?: Record<string, unknown>
  photoBase64?: string
  photoMimeType?: string
  photoName?: string
}

type DriveFile = {
  id: string
  name: string
  webViewLink?: string
  webContentLink?: string
  mimeType?: string
  createdTime?: string
}

type ServiceAccountConfig =
  | { account: any; error: '' }
  | { account: null; error: 'missing' | 'invalid' }

type BackupResult = {
  ok: boolean
  error?: string
  record?: Record<string, unknown>
}

function clean(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function sanitizeDriveName(value: string) {
  return String(value || 'arquivo-sofi')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140) || 'arquivo-sofi'
}

function getAppsScriptUrl() {
  return clean(process.env.APPS_SCRIPT_URL).replace(/\/$/, '')
}

function getBackupToken() {
  return clean(process.env.PROMOTER_BACKUP_TOKEN)
}

function parseServiceAccount(raw: string) {
  const parsed = JSON.parse(raw)
  if (typeof parsed === 'string') return JSON.parse(parsed)
  return parsed
}

function getServiceAccount(): ServiceAccountConfig {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || ''
  if (!raw.trim()) return { account: null, error: 'missing' }
  try {
    return { account: parseServiceAccount(raw), error: '' }
  } catch {
    try {
      return { account: parseServiceAccount(Buffer.from(raw, 'base64').toString('utf8')), error: '' }
    } catch {
      return { account: null, error: 'invalid' }
    }
  }
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function getGoogleAccessToken() {
  const { account: serviceAccount, error } = getServiceAccount()
  if (error) return { accessToken: '', configError: error }
  if (!serviceAccount?.client_email || !serviceAccount?.private_key) return { accessToken: '', configError: 'invalid' }

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  const signature = signer.sign(String(serviceAccount.private_key).replace(/\\n/g, '\n'))
  const assertion = `${unsigned}.${base64Url(signature)}`

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!response.ok) throw new Error(await response.text())
  const data = await response.json()
  return { accessToken: String(data.access_token || ''), configError: '' }
}

async function driveJson(accessToken: string, url: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers || {}),
    },
  })
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

async function driveText(accessToken: string, url: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(await response.text())
  return response.text()
}

async function listDriveFiles(accessToken: string, query: string) {
  const url = new URL('https://www.googleapis.com/drive/v3/files')
  url.searchParams.set('supportsAllDrives', 'true')
  url.searchParams.set('includeItemsFromAllDrives', 'true')
  url.searchParams.set('fields', 'files(id,name,mimeType,webViewLink,createdTime)')
  url.searchParams.set('pageSize', '100')
  url.searchParams.set('q', query)
  const data = await driveJson(accessToken, url.toString(), { method: 'GET' })
  return Array.isArray(data.files) ? data.files as DriveFile[] : []
}

async function createFolder(accessToken: string, name: string, parentId?: string) {
  return driveJson(accessToken, 'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: sanitizeDriveName(name),
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  }) as Promise<DriveFile>
}

async function uploadFile(accessToken: string, file: { name: string; mimeType: string; content: string | Buffer; parentId?: string }) {
  const boundary = `aps-edu-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const metadata = {
    name: sanitizeDriveName(file.name),
    mimeType: file.mimeType,
    ...(file.parentId ? { parents: [file.parentId] } : {}),
  }
  const content = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content)
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${file.mimeType}\r\n\r\n`),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])

  return driveJson(accessToken, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,webContentLink', {
    method: 'POST',
    headers: { 'content-type': `multipart/related; boundary=${boundary}` },
    body: body as any,
  }) as Promise<DriveFile>
}

function buildReportText(submission: Record<string, unknown>) {
  return [
    'Relatório APS30 - Formulário de Promotor',
    '',
    `Nome: ${submission.promoterName || ''}`,
    `Unidade: ${submission.unit || ''}`,
    `Cargo: ${submission.role || ''}`,
    `WhatsApp: ${submission.phone || ''}`,
    `E-mail: ${submission.email || ''}`,
    `Aniversário: ${submission.birthDate || ''}`,
    `Endereço: ${submission.address || ''}`,
    `Enviado em: ${submission.submittedAt || ''}`,
    '',
    'Resultado calculado:',
    JSON.stringify(submission.computed || {}, null, 2),
    '',
    'Observações:',
    String(submission.notes || 'Sem observações.'),
  ].join('\n')
}

async function saveAppsScriptBackup(submission: Record<string, unknown>): Promise<BackupResult> {
  const appUrl = getAppsScriptUrl()
  if (!appUrl) return { ok: false, error: 'APPS_SCRIPT_URL nao configurado.' }

  const response = await fetch(appUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      _method: 'POST',
      _path: 'promoter-forms/public-backup',
      _backupToken: getBackupToken(),
      submission,
    }),
    cache: 'no-store',
  })

  const text = await response.text()
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }

  if (!response.ok || data?.error) {
    return { ok: false, error: data?.error || data?.raw || `Apps Script retornou ${response.status}.` }
  }

  return { ok: true, record: data?.submission || data }
}

async function listAppsScriptBackups(): Promise<Record<string, unknown>[]> {
  const appUrl = getAppsScriptUrl()
  if (!appUrl) return []

  const response = await fetch(appUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      _method: 'GET',
      _path: 'promoter-forms/public-backup',
      _backupToken: getBackupToken(),
    }),
    cache: 'no-store',
  })

  const text = await response.text()
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { data = {} }
  if (!response.ok || data?.error || !Array.isArray(data?.submissions)) return []
  return data.submissions.map((submission: any) => {
    let raw: any = {}
    if (submission?.rawJson && typeof submission.rawJson === 'string') {
      try {
        raw = JSON.parse(submission.rawJson)
      } catch {
        raw = {}
      }
    }
    return normalizeBackupSubmission({ ...submission, ...raw })
  })
}

function normalizeBackupSubmission(submission: Record<string, unknown>) {
  const record = (submission.backup as any)?.record || {}
  const textFields = ['notes', 'bio', 'address']
  const photoCandidate = [
    submission.photoDataUrl,
    submission.photoUrl,
    submission.photoBase64 && submission.photoMimeType ? `data:${submission.photoMimeType};base64,${submission.photoBase64}` : '',
    record.photoDataUrl,
    record.photoUrl,
    submission.notes,
    submission.bio,
  ].map(value => String(value || '').trim()).find(value => value.startsWith('data:image/') || value.includes('drive.google.com/'))

  const normalized = {
    ...submission,
    photoDataUrl: String(submission.photoDataUrl || record.photoDataUrl || '').trim(),
    photoUrl: String(submission.photoUrl || record.photoUrl || '').trim(),
    photoDriveFileId: String(submission.photoDriveFileId || record.photoDriveFileId || '').trim(),
  }

  if (!normalized.photoDataUrl && photoCandidate?.startsWith('data:image/')) normalized.photoDataUrl = photoCandidate
  if (!normalized.photoUrl && photoCandidate?.includes('drive.google.com/')) normalized.photoUrl = photoCandidate

  for (const field of textFields) {
    const value = String((normalized as any)[field] || '').trim()
    if (value.startsWith('data:image/') || value.includes('drive.google.com/uc?export=view&id=')) {
      ;(normalized as any)[field] = ''
    }
  }

  return normalized
}

export function publicPromoterLink(token: string) {
  const normalized = String(token || '').toLowerCase()
  if (!['público', 'geral', 'todos'].includes(normalized)) return null
  return {
    id: `L-${normalized}`,
    token: normalized,
    publicPath: `/promotores/form/${normalized}`,
    promoterName: '',
    unit: '',
    role: 'Promotor',
    notes: 'Link fixo oficial para cadastro e avaliação completa dos promotores APS EDU.',
    expiresAt: null,
    status: 'active',
    createdAt: '2026-06-25T00:00:00.000Z',
  }
}

export async function listPublicPromoterSubmissions() {
  const backupSubmissions = await listAppsScriptBackups().catch(() => [])
  if (clean(process.env.GOOGLE_DRIVE_READ_PROMOTER_SUBMISSIONS).toLowerCase() !== 'true') {
    return { status: 200, data: { submissions: backupSubmissions, driveErrors: [] } }
  }

  const { accessToken, configError } = await getGoogleAccessToken()
  if (!accessToken) {
    return {
      status: 200,
      data: {
        submissions: backupSubmissions,
        driveErrors: [
          configError === 'invalid'
            ? 'GOOGLE_SERVICE_ACCOUNT_JSON esta cadastrado, mas o valor nao e um JSON valido.'
            : 'Google Drive ainda nao configurado na Vercel.',
        ],
      },
    }
  }

  const rootFolderId = clean(process.env.GOOGLE_DRIVE_PROMOTER_ROOT_FOLDER_ID)
  if (!rootFolderId) {
    return { status: 200, data: { submissions: backupSubmissions, driveErrors: ['Pasta raiz do Google Drive nao configurada.'] } }
  }

  const folders = await listDriveFiles(
    accessToken,
    `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  )
  const jsonFiles: DriveFile[] = []
  for (const folder of folders) {
    const files = await listDriveFiles(
      accessToken,
      `'${folder.id}' in parents and mimeType = 'application/json' and trashed = false`,
    )
    jsonFiles.push(...files)
  }

  const submissions = []
  for (const file of jsonFiles.sort((a, b) => String(b.createdTime || '').localeCompare(String(a.createdTime || '')))) {
    try {
      const text = await driveText(accessToken, `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`)
      const parsed = JSON.parse(text)
      submissions.push({
        ...parsed,
        driveSnapshot: { id: file.id, name: file.name, webViewLink: file.webViewLink },
      })
    } catch {
      // Ignore arquivos que nao sejam snapshots validos do APS30.
    }
  }

  const byId = new Map<string, Record<string, unknown>>()
  for (const item of backupSubmissions) byId.set(String(item.id || randomUUID()), item)
  for (const item of submissions) byId.set(String(item.id || randomUUID()), item)

  return { status: 200, data: { submissions: Array.from(byId.values()), driveErrors: [] } }
}

export async function savePublicPromoterSubmission(token: string, payload: PublicSubmissionPayload) {
  const link = publicPromoterLink(token)
  if (!link) return { status: 404, data: { error: 'Link nao encontrado ou expirado' } }

  const submittedAt = new Date().toISOString()
  const submission = {
    id: `S-${randomUUID().slice(0, 8)}`,
    linkId: link.id,
    linkToken: link.token,
    promoterName: clean(payload.promoterName, 'Promotor'),
    unit: clean(payload.unit, 'APS'),
    role: clean(payload.role, 'Promotor'),
    email: clean(payload.email),
    phone: clean(payload.phone),
    birthDate: clean(payload.birthDate),
    address: clean(payload.address),
    notes: clean(payload.notes),
    answers: payload.answers || {},
    computed: payload.computed || {},
    photoBase64: payload.photoBase64 || '',
    photoMimeType: payload.photoMimeType || '',
    photoName: payload.photoName || '',
    photoDataUrl: payload.photoBase64 && payload.photoMimeType ? `data:${payload.photoMimeType};base64,${payload.photoBase64}` : '',
    submittedAt,
    status: 'received',
  }

  const { accessToken, configError } = await getGoogleAccessToken()
  if (!accessToken) {
    const message = configError === 'invalid'
      ? 'GOOGLE_SERVICE_ACCOUNT_JSON esta cadastrado, mas o valor nao e um JSON valido. Cadastre novamente como JSON em uma linha ou base64.'
      : 'Google Drive ainda nao configurado na Vercel. Configure GOOGLE_SERVICE_ACCOUNT_JSON e compartilhe a pasta de destino com a service account.'
    const backup = await saveAppsScriptBackup({ ...submission, storageStatus: 'backup_only', driveErrors: [message] })
    if (!backup.ok) {
      return {
        status: 503,
        data: {
          ok: false,
          error: 'Nao conseguimos salvar suas respostas com seguranca agora. Tente enviar novamente em alguns instantes.',
          detail: [message, backup.error].filter(Boolean).join(' | '),
        },
      }
    }
    return {
      status: 201,
      data: {
        ok: true,
        submission: {
          ...submission,
          photo: null,
          driveFolder: null,
          driveSnapshot: null,
          driveReport: null,
          backup,
          driveErrors: [message],
        },
      },
    }
  }

  try {
    const rootFolderId = clean(process.env.GOOGLE_DRIVE_PROMOTER_ROOT_FOLDER_ID)
    const folder = await createFolder(
      accessToken,
      `APS EDU - Pessoas - Formulario Inteligente - ${submission.promoterName}`,
      rootFolderId || undefined,
    )

    let photo: DriveFile | null = null
    if (payload.photoBase64 && payload.photoMimeType) {
      photo = await uploadFile(accessToken, {
        name: payload.photoName || `${submission.promoterName}-foto.jpg`,
        mimeType: payload.photoMimeType,
        content: Buffer.from(payload.photoBase64, 'base64'),
        parentId: folder.id,
      })
    }

    const snapshot = { ...submission, photo }
    const jsonFile = await uploadFile(accessToken, {
      name: `${submission.promoterName}-${submission.unit}-${submittedAt.slice(0, 10)}.json`,
      mimeType: 'application/json',
      content: JSON.stringify(snapshot, null, 2),
      parentId: folder.id,
    })
    const reportFile = await uploadFile(accessToken, {
      name: `${submission.promoterName}-${submission.unit}-relatorio-sofi.txt`,
      mimeType: 'text/plain',
      content: buildReportText(snapshot),
      parentId: folder.id,
    })

    return {
      status: 201,
      data: {
        ok: true,
        submission: {
          ...snapshot,
          driveFolder: folder,
          driveSnapshot: jsonFile,
          driveReport: reportFile,
          driveErrors: [],
        },
      },
    }
  } catch (error: any) {
    const driveError = error?.message || 'Falha ao sincronizar com o Google Drive.'
    const backup = await saveAppsScriptBackup({ ...submission, storageStatus: 'backup_only', driveErrors: [driveError] })
    if (!backup.ok) {
      return {
        status: 503,
        data: {
          ok: false,
          error: 'Nao conseguimos salvar suas respostas com seguranca agora. Tente enviar novamente em alguns instantes.',
          detail: [driveError, backup.error].filter(Boolean).join(' | '),
        },
      }
    }
    return {
      status: 201,
      data: {
        ok: true,
        submission: {
          ...submission,
          photo: null,
          driveFolder: null,
          driveSnapshot: null,
          driveReport: null,
          backup,
          driveErrors: [driveError],
        },
      },
    }
  }
}


