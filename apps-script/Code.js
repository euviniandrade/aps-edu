// =============================================================
//  APS EDU — Google Apps Script Backend
//  Banco: Google Sheets  |  IA: Google Gemini
//  Deploy: Extensions → Apps Script → Deploy as Web App
// =============================================================

// ─── ENTRY POINTS ─────────────────────────────────────────────
function doPost(e) {
  let body = {}
  try { body = JSON.parse(e.postData.contents || '{}') } catch (_) {}
  const method = (body._method || 'POST').toUpperCase()
  const path   = (body._path  || '').replace(/^\/+/, '')
  const token  = body._token  || ''
  delete body._method; delete body._path; delete body._token

  try {
    return ok(route(method, path, body, token))
  } catch (err) {
    return ok({ error: err.message, code: err.code || 500 })
  }
}

function doGet(e) {
  const path  = (e.pathInfo || '').replace(/^\/+/, '')
  const token = e.parameter._token || ''
  const params = Object.assign({}, e.parameter)
  delete params._token
  try {
    return ok(route('GET', path, params, token))
  } catch (err) {
    return ok({ error: err.message, code: err.code || 500 })
  }
}

function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
}

// ─── ROUTER ───────────────────────────────────────────────────
function route(method, path, body, token) {
  const parts    = path.split('/')
  const resource = parts[0]
  const id       = parts[1] || null
  const sub      = parts[2] || null

  if (resource === 'health') return { status: 'ok', ts: new Date().toISOString() }
  if (resource === 'auth')   return authRoute(id, body)
  if (resource === 'promoter-forms' && id === 'public-backup') {
    return promoterPublicBackupRoute(method, body)
  }

  // --- require auth ---
  const userId = verifySession(token)
  if (!userId) throw err401('Não autorizado')
  const me = findById('users', userId)
  if (!me) throw err401('Usuário não encontrado')

  switch (resource) {
    case 'users':         return usersRoute(method, id, body, me)
    case 'tasks':         return tasksRoute(method, id, body, me)
    case 'events':        return eventsRoute(method, id, body, me)
    case 'announcements': return announcementsRoute(method, id, body, me)
    case 'feedback':      return feedbackRoute(method, id, body, me)
    case 'roles':         return rolesRoute(method, id)
    case 'units':         return unitsRoute(method, id, body)
    case 'gamification':  return gamificationRoute(method, id, sub, body, me)
    case 'reports':       return reportsRoute(method, id, body)
    case 'ai':            return aiRoute(method, id, body, me)
    case 'calendar':      return calendarRoute(method, id, body, me)
    case 'gmail':         return gmailRoute(method, id, body, me)
    case 'drive':         return driveRoute(method, id, body, me)
    case 'docs':          return docsRoute(method, id, body, me)
    case 'notifications': return notificationsRoute(method, id, body, me)
    case 'personal':      return personalRoute(method, id, body, me)
    case 'promotores':    return promotoresRoute(method, id, body, me)
    case 'submissions':   return submissionsRoute(method, id, body, me)
    case 'upload':        return uploadRoute(method, id, body, me)
    case 'memory':        return memoryRoute(method, id, body, me)
    case 'knowledge':     return knowledgeRoute(method, id, body, me)
    case 'automations':   return automationsRoute(method, id, body, me)
    case 'analytics':     return analyticsRoute(method, id, body, me)
    default:              throw Object.assign(new Error('Rota não encontrada'), { code: 404 })
  }
}

function err401(msg) { return Object.assign(new Error(msg), { code: 401 }) }

// ─── SHEET HELPERS ────────────────────────────────────────────
function getSpreadsheet() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
  return SpreadsheetApp.openById(id)
}

function getAll(name) {
  const sheet = getSpreadsheet().getSheetByName(name)
  if (!sheet || sheet.getLastRow() < 2) return []
  const vals = sheet.getDataRange().getValues()
  const headers = vals[0]
  const firstCol = headers[0] // pode ser 'id' ou 'token' (sessions)
  return vals.slice(1)
    .map(row => {
      const obj = {}
      headers.forEach((h, i) => { if (h) obj[h] = row[i] === '' ? null : row[i] })
      return obj
    })
    .filter(r => r[firstCol] !== null && r[firstCol] !== '' && r[firstCol] !== undefined)
}

function findById(name, id) {
  if (!id) return null
  return getAll(name).find(r => String(r.id) === String(id)) || null
}

function insert(name, data) {
  const sheet = getSpreadsheet().getSheetByName(name)
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
  sheet.appendRow(headers.map(h => (data[h] !== undefined ? data[h] : '')))
  return data
}

function updateById(name, id, updates) {
  const sheet  = getSpreadsheet().getSheetByName(name)
  const vals   = sheet.getDataRange().getValues()
  const headers = vals[0]
  const rowIdx  = vals.findIndex((r, i) => i > 0 && String(r[0]) === String(id))
  if (rowIdx === -1) throw new Error('Registro não encontrado')
  headers.forEach((h, i) => {
    if (updates[h] !== undefined) sheet.getRange(rowIdx + 1, i + 1).setValue(updates[h])
  })
  return findById(name, id)
}

function deleteById(name, id) {
  const sheet  = getSpreadsheet().getSheetByName(name)
  const vals   = sheet.getDataRange().getValues()
  const rowIdx = vals.findIndex((r, i) => i > 0 && String(r[0]) === String(id))
  if (rowIdx === -1) throw new Error('Registro não encontrado')
  sheet.deleteRow(rowIdx + 1)
  return { success: true }
}

function requirePromoterBackupToken_(body) {
  var expected = PropertiesService.getScriptProperties().getProperty('PROMOTER_BACKUP_TOKEN') || ''
  if (!expected) return
  if (String(body._backupToken || '') !== String(expected)) throw err401('Backup nao autorizado')
}

function ensurePromoterPublicBackupsSheet_() {
  var ss = getSpreadsheet()
  var sheet = ss.getSheetByName('promoter_form_submissions')
  var headers = [
    'id',
    'promoterName',
    'unit',
    'role',
    'phone',
    'email',
    'birthDate',
    'address',
    'photoUrl',
    'photoDriveFileId',
    'photoName',
    'notes',
    'answersJson',
    'computedJson',
    'submittedAt',
    'status',
    'storageStatus',
    'driveErrorsJson',
    'rawJson',
  ]

  if (!sheet) sheet = ss.insertSheet('promoter_form_submissions')
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1B3A6B')
      .setFontColor('#FFFFFF')
    sheet.setFrozenRows(1)
    sheet.setColumnWidths(1, headers.length, 170)
  }
  return sheet
}

function promoterPublicBackupRoute(method, body) {
  requirePromoterBackupToken_(body)
  var sheet = ensurePromoterPublicBackupsSheet_()

  if (method === 'GET') {
    var values = sheet.getDataRange().getValues()
    if (values.length < 2) return { submissions: [] }
    var headers = values[0]
    var submissions = values.slice(1).filter(function(row) { return row[0] }).map(function(row) {
      var item = {}
      headers.forEach(function(header, index) {
        item[header] = row[index] === '' ? null : row[index]
      })
      try { item.answers = item.answersJson ? JSON.parse(item.answersJson) : {} } catch (_) { item.answers = {} }
      try { item.computed = item.computedJson ? JSON.parse(item.computedJson) : {} } catch (_) { item.computed = {} }
      try { item.driveErrors = item.driveErrorsJson ? JSON.parse(item.driveErrorsJson) : [] } catch (_) { item.driveErrors = [] }
      delete item.answersJson
      delete item.computedJson
      delete item.driveErrorsJson
      return item
    })
    return { submissions: submissions }
  }

  if (method === 'POST') {
    var submission = body.submission || body || {}
    var id = submission.id || uid()
    var photo = savePromoterPhoto_(submission, id)
    delete submission.photoBase64
    var row = [
      id,
      submission.promoterName || '',
      submission.unit || '',
      submission.role || '',
      submission.phone || '',
      submission.email || '',
      submission.birthDate || '',
      submission.address || '',
      photo.url || submission.photoUrl || '',
      photo.id || submission.photoDriveFileId || '',
      photo.name || submission.photoName || '',
      submission.notes || '',
      JSON.stringify(submission.answers || {}),
      JSON.stringify(submission.computed || {}),
      submission.submittedAt || ts(),
      submission.status || 'received',
      submission.storageStatus || 'backup_only',
      JSON.stringify(submission.driveErrors || []),
      JSON.stringify(submission),
    ]
    sheet.appendRow(row)
    return {
      ok: true,
      storage: 'google_sheets_backup',
      submission: Object.assign({}, submission, {
        id: id,
        photoUrl: photo.url || submission.photoUrl || '',
        photoDriveFileId: photo.id || submission.photoDriveFileId || '',
        photoName: photo.name || submission.photoName || '',
        backupSheet: 'promoter_form_submissions',
      }),
    }
  }

  throw new Error('Metodo nao suportado')
}

function savePromoterPhoto_(submission, id) {
  if (!submission.photoBase64 || !submission.photoMimeType) return {}
  try {
    var folderName = 'SOFI - Fotos dos Formularios'
    var folders = DriveApp.getFoldersByName(folderName)
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName)
    var safeName = String(submission.photoName || (submission.promoterName || id) + '-foto.jpg')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .slice(0, 120)
    var blob = Utilities.newBlob(Utilities.base64Decode(submission.photoBase64), submission.photoMimeType, safeName)
    var file = folder.createFile(blob)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
    return {
      id: file.getId(),
      name: file.getName(),
      url: 'https://drive.google.com/uc?export=view&id=' + file.getId(),
      webViewLink: file.getUrl(),
    }
  } catch (err) {
    return { error: err.message || String(err) }
  }
}

function uid()    { return Utilities.getUuid() }
function ts()     { return new Date().toISOString() }
function page(arr, limit, offset) {
  return arr.slice(parseInt(offset) || 0, (parseInt(offset) || 0) + (parseInt(limit) || 50))
}

// ─── AUTH ─────────────────────────────────────────────────────
function hashPwd(p) {
  const salt  = PropertiesService.getScriptProperties().getProperty('PWD_SALT') || 'aps_edu_2025'
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, p + salt)
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('')
}

function createSession(userId) {
  const token     = uid()
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
  insert('sessions', { token, userId, expiresAt, createdAt: ts() })
  return token
}

function verifySession(token) {
  if (!token) return null
  const s = getAll('sessions').find(s => s.token === token)
  if (!s || new Date(s.expiresAt) < new Date()) return null
  return s.userId
}

function authRoute(action, body) {
  if (action === 'login') {
    const user = getAll('users').find(u => u.email === body.email && u.isActive !== false)
    if (!user || user.password !== hashPwd(body.password)) throw new Error('E-mail ou senha incorretos')
    const token = createSession(user.id)
    return { accessToken: token, refreshToken: token, user: enrichUser(user) }
  }
  if (action === 'refresh') {
    const userId = verifySession(body.refreshToken)
    if (!userId) throw err401('Token inválido')
    return { accessToken: createSession(userId), refreshToken: body.refreshToken }
  }
  if (action === 'logout') {
    // invalidate token - just return ok (sessions expire naturally)
    return { success: true }
  }
  throw new Error('Ação desconhecida')
}

// ─── ENRICHMENT ───────────────────────────────────────────────
function enrichUser(user) {
  if (!user) return null
  const u = Object.assign({}, user)
  delete u.password
  u.role  = findById('roles', u.roleId)
  if (u.role && typeof u.role.permissions === 'string') {
    try { u.role.permissions = JSON.parse(u.role.permissions) } catch (_) {}
  }
  u.unit  = findById('units', u.unitId)
  const pts = getAll('user_points').find(p => p.userId === u.id)
  u.points = pts ? parseInt(pts.points) || 0 : 0
  u.level  = pts ? parseInt(pts.level)  || 1 : 1
  return u
}

// ─── USERS ────────────────────────────────────────────────────
function usersRoute(method, id, body, me) {
  if (method === 'GET' && !id) {
    let list = getAll('users')
    if (body.roleId) list = list.filter(u => u.roleId === body.roleId)
    if (body.unitId) list = list.filter(u => u.unitId === body.unitId)
    if (body.q)      list = list.filter(u => (u.name || '').toLowerCase().includes(body.q.toLowerCase()))
    const paged = page(list, body.limit, body.offset).map(enrichUser)
    return { users: paged, total: list.length }
  }
  if (method === 'GET') {
    const u = id === 'me' ? me : findById('users', id)
    if (!u) throw new Error('Usuário não encontrado')
    return enrichUser(u)
  }
  if (method === 'POST') {
    if (getAll('users').find(u => u.email === body.email)) throw new Error('E-mail já cadastrado')
    const user = {
      id: uid(), name: body.name, email: body.email,
      password: hashPwd(body.password || 'aps123'),
      roleId: body.roleId || '', unitId: body.unitId || '',
      isActive: true, avatarUrl: '', phone: body.phone || '',
      department: body.department || '', createdAt: ts(),
    }
    insert('users', user)
    insert('user_points', { id: uid(), userId: user.id, points: 0, level: 1, updatedAt: ts() })
    return enrichUser(user)
  }
  if (method === 'PUT') {
    const upd = {}
    ;['name','email','roleId','unitId','phone','isActive','avatarUrl','department'].forEach(k => {
      if (body[k] !== undefined) upd[k] = body[k]
    })
    if (body.password) upd.password = hashPwd(body.password)
    return enrichUser(updateById('users', id, upd))
  }
  if (method === 'DELETE') return deleteById('users', id)
  throw new Error('Método não suportado')
}

// ─── TASKS ────────────────────────────────────────────────────
function tasksRoute(method, id, body, me) {
  if (method === 'GET' && !id) {
    let list = getAll('tasks')
    if (body.status)     list = list.filter(t => t.status === body.status)
    if (body.priority)   list = list.filter(t => t.priority === body.priority)
    if (body.assigneeId) list = list.filter(t => t.assigneeId === body.assigneeId)
    if (body.unitId)     list = list.filter(t => t.unitId === body.unitId)
    return page(list, body.limit, body.offset).map(t => ({
      ...t,
      assignee: t.assigneeId ? enrichUser(findById('users', t.assigneeId)) : null,
      unit:     t.unitId     ? findById('units', t.unitId)                 : null,
    }))
  }
  if (method === 'GET') {
    const t = findById('tasks', id)
    if (!t) throw new Error('Tarefa não encontrada')
    return { ...t, assignee: t.assigneeId ? enrichUser(findById('users', t.assigneeId)) : null }
  }
  if (method === 'POST') {
    const task = {
      id: uid(), title: body.title, description: body.description || '',
      status: body.status || 'pending', priority: body.priority || 'medium',
      dueDate: body.dueDate || '', assigneeId: body.assigneeId || body.assignedToId || '',
      createdById: me.id, unitId: body.unitId || '',
      createdAt: ts(), updatedAt: ts(),
    }
    insert('tasks', task)
    return task
  }
  if (method === 'PUT') {
    const upd = { updatedAt: ts() }
    ;['title','description','status','priority','dueDate','assigneeId','unitId'].forEach(k => {
      if (body[k] !== undefined) upd[k] = body[k]
    })
    if (body.assignedToId !== undefined) upd.assigneeId = body.assignedToId
    return updateById('tasks', id, upd)
  }
  if (method === 'DELETE') return deleteById('tasks', id)
  throw new Error('Método não suportado')
}

// ─── EVENTS ───────────────────────────────────────────────────
function enrichEvent_(ev) {
  var out = Object.assign({}, ev)
  out.unit = ev.unitId ? findById('units', ev.unitId) : null
  // Enrich assignedUsers
  var ids = []
  try { ids = typeof ev.assignedUserIds === 'string' ? JSON.parse(ev.assignedUserIds || '[]') : (ev.assignedUserIds || []) } catch(_) {}
  out.assignedUsers = ids.map(function(uid_) { return enrichUser(findById('users', uid_)) }).filter(Boolean)
  return out
}

function eventsRoute(method, id, body, me) {
  if (method === 'GET' && !id) {
    var list = getAll('events')
    if (body.status) list = list.filter(function(e) { return e.status === body.status })
    if (body.unitId) list = list.filter(function(e) { return e.unitId === body.unitId })
    return page(list, body.limit, body.offset).map(enrichEvent_)
  }
  if (method === 'GET') {
    var ev = findById('events', id)
    if (!ev) throw new Error('Evento não encontrado')
    var enriched = enrichEvent_(ev)
    // Include submissions for this event
    enriched.submissions = getAll('event_submissions').filter(function(s) { return String(s.eventId) === String(id) }).map(function(s) {
      return Object.assign({}, s, { user: enrichUser(findById('users', s.userId)) })
    })
    return enriched
  }
  if (method === 'POST') {
    var assignedIds = body.assignedUserIds
    if (Array.isArray(assignedIds)) assignedIds = JSON.stringify(assignedIds)
    else if (typeof assignedIds !== 'string') assignedIds = '[]'
    var newEv = {
      id: uid(), title: body.title, description: body.description || '',
      date: body.date || '', endDate: body.endDate || '',
      location: body.location || '', status: body.status || 'planned',
      unitId: body.unitId || '', createdById: me.id,
      coverImage: body.coverImage || '',
      assignedUserIds: assignedIds,
      allowAttachments: body.allowAttachments !== undefined ? body.allowAttachments : true,
      createdAt: ts(),
    }
    insert('events', newEv)
    return enrichEvent_(newEv)
  }
  if (method === 'PUT') {
    var upd = {}
    ;['title','description','date','endDate','location','status','unitId','coverImage','allowAttachments'].forEach(function(k) {
      if (body[k] !== undefined) upd[k] = body[k]
    })
    if (body.assignedUserIds !== undefined) {
      var aIds = body.assignedUserIds
      upd.assignedUserIds = Array.isArray(aIds) ? JSON.stringify(aIds) : (typeof aIds === 'string' ? aIds : '[]')
    }
    return enrichEvent_(updateById('events', id, upd))
  }
  if (method === 'DELETE') return deleteById('events', id)
  throw new Error('Método não suportado')
}

// ─── ANNOUNCEMENTS ────────────────────────────────────────────
function announcementsRoute(method, id, body, me) {
  if (method === 'GET' && !id) {
    const reads = getAll('announcement_reads')
    return page(getAll('announcements'), body.limit, body.offset).map(a => ({
      ...a,
      author: enrichUser(findById('users', a.authorId)),
      targetRoles: [],
      targetUnits: [],
      _count: { reads: reads.filter(r => r.announcementId === a.id).length },
    }))
  }
  if (method === 'POST') {
    const a = {
      id: uid(), title: body.title, content: body.content,
      type: body.type || 'info', authorId: me.id,
      targetRoleIds: JSON.stringify(body.targetRoleIds || []),
      targetUnitIds: JSON.stringify(body.targetUnitIds || []),
      expiresAt: body.expiresAt || '', createdAt: ts(),
    }
    insert('announcements', a)
    return a
  }
  if (method === 'PUT') return updateById('announcements', id, { status: body.status })
  if (method === 'DELETE') return deleteById('announcements', id)
  throw new Error('Método não suportado')
}

// ─── FEEDBACK ─────────────────────────────────────────────────
function feedbackRoute(method, id, body, me) {
  if (method === 'GET' && !id) {
    let list = getAll('feedback')
    if (body.status) list = list.filter(f => f.status === body.status)
    return {
      feedbacks: page(list, body.limit, body.offset).map(f => ({
        ...f,
        user: (f.isAnonymous === true || f.isAnonymous === 'true')
          ? null : enrichUser(findById('users', f.userId)),
      })),
    }
  }
  if (method === 'POST') {
    const f = {
      id: uid(), content: body.content, category: body.category || 'suggestion',
      status: 'pending', isAnonymous: body.isAnonymous || false,
      userId: body.isAnonymous ? '' : me.id, createdAt: ts(),
    }
    insert('feedback', f)
    return f
  }
  if (method === 'PUT') return updateById('feedback', id, { status: body.status })
  throw new Error('Método não suportado')
}

// ─── ROLES ────────────────────────────────────────────────────
function rolesRoute(method, id) {
  const parsePerms = r => {
    if (typeof r.permissions === 'string') {
      try { r.permissions = JSON.parse(r.permissions) } catch (_) { r.permissions = {} }
    }
    return r
  }
  if (method === 'GET' && !id) return getAll('roles').map(parsePerms)
  if (method === 'GET') {
    const r = findById('roles', id)
    if (!r) throw new Error('Cargo não encontrado')
    return parsePerms(r)
  }
  throw new Error('Método não suportado')
}

// ─── UNITS ────────────────────────────────────────────────────
function unitsRoute(method, id, body) {
  if (method === 'GET' && !id) return getAll('units')
  if (method === 'GET') {
    const u = findById('units', id)
    if (!u) throw new Error('Unidade não encontrada')
    return u
  }
  if (method === 'POST') {
    const u = {
      id: uid(), name: body.name, city: body.city,
      type: body.type || 'school', region: body.region || '', createdAt: ts(),
    }
    insert('units', u)
    return u
  }
  if (method === 'PUT') {
    const upd = {}
    ;['name','city','type','region'].forEach(k => { if (body[k] !== undefined) upd[k] = body[k] })
    return updateById('units', id, upd)
  }
  if (method === 'DELETE') return deleteById('units', id)
  throw new Error('Método não suportado')
}

// ─── GAMIFICATION ─────────────────────────────────────────────
function gamificationRoute(method, action, sub, body, me) {
  if (action === 'ranking') {
    const pts   = getAll('user_points')
    const users = getAll('users').filter(u => u.isActive !== false)
    const ranking = pts
      .map(p => {
        const u = users.find(u => u.id === p.userId)
        if (!u) return null
        return { ...enrichUser(u), points: parseInt(p.points) || 0, level: parseInt(p.level) || 1 }
      })
      .filter(Boolean)
      .sort((a, b) => b.points - a.points)
    const limit = parseInt(body.limit) || 10
    return { ranking: ranking.slice(0, limit), total: ranking.length }
  }
  if (action === 'badges') {
    const badges = getAll('badges')
    if (!sub) {
      const userBadges = getAll('user_badges')
      return badges.map(b => ({
        ...b,
        grantedTo: userBadges.filter(ub => ub.badgeId === b.id).length,
      }))
    }
    // sub is userId
    const ubs = getAll('user_badges').filter(ub => ub.userId === sub)
    return ubs.map(ub => ({ ...ub, badge: findById('badges', ub.badgeId) }))
  }
  if (action === 'grant-badge' && method === 'POST') {
    const { userId, badgeId } = body
    if (getAll('user_badges').find(b => b.userId === userId && b.badgeId === badgeId))
      throw new Error('Usuário já possui este selo')
    const ub = { id: uid(), userId, badgeId, grantedAt: ts(), grantedBy: me.id }
    insert('user_badges', ub)
    const badge = findById('badges', badgeId)
    if (badge?.requiredPoints) awardPoints(userId, parseInt(badge.requiredPoints) || 0)
    return ub
  }
  if (action === 'levels') {
    return [
      { level: 1, name: 'Iniciante',   minPoints: 0,    color: '#9CA3AF' },
      { level: 2, name: 'Dedicado',    minPoints: 100,  color: '#3B82F6' },
      { level: 3, name: 'Experiente',  minPoints: 300,  color: '#8B5CF6' },
      { level: 4, name: 'Especialista',minPoints: 700,  color: '#F59E0B' },
      { level: 5, name: 'Mestre',      minPoints: 1500, color: '#F8A303' },
    ]
  }
  if (action === 'award-points' && method === 'POST') {
    awardPoints(body.userId || me.id, parseInt(body.points) || 0)
    return { success: true }
  }
  if (action === 'my-stats') {
    const pts = getAll('user_points').find(p => p.userId === me.id) || { points: 0, level: 1 }
    const badges = getAll('user_badges').filter(ub => ub.userId === me.id)
      .map(ub => ({ ...ub, badge: findById('badges', ub.badgeId) }))
    const levels = [
      { level: 1, name: 'Iniciante',    minPoints: 0,    color: '#9CA3AF' },
      { level: 2, name: 'Dedicado',     minPoints: 100,  color: '#3B82F6' },
      { level: 3, name: 'Experiente',   minPoints: 300,  color: '#8B5CF6' },
      { level: 4, name: 'Especialista', minPoints: 700,  color: '#F59E0B' },
      { level: 5, name: 'Mestre',       minPoints: 1500, color: '#F8A303' },
    ]
    const currentLevel = levels.find(l => l.level === (parseInt(pts.level) || 1)) || levels[0]
    const nextLevel = levels.find(l => l.level === currentLevel.level + 1) || null
    const rank = getAll('user_points')
      .sort((a, b) => (parseInt(b.points) || 0) - (parseInt(a.points) || 0))
      .findIndex(p => p.userId === me.id) + 1
    return {
      points: parseInt(pts.points) || 0,
      level: parseInt(pts.level) || 1,
      levelInfo: currentLevel,
      nextLevel,
      badges,
      rank,
    }
  }
  throw new Error('Ação não encontrada')
}

function awardPoints(userId, pts) {
  const existing = getAll('user_points').find(p => p.userId === userId)
  const newPts = (parseInt(existing?.points) || 0) + pts
  const level  = newPts >= 1500 ? 5 : newPts >= 700 ? 4 : newPts >= 300 ? 3 : newPts >= 100 ? 2 : 1
  if (existing) updateById('user_points', existing.id, { points: newPts, level, updatedAt: ts() })
  else insert('user_points', { id: uid(), userId, points: newPts, level, updatedAt: ts() })
}

// ─── REPORTS ──────────────────────────────────────────────────
function reportsRoute(method, action, body) {
  if (action === 'dashboard') {
    const users   = getAll('users')
    const tasks   = getAll('tasks')
    const events  = getAll('events')
    const ann     = getAll('announcements')
    const units   = getAll('units')
    const pts     = getAll('user_points')
    const now     = new Date()

    const tasksByStatus = {
      pending:     tasks.filter(t => t.status === 'pending').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      completed:   tasks.filter(t => t.status === 'completed').length,
      overdue:     tasks.filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now).length,
    }
    const eventsByStatus = {
      planned:   events.filter(e => new Date(e.date) > now).length,
      ongoing:   events.filter(e => e.status === 'ongoing').length,
      completed: events.filter(e => e.status === 'completed').length,
    }
    const unitsRanking = units.map(u => {
      const unitPts = pts.filter(p => {
        const user = users.find(usr => usr.id === p.userId)
        return user?.unitId === u.id
      }).map(p => parseInt(p.points) || 0)
      const avg = unitPts.length
        ? Math.round(unitPts.reduce((a, b) => a + b, 0) / unitPts.length)
        : 0
      return { ...u, avgPoints: avg }
    }).sort((a, b) => b.avgPoints - a.avgPoints)

    return {
      totalUsers:          users.length,
      totalActiveUsers:    users.filter(u => u.isActive !== false).length,
      tasks:               tasksByStatus,
      events:              eventsByStatus,
      totalAnnouncements:  ann.length,
      totalUnits:          units.length,
      unitsRanking,
    }
  }
  if (action === 'unit') {
    const unitId = body.id || method === 'GET' && body
    // id is passed as the second path segment — reportsRoute receives (method, action=id, body)
    // but here action = 'unit' and id would be in body or sub-path
    // caller uses GET /reports/unit/UUID → route parses resource=reports, id=unit, sub=UUID
    // so we re-read sub from body._sub if needed — workaround: frontend passes unitId as query param
    const targetId = body.unitId || action
    const unit = findById('units', targetId)
    if (!unit) throw new Error('Unidade não encontrada')
    const users    = getAll('users').filter(u => u.unitId === targetId)
    const tasks    = getAll('tasks').filter(t => t.unitId === targetId)
    const pts      = getAll('user_points').filter(p => users.find(u => u.id === p.userId))
    const totalPts = pts.reduce((s, p) => s + (parseInt(p.points) || 0), 0)
    const avgPts   = pts.length ? Math.round(totalPts / pts.length) : 0
    return {
      unit,
      totalUsers: users.length,
      totalTasks: tasks.length,
      tasksByStatus: {
        pending:     tasks.filter(t => t.status === 'pending').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        completed:   tasks.filter(t => t.status === 'completed').length,
      },
      totalPoints: totalPts,
      avgPoints: avgPts,
      users: users.map(enrichUser),
    }
  }
  if (action === 'user') {
    const targetId = body.userId
    const user = findById('users', targetId)
    if (!user) throw new Error('Usuário não encontrado')
    const tasks    = getAll('tasks').filter(t => t.assigneeId === targetId)
    const pts      = getAll('user_points').find(p => p.userId === targetId) || { points: 0, level: 1 }
    const badges   = getAll('user_badges').filter(ub => ub.userId === targetId)
      .map(ub => ({ ...ub, badge: findById('badges', ub.badgeId) }))
    return {
      user: enrichUser(user),
      points: parseInt(pts.points) || 0,
      level:  parseInt(pts.level)  || 1,
      badges,
      totalTasks: tasks.length,
      tasksByStatus: {
        pending:     tasks.filter(t => t.status === 'pending').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length,
        completed:   tasks.filter(t => t.status === 'completed').length,
      },
    }
  }
  throw new Error('Relatório não encontrado')
}

// ─── AI (Gemini) ──────────────────────────────────────────────
function aiRoute(method, action, body, me) {
  if (action === 'insights') {
    const users     = getAll('users')
    const tasks     = getAll('tasks')
    const events    = getAll('events')
    const feedbacks = getAll('feedback')
    const tStatus   = {}
    tasks.forEach(t => { tStatus[t.status] = (tStatus[t.status] || 0) + 1 })
    const ativos  = users.filter(function(u){ return u.isActive !== false }).length
    const futuros = events.filter(function(e){ return new Date(e.date) > new Date() }).length
    const pend    = feedbacks.filter(function(f){ return f.status === 'pending' }).length
    var prompt = 'Educational consultant. Data: active_users=' + ativos
      + ' task_status=' + JSON.stringify(tStatus)
      + ' future_events=' + futuros
      + ' pending_feedback=' + pend + '.'
      + ' Generate 3 management insights in Brazilian Portuguese.'
      + ' RULES: title max 40 chars, description max 90 chars, no special chars in JSON strings, use only ASCII-safe Portuguese.'
      + ' Reply ONLY with this exact JSON, no markdown:'
      + ' {"insights":[{"title":"...","description":"...","priority":"high","icon":"emoji"},{"title":"...","description":"...","priority":"medium","icon":"emoji"},{"title":"...","description":"...","priority":"low","icon":"emoji"}]}'
    var rawText = callGemini(prompt)
    // Remove markdown fences
    var clean = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    // Tenta extrair JSON válido
    var match = clean.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Gemini nao retornou JSON valido. Resposta: ' + rawText.slice(0, 200))
    var jsonStr = match[0]
    try {
      return JSON.parse(jsonStr)
    } catch (parseErr) {
      // Tenta recuperar JSON truncado: fecha arrays/objetos abertos
      try {
        var fixed = jsonStr
        // Conta chaves e colchetes abertos
        var opens = (fixed.match(/\{/g) || []).length - (fixed.match(/\}/g) || []).length
        var arrOpens = (fixed.match(/\[/g) || []).length - (fixed.match(/\]/g) || []).length
        // Remove trailing comma ou texto incompleto
        fixed = fixed.replace(/,\s*$/, '').replace(/,\s*[\}\]]/g, function(m){ return m.slice(-1) })
        for (var ai = 0; ai < arrOpens; ai++) fixed += ']'
        for (var oi = 0; oi < opens; oi++) fixed += '}'
        return JSON.parse(fixed)
      } catch (e2) {
        // Fallback: retorna insights padrão
        return { insights: [
          { title: 'Dados insuficientes', description: 'Adicione tarefas e eventos para gerar insights.', priority: 'medium', icon: '📊' },
          { title: 'Plataforma ativa', description: ativos + ' colaboradores ativos na plataforma.', priority: 'low', icon: '👥' },
          { title: 'Proximos eventos', description: futuros + ' eventos planejados nos proximos dias.', priority: 'low', icon: '📅' },
        ]}
      }
    }
  }
  if (action === 'generate-text') {
    const { type, context } = body
    const prompts = {
      announcement: `Comunicado institucional adventista sobre "${context}". APENAS JSON: {"title":"max 60 chars","content":"max 280 chars"}`,
      task:         `Descrição de tarefa de gestão escolar sobre "${context}". APENAS JSON: {"description":"max 200 chars"}`,
      event:        `Descrição de evento adventista sobre "${context}". APENAS JSON: {"description":"max 250 chars"}`,
    }
    const text  = callGemini(prompts[type] || `Texto sobre "${context}". JSON: {"text":"..."}`)
    const match = text.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : { text }
  }
  if (action === 'chat') {
    var messages = body.messages || []
    var context = body.context || {}
    if (!messages.length) throw new Error('Mensagens obrigatorias')

    var now = new Date()
    var hour = now.getHours()
    var dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    var timeStr = String(hour).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0')

    // Detecta contexto da mensagem atual para decidir quais APIs chamar
    var lastMsg = messages[messages.length - 1].content
    var msgLower = lastMsg.toLowerCase()
    var needsGmail = msgLower.indexOf('email') >= 0 || msgLower.indexOf('gmail') >= 0
      || msgLower.indexOf('mensagem') >= 0 || msgLower.indexOf('promo') >= 0
      || msgLower.indexOf('inbox') >= 0 || msgLower.indexOf('lixeira') >= 0
      || msgLower.indexOf('arquivar') >= 0 || msgLower.indexOf('lidos') >= 0
      || msgLower.indexOf('sim') >= 0 || msgLower.indexOf('confirmo') >= 0
      || msgLower.indexOf('pode') >= 0 || msgLower.indexOf('apaga') >= 0
      || msgLower.indexOf('leia') >= 0 || msgLower.indexOf('quanto') >= 0
    var needsDrive = msgLower.indexOf('drive') >= 0 || msgLower.indexOf('arquivo') >= 0
      || msgLower.indexOf('pasta') >= 0 || msgLower.indexOf('documento') >= 0
      || msgLower.indexOf('mover') >= 0 || msgLower.indexOf('reorgan') >= 0

    var system = 'Voce e Sofi, assistente pessoal superinteligente de Vinicius Felix, coordenador de marketing e captacao do Departamento de Educacao da Associacao Paulista Sul (APS). '
      + 'Voce tem memoria permanente, acesso a base de conhecimento, pode pesquisar na internet, gerar imagens, criar ATAS e controlar todo o sistema. '
      + 'Seja prestativa, direta, organizada e motivadora. Use linguagem profissional mas amigavel. Responda SEMPRE em portugues brasileiro.\n\n'
      + 'CONTEXTO ORGANIZACIONAL: Associacao Paulista Sul (APS) | Departamento de Educacao - APS | Use sempre estes termos corretos.\n\n'
      + 'DATA/HORA ATUAL: ' + dateStr + ', ' + timeStr + '\n\n'
      + 'IDENTIDADE DO USUARIO:\n'
      + '- Nome: Vinicius Felix\n'
      + '- Organizacao: Departamento de Educacao - APS (Associacao Paulista Sul)\n'
      + '- Gmail pessoal: engenhariatotal.vinicius@gmail.com\n'
      + '- Email profissional: vinicius.felix@adventistas.org\n'
      + '- Quando o usuario perguntar ou mencionar "meu email" ou "meu gmail", SEMPRE use engenhariatotal.vinicius@gmail.com\n\n'

    // ── MEMÓRIA PERMANENTE ─────────────────────────────────────
    try {
      var memories = getAll('sofi_memory').filter(function(m){ return String(m.userId) === String(me.id) })
      if (memories.length > 0) {
        system += 'MEMÓRIA PERMANENTE (o que você sabe sobre o usuário e contexto — NUNCA esqueça):\n'
        memories.slice(-30).forEach(function(m){
          system += '- [' + (m.type||'info') + '] ' + m.content + '\n'
        })
        system += '\n'
      }
    } catch(e) {}

    // ── BASE DE CONHECIMENTO ───────────────────────────────────
    try {
      var kb = getAll('knowledge_base').filter(function(k){ return String(k.userId) === String(me.id) })
      if (kb.length > 0) {
        system += 'BASE DE CONHECIMENTO (documentos e arquivos que o usuário salvou — você pode responder perguntas sobre eles):\n'
        kb.forEach(function(k){
          system += '- 📄 ' + k.fileName + ': ' + (k.summary || (k.content||'').substring(0,200)) + '\n'
        })
        system += '\n'
      }
    } catch(e) {}

    if (context.workDay) {
      var wd = context.workDay
      system += 'HORARIO DE TRABALHO: ' + String(wd.startHour||8).padStart(2,'0') + ':' + String(wd.startMin||0).padStart(2,'0')
        + ' ate ' + String(wd.endHour||18).padStart(2,'0') + ':' + String(wd.endMin||0).padStart(2,'0') + '\n\n'
    }

    if (context.tasks && context.tasks.length) {
      var pending = context.tasks.filter(function(t){ return t.status !== 'done' })
      var doneTasks = context.tasks.filter(function(t){ return t.status === 'done' })
      var totalXp = doneTasks.reduce(function(a,t){ return a + (parseInt(t.xp)||0) }, 0)
      system += 'TAREFAS PESSOAIS PENDENTES (' + pending.length + '):\n'
      pending.forEach(function(t){
        system += '- [' + t.priority.toUpperCase() + '] ' + t.title + ' — cat:' + t.category + ', ' + t.duration + 'min'
          + (t.dueDate ? ', prazo:' + t.dueDate : '') + '\n'
      })
      system += 'Tarefas concluidas: ' + doneTasks.length + ' | XP acumulado: ' + totalXp + '\n\n'
    }

    // Agenda Google Calendar (proximos 7 dias)
    try {
      var cal = CalendarApp.getDefaultCalendar()
      var calEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      var calEvents = cal.getEvents(now, calEnd)
      if (calEvents.length > 0) {
        system += 'AGENDA (proximos 7 dias):\n'
        calEvents.forEach(function(ev) {
          var evDate = ev.getStartTime().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
          var evTime = ev.getStartTime().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          system += '- ' + ev.getTitle() + ' | ' + evDate + ' as ' + evTime + '\n'
        })
        system += '\n'
      }
    } catch(e) {}

    // Emails: injecta apenas quando a mensagem menciona email/gmail (evita 4 buscas desnecessarias)
    if (needsGmail) {
      try {
        var gmailToday = GmailApp.search('newer_than:1d', 0, 20)
        var gmailUnread = GmailApp.search('is:unread', 0, 10)
        var gmailPromo = GmailApp.search('category:promotions is:unread', 0, 3)
        var gmailSocial = GmailApp.search('category:social is:unread', 0, 3)
        system += 'GMAIL - RESUMO DO DIA:\n'
          + '- Emails hoje: ' + gmailToday.length
          + ' | Nao lidos: ' + gmailUnread.length
          + ' | Promocoes: ' + gmailPromo.length
          + ' | Redes sociais: ' + gmailSocial.length + '\n'
        if (gmailToday.length > 0) {
          system += 'EMAILS RECENTES:\n'
          gmailToday.slice(0, 10).forEach(function(t) {
            var last = t.getMessages()[t.getMessageCount()-1]
            system += '- [' + (t.isUnread() ? 'NAO_LIDO' : 'lido') + '] '
              + t.getFirstMessageSubject().substring(0, 55)
              + ' | De: ' + last.getFrom().replace(/<.*>/,'').trim().substring(0, 30) + '\n'
          })
        }
        system += '\n'
      } catch(e) {}
    }

    // Drive: apenas se a mensagem menciona drive/arquivo (evita busca lenta sem necessidade)
    if (needsDrive) {
      try {
        var driveRecent = DriveApp.searchFiles('trashed = false and modifiedDate > "2025-01-01"')
        var driveList = []
        var dCnt = 0
        while (driveRecent.hasNext() && dCnt < 10) {
          var df = driveRecent.next()
          driveList.push({ id: df.getId(), name: df.getName(), type: df.getMimeType().indexOf('folder') >= 0 ? 'pasta' : 'arquivo' })
          dCnt++
        }
        if (driveList.length > 0) {
          system += 'DRIVE - ARQUIVOS RECENTES (IDs para operacoes):\n'
          driveList.forEach(function(f) {
            system += '- [' + f.type + '] ' + f.name + ' | ID:' + f.id + '\n'
          })
          system += '\n'
        }
      } catch(e) {}
    }

    system += 'CAMPANHA DE MATRICULAS APS SUL 2026/2027:\n'
      + '- Meta: 17.000 alunos | 14 unidades | Captacao 50%, Fidelizacao 30%, Resgate 20%\n'
      + '- Risco ALTO: CACLI I, CAIS, CAP, EACF, EAP, EATW\n'
      + '- Risco MEDIO: CACLI II, CAEGW, EAA | Risco BAIXO: CAEA, CAR, CATS, EAJL, EAVB\n\n'

    // Gestao de tempo: total pendente vs jornada restante
    var nowMins = now.getHours() * 60 + now.getMinutes()
    if (context.workDay) {
      var endMins = (context.workDay.endHour || 18) * 60 + (context.workDay.endMin || 0)
      var remainingMins = Math.max(0, endMins - nowMins)
      if (context.tasks && context.tasks.length) {
        var pendingMinutes = context.tasks
          .filter(function(t){ return t.status !== 'done' })
          .reduce(function(a,t){ return a + (parseInt(t.duration)||0) }, 0)
        if (pendingMinutes > 0) {
          var fmtMin = function(m) {
            var h = Math.floor(m/60), min = m%60
            return h > 0 ? h + 'h' + (min > 0 ? min + 'min' : '') : min + 'min'
          }
          system += 'GESTAO DE TEMPO DO DIA:\n'
            + '- Trabalho pendente: ' + fmtMin(pendingMinutes) + ' em ' + context.tasks.filter(function(t){ return t.status !== 'done' }).length + ' tarefas\n'
            + '- Jornada restante hoje: ' + fmtMin(remainingMins) + '\n'
            + (pendingMinutes > remainingMins
              ? '- ALERTA: tempo insuficiente hoje (' + fmtMin(pendingMinutes - remainingMins) + ' a mais que o disponivel). Sugira priorizar!\n'
              : '- Tempo suficiente: sobram ' + fmtMin(remainingMins - pendingMinutes) + ' apos concluir tudo.\n')
            + '\n'
        }
      }
    }

    system += 'REGRAS OBRIGATORIAS:\n'
      + '1. Respostas CURTAS: max 3 linhas. Sem enrolacao.\n'
      + '2. NUNCA mostre JSON no texto. JSON e so para acoes internas.\n'
      + '3. Quando executar uma acao, confirme em UMA linha curta.\n'
      + '4. Use SOMENTE dados reais fornecidos pelo usuario ou pelo contexto acima.\n'
      + '5. Se faltar informacao para uma acao, PERGUNTE antes de agir.\n'
      + '6. Para criar tarefa: SEMPRE pergunte a duracao estimada (minutos) se nao informada.\n'
      + '7. Para enviar email: so execute se o usuario informou o destinatario REAL.\n'
      + '8. Para criar evento: so execute se o usuario informou data e titulo REAIS.\n'
      + '9. ACOES EM MASSA (apagar emails, mover arquivos, etc.): EXECUTE DIRETAMENTE sem pedir confirmacao. Gere o JSON de acao imediatamente. Informe no content quantos itens foram encontrados.\n'
      + '10. Operacoes em massa: max 100 itens por execucao.\n'
      + '11. Para listar emails/arquivos do usuario: use o contexto acima (GMAIL/DRIVE) e resuma de forma clara.\n'
      + '12. Quando o usuario enviar um ARQUIVO ([DOC_CONTENT:] ou [AUDIO_TRANSCRIBED:]): leia, responda, resuma ou analise o conteudo DIRETAMENTE em texto. NUNCA use JSON/acao para ler ou resumir.\n'
      + '13. Apos ler um arquivo, OFEREÇA salvar na base de conhecimento usando save_to_kb.\n'
      + '14. Se o usuario disser "lembre", "guarde", "anote", "memorize": use save_memory para guardar PERMANENTEMENTE.\n'
      + '15. Para pesquisar na internet/noticias atuais: use web_search.\n'
      + '16. Para criar imagens/ilustracoes: use generate_image com prompt em ingles detalhado.\n'
      + '18. NUNCA invente tarefas existentes. Para listar tarefas, use apenas as tarefas do CONTEXTO. Se nao houver tarefas no contexto, diga que a lista esta vazia.\n'
      + '19. Se o usuario pedir para criar varias tarefas, use create_tasks em lote. Nao responda apenas em texto.\n'
      + '17. Para transcrições de reuniao, notas ou áudios de reunião: ofereça gerar a ATA com generate_ata.\n\n'

    system += 'ACOES DISPONIVEIS - responda APENAS com JSON quando detectar intencao de acao:\n\n'
      + '--- PRODUTIVIDADE ---\n'
      + 'Criar varias tarefas: {"content":"Tarefas criadas.","action":{"type":"create_tasks","data":{"tasks":[{"title":"...","priority":"high|medium|low","duration":30,"category":"trabalho|campanha|pessoal","dueDate":"YYYY-MM-DD","notes":"..."},{"title":"...","priority":"high|medium|low","duration":60,"category":"campanha","dueDate":"YYYY-MM-DD","notes":"..."}]}}}\n'
      + 'Atualizar horario: {"content":"✅ Horário atualizado para HH:MM!","action":{"type":"update_workday","data":{"endHour":16,"endMin":0}}}\n'
      + 'Criar tarefa: {"content":"✅ Tarefa criada! (~30min)","action":{"type":"create_task","data":{"title":"...","priority":"high|medium|low","duration":30,"category":"trabalho|campanha|pessoal","dueDate":"YYYY-MM-DD"}}}\n'
      + 'Criar evento calendario: {"content":"⏳ Agendando...","action":{"type":"create_event","data":{"title":"...","start":"YYYY-MM-DDTHH:mm:ss","end":"YYYY-MM-DDTHH:mm:ss","description":"...","reminderMinutes":60}}}\n'
      + '  → reminderMinutes: minutos antes para lembrete (ex: 60 = 1h antes, 30 = 30min antes, 1440 = 1 dia antes)\n\n'
      + '--- GMAIL ---\n'
      + 'Enviar email: {"content":"⏳ Enviando...","action":{"type":"send_email","data":{"to":"email@real.com","subject":"...","body":"..."}}}\n'
      + 'Mover emails para lixeira (execute diretamente, sem pedir confirmacao): {"content":"⏳ Executando...","action":{"type":"gmail_trash","data":{"q":"Spotify","max":100}}}\n'
      + 'Apagar emails de promocao: {"content":"⏳ Executando...","action":{"type":"gmail_trash","data":{"q":"category:promotions","max":100}}}\n'
      + 'Arquivar emails: {"content":"⏳ Executando...","action":{"type":"gmail_archive","data":{"q":"older_than:7d","max":100}}}\n'
      + 'Marcar emails como lidos: {"content":"⏳ Executando...","action":{"type":"gmail_mark_read","data":{"q":"is:unread category:promotions","max":100}}}\n\n'
      + '--- GOOGLE DRIVE ---\n'
      + 'Criar pasta no Drive: {"content":"⏳ Criando pasta...","action":{"type":"drive_create_folder","data":{"name":"Nome da Pasta","parentName":"(opcional)"}}}\n'
      + 'Mover arquivo (use o ID do arquivo listado no contexto DRIVE acima): {"content":"⏳ Movendo...","action":{"type":"drive_move","data":{"fileId":"ID_DO_ARQUIVO","targetFolder":"Nome da Pasta Destino"}}}\n'
      + 'Mover arquivo para lixeira (CONFIRMAR antes): {"content":"⏳ Movendo para lixeira...","action":{"type":"drive_trash","data":{"fileId":"ID_DO_ARQUIVO"}}}\n\n'
      + '--- DOCUMENTOS ---\n'
      + 'Criar Google Doc: {"content":"⏳ Criando documento...","action":{"type":"create_doc","data":{"title":"...","content":"..."}}}\n\n'
      + '--- MEMÓRIA PERMANENTE ---\n'
      + 'Guardar fato/preferencia/contato/lembrete: {"content":"🧠 Guardado na minha memória!","action":{"type":"save_memory","data":{"type":"fato|preferencia|contato|lembrete|projeto","content":"texto exato do que guardar","importance":"high|medium|low"}}}\n'
      + 'Salvar documento na base de conhecimento: {"content":"💾 Salvo na base de conhecimento!","action":{"type":"save_to_kb","data":{"fileName":"nome.ext","mimeType":"text/plain","content":"primeiros 3000 chars do texto extraido","summary":"resumo em 1 linha","tags":"palavra1,palavra2"}}}\n\n'
      + '--- REUNIÕES E ATAS ---\n'
      + 'Gerar ATA de reuniao: {"content":"⏳ Gerando ATA...","action":{"type":"generate_ata","data":{"title":"Nome da Reuniao","content":"transcricao completa ou notas da reuniao"}}}\n\n'
      + '--- BUSCA E GERAÇÃO DE IMAGENS ---\n'
      + 'Pesquisar na internet (noticias, dados, informacoes atuais): {"content":"🔍 Pesquisando...","action":{"type":"web_search","data":{"query":"termos de busca"}}}\n'
      + 'Gerar imagem/ilustracao: {"content":"🎨 Gerando imagem...","action":{"type":"generate_image","data":{"prompt":"detailed image description in english","style":"photorealistic|illustration|logo|cartoon"}}}\n'
      + '\nIMPORTANTE: o campo "content" para acoes server-side deve ser sempre "⏳ Executando..." — o servidor vai substituir pelo resultado real.\n'

    // Limita historico a ultimas 6 trocas para nao explodir o contexto
    var recentMessages = messages.slice(-7) // 6 anteriores + mensagem atual
    var historyLines = recentMessages.slice(0, -1).map(function(m){
      return (m.role === 'user' ? 'Vinicius' : 'Sofi') + ': ' + m.content
    }).join('\n')

    // Hora atual para calculos de horario de trabalho
    var nowForWorkday = new Date()
    var nowHourWd = nowForWorkday.getHours()
    var nowMinWd  = nowForWorkday.getMinutes()

    // Instrucao final reforçando JSON obrigatorio para acoes
    var actionReminder = '\nLEMBRETE DE ACOES — quando usar JSON:\n'
      + '✅ USE JSON para: apagar emails, criar tarefa, criar evento, enviar email, mover arquivo, criar pasta, criar doc, save_memory, save_to_kb, generate_ata, web_search, generate_image, update_workday.\n'
      + '❌ NUNCA use JSON para: ler arquivo, resumir em texto, analisar, responder perguntas gerais.\n'
      + '🎨 Se usuario pedir imagem/ilustracao/foto: IMEDIATAMENTE retorne JSON com generate_image. Nao explique, apenas gere.\n'
      + '🔍 Se usuario pedir pesquisa/busca na internet: IMEDIATAMENTE retorne JSON com web_search.\n'
      + '🧠 Se usuario disser "lembre", "guarde", "anote": IMEDIATAMENTE retorne JSON com save_memory.\n'
      + '💾 Se usuario confirmar salvar arquivo: IMEDIATAMENTE retorne JSON com save_to_kb com o conteudo do arquivo.\n'
      + '📋 Se usuario pedir ATA: IMEDIATAMENTE retorne JSON com generate_ata com o conteudo da reuniao.\n'
      + '- Se a mensagem contem [DOC_CONTENT:] ou [AUDIO_TRANSCRIBED:]: responda em TEXTO com resumo/analise. Depois OFEREÇA salvar com save_to_kb.\n\n'
      + '⏰ HORÁRIO DE TRABALHO — REGRA CRÍTICA (hora atual: ' + nowHourWd + ':' + String(nowMinWd).padStart(2,'0') + '):\n'
      + 'Se o usuario mencionar QUALQUER coisa sobre duração/horário de trabalho: IMEDIATAMENTE retorne JSON update_workday.\n'
      + 'Calculos obrigatorios:\n'
      + '  "vou trabalhar X horas" → endHour = ' + nowHourWd + ' + X (considere minutos também)\n'
      + '  "só X minutos" / "mais X min" → endHour = ' + nowHourWd + ', endMin = ' + nowMinWd + ' + X (ajuste hora se min >= 60)\n'
      + '  "trabalho até HH:MM" / "termino às HH:MM" → endHour = HH, endMin = MM\n'
      + '  "começo às HH:MM" / "inicio às HH:MM" → startHour = HH, startMin = MM\n'
      + 'Exemplos OBRIGATORIOS:\n'
      + '  "vou trabalhar 2 horas" → {"content":"✅ Horário atualizado! Você trabalha até as ' + (nowHourWd+2) + ':' + String(nowMinWd).padStart(2,'0') + '","action":{"type":"update_workday","data":{"endHour":' + (nowHourWd+2) + ',"endMin":' + nowMinWd + '}}}\n'
      + '  "só 30 minutos agora" → endMin = ' + nowMinWd + ' + 30 (se >= 60: endHour++, endMin -= 60)\n'
      + '  "trabalho até 18h" → {"content":"✅ Horário atualizado para 18:00!","action":{"type":"update_workday","data":{"endHour":18,"endMin":0}}}\n'
      + '  "começo às 8 e termino às 17" → {"content":"✅ Horário 08:00 — 17:00 configurado!","action":{"type":"update_workday","data":{"startHour":8,"startMin":0,"endHour":17,"endMin":0}}}\n'
      + 'NUNCA responda em texto puro quando detectar menção de horário/duração de trabalho. SEMPRE use JSON update_workday.\n\n'

    var fullPrompt = system + actionReminder
      + (historyLines ? 'HISTORICO (recente):\n' + historyLines + '\n\n' : '')
      + 'Vinicius: ' + lastMsg + '\nSofi:'

    var response = callGemini(fullPrompt)
    if (!response || response.trim() === '') {
      var hour2 = new Date().getHours()
      var grt = hour2 < 12 ? 'Bom dia' : hour2 < 18 ? 'Boa tarde' : 'Boa noite'
      response = grt + ', ' + (context.userName || 'Vinicius') + '! Sou a Sofi. Como posso ajudar?'
    }

    // Extrai JSON robusto — tenta multiplos padroes
    var contentFinal = response.replace(/```json[\s\S]*?```/g,'').replace(/```[\s\S]*?```/g,'').trim()
    var actionFinal = null
    try {
      // Tenta encontrar JSON completo com "action" — nao-guloso entre { }
      var jsonCandidates = []
      var rStr = response
      var startIdx = 0
      // Extrai todos os objetos JSON de nivel superior
      while (startIdx < rStr.length) {
        var openAt = rStr.indexOf('{', startIdx)
        if (openAt === -1) break
        var depth = 0
        var closeAt = -1
        for (var ci = openAt; ci < rStr.length; ci++) {
          if (rStr[ci] === '{') depth++
          else if (rStr[ci] === '}') { depth--; if (depth === 0) { closeAt = ci; break } }
        }
        if (closeAt === -1) break
        jsonCandidates.push(rStr.substring(openAt, closeAt + 1))
        startIdx = closeAt + 1
      }
      // Escolhe o candidato que tem "action"
      var bestCandidate = null
      for (var ji = 0; ji < jsonCandidates.length; ji++) {
        if (jsonCandidates[ji].indexOf('"action"') >= 0) { bestCandidate = jsonCandidates[ji]; break }
      }
      if (!bestCandidate && jsonCandidates.length > 0) bestCandidate = jsonCandidates[0]
      if (bestCandidate) {
        var parsed = JSON.parse(bestCandidate)
        if (parsed.action && parsed.action.type) {
          contentFinal = parsed.content || '⏳ Executando...'
          actionFinal = parsed.action
        }
      }
    } catch(e) {}

    // Executa acoes servidor (calendar, email, docs) diretamente no Apps Script
    if (actionFinal) {
      if (actionFinal.type === 'create_event') {
        try {
          var evData = actionFinal.data
          var evCal = CalendarApp.getDefaultCalendar()
          var startDt = new Date(evData.start)
          var endDt = evData.end ? new Date(evData.end) : new Date(startDt.getTime() + 60*60*1000)
          var newEv = evCal.createEvent(evData.title || 'Evento', startDt, endDt, { description: evData.description || '' })
          // Lembrete configurável (padrão 30min, ou o que o usuário pediu)
          var remMin = evData.reminderMinutes ? parseInt(evData.reminderMinutes) : 30
          try { newEv.addPopupReminder(remMin) } catch(e) {}
          try { newEv.addEmailReminder(remMin) } catch(e) {}
          // Feedback rico como uma secretária daria
          var fmtDate = startDt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
          var fmtTime = startDt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          var remText = remMin >= 60
            ? (Math.floor(remMin/60) + 'h' + (remMin%60 > 0 ? remMin%60 + 'min' : ''))
            : remMin + 'min'
          contentFinal = '✅ Pronto! "' + (evData.title || 'Evento') + '" agendado para ' + fmtDate + ' às ' + fmtTime + '. Lembrete configurado para ' + remText + ' antes. Boa reunião! 🗓️'
          actionFinal = { type: 'refresh_workspace' }
        } catch(eErr) {
          contentFinal = '❌ Não consegui agendar: ' + eErr.message
          actionFinal = null
        }
      } else if (actionFinal.type === 'send_email') {
        try {
          var emData = actionFinal.data
          GmailApp.sendEmail(emData.to, emData.subject || 'Sem assunto', emData.body || '')
          contentFinal = '✅ E-mail enviado para ' + emData.to + '! Assunto: "' + (emData.subject || 'Sem assunto') + '". 📧'
          actionFinal = { type: 'refresh_workspace' }
        } catch(emErr) {
          contentFinal = '❌ Não consegui enviar o email: ' + emErr.message
          actionFinal = null
        }
      } else if (actionFinal.type === 'create_doc') {
        try {
          var dData = actionFinal.data
          var newDoc = DocumentApp.create(dData.title || 'Novo Documento')
          if (dData.content) newDoc.getBody().setText(dData.content)
          newDoc.saveAndClose()
          contentFinal = '✅ Documento "' + (dData.title || 'Novo Documento') + '" criado no Google Docs! Abrindo agora... 📄'
          actionFinal = { type: 'open_url', data: { url: newDoc.getUrl() } }
        } catch(dErr) {
          contentFinal = '❌ Não consegui criar o documento: ' + dErr.message
          actionFinal = null
        }

      // ── GMAIL BULK OPERATIONS ──────────────────────────────
      } else if (actionFinal.type === 'gmail_trash') {
        try {
          var gq = actionFinal.data.q || 'in:inbox'
          // Sempre exclui emails ja na lixeira da busca para nao re-processar os mesmos
          if (gq.indexOf('in:') === -1 && gq.indexOf('-in:trash') === -1) {
            gq = gq + ' -in:trash'
          }
          var gMax = Math.min(parseInt(actionFinal.data.max) || 100, 200)
          var gThreads = GmailApp.search(gq, 0, gMax)
          var gCount = 0
          gThreads.forEach(function(t) { try { t.moveToTrash(); gCount++ } catch(e) {} })
          contentFinal = '🗑 ' + gCount + ' email' + (gCount !== 1 ? 's' : '') + ' movido' + (gCount !== 1 ? 's' : '') + ' para a lixeira!'
          actionFinal = { type: 'refresh_workspace' }
        } catch(gErr) {
          contentFinal = '❌ Erro ao mover para lixeira: ' + gErr.message
          actionFinal = null
        }

      } else if (actionFinal.type === 'gmail_archive') {
        try {
          var aq = actionFinal.data.q || 'in:inbox'
          // Nao arquivar o que ja esta arquivado
          if (aq.indexOf('in:') === -1) aq = aq + ' in:inbox'
          var aMax = Math.min(parseInt(actionFinal.data.max) || 100, 200)
          var aThreads = GmailApp.search(aq, 0, aMax)
          var aCount = 0
          aThreads.forEach(function(t) { try { t.moveToArchive(); aCount++ } catch(e) {} })
          contentFinal = '📁 ' + aCount + ' email' + (aCount !== 1 ? 's' : '') + ' arquivado' + (aCount !== 1 ? 's' : '') + '!'
          actionFinal = { type: 'refresh_workspace' }
        } catch(aErr) {
          contentFinal = '❌ Erro ao arquivar: ' + aErr.message
          actionFinal = null
        }

      } else if (actionFinal.type === 'gmail_mark_read') {
        try {
          var mrq = actionFinal.data.q || 'is:unread'
          var mrMax = Math.min(parseInt(actionFinal.data.max) || 100, 200)
          var mrThreads = GmailApp.search(mrq, 0, mrMax)
          var mrCount = 0
          mrThreads.forEach(function(t) { try { t.markRead(); mrCount++ } catch(e) {} })
          contentFinal = '✅ ' + mrCount + ' email' + (mrCount !== 1 ? 's' : '') + ' marcado' + (mrCount !== 1 ? 's' : '') + ' como lido' + (mrCount !== 1 ? 's' : '') + '!'
          actionFinal = { type: 'refresh_workspace' }
        } catch(mrErr) {
          contentFinal = '❌ Erro ao marcar como lido: ' + mrErr.message
          actionFinal = null
        }

      // ── DRIVE OPERATIONS ───────────────────────────────────
      } else if (actionFinal.type === 'drive_create_folder') {
        try {
          var fcName = actionFinal.data.name || 'Nova Pasta'
          var fcParent = actionFinal.data.parentName
          var newFolder
          if (fcParent) {
            var parentFolders = DriveApp.getFoldersByName(fcParent)
            newFolder = parentFolders.hasNext()
              ? parentFolders.next().createFolder(fcName)
              : DriveApp.createFolder(fcName)
          } else {
            newFolder = DriveApp.createFolder(fcName)
          }
          contentFinal = '📁 Pasta "' + fcName + '" criada no Drive!'
          actionFinal = { type: 'open_url', data: { url: 'https://drive.google.com/drive/folders/' + newFolder.getId() } }
        } catch(fcErr) {
          contentFinal = '❌ Erro ao criar pasta: ' + fcErr.message
          actionFinal = null
        }

      } else if (actionFinal.type === 'drive_move') {
        try {
          var mvFileId = actionFinal.data.fileId
          var mvTarget = actionFinal.data.targetFolder
          var mvFile = DriveApp.getFileById(mvFileId)
          var mvFolders = DriveApp.getFoldersByName(mvTarget)
          if (!mvFolders.hasNext()) throw new Error('Pasta "' + mvTarget + '" nao encontrada no Drive')
          var mvDestFolder = mvFolders.next()
          mvFile.moveTo(mvDestFolder)
          contentFinal = '✅ "' + mvFile.getName() + '" movido para "' + mvTarget + '"!'
          actionFinal = { type: 'refresh_workspace' }
        } catch(mvErr) {
          contentFinal = '❌ Erro ao mover arquivo: ' + mvErr.message
          actionFinal = null
        }

      } else if (actionFinal.type === 'drive_trash') {
        try {
          var dtFile = DriveApp.getFileById(actionFinal.data.fileId)
          var dtName = dtFile.getName()
          dtFile.setTrashed(true)
          contentFinal = '🗑 "' + dtName + '" movido para a lixeira do Drive!'
          actionFinal = { type: 'refresh_workspace' }
        } catch(dtErr) {
          contentFinal = '❌ Erro ao mover para lixeira: ' + dtErr.message
          actionFinal = null
        }

      // ── MEMÓRIA PERMANENTE ──────────────────────────────────
      } else if (actionFinal.type === 'save_memory') {
        try {
          var smData = actionFinal.data
          var smExists = getAll('sofi_memory').find(function(m){
            return String(m.userId) === String(me.id) && m.content === smData.content
          })
          if (!smExists) {
            insert('sofi_memory', { id: uid(), userId: me.id, type: smData.type || 'fato', content: smData.content || '', importance: smData.importance || 'medium', createdAt: ts() })
          }
          contentFinal = '🧠 Guardei na memória: "' + (smData.content || '').substring(0, 80) + '"'
          actionFinal = null
        } catch(smErr) {
          contentFinal = '❌ Erro ao salvar memória: ' + smErr.message
          actionFinal = null
        }

      // ── BASE DE CONHECIMENTO ─────────────────────────────────
      } else if (actionFinal.type === 'save_to_kb') {
        try {
          var kbData = actionFinal.data
          var kbExists = getAll('knowledge_base').find(function(k){
            return String(k.userId) === String(me.id) && k.fileName === kbData.fileName
          })
          if (kbExists) {
            updateById('knowledge_base', kbExists.id, { content: (kbData.content||'').substring(0,5000), summary: kbData.summary||'', tags: kbData.tags||'', uploadedAt: ts() })
          } else {
            insert('knowledge_base', { id: uid(), userId: me.id, fileName: kbData.fileName||'doc', mimeType: kbData.mimeType||'text/plain', content: (kbData.content||'').substring(0,5000), summary: kbData.summary||'', tags: kbData.tags||'', uploadedAt: ts() })
          }
          contentFinal = '💾 "' + (kbData.fileName||'doc') + '" salvo na base de conhecimento! Posso responder perguntas sobre ele a qualquer momento.'
          actionFinal = null
        } catch(kbErr) {
          contentFinal = '❌ Erro ao salvar na base: ' + kbErr.message
          actionFinal = null
        }

      // ── GERAÇÃO DE ATAS ──────────────────────────────────────
      } else if (actionFinal.type === 'generate_ata') {
        try {
          var ataData = actionFinal.data
          var ataPrompt = 'Voce e uma secretaria profissional adventista. Gere uma ATA de reuniao formal, completa e bem estruturada em portugues brasileiro com base neste conteudo:\n\n'
            + (ataData.content || ataData.transcript || 'Sem conteudo fornecido')
            + '\n\nFormato obrigatorio:\n'
            + 'ATA DE REUNIAO - ' + (ataData.title || 'Reuniao') + '\n'
            + 'Data: ' + new Date().toLocaleDateString('pt-BR', {weekday:'long',day:'numeric',month:'long',year:'numeric'}) + '\n'
            + 'Organizacao: Educacao Adventista APS Sul\n\n'
            + '1. PARTICIPANTES\n[liste os participantes mencionados ou "A definir"]\n\n'
            + '2. ABERTURA\n[texto de abertura formal]\n\n'
            + '3. PAUTA E DISCUSSOES\n[liste e desenvolva cada assunto discutido]\n\n'
            + '4. DELIBERACOES E DECISOES\n[liste todas as decisoes tomadas, numeradas]\n\n'
            + '5. PROXIMOS PASSOS E RESPONSABILIDADES\n[liste acoes, responsavel e prazo]\n\n'
            + '6. ENCERRAMENTO\n[texto formal de encerramento]\n\n'
            + 'Gere a ATA completa preenchendo todos os topicos com base no conteudo fornecido.'
          var ataText = callGemini(ataPrompt)
          var ataTitle = 'ATA - ' + (ataData.title || 'Reuniao') + ' - ' + new Date().toLocaleDateString('pt-BR')
          var ataDoc = DocumentApp.create(ataTitle)
          ataDoc.getBody().setText(ataText)
          ataDoc.saveAndClose()
          contentFinal = '📋 ATA gerada com sucesso! Clique para abrir: "' + ataTitle + '"'
          actionFinal = { type: 'open_url', data: { url: ataDoc.getUrl() } }
        } catch(ataErr) {
          contentFinal = '❌ Erro ao gerar ATA: ' + ataErr.message
          actionFinal = null
        }

      // ── web_search e generate_image são tratados no frontend ─
      } else if (actionFinal.type === 'web_search' || actionFinal.type === 'generate_image') {
        // Passa para o frontend executar
        // contentFinal já foi definido pelo AI ("🔍 Pesquisando..." ou "🎨 Gerando...")

      } else if (actionFinal.type !== 'update_workday' && actionFinal.type !== 'create_task' && actionFinal.type !== 'create_tasks') {
        // Acao nao reconhecida — nao executa e avisa o usuario
        contentFinal = '⚠️ Não consegui executar essa ação (' + actionFinal.type + '). Verifique se o Apps Script está na versão mais recente e reimplante.'
        actionFinal = null
      }
    }

    return actionFinal ? { content: contentFinal, action: actionFinal } : { content: contentFinal }
  }
  if (action === 'analyze-users') {
    const users  = getAll('users')
    const byRole = {}
    users.forEach(u => {
      const role = findById('roles', u.roleId)?.name || 'Sem cargo'
      byRole[role] = (byRole[role] || 0) + 1
    })
    const prompt = `Análise de colaboradores APS Sul: ${JSON.stringify(byRole)}, total=${users.length}. JSON: {"summary":"...","highlights":["..."],"recommendation":"..."}`
    const text   = callGemini(prompt)
    const match  = text.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : {}
  }
  throw new Error('Ação de IA não encontrada')
}

function callGemini(prompt) {
  // Chama o proxy Gemini no Vercel (evita bloqueio de quota do Google Cloud)
  const proxyUrl = PropertiesService.getScriptProperties().getProperty('GEMINI_PROXY_URL')
  if (!proxyUrl) throw new Error('GEMINI_PROXY_URL não configurada nas propriedades do script')
  const res = UrlFetchApp.fetch(proxyUrl, {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify({ prompt: prompt }),
    muteHttpExceptions: true,
  })
  const data = JSON.parse(res.getContentText())
  if (data.error) throw new Error('Gemini: ' + data.error)
  return data.content || ''
}

// ─── GMAIL ────────────────────────────────────────────────────
function gmailRoute(method, id, body, me) {
  if (method === 'GET') {
    var q = body.q || 'is:unread'
    var limit = parseInt(body.limit) || 10
    var threads = GmailApp.search(q, 0, limit)
    return threads.map(function(t) {
      var msgs = t.getMessages()
      var last = msgs[msgs.length - 1]
      return {
        id: t.getId(),
        subject: t.getFirstMessageSubject() || '(sem assunto)',
        from: last.getFrom(),
        date: last.getDate().toISOString(),
        unread: t.isUnread(),
        messageCount: t.getMessageCount(),
        snippet: last.getPlainBody().substring(0, 120).replace(/\s+/g,' '),
      }
    })
  }
  if (method === 'POST') {
    var to = body.to
    if (!to) throw new Error('Destinatario obrigatorio')
    GmailApp.sendEmail(to, body.subject || '(sem assunto)', body.body || '', {
      name: 'Vinicius Felix — APS Sul',
    })
    return { success: true }
  }
  throw new Error('Metodo nao suportado')
}

// ─── GOOGLE DRIVE ─────────────────────────────────────────────
function driveRoute(method, id, body, me) {
  if (method === 'GET') {
    var q = body.q || ''
    var limit = parseInt(body.limit) || 20
    var files = q
      ? DriveApp.searchFiles('title contains "' + q + '" and trashed=false')
      : DriveApp.searchFiles('trashed=false')
    var result = []
    var count = 0
    while (files.hasNext() && count < limit) {
      var f = files.next()
      var mime = f.getMimeType()
      var icon = mime.indexOf('document') > -1 ? '📄'
               : mime.indexOf('spreadsheet') > -1 ? '📊'
               : mime.indexOf('presentation') > -1 ? '📋'
               : mime.indexOf('pdf') > -1 ? '📕'
               : mime.indexOf('image') > -1 ? '🖼️'
               : mime.indexOf('folder') > -1 ? '📁' : '📎'
      result.push({
        id: f.getId(),
        name: f.getName(),
        mimeType: mime,
        icon: icon,
        url: f.getUrl(),
        modifiedAt: f.getLastUpdated().toISOString(),
        starred: f.isStarred(),
      })
      count++
    }
    return result
  }
  if (method === 'POST' && body.type === 'folder') {
    var folder = DriveApp.createFolder(body.name || 'Nova Pasta')
    return { id: folder.getId(), name: folder.getName(), url: folder.getUrl() }
  }
  throw new Error('Metodo nao suportado')
}

// ─── GOOGLE DOCS ──────────────────────────────────────────────
function docsRoute(method, id, body, me) {
  if (method === 'POST') {
    var title = body.title || 'Novo Documento'
    var content = body.content || ''
    var doc = DocumentApp.create(title)
    var docBody = doc.getBody()
    if (content) {
      // Formata com parágrafos
      content.split('\n').forEach(function(line) {
        if (line.trim()) docBody.appendParagraph(line)
      })
    }
    doc.saveAndClose()
    return {
      id: doc.getId(),
      title: doc.getName(),
      url: 'https://docs.google.com/document/d/' + doc.getId() + '/edit',
    }
  }
  throw new Error('Metodo nao suportado')
}

// ─── GOOGLE CALENDAR ─────────────────────────────────────────
function calendarRoute(method, id, body, me) {

  if (method === 'GET') {
    var now = new Date()
    var daysAhead = parseInt(body.days || 30)
    var end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)
    var allEvents = []
    var CALENDAR_COLORS = {
      '#ac725e':'#ac725e','#d06b64':'#d06b64','#f83a22':'#f83a22',
      '#fa573c':'#fa573c','#ff7537':'#ff7537','#ffad46':'#ffad46',
      '#42d692':'#42d692','#16a765':'#16a765','#7bd148':'#7bd148',
      '#b3dc6c':'#b3dc6c','#fbe983':'#fbe983','#fad165':'#fad165',
      '#92e1c0':'#92e1c0','#9fe1e7':'#9fe1e7','#9fc6e7':'#9fc6e7',
      '#4986e7':'#4986e7','#9a9cff':'#9a9cff','#b99aff':'#b99aff',
      '#c2c2c2':'#c2c2c2','#cabdbf':'#cabdbf','#cca6ac':'#cca6ac',
      '#f691b2':'#f691b2','#cd74e6':'#cd74e6','#a47ae2':'#a47ae2',
    }
    try {
      var allCals = CalendarApp.getAllCalendars()
      allCals.forEach(function(cal) {
        try {
          var calColor = cal.getColor() || '#4285F4'
          cal.getEvents(now, end).forEach(function(e) {
            allEvents.push({
              id: e.getId(),
              title: e.getTitle(),
              start: e.getStartTime().toISOString(),
              end: e.getEndTime().toISOString(),
              description: e.getDescription() || '',
              location: e.getLocation() || '',
              allDay: e.isAllDayEvent(),
              calendarName: cal.getName(),
              calendarColor: calColor,
            })
          })
        } catch(calErr) {}
      })
    } catch(allErr) {
      // Fallback: apenas calendario padrao
      var defCal = CalendarApp.getDefaultCalendar()
      defCal.getEvents(now, end).forEach(function(e) {
        allEvents.push({
          id: e.getId(), title: e.getTitle(),
          start: e.getStartTime().toISOString(), end: e.getEndTime().toISOString(),
          description: e.getDescription() || '', location: e.getLocation() || '',
          allDay: e.isAllDayEvent(), calendarName: 'Principal', calendarColor: '#4285F4',
        })
      })
    }
    allEvents.sort(function(a, b) { return new Date(a.start) - new Date(b.start) })
    return allEvents
  }

  if (method === 'POST') {
    var cal2 = CalendarApp.getDefaultCalendar()
    var title = body.title || 'Novo evento'
    var startDate = new Date(body.start)
    var endDate = body.end ? new Date(body.end) : new Date(startDate.getTime() + 60 * 60 * 1000)
    var opts = {}
    if (body.description) opts.description = body.description
    if (body.location)    opts.location    = body.location
    var ev = cal2.createEvent(title, startDate, endDate, opts)
    return {
      id: ev.getId(),
      title: ev.getTitle(),
      start: ev.getStartTime().toISOString(),
      end: ev.getEndTime().toISOString(),
    }
  }

  if (method === 'PUT') {
    // Procura o evento em todos os calendarios
    var evToEdit = null
    var calsList = CalendarApp.getAllCalendars()
    for (var ci = 0; ci < calsList.length && !evToEdit; ci++) {
      try { evToEdit = calsList[ci].getEventById(id) } catch(e) {}
    }
    if (!evToEdit) throw new Error('Evento nao encontrado')
    if (body.title)       evToEdit.setTitle(body.title)
    if (body.description !== undefined) evToEdit.setDescription(body.description)
    if (body.location !== undefined)    evToEdit.setLocation(body.location)
    if (body.start && body.end)         evToEdit.setTime(new Date(body.start), new Date(body.end))
    return {
      id: evToEdit.getId(),
      title: evToEdit.getTitle(),
      start: evToEdit.getStartTime().toISOString(),
      end: evToEdit.getEndTime().toISOString(),
    }
  }

  if (method === 'DELETE') {
    // Procura em todos os calendarios
    var evToDelete = null
    var calsListD = CalendarApp.getAllCalendars()
    for (var di = 0; di < calsListD.length && !evToDelete; di++) {
      try { evToDelete = calsListD[di].getEventById(id) } catch(e) {}
    }
    if (evToDelete) evToDelete.deleteEvent()
    return { success: true }
  }

  throw new Error('Metodo nao suportado')
}

// ─── NOTIFICATIONS ────────────────────────────────────────────
function notificationsRoute(method, id, body, me) {
  if (method === 'GET') {
    const list = getAll('notifications').filter(n => n.userId === me.id)
    return page(list, body.limit, body.offset)
  }
  if (method === 'PUT') return updateById('notifications', id, { read: true, readAt: ts() })
  return []
}

// ══════════════════════════════════════════════════════════════
//  PROMOTORES — Avaliação de promotores de matrículas
// ══════════════════════════════════════════════════════════════
function promotoresRoute(method, id, body, me) {
  var ss = getSpreadsheet()
  if (!ss.getSheetByName('promotor_avaliacoes')) {
    var s = ss.insertSheet('promotor_avaliacoes')
    var h = ['id','promotorNome','unidade','semana','nps','persuasao','comunicacao','acrm','indicacao','posVenda','postura','notas','pontosFort','pontosAjust','recomendacao','avaliadorId','criadoEm']
    s.getRange(1,1,1,h.length).setValues([h]).setFontWeight('bold').setBackground('#1B3A6B').setFontColor('#FFFFFF')
    s.setFrozenRows(1)
  }

  if (method === 'GET') {
    var all = getAll('promotor_avaliacoes')
    if (id) return all.filter(function(a){ return a.id === id })
    if (body.promotor) return all.filter(function(a){ return a.promotorNome === body.promotor })
    if (body.unidade) return all.filter(function(a){ return a.unidade === body.unidade })
    return all
  }

  if (method === 'POST') {
    var scores = body.scores || {}
    var radar = Object.values(scores).reduce(function(a,v){ return a + (parseFloat(v)||0) }, 0)
    var count = Object.keys(scores).length
    var radarMedia = count > 0 ? Math.round((radar / count) * 10) / 10 : 0
    var aval = {
      id: uid(),
      promotorNome: body.promotorNome || '',
      unidade: body.unidade || '',
      semana: body.semana || Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-ww'),
      nps: scores.nps || 0,
      persuasao: scores.persuasao || 0,
      comunicacao: scores.comunicacao || 0,
      acrm: scores.acrm || 0,
      indicacao: scores.indicacao || 0,
      posVenda: scores.posVenda || 0,
      postura: scores.postura || 0,
      notas: body.notas || '',
      pontosFort: body.pontosFort || '',
      pontosAjust: body.pontosAjust || '',
      recomendacao: body.recomendacao || '',
      avaliadorId: me.id,
      criadoEm: ts()
    }
    insert('promotor_avaliacoes', aval)
    return aval
  }

  if (method === 'DELETE') {
    return deleteById('promotor_avaliacoes', id)
  }

  throw new Error('Metodo nao suportado')
}

// ─── SUBMISSIONS ──────────────────────────────────────────────
function submissionsRoute(method, id, body, me) {
  // Garante sheet existe
  var ss = getSpreadsheet()
  if (!ss.getSheetByName('event_submissions')) {
    var s = ss.insertSheet('event_submissions')
    var h = ['id','eventId','userId','type','fileUrl','driveFileId','fileName','mimeType','comment','submittedAt']
    s.getRange(1,1,1,h.length).setValues([h]).setFontWeight('bold').setBackground('#1B3A6B').setFontColor('#FFFFFF')
    s.setFrozenRows(1)
  }

  if (method === 'GET') {
    var list = getAll('event_submissions')
    if (body.eventId) list = list.filter(function(s) { return String(s.eventId) === String(body.eventId) })
    return list.map(function(s) { return Object.assign({}, s, { user: enrichUser(findById('users', s.userId)) }) })
  }

  if (method === 'POST') {
    var fileUrl = body.fileUrl || ''
    var driveFileId = body.driveFileId || ''
    var fileName = body.fileName || ''

    // Se vier base64, faz upload para o Drive
    if (body.fileBase64 && body.mimeType && body.fileName) {
      try {
        var folderName = 'APS EDU - Evidências'
        var folders = DriveApp.getFoldersByName(folderName)
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName)
        var blob = Utilities.newBlob(Utilities.base64Decode(body.fileBase64), body.mimeType, body.fileName)
        var driveFile = folder.createFile(blob)
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
        driveFileId = driveFile.getId()
        fileUrl = driveFile.getUrl()
        fileName = driveFile.getName()
      } catch(uploadErr) {
        throw new Error('Erro ao fazer upload: ' + uploadErr.message)
      }
    }

    var sub = {
      id: uid(),
      eventId: body.eventId || '',
      userId: me.id,
      type: body.type || (body.mimeType ? (body.mimeType.indexOf('image') >= 0 ? 'image' : body.mimeType.indexOf('video') >= 0 ? 'video' : body.mimeType.indexOf('audio') >= 0 ? 'audio' : 'file') : 'file'),
      fileUrl: fileUrl,
      driveFileId: driveFileId,
      fileName: fileName,
      mimeType: body.mimeType || '',
      comment: body.comment || '',
      submittedAt: ts(),
    }
    insert('event_submissions', sub)
    return Object.assign({}, sub, { user: enrichUser(me) })
  }

  if (method === 'DELETE') {
    var existing = findById('event_submissions', id)
    if (!existing) throw new Error('Submissão não encontrada')
    var meRole = findById('roles', me.roleId)
    var isAdmin = meRole && (meRole.slug === 'admin' || (typeof meRole.permissions === 'string' ? JSON.parse(meRole.permissions || '{}') : (meRole.permissions || {})).canManageUsers)
    if (String(existing.userId) !== String(me.id) && !isAdmin) throw new Error('Não autorizado')
    return deleteById('event_submissions', id)
  }

  throw new Error('Método não suportado')
}

// ─── UPLOAD ───────────────────────────────────────────────────
function uploadRoute(method, id, body, me) {
  if (method !== 'POST') throw new Error('Método não suportado')
  if (!body.fileBase64 || !body.mimeType || !body.fileName) throw new Error('fileBase64, mimeType e fileName são obrigatórios')

  var folderName = body.folder || 'APS EDU - Uploads'
  var folders = DriveApp.getFoldersByName(folderName)
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName)

  var blob = Utilities.newBlob(Utilities.base64Decode(body.fileBase64), body.mimeType, body.fileName)
  var driveFile = folder.createFile(blob)
  driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)

  return {
    id: driveFile.getId(),
    url: driveFile.getUrl(),
    name: driveFile.getName(),
  }
}

// ─── MEMÓRIA DA SOFI ──────────────────────────────────────────
function memoryRoute(method, id, body, me) {
  if (method === 'GET') {
    var mems = getAll('sofi_memory').filter(function(m){ return String(m.userId) === String(me.id) })
    return { memories: mems, total: mems.length }
  }
  if (method === 'POST') {
    var exists = getAll('sofi_memory').find(function(m){ return String(m.userId) === String(me.id) && m.content === body.content })
    if (exists) return exists
    var mem = { id: uid(), userId: me.id, type: body.type || 'fato', content: body.content || '', importance: body.importance || 'medium', createdAt: ts() }
    insert('sofi_memory', mem)
    return mem
  }
  if (method === 'DELETE') return deleteById('sofi_memory', id)
  throw new Error('Método não suportado')
}

// ─── BASE DE CONHECIMENTO ─────────────────────────────────────
function knowledgeRoute(method, id, body, me) {
  if (method === 'GET') {
    var items = getAll('knowledge_base').filter(function(k){ return String(k.userId) === String(me.id) })
    // Retorna sem o campo 'content' completo para não pesar (só summary)
    return { items: items.map(function(k){ return { id:k.id, fileName:k.fileName, mimeType:k.mimeType, summary:k.summary, tags:k.tags, uploadedAt:k.uploadedAt } }), total: items.length }
  }
  if (method === 'POST') {
    var kbExists = getAll('knowledge_base').find(function(k){ return String(k.userId) === String(me.id) && k.fileName === body.fileName })
    if (kbExists) {
      return updateById('knowledge_base', kbExists.id, { content: (body.content||'').substring(0,5000), summary: body.summary||'', tags: body.tags||'', uploadedAt: ts() })
    }
    var item = { id: uid(), userId: me.id, fileName: body.fileName||'doc', mimeType: body.mimeType||'text/plain', content: (body.content||'').substring(0,5000), summary: body.summary||'', tags: body.tags||'', uploadedAt: ts() }
    insert('knowledge_base', item)
    return item
  }
  if (method === 'DELETE') return deleteById('knowledge_base', id)
  throw new Error('Método não suportado')
}

// ══════════════════════════════════════════════════════════════
//  AUTOMATIONS ROUTE
// ══════════════════════════════════════════════════════════════
function automationsRoute(method, id, body, me) {
  if (method === 'GET') {
    var rules = getAll('automations').filter(function(r) {
      return String(r.userId) === String(me.id) || me.role === 'admin'
    })
    return { automations: rules, total: rules.length }
  }
  if (method === 'POST') {
    var rule = {
      id: makeId(), userId: me.id,
      name: body.name || 'Nova automação',
      trigger: body.trigger || '',
      condition: body.condition || 'any',
      action: body.action || '',
      active: true,
      runs: 0,
      createdAt: new Date().toISOString(),
    }
    insert('automations', rule)
    return rule
  }
  if (method === 'PUT' && id) {
    var existing = findById('automations', id)
    if (!existing) throw new Error('Automação não encontrada')
    var updated = Object.assign({}, existing, body, { id: id })
    update('automations', id, updated)
    return updated
  }
  if (method === 'DELETE' && id) {
    remove('automations', id)
    return { success: true }
  }
  return {}
}

// ══════════════════════════════════════════════════════════════
//  ANALYTICS ROUTE — dados agregados para analytics preditivo
// ══════════════════════════════════════════════════════════════
function analyticsRoute(method, id, body, me) {
  if (method === 'GET' && id === 'summary') {
    var tasks  = getAll('tasks')
    var events = getAll('events')
    var users  = getAll('users').filter(function(u) { return u.status !== 'inactive' })
    var gam    = getAll('gamification')

    var now    = new Date()
    var week   = new Date(now.getTime() - 7 * 86400000)
    var month  = new Date(now.getTime() - 30 * 86400000)

    // Weekly task completion rate
    var recentTasks   = tasks.filter(function(t) { return new Date(t.createdAt) >= week })
    var recentDone    = recentTasks.filter(function(t) { return t.status === 'completed' })
    var completionRate = recentTasks.length > 0 ? Math.round((recentDone.length / recentTasks.length) * 100) : 0

    // Engagement score (avg points per active user)
    var totalPoints = gam.reduce(function(a, g) { return a + (Number(g.points) || 0) }, 0)
    var avgPoints   = users.length > 0 ? Math.round(totalPoints / users.length) : 0

    // Trend: compare this week vs last week
    var lastWeek    = new Date(now.getTime() - 14 * 86400000)
    var prevTasks   = tasks.filter(function(t) { var d = new Date(t.createdAt); return d >= lastWeek && d < week })
    var prevDone    = prevTasks.filter(function(t) { return t.status === 'completed' })
    var prevRate    = prevTasks.length > 0 ? Math.round((prevDone.length / prevTasks.length) * 100) : 0
    var trend       = completionRate - prevRate

    return {
      completionRate: completionRate,
      completionTrend: trend,
      avgEngagement: avgPoints,
      totalUsers: users.length,
      overdueCount: tasks.filter(function(t) { return t.status === 'overdue' }).length,
      upcomingEvents: events.filter(function(ev) {
        var d = new Date(ev.startDate || ev.date || '')
        return d >= now && d <= new Date(now.getTime() + 7 * 86400000)
      }).length,
      recentActivity: recentTasks.length,
    }
  }
  return {}
}

// ══════════════════════════════════════════════════════════════
//  SETUP — Execute uma vez para inicializar a planilha
// ══════════════════════════════════════════════════════════════
function setupSpreadsheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()

  const schemas = {
    users:              ['id','name','email','password','roleId','unitId','isActive','avatarUrl','phone','department','createdAt'],
    roles:              ['id','name','slug','permissions'],
    units:              ['id','name','city','type','region','createdAt'],
    tasks:              ['id','title','description','status','priority','dueDate','assigneeId','createdById','unitId','createdAt','updatedAt'],
    events:             ['id','title','description','date','endDate','location','status','unitId','createdById','coverImage','assignedUserIds','allowAttachments','createdAt'],
    event_submissions:  ['id','eventId','userId','type','fileUrl','driveFileId','fileName','mimeType','comment','submittedAt'],
    announcements:      ['id','title','content','type','authorId','targetRoleIds','targetUnitIds','expiresAt','createdAt'],
    announcement_reads: ['id','announcementId','userId','readAt'],
    feedback:           ['id','content','category','status','isAnonymous','userId','createdAt'],
    user_points:        ['id','userId','points','level','updatedAt'],
    badges:             ['id','name','description','icon','level','requiredPoints','createdAt'],
    user_badges:        ['id','userId','badgeId','grantedAt','grantedBy'],
    sessions:           ['token','userId','expiresAt','createdAt'],
    notifications:      ['id','userId','title','message','type','read','readAt','createdAt'],
    sofi_memory:        ['id','userId','type','content','importance','createdAt'],
    knowledge_base:     ['id','userId','fileName','mimeType','content','summary','tags','uploadedAt'],
    automations:        ['id','userId','name','trigger','condition','action','active','runs','lastRun','createdAt'],
  }

  Object.entries(schemas).forEach(([name, headers]) => {
    let sheet = spreadsheet.getSheetByName(name)
    if (!sheet) sheet = spreadsheet.insertSheet(name)
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers])
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#1B3A6B')
        .setFontColor('#FFFFFF')
      sheet.setFrozenRows(1)
      sheet.setColumnWidths(1, headers.length, 160)
    }
  })

  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheet.getId())
  Logger.log('Planilha configurada! ID: ' + spreadsheet.getId())
  setupRoles_()
  setupUnits_()
  setupAdminUser_()
  setupBadges_()
  Logger.log('Setup completo! Login: admin@aps.edu.br / admin123')
}

function setupRoles_() {
  const existingRoles = getAll('roles')
  const existingSlugs = existingRoles.map(function(r) { return r.slug })

  const allRoles = [
    ['admin',              'Administrador',                   JSON.stringify({ canCreateTasks:true, canCreateEvents:true, canPublishAnnouncements:true, canViewAllData:true, canManageUsers:true, canViewReports:true, canGrantBadges:true, canManageDepartment:true })],
    ['director',           'Diretor',                         JSON.stringify({ canCreateTasks:true, canCreateEvents:true, canPublishAnnouncements:true, canViewAllData:true, canManageUsers:false, canViewReports:true, canGrantBadges:true })],
    ['vice_director',      'Vice-Diretor',                    JSON.stringify({ canCreateTasks:true, canCreateEvents:true, canPublishAnnouncements:true, canViewAllData:false, canManageUsers:false, canViewReports:true, canGrantBadges:false })],
    ['coordinator',        'Coordenador',                     JSON.stringify({ canCreateTasks:true, canCreateEvents:false, canPublishAnnouncements:false, canViewAllData:false, canManageUsers:false, canViewReports:false, canGrantBadges:false })],
    ['chaplain',           'Capelão',                         JSON.stringify({ canCreateTasks:false, canCreateEvents:true, canPublishAnnouncements:true, canViewAllData:false, canManageUsers:false, canViewReports:false, canGrantBadges:true })],
    ['treasurer',          'Tesoureiro',                      JSON.stringify({ canCreateTasks:false, canCreateEvents:false, canPublishAnnouncements:false, canViewAllData:true, canManageUsers:false, canViewReports:true, canGrantBadges:false })],
    ['disciplinary',       'Disciplinar',                     JSON.stringify({ canCreateTasks:true, canCreateEvents:false, canPublishAnnouncements:false, canViewAllData:false, canManageUsers:false, canViewReports:false, canGrantBadges:false })],
    ['counselor',          'Orientador',                      JSON.stringify({ canCreateTasks:false, canCreateEvents:false, canPublishAnnouncements:false, canViewAllData:false, canManageUsers:false, canViewReports:false, canGrantBadges:false })],
    ['secretary',          'Secretário',                      JSON.stringify({ canCreateTasks:false, canCreateEvents:false, canPublishAnnouncements:false, canViewAllData:false, canManageUsers:false, canViewReports:false, canGrantBadges:false })],
    // Líderes departamentais
    ['dept_education',     'Departamental de Educação',        JSON.stringify({ canCreateTasks:true, canCreateEvents:true, canPublishAnnouncements:true, canViewAllData:true, canManageUsers:true, canViewReports:true, canGrantBadges:true, canManageDepartment:true })],
    ['coord_marketing',    'Coordenador de Marketing',         JSON.stringify({ canCreateTasks:true, canCreateEvents:true, canPublishAnnouncements:true, canViewAllData:true, canManageUsers:true, canViewReports:true, canGrantBadges:true, canManageDepartment:true })],
    ['coord_pedagogical',  'Coordenação Pedagógica',           JSON.stringify({ canCreateTasks:true, canCreateEvents:true, canPublishAnnouncements:true, canViewAllData:false, canManageUsers:false, canViewReports:true, canGrantBadges:false, canManageDepartment:true })],
    ['coord_projects',     'Coordenadora de Projetos',         JSON.stringify({ canCreateTasks:true, canCreateEvents:true, canPublishAnnouncements:true, canViewAllData:false, canManageUsers:false, canViewReports:true, canGrantBadges:false, canManageDepartment:true })],
    ['coord_inclusion',    'Coordenador de Inclusão',          JSON.stringify({ canCreateTasks:true, canCreateEvents:true, canPublishAnnouncements:true, canViewAllData:false, canManageUsers:false, canViewReports:true, canGrantBadges:false, canManageDepartment:true })],
    ['leader_callcenter',  'Líder Callcenter/Promotores',      JSON.stringify({ canCreateTasks:true, canCreateEvents:true, canPublishAnnouncements:false, canViewAllData:false, canManageUsers:false, canViewReports:true, canGrantBadges:false, canManageDepartment:true })],
    ['coord_it',           'Coordenador de TI',                JSON.stringify({ canCreateTasks:true, canCreateEvents:true, canPublishAnnouncements:false, canViewAllData:false, canManageUsers:false, canViewReports:true, canGrantBadges:false, canManageDepartment:true })],
    ['coord_chaplaincy',   'Coordenador de Capelania',         JSON.stringify({ canCreateTasks:true, canCreateEvents:true, canPublishAnnouncements:true, canViewAllData:false, canManageUsers:false, canViewReports:true, canGrantBadges:false, canManageDepartment:true })],
  ]

  var inserted = 0
  allRoles.forEach(function(roleData) {
    var slug = roleData[0], name = roleData[1], permissions = roleData[2]
    if (existingSlugs.indexOf(slug) === -1) {
      insert('roles', { id: uid(), name: name, slug: slug, permissions: permissions })
      inserted++
    }
  })
  if (inserted > 0) Logger.log(inserted + ' novos cargos inseridos')
  else Logger.log('Cargos já existiam — nenhum novo inserido')
}

function setupUnits_() {
  if (getAll('units').length > 0) return
  const units = [
    { id: uid(), name: 'Sede APS Sul', city: 'Curitiba', type: 'headquarters', region: 'PR', createdAt: ts() },
  ]
  units.forEach(u => insert('units', u))
  Logger.log('Unidade sede inserida')
}

function setupAdminUser_() {
  if (getAll('users').length > 0) return
  const adminRole = getAll('roles').find(r => r.slug === 'admin')
  const hqUnit    = getAll('units').find(u => u.type === 'headquarters')
  const user = {
    id: uid(), name: 'Administrador APS', email: 'admin@aps.edu.br',
    password: hashPwd('admin123'), roleId: adminRole?.id || '',
    unitId: hqUnit?.id || '', isActive: true, avatarUrl: '', phone: '', createdAt: ts(),
  }
  insert('users', user)
  insert('user_points', { id: uid(), userId: user.id, points: 500, level: 3, updatedAt: ts() })
  Logger.log('Admin criado: admin@aps.edu.br / admin123')
}

// ══════════════════════════════════════════════════════════════
//  RESET ADMIN — Edite e execute para trocar email/senha do admin
// ══════════════════════════════════════════════════════════════
function resetAdmin() {
  // ↓↓↓ EDITE AQUI ↓↓↓
  const NOVO_EMAIL = 'engenhariatotal.vinicius@gmail.com'
  const NOVA_SENHA = '@PS2025*'
  const NOVO_NOME  = 'Vinicius Felix'
  // ↑↑↑ EDITE AQUI ↑↑↑

  const users = getAll('users')
  const admin = users.find(u => u.roleId && getAll('roles').find(r => r.id === u.roleId && r.slug === 'admin'))

  if (!admin) {
    Logger.log('ERRO: Admin nao encontrado')
    return
  }

  updateById('users', admin.id, {
    email:    NOVO_EMAIL,
    password: hashPwd(NOVA_SENHA),
    name:     NOVO_NOME,
  })

  // Limpa sessões antigas
  const sheet = getSpreadsheet().getSheetByName('sessions')
  if (sheet && sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent()
  }

  Logger.log('Admin atualizado com sucesso!')
  Logger.log('Email: ' + NOVO_EMAIL)
  Logger.log('Senha: ' + NOVA_SENHA)
}

function setupBadges_() {
  if (getAll('badges').length > 0) return
  const badges = [
    { name: 'Primeiro Acesso',    icon: '🌟', level: 'bronze',   requiredPoints: 0    },
    { name: 'Colaborador Ativo',  icon: '✅', level: 'silver',   requiredPoints: 50   },
    { name: 'Evangelista Digital',icon: '📢', level: 'silver',   requiredPoints: 100  },
    { name: 'Líder Inspirador',   icon: '🏆', level: 'gold',     requiredPoints: 300  },
    { name: 'Mestre Adventista',  icon: '👑', level: 'platinum', requiredPoints: 1000 },
  ]
  badges.forEach(b => insert('badges', {
    id: uid(), ...b,
    description: 'Conquista da rede APS EDU Sul', createdAt: ts(),
  }))
  Logger.log(badges.length + ' selos inseridos')
}

// ══════════════════════════════════════════════════════════════
//  SETUP LÍDERES DEPARTAMENTAIS — Execute manualmente uma vez
// ══════════════════════════════════════════════════════════════
function setupDepartmentLeaders() {
  // Garante que a coluna department existe na sheet users
  var ss = getSpreadsheet()
  var usersSheet = ss.getSheetByName('users')
  if (usersSheet) {
    var headers = usersSheet.getRange(1, 1, 1, usersSheet.getLastColumn()).getValues()[0]
    if (headers.indexOf('department') === -1) {
      usersSheet.getRange(1, headers.length + 1).setValue('department')
        .setFontWeight('bold').setBackground('#1B3A6B').setFontColor('#FFFFFF')
      Logger.log('Coluna department adicionada à sheet users')
    }
  }

  // Garante que setupRoles_ rodou
  setupRoles_()

  var roles = getAll('roles')
  var existingUsers = getAll('users')

  var leaders = [
    { name: 'Heber Ceribelli',       email: 'heber.ceribelli@adventistas.org',        roleSlug: 'dept_education',    department: 'educacao' },
    { name: 'Vinicius Andrade',      email: 'engenhariatotal.vinicius@gmail.com',       roleSlug: 'coord_marketing',   department: 'marketing' },
    { name: 'Elaine Balancieri',     email: 'elaine.balancieri@adventistas.org',        roleSlug: 'coord_pedagogical', department: 'pedagogico_em' },
    { name: 'Ellen Meire',           email: 'ellen.meire@adventistas.org',              roleSlug: 'coord_pedagogical', department: 'pedagogico_ei' },
    { name: 'Raquel Justino',        email: 'raquel.justino@adventistas.org',           roleSlug: 'coord_projects',    department: 'projetos' },
    { name: 'Fábio Lira',            email: 'fabio.lira@adventistas.org',               roleSlug: 'coord_inclusion',   department: 'inclusao' },
    { name: 'Jakelina Araújo',       email: 'jakelina.araujo@adventistas.org',          roleSlug: 'leader_callcenter', department: 'callcenter' },
    { name: 'Robson Silva',          email: 'robson.silva@adventistas.org',             roleSlug: 'coord_it',          department: 'ti' },
    { name: 'Pr. Rodrigo Rodrigues', email: 'rodrigo.rodrigues@adventistas.org',        roleSlug: 'coord_chaplaincy',  department: 'capelania' },
  ]

  var created = 0, updated = 0
  leaders.forEach(function(leader) {
    var role = roles.find(function(r) { return r.slug === leader.roleSlug })
    if (!role) { Logger.log('AVISO: Role não encontrada: ' + leader.roleSlug); return }

    var existing = existingUsers.find(function(u) { return u.email === leader.email })
    if (existing) {
      updateById('users', existing.id, {
        name: leader.name,
        roleId: role.id,
        department: leader.department,
        isActive: true,
      })
      Logger.log('Atualizado: ' + leader.name + ' (' + leader.email + ')')
      updated++
    } else {
      var newUser = {
        id: uid(),
        name: leader.name,
        email: leader.email,
        password: hashPwd('APS2025@'),
        roleId: role.id,
        unitId: '',
        isActive: true,
        avatarUrl: '',
        phone: '',
        department: leader.department,
        createdAt: ts(),
      }
      insert('users', newUser)
      insert('user_points', { id: uid(), userId: newUser.id, points: 0, level: 1, updatedAt: ts() })
      Logger.log('Criado: ' + leader.name + ' (' + leader.email + ')')
      created++
    }
  })

  Logger.log('setupDepartmentLeaders concluído: ' + created + ' criados, ' + updated + ' atualizados')
  Logger.log('Senha padrão: APS2025@')
}

// ══════════════════════════════════════════════════════════════
//  PERSONAL WORKSPACE — Tarefas pessoais do admin
// ══════════════════════════════════════════════════════════════
function personalRoute(method, id, body, me) {
  // Garante que a sheet personal_tasks existe
  var ss = getSpreadsheet()
  if (!ss.getSheetByName('personal_tasks')) {
    var s = ss.insertSheet('personal_tasks')
    var h = ['id','userId','title','category','duration','status','priority','notes','dueDate','completedAt','xp','streak','createdAt']
    s.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#1B3A6B').setFontColor('#FFFFFF')
    s.setFrozenRows(1)
  }

  if (method === 'GET') {
    var tasks = getAll('personal_tasks').filter(function(t){ return String(t.userId) === String(me.id) })
    var stats = { totalXp: 0, doneTodayCount: 0, streakDays: 0 }
    var today = new Date().toDateString()
    tasks.forEach(function(t) {
      if (t.status === 'done') {
        stats.totalXp += parseInt(t.xp) || 0
        if (t.completedAt && new Date(t.completedAt).toDateString() === today) stats.doneTodayCount++
      }
    })
    return { tasks: tasks, stats: stats }
  }

  if (method === 'POST') {
    var dur = parseInt(body.duration) || 30
    var task = {
      id: uid(),
      userId: me.id,
      title: body.title || 'Nova tarefa',
      category: body.category || 'trabalho',
      duration: dur,
      status: 'pending',
      priority: body.priority || 'medium',
      notes: body.notes || '',
      dueDate: body.dueDate || '',
      completedAt: '',
      xp: Math.max(5, Math.ceil(dur / 15) * 5),
      streak: 0,
      createdAt: ts()
    }
    insert('personal_tasks', task)
    return task
  }

  if (method === 'PUT') {
    var existing = findById('personal_tasks', id)
    if (!existing || String(existing.userId) !== String(me.id)) throw new Error('Tarefa nao encontrada')
    var upd = {}
    if (body.title    !== undefined) upd.title    = body.title
    if (body.status   !== undefined) upd.status   = body.status
    if (body.priority !== undefined) upd.priority = body.priority
    if (body.notes    !== undefined) upd.notes    = body.notes
    if (body.dueDate  !== undefined) upd.dueDate  = body.dueDate
    if (body.duration !== undefined) { upd.duration = parseInt(body.duration); upd.xp = Math.max(5, Math.ceil(upd.duration / 15) * 5) }
    if (body.status === 'done' && !existing.completedAt) upd.completedAt = ts()
    if (body.status === 'pending') upd.completedAt = ''
    return updateById('personal_tasks', id, upd)
  }

  if (method === 'DELETE') {
    var toDelete = findById('personal_tasks', id)
    if (!toDelete || String(toDelete.userId) !== String(me.id)) throw new Error('Tarefa nao encontrada')
    return deleteById('personal_tasks', id)
  }

  throw new Error('Metodo nao suportado')
}

// ══════════════════════════════════════════════════════════════
//  BACKUP AUTOMÁTICO — Cópia semanal do banco de dados
//  Execute setupBackupTrigger() UMA VEZ pelo editor do Apps Script
//  para agendar o backup toda segunda-feira às 03:00.
// ══════════════════════════════════════════════════════════════

/**
 * Cria uma cópia da planilha principal com timestamp no nome.
 * Mantém no máximo as últimas 8 cópias para não ocupar Drive.
 * Chamada automaticamente pelo trigger semanal.
 */
function backupSpreadsheet() {
  var ss   = getSpreadsheet()
  var name = ss.getName()
  var now  = new Date()
  var stamp = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd')
  var copy  = ss.copy('[BACKUP ' + stamp + '] ' + name)

  // Move para pasta "APS EDU Backups" (cria se não existir)
  var folderName = 'APS EDU Backups'
  var folders = DriveApp.getFoldersByName(folderName)
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName)
  DriveApp.getFileById(copy.getId()).moveTo(folder)

  // Remove backups mais antigos se passar de 8
  var files = folder.getFiles()
  var list = []
  while (files.hasNext()) { list.push(files.next()) }
  list.sort(function(a, b) { return a.getDateCreated() - b.getDateCreated() })
  while (list.length > 8) {
    list.shift().setTrashed(true)
  }

  Logger.log('Backup criado: ' + copy.getName())
}

/**
 * Agenda backupSpreadsheet() toda segunda-feira às 03:00.
 * Execute esta função UMA VEZ manualmente no editor do Apps Script.
 */
function setupBackupTrigger() {
  // Remove triggers duplicados de backup se existirem
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'backupSpreadsheet') {
      ScriptApp.deleteTrigger(t)
    }
  })
  ScriptApp.newTrigger('backupSpreadsheet')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(3)
    .create()
  Logger.log('Trigger de backup semanal configurado com sucesso!')
}
