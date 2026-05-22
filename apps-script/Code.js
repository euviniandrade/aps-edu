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
    case 'calendar':      return calendarRoute(method, id, body, me)
    case 'gmail':         return gmailRoute(method, id, body, me)
    case 'drive':         return driveRoute(method, id, body, me)
    case 'docs':          return docsRoute(method, id, body, me)
    case 'notifications': return notificationsRoute(method, id, body, me)
    case 'personal':      return personalRoute(method, id, body, me)
    case 'promotores':    return promotoresRoute(method, id, body, me)
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
    const ativos  = users.filter(function(u){ return u.isActive !== false }).length
    const futuros = events.filter(function(e){ return new Date(e.date) > new Date() }).length
    const pend    = feedbacks.filter(function(f){ return f.status === 'pending' }).length
    const prompt  = 'Voce e um consultor de gestao educacional adventista. '
                  + 'Dados da plataforma APS Sul: colaboradores ativos=' + ativos
                  + ', status das tarefas=' + JSON.stringify(tStatus)
                  + ', eventos futuros=' + futuros
                  + ', feedbacks pendentes=' + pend + '. '
                  + 'Gere exatamente 3 insights de gestao. '
                  + 'Responda APENAS com JSON puro, sem markdown, sem explicacao: '
                  + '{"insights":[{"title":"titulo curto","description":"descricao util","priority":"high","icon":"emoji"},...]}'
    var rawText = callGemini(prompt)
    // remove possivel markdown ```json ... ```
    var clean = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    var match  = clean.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Gemini nao retornou JSON valido. Resposta: ' + rawText.slice(0, 200))
    try {
      return JSON.parse(match[0])
    } catch (parseErr) {
      throw new Error('Erro ao parsear JSON do Gemini: ' + parseErr.message + ' | Raw: ' + rawText.slice(0, 200))
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

    var system = 'Voce e Sofi, assistente pessoal inteligente de Vinicius Felix, coordenador de marketing e captacao da Educacao Adventista APS Sul. '
      + 'Seja prestativa, direta, organizada e motivadora. Use linguagem profissional mas amigavel. Responda SEMPRE em portugues brasileiro.\n\n'
      + 'DATA/HORA ATUAL: ' + dateStr + ', ' + timeStr + '\n\n'

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

    // Emails reais do Gmail como contexto
    try {
      var gmailThreads = GmailApp.search('is:unread', 0, 5)
      if (gmailThreads.length > 0) {
        system += 'EMAILS NAO LIDOS (' + gmailThreads.length + '):\n'
        gmailThreads.forEach(function(t) {
          var last = t.getMessages()[t.getMessageCount()-1]
          system += '- De: ' + last.getFrom().replace(/<.*>/,'').trim()
            + ' | Assunto: ' + t.getFirstMessageSubject() + '\n'
        })
        system += '\n'
      }
    } catch(e) {}

    system += 'CAMPANHA DE MATRICULAS APS SUL 2026/2027:\n'
      + '- Meta: 17.000 alunos | 14 unidades | Captacao 50%, Fidelizacao 30%, Resgate 20%\n'
      + '- Risco ALTO: CACLI I, CAIS, CAP, EACF, EAP, EATW\n'
      + '- Risco MEDIO: CACLI II, CAEGW, EAA | Risco BAIXO: CAEA, CAR, CATS, EAJL, EAVB\n\n'

    system += 'REGRAS OBRIGATORIAS:\n'
      + '1. Respostas CURTAS: max 3 linhas. Sem enrolacao.\n'
      + '2. NUNCA mostre JSON no texto. JSON e so para acoes internas.\n'
      + '3. Quando executar uma acao, confirme em UMA linha: "✅ Feito!" ou "📅 Agendado!" etc.\n'
      + '4. Use SOMENTE dados que o usuario forneceu. NUNCA invente emails, nomes, datas ou assuntos.\n'
      + '5. Se faltar informacao para executar uma acao (ex: email sem destinatario, evento sem data), PERGUNTE antes de agir.\n'
      + '6. Para enviar email: so execute se o usuario informou o destinatario REAL na mensagem.\n'
      + '7. Para criar evento: so execute se o usuario informou data e titulo REAIS na mensagem.\n\n'

    system += 'ACOES DISPONIVEIS - responda APENAS com JSON quando detectar intencao de acao:\n'
      + 'Atualizar horario fim de trabalho: {"content":"✅ Horário atualizado para HH:MM!","action":{"type":"update_workday","data":{"endHour":16,"endMin":0}}}\n'
      + 'Criar tarefa: {"content":"✅ Tarefa criada!","action":{"type":"create_task","data":{"title":"...","priority":"high|medium|low","duration":30,"category":"trabalho|campanha|pessoal","dueDate":"YYYY-MM-DD"}}}\n'
      + 'Criar evento: {"content":"📅 Agendado!","action":{"type":"create_event","data":{"title":"...","start":"YYYY-MM-DDTHH:mm:ss","end":"YYYY-MM-DDTHH:mm:ss","description":"..."}}}\n'
      + 'Enviar email: {"content":"📧 Email enviado para X!","action":{"type":"send_email","data":{"to":"...","subject":"...","body":"..."}}}\n'
      + 'Criar doc: {"content":"📄 Documento criado!","action":{"type":"create_doc","data":{"title":"...","content":"..."}}}\n'

    var historyLines = messages.slice(0, -1).map(function(m){
      return (m.role === 'user' ? 'Vinicius' : 'Sofi') + ': ' + m.content
    }).join('\n')

    var lastMsg = messages[messages.length - 1].content
    var fullPrompt = system
      + (historyLines ? 'HISTORICO:\n' + historyLines + '\n\n' : '')
      + 'Vinicius: ' + lastMsg + '\nSofi (resposta curta e direta):'

    var response = callGemini(fullPrompt)
    if (!response || response.trim() === '') {
      var hour2 = new Date().getHours()
      var grt = hour2 < 12 ? 'Bom dia' : hour2 < 18 ? 'Boa tarde' : 'Boa noite'
      response = grt + ', ' + (context.userName || 'Vinicius') + '! Sou a Sofi. Como posso ajudar?'
    }

    // Extrai JSON com action de qualquer parte da resposta
    var contentFinal = response.replace(/```json[\s\S]*?```/g,'').replace(/```[\s\S]*?```/g,'').trim()
    var actionFinal = null
    try {
      var jsonMatch = response.match(/\{[\s\S]*"action"[\s\S]*\}/)
      if (!jsonMatch) jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        var parsed = JSON.parse(jsonMatch[0])
        if (parsed.content && parsed.action) {
          contentFinal = parsed.content
          actionFinal = parsed.action
        }
      }
    } catch(e) {}

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
  var cal = CalendarApp.getDefaultCalendar()

  if (method === 'GET') {
    var now = new Date()
    var daysAhead = parseInt(body.days || 30)
    var end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)
    var events = cal.getEvents(now, end)
    return events.map(function(e) {
      return {
        id: e.getId(),
        title: e.getTitle(),
        start: e.getStartTime().toISOString(),
        end: e.getEndTime().toISOString(),
        description: e.getDescription() || '',
        location: e.getLocation() || '',
        allDay: e.isAllDayEvent(),
      }
    })
  }

  if (method === 'POST') {
    var title = body.title || 'Novo evento'
    var startDate = new Date(body.start)
    var endDate = body.end ? new Date(body.end) : new Date(startDate.getTime() + 60 * 60 * 1000)
    var opts = {}
    if (body.description) opts.description = body.description
    if (body.location)    opts.location    = body.location
    var ev = cal.createEvent(title, startDate, endDate, opts)
    return {
      id: ev.getId(),
      title: ev.getTitle(),
      start: ev.getStartTime().toISOString(),
      end: ev.getEndTime().toISOString(),
    }
  }

  if (method === 'DELETE') {
    var ev2 = cal.getEventById(id)
    if (ev2) ev2.deleteEvent()
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
