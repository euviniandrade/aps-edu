const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const STOP = new Set(['da', 'de', 'do', 'das', 'dos', 'di', 'e', 'a', 'o'])

function makeEmail(name, used) {
  const parts = name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim().split(/\s+/)
    .filter(p => p && !STOP.has(p))
  const base = parts.slice(0, 2).join('.')
  let email = base + '@aps.edu.br'
  let n = 2
  while (used.has(email)) { email = base + n++ + '@aps.edu.br' }
  used.add(email)
  return email
}

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...\n')

  // ─── CLEANUP (remove old data to allow full re-seed) ─────────────────────
  console.log('🧹 Limpando dados antigos...')
  await prisma.taskComment.deleteMany({})
  await prisma.taskChecklist.deleteMany({})
  await prisma.eventResponsible.deleteMany({})
  await prisma.task.deleteMany({})
  await prisma.event.deleteMany({})
  await prisma.announcementRead.deleteMany({})
  await prisma.announcement.deleteMany({})
  await prisma.feedback.deleteMany({})
  await prisma.userBadge.deleteMany({})
  await prisma.userPoints.deleteMany({})
  await prisma.user.deleteMany({})
  await prisma.unit.deleteMany({})
  await prisma.badge.deleteMany({})
  console.log('✅ Dados antigos removidos\n')

  // ─── ROLES ────────────────────────────────────────────────────────────────
  const roles = await Promise.all([
    prisma.role.upsert({ where: { slug: 'admin' }, create: { name: 'Administrador', slug: 'admin', permissions: JSON.stringify({ canCreateTasks: true, canCreateEvents: true, canPublishAnnouncements: true, canViewAllData: true, canManageUsers: true, canViewReports: true, canGrantBadges: true }) }, update: {} }),
    prisma.role.upsert({ where: { slug: 'director' }, create: { name: 'Diretor', slug: 'director', permissions: JSON.stringify({ canCreateTasks: true, canCreateEvents: true, canPublishAnnouncements: true, canViewAllData: true, canManageUsers: false, canViewReports: true, canGrantBadges: false }) }, update: {} }),
    prisma.role.upsert({ where: { slug: 'vice_director' }, create: { name: 'Vice-Diretor', slug: 'vice_director', permissions: JSON.stringify({ canCreateTasks: true, canCreateEvents: false, canPublishAnnouncements: false, canViewAllData: false, canManageUsers: false, canViewReports: true, canGrantBadges: false }) }, update: {} }),
    prisma.role.upsert({ where: { slug: 'coordinator' }, create: { name: 'Coordenador', slug: 'coordinator', permissions: JSON.stringify({ canCreateTasks: true, canCreateEvents: false, canPublishAnnouncements: false, canViewAllData: false, canManageUsers: false, canViewReports: false, canGrantBadges: false }) }, update: {} }),
    prisma.role.upsert({ where: { slug: 'chaplain' }, create: { name: 'Capelão', slug: 'chaplain', permissions: JSON.stringify({ canCreateTasks: false, canCreateEvents: false, canPublishAnnouncements: false, canViewAllData: false, canManageUsers: false, canViewReports: false, canGrantBadges: false }) }, update: {} }),
    prisma.role.upsert({ where: { slug: 'treasurer' }, create: { name: 'Tesoureiro', slug: 'treasurer', permissions: JSON.stringify({ canCreateTasks: false, canCreateEvents: false, canPublishAnnouncements: false, canViewAllData: false, canManageUsers: false, canViewReports: false, canGrantBadges: false }) }, update: {} }),
    prisma.role.upsert({ where: { slug: 'disciplinary' }, create: { name: 'Disciplinar', slug: 'disciplinary', permissions: JSON.stringify({ canCreateTasks: true, canCreateEvents: false, canPublishAnnouncements: false, canViewAllData: false, canManageUsers: false, canViewReports: false, canGrantBadges: false }) }, update: {} }),
    prisma.role.upsert({ where: { slug: 'counselor' }, create: { name: 'Orientador', slug: 'counselor', permissions: JSON.stringify({ canCreateTasks: false, canCreateEvents: false, canPublishAnnouncements: false, canViewAllData: false, canManageUsers: false, canViewReports: false, canGrantBadges: false }) }, update: {} }),
    prisma.role.upsert({ where: { slug: 'secretary' }, create: { name: 'Secretária', slug: 'secretary', permissions: JSON.stringify({ canCreateTasks: false, canCreateEvents: false, canPublishAnnouncements: false, canViewAllData: false, canManageUsers: false, canViewReports: false, canGrantBadges: false }) }, update: {} })
  ])
  console.log(`✅ ${roles.length} funções criadas`)

  // ─── UNITS (15 unidades reais) ────────────────────────────────────────────
  const unitDefs = [
    { id: '00000000-0000-0000-0000-000000000001', code: 'APS',      name: 'Sede APS — Departamento de Educação',          city: 'São Paulo',         type: 'headquarters', region: 'SP' },
    { id: '00000000-0000-0000-0000-000000000002', code: 'EAA',      name: 'Escola Adventista de Americana',                city: 'Americana',         type: 'school',       region: 'SP' },
    { id: '00000000-0000-0000-0000-000000000003', code: 'EAJL',     name: 'Escola Adventista de Jundiaí',                  city: 'Jundiaí',           type: 'school',       region: 'SP' },
    { id: '00000000-0000-0000-0000-000000000004', code: 'EATW',     name: 'Escola Adventista de Tatuí',                    city: 'Tatuí',             type: 'school',       region: 'SP' },
    { id: '00000000-0000-0000-0000-000000000005', code: 'CAIS',     name: 'Colégio Adventista de Itu',                     city: 'Itu',               type: 'school',       region: 'SP' },
    { id: '00000000-0000-0000-0000-000000000006', code: 'CATS',     name: 'Colégio Adventista de Taubaté',                 city: 'Taubaté',           type: 'school',       region: 'SP' },
    { id: '00000000-0000-0000-0000-000000000007', code: 'CAR',      name: 'Colégio Adventista de Ribeirão Preto',          city: 'Ribeirão Preto',    type: 'school',       region: 'SP' },
    { id: '00000000-0000-0000-0000-000000000008', code: 'CAEA',     name: 'Colégio Adventista de Engenheiro Ávidos',       city: 'Sorocaba',          type: 'school',       region: 'SP' },
    { id: '00000000-0000-0000-0000-000000000009', code: 'CAEGW',    name: 'Colégio Adventista Ellen G. White',             city: 'São Paulo',         type: 'school',       region: 'SP' },
    { id: '00000000-0000-0000-0000-000000000010', code: 'CACLI',    name: 'Colégio Adventista de Campinas Leste I',        city: 'Campinas',          type: 'school',       region: 'SP' },
    { id: '00000000-0000-0000-0000-000000000011', code: 'CACLI II', name: 'Colégio Adventista de Campinas Leste II',       city: 'Campinas',          type: 'school',       region: 'SP' },
    { id: '00000000-0000-0000-0000-000000000012', code: 'EAVB',     name: 'Escola Adventista de Valinhos',                 city: 'Valinhos',          type: 'school',       region: 'SP' },
    { id: '00000000-0000-0000-0000-000000000013', code: 'EACF',     name: 'Escola Adventista de Campinas Floresta',        city: 'Campinas',          type: 'school',       region: 'SP' },
    { id: '00000000-0000-0000-0000-000000000014', code: 'EAP',      name: 'Escola Adventista de Piracicaba',               city: 'Piracicaba',        type: 'school',       region: 'SP' },
    { id: '00000000-0000-0000-0000-000000000015', code: 'CAP',      name: 'Colégio Adventista de Piracicaba',              city: 'Piracicaba',        type: 'school',       region: 'SP' },
  ]
  const units = await Promise.all(
    unitDefs.map(ud => prisma.unit.upsert({ where: { id: ud.id }, create: ud, update: {} }))
  )
  const unitByCode = Object.fromEntries(unitDefs.map((ud, i) => [ud.code, units[i]]))
  console.log(`✅ ${units.length} unidades criadas`)

  const roleMap = Object.fromEntries(roles.map(r => [r.slug, r]))
  const defaultHash = await bcrypt.hash('Teste@123', 10)
  const adminHash   = await bcrypt.hash('Admin@123', 10)
  const dirHash     = await bcrypt.hash('Diretor@123', 10)

  // ─── USERS ────────────────────────────────────────────────────────────────
  // Role cycling per position in each unit
  const unitRoleCycle = ['director', 'vice_director', 'coordinator', 'chaplain', 'treasurer', 'disciplinary', 'counselor', 'secretary', 'counselor', 'secretary', 'counselor', 'secretary', 'counselor', 'secretary', 'counselor', 'secretary', 'counselor']
  const apsRoleCycle  = ['director', 'coordinator', 'vice_director', 'coordinator', 'chaplain', 'secretary', 'counselor', 'treasurer', 'disciplinary', 'counselor', 'secretary', 'coordinator', 'counselor', 'counselor', 'counselor', 'counselor', 'counselor', 'counselor', 'counselor', 'counselor', 'counselor']

  // 142 real people from Excel (name, unitCode)
  const peopleRaw = [
    ['Adriana Silveira Castro Gasquez',                   'EAA'],
    ['Adriano Souza dos Reis',                            'EAJL'],
    ['Agatha Raquel Evangelista Cavalcanti',              'EATW'],
    ['Alan Fernandes de Oliveira',                        'CAIS'],
    ['Albert Luis Moreira Andrade',                       'CATS'],
    ['Alberto Sa dos Santos',                             'CAR'],
    ['Alessandro de Oliveira Lopes',                      'CATS'],
    ['Alessandro Romaneli Lei',                           'EAJL'],
    ['Aline Santos Viana Medeiros',                       'CATS'],
    ['Alisson Alencar Costa',                             'CAP'],
    ['Amanda Dias da Silva',                              'CACLI'],
    ['Ana Beatriz Ribeiro Andrade',                       'CACLI'],
    ['Ana Cristina dos Santos',                           'EAA'],
    ['Ana Lucia de Melo Vieira',                          'EAJL'],
    ['Anderson Macario Gomes',                            'CAEGW'],
    ['Andre Carlos da Silva Lira',                        'CACLI II'],
    ['Andre Coelho Kawamura',                             'EAVB'],
    ['Andre Rui Gessner de Andrade',                      'EACF'],
    ['Angela Martins de Morais Lima',                     'CATS'],
    ['Anne Liz Meira Silva',                              'APS'],
    ['Anne Marks Ferreira',                               'APS'],
    ['Anny Karoliny Santana Gomes Pereira',               'CAP'],
    ['Antonio Acleto Amaral',                             'CACLI'],
    ['Camila Ribeiro dos Santos Moura',                   'CAIS'],
    ['Carina Penha Justino Pereira',                      'CAEGW'],
    ['Caroline Percio Cardoso Dias',                      'EATW'],
    ['Cibelle Marques Batista',                           'CAEA'],
    ['Cinthya dos Santos Vilar Garcia',                   'CATS'],
    ['Cintia Helena Dias de Oliveira',                    'CAEGW'],
    ['Cleusa Batista de Oliveira',                        'EACF'],
    ['Cristiana Pereira Barbosa da Cruz',                 'CAEGW'],
    ['Dagmar Regiane dos Reis Silva Santos',              'CAP'],
    ['Daniel de Oliveira Rodrigues',                      'CACLI'],
    ['Daniel Viana Medeiros',                             'APS'],
    ['Daniella Bispo Betzel Veloso',                      'EATW'],
    ['Danielly Goncalves Wolff',                          'CAP'],
    ['Debora Joice dos Santos Nascimento Macedo',         'EACF'],
    ['Deise Andrade Bonifacio',                           'EAVB'],
    ['Diego Pingituro Mariano',                           'CAEA'],
    ['Douglas Lourenco Angelo',                           'CATS'],
    ['Douglas Pires de Freitas',                          'CAR'],
    ['Douglas Ribeiro Pereira',                           'CAEGW'],
    ['Ednaldo Oliveira Pereira',                          'EATW'],
    ['Elaine Cristina Balancieri Pereira',                'APS'],
    ['Eliane Queiroz Cunha',                              'CACLI II'],
    ['Eliene Almeida Silva Camilo',                       'CAEGW'],
    ['Elisabete Oliveira de Araujo',                      'APS'],
    ['Elisnei Novaes de Lima',                            'CATS'],
    ['Ellen Rogeria Meira Silva',                         'APS'],
    ['Eric Henrique Xavier Luz',                          'CAIS'],
    ['Eucileide Carvalho Borges',                         'CACLI'],
    ['Eurico dos Santos Borges',                          'CAIS'],
    ['Evandro Alves Medeiros',                            'APS'],
    ['Evandro Feijo Guimaraes',                           'APS'],
    ['Fabiana Apareida Feitosa da Silva',                 'CATS'],
    ['Fabio da Silva Santos',                             'CAIS'],
    ['Fabio Henrique Cavalcante de Melo Silva',           'EAJL'],
    ['Fabio Menezes de Jesus Silva',                      'APS'],
    ['Fabio Ricardo da Silva',                            'EAVB'],
    ['Fabio Rogerio Lira',                                'APS'],
    ['Fabiola Rodrigues Nunes Brandao',                   'CACLI II'],
    ['Francicleia Silva Santos',                          'EAJL'],
    ['Gilfferson Silva Santos',                           'CATS'],
    ['Gisele Cristina dos Santos Nunes',                  'CACLI'],
    ['Gustavo Peixoto Silva',                             'CAP'],
    ['Heber Ceribelli',                                   'APS'],
    ['Helena Marks Ferreira',                             'APS'],
    ['Henrique Felix Goncalves Alfaz',                    'CAEA'],
    ['Iris Carvalho Leite',                               'CATS'],
    ['Iris de Souza Amaral',                              'CACLI II'],
    ['Ivone Paim Lima Silva',                             'CACLI II'],
    ['Jacqueline Palacio Jardim Rocha',                   'EAJL'],
    ['Jacqueline Ribeiro Andrade',                        'CACLI'],
    ['Jacqueline Rocha Espindola',                        'CAEA'],
    ['Jean Luiz Morais Diniz',                            'CAEA'],
    ['Jonatan Ferreira Nascimento',                       'CAP'],
    ['Jonisson de Souza Santos',                          'EACF'],
    ['Josafath Tadeu Francisco',                          'EAA'],
    ['Jose Renato Matos Medrado Junior',                  'CAEGW'],
    ['Josy Mendonca Martins de Lara',                     'EAP'],
    ['Julia Aparecida Gomes Freitas',                     'CATS'],
    ['Jussilene Lima de Souza',                           'CACLI II'],
    ['Katia Mendes de Oliveira',                          'CAP'],
    ['Katieli Silva Cordeiro Bezerra',                    'EATW'],
    ['Kelly Cristina Felix Alfaz Cunha',                  'CATS'],
    ['Lenice Nunes Barbosa',                              'CAEA'],
    ['Lucas Patekoski Pioker',                            'EAP'],
    ['Luciana Mendes Feliciano',                          'CAR'],
    ['Luciane N. Lemos Schlichting',                      'CAR'],
    ['Luis Enrique Gutierrez Bravo',                      'CAIS'],
    ['Luiz Bellino Christianini Neto',                    'CACLI'],
    ['Luiz Bellino Christianini Neto',                    'EATW'],
    ['Marcela Jainana dos Santos Bonifacio',              'CAEA'],
    ['Marcelo Soares Marcelino',                          'CAEA'],
    ['Marcia Marafiga Oliveira de Sousa',                 'APS'],
    ['Marcia Regina Santana Vatri',                       'CAEGW'],
    ['Marcio Fernando da Silva',                          'APS'],
    ['Marco Antonio Bregalante',                          'EAVB'],
    ['Marcos Jose de Sousa',                              'APS'],
    ['Marcos Juan Kuntz Rabelo',                          'CAP'],
    ['Mariana Viana Medeiros',                            'APS'],
    ['Mariane Francisca dos Santos Andrade',              'CAP'],
    ['Marilei Dantas Barbosa Gutierrez',                  'CATS'],
    ['Marta Pimentel do Nascimento',                      'CAP'],
    ['Mauricio Silva Santos',                             'CAP'],
    ['Michelle Miranda Vieira',                           'CAIS'],
    ['Milene Nascimento do Carmo Santos',                 'CAIS'],
    ['Monaliza Valeria Costa',                            'EAVB'],
    ['Nadir Panegacci dos Santos',                        'CAP'],
    ['Nathalia Conceicao Santos Cordeiro',                'CAEA'],
    ['Oliveiros Pinto Ferreira Junior',                   'APS'],
    ['Otavio Felipe de Souza Silva',                      'EAJL'],
    ['Paulo Cesar Teixeira Chaves',                       'CACLI'],
    ['Paulo Marcelo de Oliveira',                         'APS'],
    ['Pricila Aparecida Borges Kauffman',                 'CATS'],
    ['Rafael Ferreira da Silva',                          'EACF'],
    ['Railda Souza Santana',                              'CAIS'],
    ['Raphael Carvalho Vellozo',                          'CACLI II'],
    ['Raquel Justino da Rocha',                           'APS'],
    ['Raquel Rodrigues Bremmer',                          'CACLI'],
    ['Raul Reis Passos',                                  'CAP'],
    ['Reginaldo Pires de Freitas',                        'CAEGW'],
    ['Renata Rodrigues Machado',                          'EAA'],
    ['Roberta Lindenberg de Souza Libardi Nascimento',    'CAEGW'],
    ['Roberto Gorski',                                    'CAEA'],
    ['Rodrigo Oliveira Rodrigues',                        'APS'],
    ['Rodrigo Pereira',                                   'CATS'],
    ['Rosimeire Pereira Goes da Silva',                   'CAP'],
    ['Sandra Tavares da Silva',                           'EACF'],
    ['Silvanete de Souza Passos',                         'CATS'],
    ['Simone Rodrigues do Carmo Nascimento',              'CAP'],
    ['Solange da Silva',                                  'EACF'],
    ['Tatiane Cardoso Ferreira',                          'EAA'],
    ['Thiago Gessner de Andrade',                         'EATW'],
    ['Topaze Michaelle Aparecida do Nascimento Santos Ohara', 'EAVB'],
    ['Uoston Santos Andrade',                             'CACLI II'],
    ['Vinicius de Andrade Felix',                         'APS'],
    ['Vitoria Elisabete de Oliveira Barros',              'CACLI'],
    ['Viviane Alves Bispo Rocha',                         'CACLI II'],
    ['Viviane Aparecida Pinho Tavares',                   'EAVB'],
    ['Washington Luiz Saraiva Volzzi',                    'CAP'],
    ['William Antonio Marcolino',                         'EAA'],
  ]

  const usedEmails = new Set(['admin@aps.edu.br'])

  // System admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@aps.edu.br' },
    create: { name: 'Administrador APS', email: 'admin@aps.edu.br', passwordHash: adminHash, roleId: roleMap['admin'].id, unitId: unitByCode['APS'].id },
    update: {}
  })

  const usersByUnit = {}  // code → [user, ...]
  const createdPeople = []
  const unitPosCounter = {}

  for (const [name, unitCode] of peopleRaw) {
    if (!unitPosCounter[unitCode]) unitPosCounter[unitCode] = 0
    const pos = unitPosCounter[unitCode]++

    const cycle = unitCode === 'APS' ? apsRoleCycle : unitRoleCycle
    const roleSlug = cycle[Math.min(pos, cycle.length - 1)]
    const hash = roleSlug === 'director' ? dirHash : defaultHash
    const email = makeEmail(name, usedEmails)

    const user = await prisma.user.upsert({
      where: { email },
      create: { name, email, passwordHash: hash, roleId: roleMap[roleSlug].id, unitId: unitByCode[unitCode].id },
      update: {}
    })
    createdPeople.push(user)
    if (!usersByUnit[unitCode]) usersByUnit[unitCode] = []
    usersByUnit[unitCode].push(user)
  }

  const createdUsers = [adminUser, ...createdPeople]
  // Helper: get user by unit code and position (0-based), falls back to admin
  const uu = (code, idx = 0) => usersByUnit[code]?.[idx] ?? adminUser
  console.log(`✅ ${createdUsers.length} usuários criados`)

  // ─── USER POINTS (gamificação simulada) ─────────────────────────────────
  // Assign points to all users with a realistic distribution
  const allUsersForPoints = [...createdUsers]
  let pointsCreated = 0
  for (let i = 0; i < allUsersForPoints.length; i++) {
    const u = allUsersForPoints[i]
    // Vary points based on position — early users tend to be "directors" with more points
    const base = Math.max(200, 4500 - i * 28 + Math.floor(Math.random() * 400 - 200))
    const points = Math.max(100, Math.min(5000, base))
    const tasksCompleted = Math.floor(points / 55)
    const tasksOnTime = Math.floor(tasksCompleted * 0.85)
    const loginStreak = Math.floor(points / 120)
    await prisma.userPoints.upsert({
      where: { userId: u.id },
      create: {
        userId: u.id, points, tasksCompleted, tasksOnTime, loginStreak,
        tasksCreated: Math.floor(tasksCompleted * 0.6),
        eventsCreated: Math.floor(points / 400),
        commentsPosted: Math.floor(tasksCompleted * 1.4),
        evidencesUploaded: Math.floor(tasksCompleted * 0.8),
        announcementsRead: Math.floor(points / 140),
        lastLoginDate: new Date(),
      },
      update: {}
    })
    pointsCreated++
  }
  console.log(`✅ ${pointsCreated} registros de pontos criados`)

  // ─── AVISOS ───────────────────────────────────────────────────────────────
  const avisos = [
    {
      id: 'aviso-00000000-0000-0000-0001',
      title: '🎉 Bem-vindos ao APS EDU — Plataforma Oficial da Educação Adventista APS Sul!',
      content: `Olá, equipe! É com muita alegria que apresentamos oficialmente o APS EDU, nossa nova plataforma de gestão educacional.

Aqui você encontrará tudo que precisa para o dia a dia das nossas escolas:

✅ Gestão de tarefas com acompanhamento de progresso
📅 Controle de eventos e cronogramas
📢 Mural de avisos segmentados por escola e cargo
🏆 Sistema de gamificação com pontos e conquistas
📊 Relatórios de desempenho por unidade
💬 Canal de feedback direto com a liderança

Nosso objetivo é fortalecer a comunicação, reconhecer o esforço de cada colaborador e garantir excelência na gestão das nossas unidades.

Que Deus abençoe cada um de vocês nessa nova etapa! 🙏

— Departamento de Educação · Associação Paulista Sul`,
      type: 'celebration', authorId: adminUser.id,
      publishAt: new Date('2025-04-01T08:00:00Z'), expiresAt: null,
    },
    {
      id: 'aviso-00000000-0000-0000-0002',
      title: '⚠️ Prazo Final — Entrega dos Planos Pedagógicos 1º Semestre',
      content: `Prezados diretores e coordenadores,

Lembramos que o prazo para entrega dos Planos Pedagógicos do 1º Semestre de 2025 se encerra no dia 30 de abril.

Por favor, certifiquem-se de:
• Anexar o plano de cada disciplina no módulo de Tarefas
• Incluir as metas de desempenho por turma
• Assinar digitalmente o documento antes do envio

Unidades que não cumprirem o prazo estarão sujeitas a perda de pontos na gamificação e serão contactadas pela supervisão pedagógica.

Qualquer dúvida, entrem em contato com a Coord. Pedagógica da APS Sul.

— Departamento de Educação · APS Sul`,
      type: 'warning', authorId: uu('APS', 0).id,
      publishAt: new Date('2025-04-10T09:00:00Z'), expiresAt: new Date('2025-04-30T23:59:00Z'),
    },
    {
      id: 'aviso-00000000-0000-0000-0003',
      title: '📊 ENQUETE — Melhor Horário para o Encontro de Diretores APS 2025',
      content: `Querida equipe de liderança,

Estamos organizando o Encontro de Diretores APS 2025 e precisamos da sua opinião sobre o melhor horário!

━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 ENQUETE — Escolha o melhor período:
━━━━━━━━━━━━━━━━━━━━━━━━━━

🔵 Opção A — Manhã (8h às 12h)
   Votos: ████████░░  8 votos  (38%)

🟡 Opção B — Tarde (13h às 17h)
   Votos: █████████░  9 votos  (43%)

🟢 Opção C — Período integral (8h às 17h)
   Votos: ████░░░░░░  4 votos  (19%)

━━━━━━━━━━━━━━━━━━━━━━━━━━
Total de respostas: 21  |  Encerra em: 25/04/2025
━━━━━━━━━━━━━━━━━━━━━━━━━━

Para votar, responda este aviso com sua opção (A, B ou C) no módulo de Feedback.

— Departamento de Educação · APS Sul`,
      type: 'info', authorId: adminUser.id,
      publishAt: new Date('2025-04-15T07:30:00Z'), expiresAt: new Date('2025-04-25T23:59:00Z'),
    },
    {
      id: 'aviso-00000000-0000-0000-0004',
      title: '🏆 APS30 — Propósito em Ação: Comemorações dos 30 anos da APS Sul!',
      content: `Este ano celebramos 30 anos de história, fé e educação transformadora!

A APS Sul completa 30 anos em 2025, e nossa rede de escolas é a maior expressão deste legado.

🎯 O que está previsto para o APS30:

📅 Maio/2025 — Culto comemorativo com toda a rede escolar
🎨 Junho/2025 — Concurso cultural entre as unidades (inscrições abertas!)
🏅 Julho/2025 — Gala de reconhecimento dos colaboradores destaques
📖 Setembro/2025 — Publicação do livro histórico da APS Sul
🎤 Outubro/2025 — Congresso Pedagógico APS30

Cada escola deve eleger 1 representante para o Comitê APS30 até 30/04.
Envie o nome do representante pelo módulo de Feedback desta plataforma.

Juntos, seguimos com Propósito em Ação! 💛🩵🧡💙

— Presidência · Associação Paulista Sul`,
      type: 'celebration', authorId: adminUser.id,
      publishAt: new Date('2025-04-05T08:00:00Z'), expiresAt: null,
    },
  ]

  for (const aviso of avisos) {
    await prisma.announcement.upsert({ where: { id: aviso.id }, create: aviso, update: {} })
  }

  // Mark announcements read by directors of each unit
  const directors = Object.keys(usersByUnit).map(code => uu(code, 0))
  for (const announceId of ['aviso-00000000-0000-0000-0001', 'aviso-00000000-0000-0000-0004']) {
    for (const dir of directors) {
      await prisma.announcementRead.upsert({
        where: { announcementId_userId: { announcementId: announceId, userId: dir.id } },
        create: { announcementId: announceId, userId: dir.id },
        update: {}
      }).catch(() => {})
    }
  }
  for (const dir of directors.slice(0, 10)) {
    await prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId: 'aviso-00000000-0000-0000-0002', userId: dir.id } },
      create: { announcementId: 'aviso-00000000-0000-0000-0002', userId: dir.id },
      update: {}
    }).catch(() => {})
  }
  console.log(`✅ ${avisos.length} avisos criados`)

  // ─── 50 BADGES ────────────────────────────────────────────────────────────
  const badges = [
    { name: 'Primeira Missão',      description: 'Deu o primeiro passo',          criteria: 'Concluir a 1ª tarefa',           category: 'commitment',  level: 'bronze', pointsReward: 30,   order: 1,  unlockRule: { type: 'tasks_completed', count: 1 } },
    { name: 'Dedicação Inicial',    description: 'Começa com tudo',                criteria: 'Concluir 5 tarefas',              category: 'commitment',  level: 'bronze', pointsReward: 50,   order: 2,  unlockRule: { type: 'tasks_completed', count: 5 } },
    { name: 'Em Pleno Vapor',       description: 'Ritmo crescente de trabalho',    criteria: 'Concluir 15 tarefas',             category: 'commitment',  level: 'bronze', pointsReward: 80,   order: 3,  unlockRule: { type: 'tasks_completed', count: 15 } },
    { name: 'Nunca Desiste',        description: 'Persistência comprovada',        criteria: 'Concluir 30 tarefas',             category: 'commitment',  level: 'silver', pointsReward: 120,  order: 4,  unlockRule: { type: 'tasks_completed', count: 30 } },
    { name: 'Mão na Massa',         description: 'Execução consistente',           criteria: 'Concluir 50 tarefas',             category: 'commitment',  level: 'silver', pointsReward: 200,  order: 5,  unlockRule: { type: 'tasks_completed', count: 50 } },
    { name: 'Pilar da Equipe',      description: 'Compromisso inabalável',         criteria: 'Concluir 100 tarefas',            category: 'commitment',  level: 'silver', pointsReward: 300,  order: 6,  unlockRule: { type: 'tasks_completed', count: 100 } },
    { name: 'Força Total',          description: 'Produção excepcional',           criteria: 'Concluir 200 tarefas',            category: 'commitment',  level: 'gold',   pointsReward: 500,  order: 7,  unlockRule: { type: 'tasks_completed', count: 200 } },
    { name: 'Guardião da Missão',   description: 'Zelar pela equipe',              criteria: '30 dias consecutivos de login',   category: 'commitment',  level: 'gold',   pointsReward: 400,  order: 8,  unlockRule: { type: 'login_streak', days: 30 } },
    { name: 'Presença Constante',   description: 'Login diário consistente',       criteria: '7 dias consecutivos de login',    category: 'commitment',  level: 'silver', pointsReward: 150,  order: 9,  unlockRule: { type: 'login_streak', days: 7 } },
    { name: 'Comprometimento Total',description: 'Marca registrada',               criteria: '60 dias consecutivos de login',   category: 'commitment',  level: 'gold',   pointsReward: 600,  order: 10, unlockRule: { type: 'login_streak', days: 60 } },
    { name: 'No Horário',           description: 'Entrega pontual',                criteria: '5 tarefas no prazo',              category: 'punctuality', level: 'bronze', pointsReward: 60,   order: 11, unlockRule: { type: 'tasks_on_time', count: 5 } },
    { name: 'Relojoeiro',           description: 'Precisão de entrega',            criteria: '15 tarefas no prazo',             category: 'punctuality', level: 'bronze', pointsReward: 100,  order: 12, unlockRule: { type: 'tasks_on_time', count: 15 } },
    { name: 'Antes do Previsto',    description: 'Vai além do esperado',           criteria: '3 tarefas antecipadas',           category: 'punctuality', level: 'bronze', pointsReward: 70,   order: 13, unlockRule: { type: 'tasks_on_time', count: 3 } },
    { name: 'Mestre do Tempo',      description: 'Gestão exemplar do tempo',       criteria: '30 tarefas no prazo',             category: 'punctuality', level: 'silver', pointsReward: 180,  order: 14, unlockRule: { type: 'tasks_on_time', count: 30 } },
    { name: 'Velocidade Leal',      description: 'Rápido e preciso',               criteria: '50 tarefas no prazo',             category: 'punctuality', level: 'silver', pointsReward: 250,  order: 15, unlockRule: { type: 'tasks_on_time', count: 50 } },
    { name: 'Sem Atrasos',          description: 'Sequência perfeita',             criteria: '75 tarefas no prazo',             category: 'punctuality', level: 'silver', pointsReward: 300,  order: 16, unlockRule: { type: 'tasks_on_time', count: 75 } },
    { name: 'Executor Preciso',     description: 'Pontualidade absoluta',          criteria: '100 tarefas no prazo',            category: 'punctuality', level: 'gold',   pointsReward: 450,  order: 17, unlockRule: { type: 'tasks_on_time', count: 100 } },
    { name: 'Além do Limite',       description: 'Supera expectativas',            criteria: '150 tarefas no prazo',            category: 'punctuality', level: 'gold',   pointsReward: 500,  order: 18, unlockRule: { type: 'tasks_on_time', count: 150 } },
    { name: 'Maratona Pontual',     description: 'Consistência ao longo do tempo', criteria: '200 tarefas no prazo',            category: 'punctuality', level: 'gold',   pointsReward: 600,  order: 19, unlockRule: { type: 'tasks_on_time', count: 200 } },
    { name: 'Lendário do Prazo',    description: 'Pontualidade histórica',         criteria: '300 tarefas no prazo',            category: 'punctuality', level: 'gold',   pointsReward: 800,  order: 20, unlockRule: { type: 'tasks_on_time', count: 300 } },
    { name: 'Sprint Inicial',       description: 'Início acelerado',               criteria: 'Enviar 3 evidências',             category: 'productivity',level: 'bronze', pointsReward: 40,   order: 21, unlockRule: { type: 'evidences_uploaded', count: 3 } },
    { name: 'Semana Poderosa',      description: 'Alta produção semanal',          criteria: 'Enviar 10 evidências',            category: 'productivity',level: 'bronze', pointsReward: 80,   order: 22, unlockRule: { type: 'evidences_uploaded', count: 10 } },
    { name: 'Checklist Completo',   description: 'Detalhe que importa',            criteria: 'Enviar 25 evidências',            category: 'productivity',level: 'bronze', pointsReward: 120,  order: 23, unlockRule: { type: 'evidences_uploaded', count: 25 } },
    { name: 'Evidências em Dia',    description: 'Documentação impecável',         criteria: 'Enviar 50 evidências',            category: 'productivity',level: 'silver', pointsReward: 200,  order: 24, unlockRule: { type: 'evidences_uploaded', count: 50 } },
    { name: 'Mês Produtivo',        description: 'Mês de alta performance',        criteria: 'Enviar 100 evidências',           category: 'productivity',level: 'silver', pointsReward: 350,  order: 25, unlockRule: { type: 'evidences_uploaded', count: 100 } },
    { name: 'Multitarefa',          description: 'Vários focos simultâneos',       criteria: '20 tarefas criadas',              category: 'productivity',level: 'bronze', pointsReward: 100,  order: 26, unlockRule: { type: 'tasks_created', count: 20 } },
    { name: 'Excelência Documental',description: 'Qualidade de registro',          criteria: '50 tarefas criadas',              category: 'productivity',level: 'silver', pointsReward: 200,  order: 27, unlockRule: { type: 'tasks_created', count: 50 } },
    { name: 'Máquina de Resultados',description: 'Produção máxima',               criteria: '100 tarefas criadas',             category: 'productivity',level: 'gold',   pointsReward: 400,  order: 28, unlockRule: { type: 'tasks_created', count: 100 } },
    { name: 'Trimestre de Ouro',    description: 'Alta produção contínua',         criteria: '150 tarefas criadas',             category: 'productivity',level: 'gold',   pointsReward: 500,  order: 29, unlockRule: { type: 'tasks_created', count: 150 } },
    { name: 'Velocidade de Cruzeiro',description:'Performance sustentável',        criteria: '1000 pontos totais',              category: 'productivity',level: 'gold',   pointsReward: 300,  order: 30, unlockRule: { type: 'total_points', points: 1000 } },
    { name: 'Primeira Estrela',     description: 'Reconhecimento inicial',         criteria: '100 pontos acumulados',           category: 'excellence',  level: 'bronze', pointsReward: 50,   order: 31, unlockRule: { type: 'total_points', points: 100 } },
    { name: 'Padrão de Qualidade',  description: 'Qualidade reconhecida',          criteria: '300 pontos acumulados',           category: 'excellence',  level: 'bronze', pointsReward: 80,   order: 32, unlockRule: { type: 'total_points', points: 300 } },
    { name: 'Destaque da Semana',   description: 'Melhor da semana',               criteria: '500 pontos acumulados',           category: 'excellence',  level: 'silver', pointsReward: 150,  order: 33, unlockRule: { type: 'total_points', points: 500 } },
    { name: 'Destaque do Mês',      description: 'Melhor do mês',                  criteria: '1000 pontos acumulados',          category: 'excellence',  level: 'silver', pointsReward: 200,  order: 34, unlockRule: { type: 'total_points', points: 1000 } },
    { name: 'Feedback Positivo',    description: 'Reconhecimento externo',         criteria: '10 comentários postados',         category: 'excellence',  level: 'bronze', pointsReward: 80,   order: 35, unlockRule: { type: 'comments_posted', count: 10 } },
    { name: 'Modelo a Seguir',      description: 'Referência de qualidade',        criteria: '2000 pontos acumulados',          category: 'excellence',  level: 'silver', pointsReward: 300,  order: 36, unlockRule: { type: 'total_points', points: 2000 } },
    { name: 'Nível Elite',          description: 'Alta performance contínua',      criteria: '3500 pontos acumulados',          category: 'excellence',  level: 'gold',   pointsReward: 400,  order: 37, unlockRule: { type: 'total_points', points: 3500 } },
    { name: 'Campeão Trimestral',   description: 'Melhor do trimestre',            criteria: '6000 pontos acumulados',          category: 'excellence',  level: 'gold',   pointsReward: 500,  order: 38, unlockRule: { type: 'total_points', points: 6000 } },
    { name: 'Polo de Excelência',   description: 'Referência institucional',       criteria: '8000 pontos acumulados',          category: 'excellence',  level: 'gold',   pointsReward: 600,  order: 39, unlockRule: { type: 'total_points', points: 8000 } },
    { name: 'Lenda Viva',           description: 'Legado de excelência',           criteria: '10000 pontos acumulados',         category: 'excellence',  level: 'gold',   pointsReward: 1000, order: 40, unlockRule: { type: 'total_points', points: 10000 } },
    { name: 'Voz Ativa',            description: 'Contribui com o grupo',          criteria: '10 comentários em tarefas',       category: 'teamwork',    level: 'bronze', pointsReward: 80,   order: 41, unlockRule: { type: 'comments_posted', count: 10 } },
    { name: 'Apoio Mútuo',          description: 'Sempre presente para a equipe',  criteria: '25 comentários postados',         category: 'teamwork',    level: 'silver', pointsReward: 150,  order: 42, unlockRule: { type: 'comments_posted', count: 25 } },
    { name: 'União de Forças',      description: 'Colaboração contínua',           criteria: '50 comentários postados',         category: 'teamwork',    level: 'silver', pointsReward: 250,  order: 43, unlockRule: { type: 'comments_posted', count: 50 } },
    { name: 'Elo da Corrente',      description: 'Peça fundamental da equipe',     criteria: '100 comentários postados',        category: 'teamwork',    level: 'gold',   pointsReward: 400,  order: 44, unlockRule: { type: 'comments_posted', count: 100 } },
    { name: 'Coração da Equipe',    description: 'Referência humana',              criteria: '200 comentários postados',        category: 'teamwork',    level: 'gold',   pointsReward: 600,  order: 45, unlockRule: { type: 'comments_posted', count: 200 } },
    { name: 'Primeiro Passo',       description: 'Inicia a liderança',             criteria: 'Criar primeira tarefa',           category: 'leadership',  level: 'bronze', pointsReward: 50,   order: 46, unlockRule: { type: 'tasks_created', count: 1 } },
    { name: 'Gestor Ativo',         description: 'Gestão em prática',              criteria: 'Criar 10 tarefas',                category: 'leadership',  level: 'silver', pointsReward: 150,  order: 47, unlockRule: { type: 'tasks_created', count: 10 } },
    { name: 'Organizador de Eventos',description:'Domina a execução',              criteria: 'Criar 3 eventos',                 category: 'leadership',  level: 'silver', pointsReward: 200,  order: 48, unlockRule: { type: 'events_created', count: 3 } },
    { name: 'Comunicador Oficial',  description: 'Voz da instituição',             criteria: 'Publicar 10 avisos',              category: 'leadership',  level: 'silver', pointsReward: 200,  order: 49, unlockRule: { type: 'announcements_published', count: 10 } },
    { name: 'Líder Completo',       description: 'Gestão plena e exemplar',        criteria: '100 tarefas criadas E 3 eventos', category: 'leadership',  level: 'gold',   pointsReward: 1000, order: 50, unlockRule: { type: 'composite', operator: 'AND', rules: [{ type: 'tasks_created', count: 100 }, { type: 'events_created', count: 3 }] } }
  ]
  let badgesCreated = 0
  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { id: `badge-${badge.order.toString().padStart(2, '0')}` },
      create: { id: `badge-${badge.order.toString().padStart(2, '0')}`, ...badge, unlockRule: JSON.stringify(badge.unlockRule || {}) },
      update: {}
    })
    badgesCreated++
  }
  console.log(`✅ ${badgesCreated} selos criados`)

  // ─── EVENTOS ─────────────────────────────────────────────────────────────
  const eventosData = [
    {
      id: 'event-000000-0000-0000-0001',
      name: 'Encontro de Diretores APS Sul 2025',
      description: 'Reunião anual de liderança com foco em metas pedagógicas, resultados do 1º trimestre e planejamento estratégico do 2º semestre. Presença obrigatória de todos os diretores e vice-diretores da rede.',
      startDate: new Date('2025-05-10T08:00:00Z'), endDate: new Date('2025-05-10T17:00:00Z'),
      location: 'Sede APS — Auditório Principal, São Paulo', status: 'planned', progressPercent: 35,
      createdById: adminUser.id, unitId: unitByCode['APS'].id,
    },
    {
      id: 'event-000000-0000-0000-0002',
      name: 'Semana da Família — Colégio Adventista de Taubaté',
      description: 'Programação especial de integração com as famílias dos alunos, incluindo apresentações culturais, reuniões pedagógicas abertas e atividades recreativas.',
      startDate: new Date('2025-05-19T08:00:00Z'), endDate: new Date('2025-05-23T17:00:00Z'),
      location: 'Colégio Adventista de Taubaté — Quadra e Auditório', status: 'planned', progressPercent: 20,
      createdById: uu('CATS', 0).id, unitId: unitByCode['CATS'].id,
    },
    {
      id: 'event-000000-0000-0000-0003',
      name: 'Olimpíada Interna de Matemática — CA Piracicaba',
      description: 'Competição entre turmas do Ensino Fundamental II e Médio. Premiação com troféus e medalhas para os 3 primeiros colocados de cada categoria.',
      startDate: new Date('2025-04-25T08:00:00Z'), endDate: new Date('2025-04-25T16:00:00Z'),
      location: 'Colégio Adventista de Piracicaba — Salas de Aula', status: 'planned', progressPercent: 70,
      createdById: uu('CAP', 0).id, unitId: unitByCode['CAP'].id,
    },
    {
      id: 'event-000000-0000-0000-0004',
      name: 'Culto de Abertura do 1º Semestre — Rede APS Sul',
      description: 'Culto comemorativo de abertura do ano letivo 2025 com participação de todas as unidades. Transmissão ao vivo pelo canal oficial. Mensagem do presidente da APS Sul.',
      startDate: new Date('2025-02-05T07:30:00Z'), endDate: new Date('2025-02-05T10:00:00Z'),
      location: 'Igreja Central Adventista — São Paulo (SP)', status: 'completed', progressPercent: 100,
      createdById: adminUser.id, unitId: unitByCode['APS'].id,
    },
    {
      id: 'event-000000-0000-0000-0005',
      name: 'Treinamento em Gestão Escolar — Coordenadores',
      description: 'Capacitação de dois dias voltada para coordenadores pedagógicos, com foco em liderança de equipes, gestão de conflitos e uso da plataforma APS EDU. Certificado de 16h.',
      startDate: new Date('2025-04-08T08:00:00Z'), endDate: new Date('2025-04-09T17:00:00Z'),
      location: 'Sede APS Sul — Sala de Capacitação', status: 'completed', progressPercent: 100,
      createdById: uu('APS', 0).id, unitId: unitByCode['APS'].id,
    },
    {
      id: 'event-000000-0000-0000-0006',
      name: 'Feira de Ciências — EA Campinas Leste I',
      description: 'Mostra científica anual com projetos dos alunos do Fundamental I ao Médio. Avaliação por bancas. Os 5 melhores projetos participarão da feira regional.',
      startDate: new Date('2025-06-12T08:00:00Z'), endDate: new Date('2025-06-13T16:00:00Z'),
      location: 'CACLI — Ginásio Poliesportivo', status: 'planned', progressPercent: 10,
      createdById: uu('CACLI', 0).id, unitId: unitByCode['CACLI'].id,
    },
    {
      id: 'event-000000-0000-0000-0007',
      name: 'Concurso Cultural APS30 — Propósito em Ação',
      description: 'Concurso entre todas as unidades da APS Sul celebrando os 30 anos da associação. Categorias: redação, música, artes visuais e vídeo. Inscrições abertas até 31/05.',
      startDate: new Date('2025-06-20T08:00:00Z'), endDate: new Date('2025-06-20T18:00:00Z'),
      location: 'Centro de Convenções — São Paulo', status: 'planned', progressPercent: 15,
      createdById: adminUser.id, unitId: unitByCode['APS'].id,
    },
    {
      id: 'event-000000-0000-0000-0008',
      name: 'Confraternização de Encerramento do 1º Semestre',
      description: 'Celebração dos resultados do 1º semestre com reconhecimento dos colaboradores destaques, entrega de certificados de conquistas na gamificação. Traje: social.',
      startDate: new Date('2025-07-05T17:00:00Z'), endDate: new Date('2025-07-05T22:00:00Z'),
      location: 'Sede APS Sul — Salão de Eventos', status: 'planned', progressPercent: 5,
      createdById: uu('APS', 0).id, unitId: unitByCode['APS'].id,
    },
  ]
  const createdEvents = []
  for (const ev of eventosData) {
    const evt = await prisma.event.upsert({ where: { id: ev.id }, create: ev, update: {} })
    createdEvents.push(evt)
  }
  // Event responsibles — directors of each unit for all-network events
  const allDirectors = Object.keys(usersByUnit).map(code => uu(code, 0)).filter(Boolean)
  for (const evt of [createdEvents[0], createdEvents[3], createdEvents[6], createdEvents[7]]) {
    for (const dir of allDirectors) {
      await prisma.eventResponsible.upsert({
        where: { eventId_userId: { eventId: evt.id, userId: dir.id } },
        create: { eventId: evt.id, userId: dir.id },
        update: {}
      }).catch(() => {})
    }
  }
  console.log(`✅ ${createdEvents.length} eventos criados`)

  // ─── TAREFAS ─────────────────────────────────────────────────────────────
  const now = new Date()
  const d = (days) => new Date(now.getTime() + days * 86400000)

  const tasksData = [
    // ── Sede / APS
    { id: 'task-00001', title: 'Revisar e aprovar Planos Pedagógicos 1º Semestre',           description: 'Verificar todos os planos enviados pelas unidades escolares, validar alinhamento com a grade curricular APS e retornar feedback até 30/04.', status: 'in_progress', priority: 'critical', progressPercent: 60, dueDate: d(8),   createdById: adminUser.id,    assignedToId: uu('APS', 0).id, unitId: unitByCode['APS'].id },
    { id: 'task-00002', title: 'Preparar relatório trimestral de desempenho da rede',         description: 'Compilar dados de frequência, notas médias e indicadores de engajamento de todas as unidades para apresentação ao Conselho Diretivo.',       status: 'in_progress', priority: 'high',     progressPercent: 45, dueDate: d(12),  createdById: adminUser.id,    assignedToId: uu('APS', 1).id, unitId: unitByCode['APS'].id },
    { id: 'task-00003', title: 'Atualizar cadastros de colaboradores no sistema',             description: 'Revisar dados cadastrais de todos os 143 colaboradores: cargo, unidade, contato e status ativo/inativo.',                                   status: 'pending',     priority: 'medium',   progressPercent: 0,  dueDate: d(15),  createdById: uu('APS', 0).id, assignedToId: uu('APS', 2).id, unitId: unitByCode['APS'].id },
    { id: 'task-00004', title: 'Elaborar pauta do Encontro de Diretores — Maio/2025',        description: 'Definir tópicos, ordem do dia, duração de cada bloco e material de apresentação para o encontro de 10/05.',                               status: 'in_progress', priority: 'high',     progressPercent: 55, dueDate: d(5),   createdById: adminUser.id,    assignedToId: uu('APS', 0).id, unitId: unitByCode['APS'].id },
    { id: 'task-00005', title: 'Concluir orçamento de materiais didáticos 2025',              description: 'Levantar necessidades de cada unidade e consolidar proposta de compra para aprovação financeira.',                                          status: 'completed',   priority: 'high',     progressPercent: 100,dueDate: d(-5),  createdById: uu('APS', 0).id, assignedToId: adminUser.id,    unitId: unitByCode['APS'].id },
    { id: 'task-00006', title: 'Publicar manual de uso da plataforma APS EDU',                description: 'Criar e disponibilizar guia prático com passo a passo para todas as funcionalidades do painel administrativo.',                              status: 'pending',     priority: 'medium',   progressPercent: 20, dueDate: d(20),  createdById: adminUser.id,    assignedToId: uu('APS', 2).id, unitId: unitByCode['APS'].id },

    // ── CATS (Taubaté)
    { id: 'task-00007', title: 'Entregar plano pedagógico — CATS 1º Semestre',               description: 'Finalizar e submeter o plano pedagógico completo de todas as disciplinas ao departamento de educação da APS.',                              status: 'overdue',     priority: 'critical', progressPercent: 80, dueDate: d(-3),  createdById: uu('CATS', 0).id, assignedToId: uu('CATS', 1).id, unitId: unitByCode['CATS'].id },
    { id: 'task-00008', title: 'Organizar Semana da Família — logística e programação',       description: 'Definir programação detalhada, contratar fornecedores (som, buffet), comunicar famílias e treinar equipe de recepção.',                    status: 'in_progress', priority: 'high',     progressPercent: 40, dueDate: d(10),  createdById: uu('CATS', 0).id, assignedToId: uu('CATS', 2).id, unitId: unitByCode['CATS'].id },
    { id: 'task-00009', title: 'Aplicar avaliação diagnóstica — CATS turmas 6º ao 9º',       description: 'Conduzir avaliação de nivelamento nas disciplinas de Português e Matemática e consolidar resultados por turma.',                           status: 'completed',   priority: 'high',     progressPercent: 100,dueDate: d(-10), createdById: uu('CATS', 1).id, assignedToId: uu('CATS', 2).id, unitId: unitByCode['CATS'].id },
    { id: 'task-00010', title: 'Renovar contrato de prestadores de serviço — CATS',          description: 'Verificar vencimento dos contratos com fornecedores de limpeza, segurança e manutenção. Renovar ou publicar novo processo seletivo.',        status: 'pending',     priority: 'medium',   progressPercent: 0,  dueDate: d(25),  createdById: uu('CATS', 0).id, assignedToId: uu('CATS', 4).id, unitId: unitByCode['CATS'].id },
    { id: 'task-00011', title: 'Capacitação em primeiros socorros para docentes — CATS',     description: 'Agendar e organizar treinamento de primeiros socorros para 100% dos professores conforme exigência da ANVISA.',                             status: 'pending',     priority: 'medium',   progressPercent: 0,  dueDate: d(30),  createdById: uu('CATS', 1).id, assignedToId: uu('CATS', 3).id, unitId: unitByCode['CATS'].id },

    // ── CAP (Piracicaba)
    { id: 'task-00012', title: 'Organizar Olimpíada Interna de Matemática — CAP',            description: 'Preparar questões, organizar bancas avaliadoras, reservar salas e comunicar alunos participantes sobre regras e datas.',                    status: 'in_progress', priority: 'high',     progressPercent: 70, dueDate: d(3),   createdById: uu('CAP', 0).id,  assignedToId: uu('CAP', 2).id,  unitId: unitByCode['CAP'].id },
    { id: 'task-00013', title: 'Entregar relatório financeiro — 1º trimestre CAP',           description: 'Consolidar balancete financeiro da unidade e enviar à tesouraria da APS Sul com todos os comprovantes.',                                     status: 'overdue',     priority: 'critical', progressPercent: 90, dueDate: d(-2),  createdById: uu('CAP', 0).id,  assignedToId: uu('CAP', 4).id,  unitId: unitByCode['CAP'].id },
    { id: 'task-00014', title: 'Implantação do programa de tutoria entre pares — CAP',       description: 'Selecionar alunos tutores do 9º ano e 3º médio para apoio individualizado a estudantes com dificuldades de aprendizagem.',                  status: 'pending',     priority: 'medium',   progressPercent: 10, dueDate: d(22),  createdById: uu('CAP', 1).id,  assignedToId: uu('CAP', 2).id,  unitId: unitByCode['CAP'].id },
    { id: 'task-00015', title: 'Compra de equipamentos audiovisuais — CAP',                  description: 'Levantar demanda, obter 3 orçamentos e encaminhar para aprovação. Prioridade para salas sem projetor.',                                      status: 'completed',   priority: 'high',     progressPercent: 100,dueDate: d(-8),  createdById: uu('CAP', 1).id,  assignedToId: uu('CAP', 3).id,  unitId: unitByCode['CAP'].id },

    // ── CACLI (Campinas Leste I)
    { id: 'task-00016', title: 'Montar comissão organizadora da Feira de Ciências — CACLI',  description: 'Selecionar professores coordenadores por área (Biologia, Química, Física) e definir cronograma de preparação dos projetos.',                status: 'in_progress', priority: 'medium',   progressPercent: 50, dueDate: d(7),   createdById: uu('CACLI', 0).id,assignedToId: uu('CACLI', 1).id,unitId: unitByCode['CACLI'].id },
    { id: 'task-00017', title: 'Diagnóstico de infraestrutura — laboratórios CACLI',         description: 'Vistoriar laboratórios de Ciências e Informática, registrar necessidades de manutenção e enviar solicitação.',                               status: 'completed',   priority: 'medium',   progressPercent: 100,dueDate: d(-12), createdById: uu('CACLI', 0).id,assignedToId: uu('CACLI', 2).id,unitId: unitByCode['CACLI'].id },
    { id: 'task-00018', title: 'Formação continuada — professores do Fundamental I CACLI',   description: 'Organizar workshop de 8h sobre metodologias ativas e gamificação em sala de aula para professores do EF1.',                                 status: 'pending',     priority: 'medium',   progressPercent: 0,  dueDate: d(28),  createdById: uu('CACLI', 1).id,assignedToId: uu('CACLI', 2).id,unitId: unitByCode['CACLI'].id },

    // ── CAEGW (Ellen G. White)
    { id: 'task-00019', title: 'Preparar inscrições para o Concurso APS30 — CAEGW',         description: 'Divulgar regulamento, orientar alunos nas categorias (redação, artes, vídeo, música) e coletar inscrições até 31/05.',                      status: 'in_progress', priority: 'medium',   progressPercent: 30, dueDate: d(14),  createdById: uu('CAEGW', 0).id,assignedToId: uu('CAEGW', 1).id,unitId: unitByCode['CAEGW'].id },
    { id: 'task-00020', title: 'Readequação do calendário letivo — reposição CAEGW',        description: 'Replanejar as aulas não ministradas em fevereiro. Enviar novo calendário à APS e comunicar famílias.',                                      status: 'completed',   priority: 'high',     progressPercent: 100,dueDate: d(-6),  createdById: uu('CAEGW', 0).id,assignedToId: uu('CAEGW', 2).id,unitId: unitByCode['CAEGW'].id },
    { id: 'task-00021', title: 'Reunião de pais e mestres — 2º bimestre CAEGW',             description: 'Organizar local, definir horários por turma, preparar boletins e orientar professores para atendimento individualizado.',                      status: 'pending',     priority: 'medium',   progressPercent: 0,  dueDate: d(18),  createdById: uu('CAEGW', 1).id,assignedToId: uu('CAEGW', 3).id,unitId: unitByCode['CAEGW'].id },
    { id: 'task-00022', title: 'Protocolo de prevenção dengue e H1N1 — CAEGW',              description: 'Elaborar e divulgar protocolo de higienização para prevenção de doenças sazonais. Providenciar material de apoio para sala de aula.',         status: 'completed',   priority: 'critical', progressPercent: 100,dueDate: d(-4),  createdById: uu('CAEGW', 0).id,assignedToId: uu('CAEGW', 2).id,unitId: unitByCode['CAEGW'].id },

    // ── CAEA
    { id: 'task-00023', title: 'Cadastro de novos alunos — matrículas 2025 CAEA',           description: 'Processar e validar documentação dos novos alunos matriculados para o 2º semestre. Inserir dados no sistema e emitir declarações.',           status: 'in_progress', priority: 'high',     progressPercent: 65, dueDate: d(9),   createdById: uu('CAEA', 0).id, assignedToId: uu('CAEA', 3).id, unitId: unitByCode['CAEA'].id },
    { id: 'task-00024', title: 'Semana da Bíblia — programação e material CAEA',            description: 'Elaborar programação completa (estudos, palestras, quiz interativo) e produzir material didático para todas as turmas.',                       status: 'in_progress', priority: 'medium',   progressPercent: 45, dueDate: d(11),  createdById: uu('CAEA', 1).id, assignedToId: uu('CAEA', 2).id, unitId: unitByCode['CAEA'].id },
    { id: 'task-00025', title: 'Entrega do relatório de inadimplência — CAEA março',         description: 'Consolidar lista de alunos com mensalidades em atraso e encaminhar ao financeiro da APS Sul com proposta de negociação.',                     status: 'overdue',     priority: 'critical', progressPercent: 70, dueDate: d(-7),  createdById: uu('CAEA', 0).id, assignedToId: uu('CAEA', 3).id, unitId: unitByCode['CAEA'].id },

    // ── EAA
    { id: 'task-00026', title: 'Lançar notas do 1º bimestre — sistema acadêmico EAA',       description: 'Coletar boletins de todos os professores e lançar no sistema acadêmico até o prazo definido pela secretaria.',                              status: 'completed',   priority: 'high',     progressPercent: 100,dueDate: d(-1),  createdById: uu('EAA', 0).id,  assignedToId: uu('EAA', 3).id,  unitId: unitByCode['EAA'].id },
    { id: 'task-00027', title: 'Elaborar projeto de reforço escolar — EAA',                  description: 'Identificar alunos com rendimento abaixo de 50% e montar grade de reforço para disciplinas críticas (Matemática, Português, Ciências).',     status: 'in_progress', priority: 'high',     progressPercent: 40, dueDate: d(13),  createdById: uu('EAA', 0).id,  assignedToId: uu('EAA', 2).id,  unitId: unitByCode['EAA'].id },
    { id: 'task-00028', title: 'Inspeção de segurança patrimonial — EAA',                   description: 'Realizar vistoria de extintores, saídas de emergência e instalações elétricas. Contratar empresa credenciada para laudo técnico.',            status: 'pending',     priority: 'high',     progressPercent: 0,  dueDate: d(20),  createdById: uu('EAA', 0).id,  assignedToId: uu('EAA', 1).id,  unitId: unitByCode['EAA'].id },

    // ── EAJL
    { id: 'task-00029', title: 'Revisão do projeto político-pedagógico — EAJL',             description: 'Atualizar o PPP com as novas diretrizes curriculares e incluir as metas de sustentabilidade exigidas pelo MEC.',                               status: 'in_progress', priority: 'high',     progressPercent: 35, dueDate: d(18),  createdById: uu('EAJL', 0).id, assignedToId: uu('EAJL', 2).id, unitId: unitByCode['EAJL'].id },
    { id: 'task-00030', title: 'Controle de frequência — inserir dados março EAJL',          description: 'Lançar frequência do mês de março para todas as turmas no sistema até o prazo estabelecido pela coordenação.',                               status: 'overdue',     priority: 'high',     progressPercent: 60, dueDate: d(-15), createdById: uu('EAJL', 1).id, assignedToId: uu('EAJL', 3).id, unitId: unitByCode['EAJL'].id },

    // ── EATW / EAVB / EACF / EAP / CAR / CAIS / CACLI II
    { id: 'task-00031', title: 'Ata da reunião pedagógica — abril EATW',                     description: 'Redigir e circular a ata da reunião pedagógica de abril para assinatura de todos os presentes e arquivamento.',                               status: 'in_progress', priority: 'medium',   progressPercent: 80, dueDate: d(2),   createdById: uu('EATW', 1).id, assignedToId: uu('EATW', 2).id, unitId: unitByCode['EATW'].id },
    { id: 'task-00032', title: 'Visita técnica — EAVB alunos 7º e 8º ano',                   description: 'Organizar visita educativa para turmas do 7º e 8º ano. Solicitar ônibus, seguro e autorização dos pais.',                                    status: 'pending',     priority: 'low',      progressPercent: 0,  dueDate: d(35),  createdById: uu('EAVB', 1).id, assignedToId: uu('EAVB', 2).id, unitId: unitByCode['EAVB'].id },
    { id: 'task-00033', title: 'Revisão do cardápio da cantina — EACF nutricionista',        description: 'Solicitar revisão e assinatura do nutricionista responsável no cardápio mensal. Verificar conformidade com normas da ANVISA.',                status: 'pending',     priority: 'medium',   progressPercent: 0,  dueDate: d(20),  createdById: uu('EACF', 0).id, assignedToId: uu('EACF', 2).id, unitId: unitByCode['EACF'].id },
    { id: 'task-00034', title: 'Implementar projeto de leitura — EAP Lê',                   description: 'Criar biblioteca de sala em todas as turmas do EF1, selecionar acervo inicial de 30 títulos por classe e treinar professores.',               status: 'in_progress', priority: 'low',      progressPercent: 25, dueDate: d(35),  createdById: uu('EAP', 0).id,  assignedToId: uu('EAP', 1).id,  unitId: unitByCode['EAP'].id },
    { id: 'task-00035', title: 'Entrega do plano pedagógico — CAIS 1º Semestre',             description: 'Finalizar e submeter o plano pedagógico completo ao departamento de educação da APS.',                                                        status: 'in_progress', priority: 'critical', progressPercent: 75, dueDate: d(4),   createdById: uu('CAIS', 0).id, assignedToId: uu('CAIS', 1).id, unitId: unitByCode['CAIS'].id },
  ]

  let tasksCreated = 0
  const createdTasks = []
  for (const t of tasksData) {
    const task = await prisma.task.upsert({ where: { id: t.id }, create: t, update: {} })
    createdTasks.push(task)
    tasksCreated++
  }
  console.log(`✅ ${tasksCreated} tarefas criadas`)

  // ── Checklists
  const checklistsData = [
    { taskId: 'task-00001', items: ['Receber planos de todas as unidades','Verificar alinhamento curricular','Dar feedback ao CATS','Dar feedback ao CAP','Dar feedback ao CACLI','Aprovar planos conformes'] },
    { taskId: 'task-00004', items: ['Definir tópicos prioritários','Preparar apresentação de resultados','Convidar palestrantes externos','Confirmar local e coffee-break'] },
    { taskId: 'task-00008', items: ['Reservar ginásio e auditório','Contratar serviço de som','Enviar convites às famílias','Treinar equipe de recepção','Preparar programação cultural'] },
    { taskId: 'task-00012', items: ['Elaborar 40 questões por categoria','Selecionar professores avaliadores','Preparar lista de participantes','Comprar medalhas e troféus','Comunicar turmas participantes'] },
    { taskId: 'task-00027', items: ['Levantar alunos com notas < 50%','Definir grade horária de reforço','Selecionar professores tutores','Comunicar famílias','Iniciar aulas de reforço'] },
  ]
  for (const cl of checklistsData) {
    for (let i = 0; i < cl.items.length; i++) {
      await prisma.taskChecklist.upsert({
        where: { id: `cl-${cl.taskId}-${i}` },
        create: { id: `cl-${cl.taskId}-${i}`, taskId: cl.taskId, title: cl.items[i], isCompleted: i < 2, order: i },
        update: {}
      })
    }
  }

  // ── Comentários
  const commentsData = [
    { id: 'cmt-001', taskId: 'task-00001', userId: uu('APS', 0).id,   content: 'Recebi os planos do CATS e do CAP. Ainda aguardo CACLI, CAEGW, CAEA e EAA.' },
    { id: 'cmt-002', taskId: 'task-00001', userId: uu('CATS', 0).id,  content: 'CATS enviou. Confirmo o recebimento. Plano está completo conforme as diretrizes.' },
    { id: 'cmt-003', taskId: 'task-00001', userId: uu('CAP', 0).id,   content: 'CAP já enviou também. Segue em anexo na tarefa.' },
    { id: 'cmt-004', taskId: 'task-00007', userId: uu('CATS', 0).id,  content: 'Estamos finalizando os últimos dois componentes curriculares. Envio até quinta-feira.' },
    { id: 'cmt-005', taskId: 'task-00007', userId: uu('APS', 0).id,   content: 'Atenção: o prazo já passou. Por favor, priorizar a entrega hoje.' },
    { id: 'cmt-006', taskId: 'task-00008', userId: uu('CATS', 2).id,  content: 'Já confirmei o espaço do auditório. Falta fechar o buffet — tenho 2 propostas para analisar.' },
    { id: 'cmt-007', taskId: 'task-00012', userId: uu('CAP', 2).id,   content: 'Questões das categorias bronze e prata já estão prontas. Trabalhando nas de ouro.' },
    { id: 'cmt-008', taskId: 'task-00012', userId: uu('CAP', 0).id,   content: 'Ótimo progresso! Confirmar se precisamos de sala extra para a categoria de 9º ano.' },
    { id: 'cmt-009', taskId: 'task-00013', userId: uu('CAP', 4).id,   content: 'Balancete quase pronto. Falta apenas a conciliação de uma conta do fornecedor de limpeza.' },
    { id: 'cmt-010', taskId: 'task-00025', userId: uu('CAEA', 0).id,  content: 'Lista com 18 alunos inadimplentes. Preciso de orientação do financeiro da APS antes de enviar.' },
    { id: 'cmt-011', taskId: 'task-00002', userId: adminUser.id,      content: 'Dados de frequência já consolidados. Aguardando métricas de engajamento da plataforma.' },
    { id: 'cmt-012', taskId: 'task-00024', userId: uu('CAEA', 2).id,  content: 'Quiz interativo já está preparado para 6 turmas. Material da Semana da Bíblia em impressão.' },
    { id: 'cmt-013', taskId: 'task-00023', userId: uu('CAEA', 3).id,  content: '47 novos alunos cadastrados. Restam 12 com documentação incompleta. Mandei e-mail às famílias.' },
    { id: 'cmt-014', taskId: 'task-00031', userId: uu('EATW', 2).id,  content: 'Ata redigida e enviada para revisão. Aguardando assinaturas de 3 professores.' },
  ]
  for (const c of commentsData) {
    await prisma.taskComment.upsert({
      where: { id: c.id },
      create: { id: c.id, taskId: c.taskId, userId: c.userId, content: c.content },
      update: {}
    }).catch(() => {})
  }
  console.log('✅ Checklists e comentários de tarefas criados')

  // ─── FEEDBACK ─────────────────────────────────────────────────────────────
  const feedbacksData = [
    { id: 'fb-001', category: 'suggestion', content: 'Seria ótimo ter um módulo de comunicação direta entre coordenadores e professores dentro da plataforma, com histórico de mensagens por turma.', isAnonymous: false, userId: uu('CATS', 2).id, status: 'read' },
    { id: 'fb-002', category: 'problem',    content: 'Estou tendo dificuldade para anexar arquivos grandes (acima de 5MB) nas evidências das tarefas. O sistema apresenta erro 413 e não informa claramente o limite.', isAnonymous: false, userId: uu('CAP', 2).id, status: 'resolved' },
    { id: 'fb-003', category: 'idea',       content: 'Proposta: criar um "Mural de Conquistas" visível para todos na tela inicial, onde apareçam os badges recém-conquistados pelos colaboradores. Isso aumentaria a motivação!', isAnonymous: false, userId: uu('CACLI', 1).id, status: 'pending' },
    { id: 'fb-004', category: 'praise',     content: 'Parabéns pela plataforma APS EDU! Está muito intuitiva e organizada. Facilitou muito o nosso dia a dia na coordenação. Esperamos novidades em breve!', isAnonymous: false, userId: uu('CATS', 1).id, status: 'read' },
    { id: 'fb-005', category: 'suggestion', content: 'Sugiro adicionar filtro por unidade na tela de tarefas, para que diretores possam ver rapidamente apenas as tarefas da própria escola sem precisar rolar a lista toda.', isAnonymous: true, userId: null, status: 'pending' },
    { id: 'fb-006', category: 'problem',    content: 'O relatório de desempenho por unidade está demorando muito para carregar (mais de 30 segundos). Isso dificulta o trabalho de análise nos dias de reunião.', isAnonymous: false, userId: uu('EAJL', 1).id, status: 'pending' },
    { id: 'fb-007', category: 'idea',       content: 'Que tal integrar um calendário compartilhado na plataforma, onde todos os eventos da rede apareçam de forma visual? Hoje precisamos consultar e-mails separados.', isAnonymous: false, userId: uu('CAEGW', 1).id, status: 'read' },
    { id: 'fb-008', category: 'praise',     content: 'O sistema de gamificação está sendo um diferencial enorme! Nossa equipe está mais engajada em concluir as tarefas no prazo para ganhar pontos. Excelente iniciativa!', isAnonymous: false, userId: uu('CAEA', 1).id, status: 'read' },
    { id: 'fb-009', category: 'suggestion', content: 'Seria muito útil poder exportar os relatórios em PDF com logo da APS e formatação oficial, para apresentar nas reuniões com pais e conselho escolar.', isAnonymous: false, userId: uu('EAVB', 1).id, status: 'pending' },
    { id: 'fb-010', category: 'problem',    content: 'Na tela de usuários, ao tentar editar o cargo de um colaborador, o sistema fecha o modal sem salvar. Aconteceu comigo 3 vezes hoje.', isAnonymous: true, userId: null, status: 'pending' },
    { id: 'fb-011', category: 'idea',       content: 'VOTAÇÃO — Encontro de Diretores: Opção B (tarde, 13h-17h)', isAnonymous: false, userId: uu('CATS', 0).id, status: 'read' },
    { id: 'fb-012', category: 'idea',       content: 'VOTAÇÃO — Encontro de Diretores: Opção A (manhã, 8h-12h)', isAnonymous: false, userId: uu('CAP', 0).id, status: 'read' },
    { id: 'fb-013', category: 'idea',       content: 'VOTAÇÃO — Encontro de Diretores: Opção B (tarde, 13h-17h)', isAnonymous: false, userId: uu('CACLI', 0).id, status: 'read' },
    { id: 'fb-014', category: 'idea',       content: 'VOTAÇÃO — Encontro de Diretores: Opção A (manhã, 8h-12h)', isAnonymous: false, userId: uu('CAEGW', 0).id, status: 'read' },
    { id: 'fb-015', category: 'idea',       content: 'VOTAÇÃO — Encontro de Diretores: Opção C (período integral, 8h-17h)', isAnonymous: false, userId: uu('CAEA', 0).id, status: 'read' },
    { id: 'fb-016', category: 'idea',       content: 'VOTAÇÃO — Encontro de Diretores: Opção B (tarde, 13h-17h)', isAnonymous: false, userId: uu('EAA', 0).id, status: 'read' },
    { id: 'fb-017', category: 'suggestion', content: 'CA Taubaté indica como representante do Comitê APS30: coordenadora pedagógica da unidade.', isAnonymous: false, userId: uu('CATS', 0).id, status: 'read' },
    { id: 'fb-018', category: 'suggestion', content: 'CA Piracicaba indica como representante do Comitê APS30: vice-diretora da unidade.', isAnonymous: false, userId: uu('CAP', 0).id, status: 'pending' },
    { id: 'fb-019', category: 'praise',     content: 'Agradeço o treinamento de gestão escolar oferecido pela APS. Foi muito enriquecedor e prático. Os conteúdos sobre avaliação por competências foram especialmente úteis!', isAnonymous: false, userId: uu('CACLI', 1).id, status: 'read' },
    { id: 'fb-020', category: 'problem',    content: 'A notificação de badge conquistado apareceu mas o badge não aparece na minha tela de gamificação. Por favor, verificar.', isAnonymous: false, userId: uu('EAJL', 2).id, status: 'pending' },
  ]
  let fbCreated = 0
  for (const fb of feedbacksData) {
    await prisma.feedback.upsert({ where: { id: fb.id }, create: fb, update: {} }).catch(() => {})
    fbCreated++
  }
  console.log(`✅ ${fbCreated} feedbacks criados`)

  // ─── USER BADGES ──────────────────────────────────────────────────────────
  const topUsers = [
    adminUser,
    uu('APS', 0), uu('APS', 1),
    uu('CATS', 0), uu('CAP', 0), uu('CACLI', 0), uu('CAEGW', 0), uu('CAEA', 0),
    uu('EAA', 0), uu('EAJL', 0), uu('EAVB', 0), uu('EACF', 0),
  ]
  const badgeSets = [
    ['badge-01','badge-02','badge-03','badge-04','badge-05','badge-09','badge-11','badge-12','badge-13','badge-14','badge-21','badge-22','badge-31','badge-32','badge-33','badge-34','badge-36','badge-37','badge-46','badge-47'],
    ['badge-01','badge-02','badge-03','badge-04','badge-05','badge-09','badge-11','badge-12','badge-21','badge-22','badge-31','badge-32','badge-33','badge-34','badge-36','badge-46','badge-47'],
    ['badge-01','badge-02','badge-03','badge-04','badge-09','badge-11','badge-12','badge-21','badge-22','badge-31','badge-32','badge-33','badge-46'],
    ['badge-01','badge-02','badge-03','badge-09','badge-11','badge-12','badge-21','badge-31','badge-32','badge-33','badge-46'],
    ['badge-01','badge-02','badge-11','badge-31','badge-32'],
    ['badge-01','badge-02','badge-11','badge-31'],
    ['badge-01','badge-11'],
  ]
  let badgesAwarded = 0
  for (let i = 0; i < topUsers.length; i++) {
    const u = topUsers[i]
    if (!u) continue
    const bset = badgeSets[Math.min(i, badgeSets.length - 1)]
    for (const badgeId of bset) {
      try {
        await prisma.userBadge.upsert({
          where: { userId_badgeId: { userId: u.id, badgeId } },
          create: { userId: u.id, badgeId, notified: true },
          update: {}
        })
        badgesAwarded++
      } catch (_) {}
    }
  }
  // Give initial badges to all other directors
  for (const code of Object.keys(usersByUnit)) {
    const dir = uu(code, 0)
    if (topUsers.includes(dir)) continue
    for (const badgeId of ['badge-01', 'badge-11', 'badge-31']) {
      try {
        await prisma.userBadge.upsert({
          where: { userId_badgeId: { userId: dir.id, badgeId } },
          create: { userId: dir.id, badgeId, notified: true },
          update: {}
        })
        badgesAwarded++
      } catch (_) {}
    }
  }
  console.log(`✅ ${badgesAwarded} badges atribuídos`)

  console.log('\n🎉 Seed concluído com sucesso!')
  console.log('\n📋 Credenciais de acesso:')
  console.log('   Admin:     admin@aps.edu.br         | Admin@123')
  console.log('   Diretores: <primeiro>.<sobrenome>@aps.edu.br | Diretor@123')
  console.log('   Demais:    <primeiro>.<sobrenome>@aps.edu.br | Teste@123')
  console.log('\n📊 Resumo:')
  console.log(`   • 143 usuários (1 admin + 142 pessoas reais) em 15 unidades reais`)
  console.log('   • 35 tarefas (pending/in_progress/completed/overdue)')
  console.log('   • 8 eventos (planned/ongoing/completed)')
  console.log('   • 4 avisos com leituras')
  console.log('   • 20 feedbacks')
  console.log('   • 50 selos disponíveis + badges atribuídos')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
