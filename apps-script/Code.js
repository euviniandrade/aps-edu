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
    case 'ai':            return aiRoute(method, id, body)
    case 'notifications': return notificationsRoute(method, id, body, me)
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
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
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
    const u = findById('users', id)
    if (!u) throw new Error('Usuário não encontrado')
    return enrichUser(u)
  }
  if (method === 'POST') {
    if (getAll('users').find(u => u.email === body.email)) throw new Error('E-mail já cadastrado')
    const user = {
      id: uid(), name: body.name, email: body.email,
      password: hashPwd(body.password || 'aps123'),
      roleId: body.roleId || '', unitId: body.unitId || '',
      isActive: true, avatarUrl: '', phone: body.phone || '', createdAt: ts(),
    }
    insert('users', user)
    insert('user_points', { id: uid(), userId: user.id, points: 0, level: 1, updatedAt: ts() })
    return enrichUser(user)
  }
  if (method === 'PUT') {
    const upd = {}
    ;['name','email','roleId','unitId','phone','isActive','avatarUrl'].forEach(k => {
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
      dueDate: body.dueDate || '', assigneeId: body.assigneeId || '',
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
    return updateById('tasks', id, upd)
  }
  if (method === 'DELETE') return deleteById('tasks', id)
  throw new Error('Método não suportado')
}

// ─── EVENTS ───────────────────────────────────────────────────
function eventsRoute(method, id, body, me) {
  if (method === 'GET' && !id) {
    let list = getAll('events')
    if (body.status) list = list.filter(e => e.status === body.status)
    if (body.unitId) list = list.filter(e => e.unitId === body.unitId)
    return page(list, body.limit, body.offset).map(ev => ({
      ...ev, unit: ev.unitId ? findById('units', ev.unitId) : null,
    }))
  }
  if (method === 'GET') return findById('events', id)
  if (method === 'POST') {
    const ev = {
      id: uid(), title: body.title, description: body.description || '',
      date: body.date || '', endDate: body.endDate || '',
      location: body.location || '', status: body.status || 'planned',
      unitId: body.unitId || '', createdById: me.id,
      coverImage: body.coverImage || '', createdAt: ts(),
    }
    insert('events', ev)
    return ev
  }
  if (method === 'PUT') {
    const upd = {}
    ;['title','description','date','endDate','location','status','unitId','coverImage'].forEach(k => {
      if (body[k] !== undefined) upd[k] = body[k]
    })
    return updateById('events', id, upd)
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
  throw new Error('Relatório não encontrado')
}

// ─── AI (Gemini) ──────────────────────────────────────────────
function aiRoute(method, action, body) {
  if (action === 'insights') {
    const users     = getAll('users')
    const tasks     = getAll('tasks')
    const events    = getAll('events')
    const feedbacks = getAll('feedback')
    const tStatus   = {}
    tasks.forEach(t => { tStatus[t.status] = (tStatus[t.status] || 0) + 1 })
    const prompt = `Consultor de gestão educacional da rede adventista APS Sul.
Dados: colaboradores ativos=${users.filter(u=>u.isActive!==false).length}, tarefas=${JSON.stringify(tStatus)}, eventos futuros=${events.filter(e=>new Date(e.date)>new Date()).length}, feedbacks pendentes=${feedbacks.filter(f=>f.status==='pending').length}
Retorne APENAS JSON (sem markdown): {"insights":[{"title":"max 45 chars","description":"max 120 chars","priority":"high|medium|low","icon":"emoji"}]}`
    const text  = callGemini(prompt)
    const match = text.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : { insights: [] }
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
    const { messages } = body
    if (!messages?.length) throw new Error('Mensagens obrigatórias')
    const ctx = {
      usuarios: getAll('users').filter(u => u.isActive !== false).length,
      tarefas:  getAll('tasks').length,
      unidades: getAll('units').length,
    }
    const history = messages.slice(0, -1)
      .map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`)
      .join('\n')
    const last = messages[messages.length - 1].content
    const prompt = `Assistente IA da plataforma APS EDU Sul (rede adventista). Português, conciso, profissional.
Contexto: ${JSON.stringify(ctx)}
${history ? 'Histórico:\n' + history + '\n' : ''}Usuário: ${last}
Assistente:`
    return { content: callGemini(prompt) }
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
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')
  if (!key) throw new Error('GEMINI_API_KEY não configurada nas propriedades do script')
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + key
  const res = UrlFetchApp.fetch(url, {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    }),
    muteHttpExceptions: true,
  })
  const data = JSON.parse(res.getContentText())
  if (data.error) throw new Error('Gemini: ' + data.error.message)
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
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
//  SETUP — Execute uma vez para inicializar a planilha
// ══════════════════════════════════════════════════════════════
function setupSpreadsheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()

  const schemas = {
    users:              ['id','name','email','password','roleId','unitId','isActive','avatarUrl','phone','createdAt'],
    roles:              ['id','name','slug','permissions'],
    units:              ['id','name','city','type','region','createdAt'],
    tasks:              ['id','title','description','status','priority','dueDate','assigneeId','createdById','unitId','createdAt','updatedAt'],
    events:             ['id','title','description','date','endDate','location','status','unitId','createdById','coverImage','createdAt'],
    announcements:      ['id','title','content','type','authorId','targetRoleIds','targetUnitIds','expiresAt','createdAt'],
    announcement_reads: ['id','announcementId','userId','readAt'],
    feedback:           ['id','content','category','status','isAnonymous','userId','createdAt'],
    user_points:        ['id','userId','points','level','updatedAt'],
    badges:             ['id','name','description','icon','level','requiredPoints','createdAt'],
    user_badges:        ['id','userId','badgeId','grantedAt','grantedBy'],
    sessions:           ['token','userId','expiresAt','createdAt'],
    notifications:      ['id','userId','title','message','type','read','readAt','createdAt'],
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
  if (getAll('roles').length > 0) return
  const roles = [
    ['admin',         'Administrador', JSON.stringify({ canCreateTasks:true, canCreateEvents:true, canPublishAnnouncements:true, canViewAllData:true, canManageUsers:true, canViewReports:true, canGrantBadges:true })],
    ['director',      'Diretor',       JSON.stringify({ canCreateTasks:true, canCreateEvents:true, canPublishAnnouncements:true, canViewAllData:true, canManageUsers:false, canViewReports:true, canGrantBadges:true })],
    ['vice_director', 'Vice-Diretor',  JSON.stringify({ canCreateTasks:true, canCreateEvents:true, canPublishAnnouncements:true, canViewAllData:false, canManageUsers:false, canViewReports:true, canGrantBadges:false })],
    ['coordinator',   'Coordenador',   JSON.stringify({ canCreateTasks:true, canCreateEvents:false, canPublishAnnouncements:false, canViewAllData:false, canManageUsers:false, canViewReports:false, canGrantBadges:false })],
    ['chaplain',      'Capelão',       JSON.stringify({ canCreateTasks:false, canCreateEvents:true, canPublishAnnouncements:true, canViewAllData:false, canManageUsers:false, canViewReports:false, canGrantBadges:true })],
    ['treasurer',     'Tesoureiro',    JSON.stringify({ canCreateTasks:false, canCreateEvents:false, canPublishAnnouncements:false, canViewAllData:true, canManageUsers:false, canViewReports:true, canGrantBadges:false })],
    ['disciplinary',  'Disciplinar',   JSON.stringify({ canCreateTasks:true, canCreateEvents:false, canPublishAnnouncements:false, canViewAllData:false, canManageUsers:false, canViewReports:false, canGrantBadges:false })],
    ['counselor',     'Orientador',    JSON.stringify({ canCreateTasks:false, canCreateEvents:false, canPublishAnnouncements:false, canViewAllData:false, canManageUsers:false, canViewReports:false, canGrantBadges:false })],
    ['secretary',     'Secretário',    JSON.stringify({ canCreateTasks:false, canCreateEvents:false, canPublishAnnouncements:false, canViewAllData:false, canManageUsers:false, canViewReports:false, canGrantBadges:false })],
  ]
  roles.forEach(([slug, name, permissions]) => insert('roles', { id: uid(), name, slug, permissions }))
  Logger.log(roles.length + ' cargos inseridos')
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
  const NOVO_EMAIL = 'SEU_EMAIL@AQUI.COM'
  const NOVA_SENHA = 'SUA_SENHA_AQUI'
  const NOVO_NOME  = 'Seu Nome Aqui'
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
