const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')
const { authenticate } = require('../../shared/middleware/auth.middleware')
const { uploadDriveFile } = require('../integrations/integrations.service')

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'promoter-forms-state.json')

const defaultState = {
  links: [],
  submissions: [],
}

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

async function uploadSnapshot(userId, data, name, folder) {
  try {
    return await uploadDriveFile(userId, {
      name,
      mimeType: 'application/json',
      content: JSON.stringify(data, null, 2),
      folder,
    })
  } catch (error) {
    return { error: error?.message || 'Falha ao sincronizar com Drive' }
  }
}

async function uploadBinary(userId, { base64, mimeType, fileName, folder }) {
  if (!base64 || !mimeType || !fileName) return null
  try {
    return await uploadDriveFile(userId, {
      name: sanitizeFileName(fileName),
      mimeType,
      content: Buffer.from(base64, 'base64'),
      folder,
    })
  } catch (error) {
    return { error: error?.message || 'Falha ao enviar arquivo para o Drive' }
  }
}

function buildPublicPath(token) {
  return `/promotores/form/${token}`
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
    const link = state.links.find(item => item.token === request.params.token && item.status !== 'disabled')
    if (!link) return reply.code(404).send({ error: 'Link nao encontrado ou expirado' })
    return {
      link: pickPublicLink(link),
      questionnaireVersion: '2026-06',
    }
  })

  fastify.post('/public/:token', async (request, reply) => {
    const body = request.body || {}
    const state = readState()
    const link = state.links.find(item => item.token === request.params.token && item.status !== 'disabled')
    if (!link) return reply.code(404).send({ error: 'Link nao encontrado ou expirado' })

    const answers = body.answers && typeof body.answers === 'object' ? body.answers : {}
    const computed = body.computed && typeof body.computed === 'object' ? body.computed : {}
    const promoterName = normalizeText(body.promoterName || link.promoterName || 'Promotor')
    const unit = normalizeText(body.unit || link.unit || 'APS')
    const role = normalizeText(body.role || link.role || '')

    const createdBy = link.createdBy || 'system'
    const folder = 'APS EDU - Promotores - Formulario'

    const photoUpload = await uploadBinary(createdBy, {
      base64: body.photoBase64,
      mimeType: body.photoMimeType,
      fileName: body.photoName || `${promoterName}-foto.jpg`,
      folder,
    })

    const snapshot = {
      promoterName,
      unit,
      role,
      email: normalizeText(body.email),
      phone: normalizeText(body.phone),
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
      folder
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
      submittedAt: new Date().toISOString(),
      status: 'received',
    }

    state.submissions = [submission, ...state.submissions]
    writeState(state)

    return reply.code(201).send({
      ok: true,
      submission,
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
