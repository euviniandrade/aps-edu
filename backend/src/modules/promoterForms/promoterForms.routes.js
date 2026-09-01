const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')
const { authenticate } = require('../../shared/middleware/auth.middleware')
const prisma = require('../../shared/config/prisma')
const { createDriveFolder, uploadDriveFile } = require('../integrations/integrations.service')

const DATA_DIR = process.env.DATA_DIR || (process.env.NODE_ENV === 'production' ? '/data' : path.join(process.cwd(), 'data'))
const DATA_FILE = path.join(DATA_DIR, 'promoter-forms-state.json')
const MANAGEMENT_FILE = path.join(DATA_DIR, 'management-state.json')

const defaultState = {
  links: [],
  submissions: [],
}

const FIXED_PUBLIC_TOKENS = new Set(['publico', 'geral', 'todos'])

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultState, null, 2))
  }
}

function readState() {
  ensureDataFile()
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    return {
      links: Array.isArray(raw.links) ? raw.links : [],
      submissions: Array.isArray(raw.submissions) ? raw.submissions : [],
      updatedAt: raw.updatedAt || new Date().toISOString(),
    }
  } catch {
    return { ...defaultState, updatedAt: new Date().toISOString() }
  }
}

function writeState(state) {
  const next = { ...state, updatedAt: new Date().toISOString() }
  fs.writeFileSync(DATA_FILE, JSON.stringify(next, null, 2))
  return next
}

function readManagementState() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(MANAGEMENT_FILE)) {
    fs.writeFileSync(MANAGEMENT_FILE, JSON.stringify({ people: [], updatedAt: new Date().toISOString() }, null, 2))
  }

  try {
    const state = JSON.parse(fs.readFileSync(MANAGEMENT_FILE, 'utf8'))
    return {
      ...state,
      people: Array.isArray(state.people) ? state.people : [],
    }
  } catch {
    return { people: [], updatedAt: new Date().toISOString() }
  }
}

function writeManagementState(state) {
  const next = { ...state, updatedAt: new Date().toISOString() }
  fs.writeFileSync(MANAGEMENT_FILE, JSON.stringify(next, null, 2))
  return next
}

function createId(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8)}`
}

function createToken() {
  return randomUUID().replace(/-/g, '').slice(0, 24)
}

function normalizeText(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function sanitizeFileName(value = '') {
  return String(value)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

async function uploadSnapshot(userId, data, name, folder, parentId) {
  try {
    return await uploadDriveFile(userId, {
      name,
      mimeType: 'application/json',
      content: JSON.stringify(data, null, 2),
      folder,
      parentId,
      provider: 'google',
      allowProviderFallback: false,
    })
  } catch (error) {
    return { error: error?.message || 'Falha ao sincronizar com Drive' }
  }
}

async function uploadBinary(userId, { base64, mimeType, fileName, folder, parentId }) {
  if (!base64 || !mimeType || !fileName) return null
  try {
    return await uploadDriveFile(userId, {
      name: sanitizeFileName(fileName),
      mimeType,
      content: Buffer.from(base64, 'base64'),
      folder,
      parentId,
      provider: 'google',
      allowProviderFallback: false,
    })
  } catch (error) {
    return { error: error?.message || 'Falha ao enviar arquivo para o Drive' }
  }
}

async function createPromoterDriveFolder(userId, folderName) {
  try {
    return await createDriveFolder(userId, {
      name: sanitizeFileName(folderName),
      provider: 'google',
      allowProviderFallback: false,
    })
  } catch (error) {
    return { error: error?.message || 'Falha ao criar pasta no Drive' }
  }
}

async function resolvePublicFormOwner(link) {
  const configuredOwner = normalizeText(process.env.PROMOTER_FORM_OWNER_USER_ID || process.env.DEFAULT_USER_ID)
  if (configuredOwner) return configuredOwner
  if (link?.createdBy && link.createdBy !== 'system') return link.createdBy

  try {
    const integration = await prisma.externalIntegration.findFirst({
      where: { provider: 'google' },
      orderBy: { updatedAt: 'desc' },
      select: { userId: true },
    })
    return integration?.userId || link?.createdBy || 'system'
  } catch {
    return link?.createdBy || 'system'
  }
}

function normalizePdfText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapePdfText(value = '') {
  return normalizePdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function wrapText(value = '', max = 86) {
  const words = normalizePdfText(value).split(' ').filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    if (`${line} ${word}`.trim().length > max) {
      if (line) lines.push(line)
      line = word
    } else {
      line = `${line} ${word}`.trim()
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function formatMetric(value) {
  const number = Number(value || 0)
  return Number.isFinite(number) ? `${Math.round(number)}%` : '0%'
}

function pdfLine(label, value) {
  return `${label}: ${normalizePdfText(value || '-')}`
}

function buildPromoterReportPdf(submission) {
  const computed = submission.computed || {}
  const indices = computed.indices || {}
  const alerts = computed.alerts || {}
  const productivity = computed.productivity || {}
  const finalProfile = computed.finalProfile || {}
  const temperament = computed.temperament || {}
  const behavioralProfile = computed.behavioralProfile || {}
  const now = new Date(submission.submittedAt || Date.now()).toLocaleString('pt-BR')
  const lines = [
    'SOFI / APS EDU - Relatorio Inteligente do Promotor',
    `Gerado em ${now}`,
    '',
    pdfLine('Nome', submission.promoterName),
    pdfLine('Unidade', submission.unit),
    pdfLine('Cargo/Função', submission.role || 'Promotor'),
    pdfLine('E-mail', submission.email),
    pdfLine('Telefone', submission.phone),
    pdfLine('Data de aniversario', submission.birthDate),
    pdfLine('Endereco', submission.address),
    '',
    'Indicadores executivos',
    pdfLine('Potencial de liderança', `${formatMetric(indices.leadershipPotential?.score)} - ${indices.leadershipPotential?.label || ''}`),
    pdfLine('Potencial de promoção', `${formatMetric(indices.promotionPotential?.score)} - ${indices.promotionPotential?.label || ''}`),
    pdfLine('Inteligência emocional', `${formatMetric(indices.emotionalIntelligence?.score)} - ${indices.emotionalIntelligence?.label || ''}`),
    pdfLine('Maturidade profissional', `${formatMetric(indices.professionalMaturity?.score)} - ${indices.professionalMaturity?.label || ''}`),
    pdfLine('Relacionamento interpessoal', `${formatMetric(indices.interpersonalRelationship?.score)} - ${indices.interpersonalRelationship?.label || ''}`),
    pdfLine('Produtividade', `${formatMetric(productivity.index)} - ${productivity.diagnosis || ''}`),
    '',
    'Perfil calculado',
    pdfLine('Perfil final', finalProfile.title),
    pdfLine('Temperamento', `${temperament.primary || '-'} ${temperament.primaryPercent ? `(${temperament.primaryPercent}%)` : ''}`),
    pdfLine('Perfil comportamental', `${behavioralProfile.profile || '-'} ${behavioralProfile.percent ? `(${behavioralProfile.percent}%)` : ''}`),
    ...wrapText(finalProfile.description || 'Sem descrição executiva.', 86),
    '',
    'Alertas',
    pdfLine('Centralização', alerts.centralization?.level),
    pdfLine('Procrastinação', alerts.procrastination?.level),
    pdfLine('Risco de conflito', alerts.conflictRisk?.level),
    pdfLine('Resistência a mudança', alerts.changeResistance?.level),
    pdfLine('Consistência', alerts.consistency?.level),
    '',
    'Produtividade segmentada',
    pdfLine('Eficiência', formatMetric(productivity.efficiency)),
    pdfLine('Qualidade', formatMetric(productivity.quality)),
    pdfLine('Organização', formatMetric(productivity.organization)),
    pdfLine('Comprometimento', formatMetric(productivity.commitment)),
    pdfLine('Autonomia', formatMetric(productivity.autonomy)),
    '',
    'Observações',
    ...wrapText(submission.notes || 'Preenchimento recebido pelo formulário público da plataforma.', 86),
  ]

  const pages = []
  for (let i = 0; i < lines.length; i += 42) pages.push(lines.slice(i, i + 42))
  const objects = []
  const addObject = content => {
    objects.push(content)
    return objects.length
  }
  const catalogId = addObject('<< /Type /Catalog /Pages 2 0 R >>')
  const pagesId = addObject('')
  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const pageIds = []
  const contentIds = []

  pages.forEach(pageLines => {
    const textOps = ['BT', '/F1 10 Tf', '42 790 Td']
    pageLines.forEach((line, index) => {
      const escaped = escapePdfText(line)
      textOps.push(index === 0 ? `(${escaped}) Tj` : `0 -16 Td (${escaped}) Tj`)
    })
    textOps.push('ET')
    const content = textOps.join('\n')
    const contentId = addObject(`<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream`)
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`)
    contentIds.push(contentId)
    pageIds.push(pageId)
  })

  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((content, index) => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'))
    pdf += `${index + 1} 0 obj\n${content}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf, 'ascii')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`
  return pdf
}

async function uploadReportPdf(userId, submission, folder, parentId) {
  try {
    return await uploadDriveFile(userId, {
      name: sanitizeFileName(`${submission.promoterName}-${submission.unit}-relatorio-sofi.pdf`),
      mimeType: 'application/pdf',
      content: buildPromoterReportPdf(submission),
      folder,
      parentId,
      provider: 'google',
      allowProviderFallback: false,
    })
  } catch (error) {
    return { error: error?.message || 'Falha ao enviar relatório PDF para o Drive' }
  }
}

function buildPublicPath(token) {
  return `/promotores/form/${token}`
}

function isFixedPublicToken(token = '') {
  return FIXED_PUBLIC_TOKENS.has(String(token || '').toLowerCase())
}

function buildFixedPublicLink(token = 'publico') {
  return {
    id: `L-${token}`,
    token,
    promoterName: '',
    unit: '',
    role: 'Promotor',
    notes: 'Link fixo oficial para cadastro e avaliacao completa dos promotores APS EDU.',
    expiresAt: null,
    status: 'active',
    createdAt: '2026-06-25T00:00:00.000Z',
    createdBy: process.env.PROMOTER_FORM_OWNER_USER_ID || process.env.DEFAULT_USER_ID || 'system',
    createdByName: 'SOFI',
    fixed: true,
  }
}

function findPublicLink(state, token) {
  const found = state.links.find(item => item.token === token && item.status !== 'disabled')
  if (found) return found
  if (isFixedPublicToken(token)) return buildFixedPublicLink(token)
  return null
}

function pickPublicLink(link) {
  if (!link) return null
  return {
    id: link.id,
    token: link.token,
    publicPath: buildPublicPath(link.token),
    promoterName: link.promoterName || '',
    unit: link.unit || '',
    role: link.role || '',
    notes: link.notes || '',
    expiresAt: link.expiresAt || null,
    status: link.status || 'active',
    createdAt: link.createdAt || null,
  }
}

function levelFromPercent(value) {
  const score = Number(value || 0)
  if (score >= 90) return 5
  if (score >= 80) return 4
  if (score >= 65) return 3
  if (score >= 50) return 2
  return 1
}

function profileFromFinalProfile(title = '') {
  if (title === 'Multiplicador Institucional') return 'Multiplica lideres e fortalece a cultura institucional'
  if (title === 'Diretor') return 'Forma novos lideres de maneira consistente'
  if (title === 'Gestor') return 'Desenvolve regularmente'
  if (title === 'Coordenador') return 'Desenvolve ocasionalmente'
  return 'Nao desenvolve'
}

function buildPersonFromSubmission(submission) {
  const computed = submission.computed || {}
  const indices = computed.indices || {}
  const leadershipScore = Number(indices.leadershipPotential?.score || 0)
  const promotionScore = Number(indices.promotionPotential?.score || 0)
  const emotionalScore = Number(indices.emotionalIntelligence?.score || 0)
  const maturityScore = Number(indices.professionalMaturity?.score || 0)
  const relationshipScore = Number(indices.interpersonalRelationship?.score || 0)
  const productivity = computed.productivity || {}
  const temperament = computed.temperament || {}
  const behavioralProfile = computed.behavioralProfile || {}
  const finalProfile = computed.finalProfile || {}

  const files = [
    submission.photo?.webViewLink || submission.photo?.name,
    submission.driveSnapshot?.webViewLink || submission.driveSnapshot?.name,
    submission.driveReport?.webViewLink || submission.driveReport?.name,
    submission.driveFolder?.webViewLink || submission.driveFolder?.name,
  ].filter(Boolean)

  return {
    id: `P-${submission.id.replace(/^S-/, '')}`,
    source: 'promoter-form',
    promoterSubmissionId: submission.id,
    promoterLinkToken: submission.linkToken,
    name: submission.promoterName,
    role: submission.role || finalProfile.title || 'Promotor',
    unit: submission.unit || 'APS',
    email: submission.email || '',
    phone: submission.phone || '',
    birthDate: submission.birthDate || '',
    address: submission.address || '',
    avatar: submission.photo?.webViewLink || '',
    training: 'Formulario inteligente de promotores',
    nextReview: 'Revisar devolutiva',
    score: Math.round(((leadershipScore + promotionScore + maturityScore + relationshipScore + Number(productivity.index || 0)) / 5) / 20),
    leadershipPercent: leadershipScore,
    leadershipLevel: levelFromPercent(leadershipScore),
    leadershipProfile: behavioralProfile.profile || 'Executor',
    leadershipPotential: leadershipScore >= 90 ? 'Excepcional' : leadershipScore >= 80 ? 'Muito Alto' : leadershipScore >= 65 ? 'Alto' : leadershipScore >= 50 ? 'Moderado' : 'Baixo',
    leadershipReadiness:
      leadershipScore >= 90 ? 'Pronto para liderar unidades ou grandes projetos'
      : leadershipScore >= 80 ? 'Pronto para liderar setores/departamentos'
      : leadershipScore >= 65 ? 'Pronto para liderar pequenas equipes'
      : leadershipScore >= 50 ? 'Potencial em desenvolvimento'
      : 'Ainda nao demonstra perfil de lideranca',
    leaderDevelopment: profileFromFinalProfile(finalProfile.title),
    temperamentPrimary: temperament.primary,
    temperamentPrimaryPercent: temperament.primaryPercent,
    temperamentSecondary: temperament.secondary,
    temperamentSecondaryPercent: temperament.secondaryPercent,
    temperamentReason: temperament.reason,
    behavioralProfile: behavioralProfile.profile,
    behavioralProfilePercent: behavioralProfile.percent,
    interpersonalLevel: relationshipScore >= 85 ? 'Extremamente comunicativo' : relationshipScore >= 70 ? 'Comunicativo' : relationshipScore >= 55 ? 'Equilibrado' : 'Reservado',
    convivenceLevel: relationshipScore >= 85 ? 'Muito facil de lidar' : relationshipScore >= 70 ? 'Facil de lidar' : relationshipScore >= 55 ? 'Moderadamente facil de lidar' : 'Dificil de lidar em algumas situacoes',
    collaborationLevel: relationshipScore >= 80 ? 'Atua como agregador da equipe' : relationshipScore >= 65 ? 'Colabora ativamente com os demais' : 'Colabora quando solicitado',
    relationalIntelligence: emotionalScore >= 80 ? 'Recebe feedbacks com maturidade e busca crescimento' : emotionalScore >= 65 ? 'Geralmente aceita feedbacks e faz ajustes' : 'Aceita feedbacks com alguma resistencia inicial',
    relationalClassification: relationshipScore >= 85 ? 'Referencia positiva de relacionamento e trabalho em equipe' : relationshipScore >= 70 ? 'Relacionamento acima da media' : relationshipScore >= 55 ? 'Relacionamento adequado' : 'Necessita desenvolver competencias relacionais',
    pressureResponse: maturityScore >= 75 ? 'Mantem a calma' : 'Busca apoio da equipe',
    productivityEfficiency: productivity.efficiency,
    productivityQuality: productivity.quality,
    productivityOrganization: productivity.organization,
    productivityCommitment: productivity.commitment,
    productivityAutonomy: productivity.autonomy,
    productivityIndex: productivity.index,
    productivityDiagnosis: productivity.diagnosis,
    pulse: Math.max(0, Math.min(100, Math.round((emotionalScore + relationshipScore) / 2))),
    attendance: Math.max(0, Math.min(100, Math.round((maturityScore + Number(productivity.commitment || 0)) / 2))),
    workload: Math.max(0, Math.min(100, Math.round(100 - Number(computed.alerts?.procrastination?.level === 'Alto' ? 18 : 8)))),
    strengths: [
      indices.leadershipPotential?.label,
      indices.productivity?.label,
      finalProfile.title,
    ].filter(Boolean),
    risks: [
      computed.alerts?.centralization?.level === 'Alto' ? 'Centralizacao' : '',
      computed.alerts?.procrastination?.level === 'Alto' ? 'Procrastinacao' : '',
      computed.alerts?.conflictRisk?.level === 'Alto' ? 'Risco de conflito' : '',
      computed.alerts?.changeResistance?.level === 'Resistente' ? 'Resistencia a mudanca' : '',
    ].filter(Boolean),
    nextAction: finalProfile.description || 'Gerar devolutiva executiva',
    bio: submission.notes || finalProfile.description || '',
    files,
    assessmentForm: {
      version: 'promoter-form-2026-06',
      answers: submission.answers,
      computed,
      submittedAt: submission.submittedAt,
    },
    driveSyncAt: submission.submittedAt,
    driveSyncProvider: submission.driveSnapshot || submission.driveReport ? 'google-or-microsoft' : undefined,
    driveSyncFile: submission.driveReport?.webViewLink || submission.driveSnapshot?.webViewLink || submission.driveReport?.name || submission.driveSnapshot?.name || undefined,
    updatedAt: submission.submittedAt,
  }
}

function syncSubmissionToPeople(submission) {
  const state = readManagementState()
  const person = buildPersonFromSubmission(submission)
  const samePerson = item =>
    item.promoterSubmissionId === submission.id ||
    (submission.email && String(item.email || '').toLowerCase() === String(submission.email).toLowerCase()) ||
    (!submission.email && String(item.name || '').toLowerCase() === String(submission.promoterName).toLowerCase() && String(item.unit || '').toLowerCase() === String(submission.unit).toLowerCase())

  const index = state.people.findIndex(samePerson)
  if (index >= 0) state.people[index] = { ...state.people[index], ...person, id: state.people[index].id || person.id }
  else state.people = [person, ...state.people]

  return writeManagementState(state)
}

module.exports = async function (fastify) {
  fastify.get('/links', { preHandler: [authenticate] }, async () => {
    const state = readState()
    return { links: state.links.map(pickPublicLink), total: state.links.length }
  })

  fastify.post('/links', { preHandler: [authenticate] }, async (request, reply) => {
    const body = request.body || {}
    const token = createToken()
    const link = {
      id: createId('L'),
      token,
      promoterName: normalizeText(body.promoterName),
      unit: normalizeText(body.unit),
      role: normalizeText(body.role),
      notes: normalizeText(body.notes),
      expiresAt: normalizeText(body.expiresAt),
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: request.currentUser.id,
      createdByName: request.currentUser.name || '',
    }

    const state = readState()
    state.links = [link, ...state.links]
    writeState(state)

    return reply.code(201).send({
      link: pickPublicLink(link),
      url: buildPublicPath(token),
    })
  })

  fastify.get('/submissions', { preHandler: [authenticate] }, async () => {
    const state = readState()
    return {
      submissions: [...state.submissions].sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || ''))),
      total: state.submissions.length,
    }
  })

  fastify.get('/public/:token', async (request, reply) => {
    const state = readState()
    const link = findPublicLink(state, request.params.token)
    if (!link) return reply.code(404).send({ error: 'Link nao encontrado ou expirado' })
    return {
      link: pickPublicLink(link),
      questionnaireVersion: '2026-06',
    }
  })

  fastify.post('/public/:token', async (request, reply) => {
    const body = request.body || {}
    const state = readState()
    const link = findPublicLink(state, request.params.token)
    if (!link) return reply.code(404).send({ error: 'Link nao encontrado ou expirado' })

    const answers = body.answers && typeof body.answers === 'object' ? body.answers : {}
    const computed = body.computed && typeof body.computed === 'object' ? body.computed : {}
    const promoterName = normalizeText(body.promoterName || link.promoterName || 'Promotor')
    const unit = normalizeText(body.unit || link.unit || 'APS')
    const role = normalizeText(body.role || link.role || '')

    const createdBy = await resolvePublicFormOwner(link)
    const folder = `APS EDU - Pessoas - Formulario Inteligente - ${promoterName}`
    const folderUpload = await createPromoterDriveFolder(createdBy, folder)
    const parentId = folderUpload?.folder?.id || null

    const photoUpload = await uploadBinary(createdBy, {
      base64: body.photoBase64,
      mimeType: body.photoMimeType,
      fileName: body.photoName || `${promoterName}-foto.jpg`,
      folder,
      parentId,
    })

    const snapshot = {
      promoterName,
      unit,
      role,
      email: normalizeText(body.email),
      phone: normalizeText(body.phone),
      birthDate: normalizeText(body.birthDate),
      address: normalizeText(body.address),
      notes: normalizeText(body.notes),
      answers,
      computed,
      photo: photoUpload?.file ? {
        id: photoUpload.file.id || null,
        name: photoUpload.file.name || null,
        webViewLink: photoUpload.file.webViewLink || photoUpload.file.webContentLink || null,
      } : null,
      submittedAt: new Date().toISOString(),
      linkToken: link.token,
      linkId: link.id,
    }

    const snapshotUpload = await uploadSnapshot(
      createdBy,
      snapshot,
      sanitizeFileName(`${promoterName}-${unit}-${new Date().toISOString().slice(0, 10)}.json`),
      folder,
      parentId
    )

    const submission = {
      id: createId('S'),
      linkId: link.id,
      linkToken: link.token,
      promoterName,
      unit,
      role,
      email: normalizeText(body.email),
      phone: normalizeText(body.phone),
      birthDate: normalizeText(body.birthDate),
      address: normalizeText(body.address),
      notes: normalizeText(body.notes),
      answers,
      computed,
      photo: photoUpload?.file ? {
        id: photoUpload.file.id || null,
        name: photoUpload.file.name || null,
        webViewLink: photoUpload.file.webViewLink || photoUpload.file.webContentLink || null,
      } : null,
      driveSnapshot: snapshotUpload?.file ? {
        id: snapshotUpload.file.id || null,
        name: snapshotUpload.file.name || null,
        webViewLink: snapshotUpload.file.webViewLink || snapshotUpload.file.webContentLink || null,
      } : null,
      driveFolder: folderUpload?.folder ? {
        id: folderUpload.folder.id || null,
        name: folderUpload.folder.name || folder,
        webViewLink: folderUpload.folder.webViewLink || folderUpload.folder.webUrl || null,
      } : null,
      submittedAt: new Date().toISOString(),
      status: 'received',
    }

    const reportUpload = await uploadReportPdf(createdBy, submission, folder, parentId)
    submission.driveReport = reportUpload?.file ? {
      id: reportUpload.file.id || null,
      name: reportUpload.file.name || null,
      webViewLink: reportUpload.file.webViewLink || reportUpload.file.webUrl || null,
    } : null
    submission.driveErrors = [
      folderUpload?.error,
      photoUpload?.error,
      snapshotUpload?.error,
      reportUpload?.error,
    ].filter(Boolean)

    state.submissions = [submission, ...state.submissions]
    writeState(state)
    const managementState = syncSubmissionToPeople(submission)

    return reply.code(201).send({
      ok: true,
      submission,
      person: managementState.people.find(item => item.promoterSubmissionId === submission.id) || null,
    })
  })

  fastify.patch('/links/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const state = readState()
    let found = false
    state.links = state.links.map(link => {
      if (link.id !== request.params.id) return link
      found = true
      return {
        ...link,
        ...request.body,
        promoterName: normalizeText(request.body?.promoterName || link.promoterName),
        unit: normalizeText(request.body?.unit || link.unit),
        role: normalizeText(request.body?.role || link.role),
        notes: normalizeText(request.body?.notes || link.notes),
      }
    })
    if (!found) return reply.code(404).send({ error: 'Link nao encontrado' })
    return reply.send(writeState(state))
  })

  fastify.delete('/links/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const state = readState()
    const before = state.links.length
    state.links = state.links.filter(link => link.id !== request.params.id)
    if (state.links.length === before) return reply.code(404).send({ error: 'Link nao encontrado' })
    return reply.send(writeState(state))
  })
}
