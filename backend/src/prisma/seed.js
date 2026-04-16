const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...\n')

  // ─── ROLES ────────────────────────────────────────────────────────────────
  const roles = await Promise.all([
    prisma.role.upsert({ where: { slug: 'admin' }, create: { name: 'Administrador', slug: 'admin', permissions: { canCreateTasks: true, canCreateEvents: true, canPublishAnnouncements: true, canViewAllData: true, canManageUsers: true, canViewReports: true, canGrantBadges: true } }, update: {} }),
    prisma.role.upsert({ where: { slug: 'director' }, create: { name: 'Diretor', slug: 'director', permissions: { canCreateTasks: true, canCreateEvents: true, canPublishAnnouncements: true, canViewAllData: true, canManageUsers: false, canViewReports: true, canGrantBadges: false } }, update: {} }),
    prisma.role.upsert({ where: { slug: 'vice_director' }, create: { name: 'Vice-Diretor', slug: 'vice_director', permissions: { canCreateTasks: true, canCreateEvents: false, canPublishAnnouncements: false, canViewAllData: false, canManageUsers: false, canViewReports: true, canGrantBadges: false } }, update: {} }),
    prisma.role.upsert({ where: { slug: 'coordinator' }, create: { name: 'Coordenador', slug: 'coordinator', permissions: { canCreateTasks: true, canCreateEvents: false, canPublishAnnouncements: false, canViewAllData: false, canManageUsers: false, canViewReports: false, canGrantBadges: false } }, update: {} }),
    prisma.role.upsert({ where: { slug: 'chaplain' }, create: { name: 'Capelão', slug: 'chaplain', permissions: { canCreateTasks: false, canCreateEvents: false, canPublishAnnouncements: false, canViewAllData: false, canManageUsers: false, canViewReports: false, canGrantBadges: false } }, update: {} }),
    prisma.role.upsert({ where: { slug: 'treasurer' }, create: { name: 'Tesoureiro', slug: 'treasurer', permissions: { canCreateTasks: false, canCreateEvents: false, canPublishAnnouncements: false, canViewAllData: false, canManageUsers: false, canViewReports: false, canGrantBadges: false } }, update: {} }),
    prisma.role.upsert({ where: { slug: 'disciplinary' }, create: { name: 'Disciplinar', slug: 'disciplinary', permissions: { canCreateTasks: true, canCreateEvents: false, canPublishAnnouncements: false, canViewAllData: false, canManageUsers: false, canViewReports: false, canGrantBadges: false } }, update: {} }),
    prisma.role.upsert({ where: { slug: 'counselor' }, create: { name: 'Orientador', slug: 'counselor', permissions: { canCreateTasks: false, canCreateEvents: false, canPublishAnnouncements: false, canViewAllData: false, canManageUsers: false, canViewReports: false, canGrantBadges: false } }, update: {} }),
    prisma.role.upsert({ where: { slug: 'secretary' }, create: { name: 'Secretária', slug: 'secretary', permissions: { canCreateTasks: false, canCreateEvents: false, canPublishAnnouncements: false, canViewAllData: false, canManageUsers: false, canViewReports: false, canGrantBadges: false } }, update: {} })
  ])
  console.log(`✅ ${roles.length} funções criadas`)

  // ─── UNITS ────────────────────────────────────────────────────────────────
  const units = await Promise.all([
    prisma.unit.upsert({ where: { id: '00000000-0000-0000-0000-000000000001' }, create: { id: '00000000-0000-0000-0000-000000000001', name: 'Sede APS — Departamento de Educação', city: 'São Paulo', type: 'headquarters', region: 'SP' }, update: {} }),
    prisma.unit.upsert({ where: { id: '00000000-0000-0000-0000-000000000002' }, create: { id: '00000000-0000-0000-0000-000000000002', name: 'Colégio Adventista do Ipiranga', city: 'São Paulo', type: 'school', region: 'SP' }, update: {} }),
    prisma.unit.upsert({ where: { id: '00000000-0000-0000-0000-000000000003' }, create: { id: '00000000-0000-0000-0000-000000000003', name: 'Colégio Adventista de Santo André', city: 'Santo André', type: 'school', region: 'SP' }, update: {} }),
    prisma.unit.upsert({ where: { id: '00000000-0000-0000-0000-000000000004' }, create: { id: '00000000-0000-0000-0000-000000000004', name: 'Colégio Adventista de Mauá', city: 'Mauá', type: 'school', region: 'SP' }, update: {} }),
    prisma.unit.upsert({ where: { id: '00000000-0000-0000-0000-000000000005' }, create: { id: '00000000-0000-0000-0000-000000000005', name: 'Colégio Adventista de São Bernardo', city: 'São Bernardo do Campo', type: 'school', region: 'SP' }, update: {} }),
    prisma.unit.upsert({ where: { id: '00000000-0000-0000-0000-000000000006' }, create: { id: '00000000-0000-0000-0000-000000000006', name: 'Colégio Adventista de Diadema', city: 'Diadema', type: 'school', region: 'SP' }, update: {} }),
    prisma.unit.upsert({ where: { id: '00000000-0000-0000-0000-000000000007' }, create: { id: '00000000-0000-0000-0000-000000000007', name: 'Colégio Adventista de Guarulhos', city: 'Guarulhos', type: 'school', region: 'SP' }, update: {} }),
  ])
  console.log(`✅ ${units.length} unidades criadas`)

  const unit        = units[0]
  const unitIpiranga  = units[1]
  const unitAndre     = units[2]
  const unitMaua      = units[3]
  const unitBernardo  = units[4]
  const unitDiadema   = units[5]
  const unitGua       = units[6]

  // ─── ROLES MAP ────────────────────────────────────────────────────────────
  const roleMap = Object.fromEntries(roles.map(r => [r.slug, r]))

  // ─── HASH PADRÃO ─────────────────────────────────────────────────────────
  const defaultHash = await bcrypt.hash('Teste@123', 10)
  const adminHash   = await bcrypt.hash('Admin@123', 10)
  const dirHash     = await bcrypt.hash('Diretor@123', 10)

  // ─── USUÁRIOS ─────────────────────────────────────────────────────────────
  const usersData = [
    // ── Admins / Sede
    { name: 'Administrador APS',       email: 'admin@aps.edu.br',          hash: adminHash, role: 'admin',         unit: unit },
    { name: 'João Paulo Silva',         email: 'diretor@aps.edu.br',         hash: dirHash,   role: 'director',      unit: unit },
    { name: 'Maria Santos',             email: 'coord@aps.edu.br',           hash: defaultHash, role: 'coordinator', unit: unitIpiranga },

    // ── Ipiranga
    { name: 'Carlos Eduardo Moreira',   email: 'carlos.moreira@aps.edu.br',  hash: defaultHash, role: 'director',      unit: unitIpiranga },
    { name: 'Ana Claudia Ferreira',     email: 'ana.ferreira@aps.edu.br',    hash: defaultHash, role: 'vice_director',  unit: unitIpiranga },
    { name: 'Roberto Mendes',           email: 'roberto.mendes@aps.edu.br',  hash: defaultHash, role: 'coordinator',   unit: unitIpiranga },
    { name: 'Fernanda Lima',            email: 'fernanda.lima@aps.edu.br',   hash: defaultHash, role: 'chaplain',      unit: unitIpiranga },
    { name: 'Thiago Costa',             email: 'thiago.costa@aps.edu.br',    hash: defaultHash, role: 'treasurer',     unit: unitIpiranga },

    // ── Santo André
    { name: 'Patricia Oliveira',        email: 'patricia.oliveira@aps.edu.br', hash: defaultHash, role: 'director',    unit: unitAndre },
    { name: 'Lucas Andrade',            email: 'lucas.andrade@aps.edu.br',   hash: defaultHash, role: 'vice_director',  unit: unitAndre },
    { name: 'Juliana Rocha',            email: 'juliana.rocha@aps.edu.br',   hash: defaultHash, role: 'coordinator',   unit: unitAndre },
    { name: 'Marcelo Souza',            email: 'marcelo.souza@aps.edu.br',   hash: defaultHash, role: 'disciplinary',  unit: unitAndre },
    { name: 'Camila Pereira',           email: 'camila.pereira@aps.edu.br',  hash: defaultHash, role: 'secretary',     unit: unitAndre },

    // ── Mauá
    { name: 'Eduardo Nascimento',       email: 'eduardo.nascimento@aps.edu.br', hash: defaultHash, role: 'director',   unit: unitMaua },
    { name: 'Beatriz Alves',            email: 'beatriz.alves@aps.edu.br',   hash: defaultHash, role: 'coordinator',   unit: unitMaua },
    { name: 'Rafael Carvalho',          email: 'rafael.carvalho@aps.edu.br', hash: defaultHash, role: 'chaplain',      unit: unitMaua },
    { name: 'Isabela Martins',          email: 'isabela.martins@aps.edu.br', hash: defaultHash, role: 'counselor',     unit: unitMaua },
    { name: 'Gustavo Ribeiro',          email: 'gustavo.ribeiro@aps.edu.br', hash: defaultHash, role: 'treasurer',     unit: unitMaua },

    // ── São Bernardo
    { name: 'Vanessa Torres',           email: 'vanessa.torres@aps.edu.br',  hash: defaultHash, role: 'director',      unit: unitBernardo },
    { name: 'Felipe Barbosa',           email: 'felipe.barbosa@aps.edu.br',  hash: defaultHash, role: 'vice_director',  unit: unitBernardo },
    { name: 'Larissa Gomes',            email: 'larissa.gomes@aps.edu.br',   hash: defaultHash, role: 'secretary',     unit: unitBernardo },
    { name: 'Diego Freitas',            email: 'diego.freitas@aps.edu.br',   hash: defaultHash, role: 'disciplinary',  unit: unitBernardo },
    { name: 'Natalia Cardoso',          email: 'natalia.cardoso@aps.edu.br', hash: defaultHash, role: 'counselor',     unit: unitBernardo },

    // ── Diadema
    { name: 'Anderson Castro',          email: 'anderson.castro@aps.edu.br', hash: defaultHash, role: 'director',      unit: unitDiadema },
    { name: 'Renata Melo',              email: 'renata.melo@aps.edu.br',     hash: defaultHash, role: 'coordinator',   unit: unitDiadema },
    { name: 'Bruno Teixeira',           email: 'bruno.teixeira@aps.edu.br',  hash: defaultHash, role: 'chaplain',      unit: unitDiadema },
    { name: 'Aline Correia',            email: 'aline.correia@aps.edu.br',   hash: defaultHash, role: 'secretary',     unit: unitDiadema },

    // ── Guarulhos
    { name: 'Paulo Henrique Dias',      email: 'paulo.dias@aps.edu.br',      hash: defaultHash, role: 'director',      unit: unitGua },
    { name: 'Tatiane Nunes',            email: 'tatiane.nunes@aps.edu.br',   hash: defaultHash, role: 'vice_director',  unit: unitGua },
    { name: 'Victor Hugo Pinto',        email: 'victor.pinto@aps.edu.br',    hash: defaultHash, role: 'coordinator',   unit: unitGua },
    { name: 'Claudia Ramos',            email: 'claudia.ramos@aps.edu.br',   hash: defaultHash, role: 'treasurer',     unit: unitGua },
    { name: 'Rodrigo Leal',             email: 'rodrigo.leal@aps.edu.br',    hash: defaultHash, role: 'counselor',     unit: unitGua },
  ]

  let usersCreated = 0
  const createdUsers = []
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        name: u.name,
        email: u.email,
        passwordHash: u.hash,
        roleId: roleMap[u.role].id,
        unitId: u.unit.id,
      },
      update: {}
    })
    createdUsers.push(user)
    usersCreated++
  }
  console.log(`✅ ${usersCreated} usuários criados`)

  // ─── USER POINTS (gamificação realista) ───────────────────────────────────
  const pointsData = [
    // [index no usersData, points, tasksCompleted, tasksOnTime, loginStreak]
    [0,  4200, 87, 82, 45],  // admin
    [1,  3850, 72, 65, 38],  // diretor sede
    [2,  2980, 61, 55, 29],  // coord
    [3,  2650, 54, 48, 22],  // carlos ipiranga
    [4,  2410, 48, 43, 19],  // ana
    [5,  1980, 39, 34, 15],  // roberto
    [6,  1740, 33, 28, 12],  // fernanda
    [7,  1520, 27, 23, 10],  // thiago
    [8,  3100, 65, 59, 31],  // patricia andre
    [9,  2200, 44, 39, 17],  // lucas
    [10, 1870, 36, 31, 14],  // juliana
    [11, 1450, 28, 24, 9],   // marcelo
    [12, 1200, 22, 18, 7],   // camila
    [13, 2750, 56, 50, 25],  // eduardo maua
    [14, 1640, 31, 27, 11],  // beatriz
    [15, 1390, 25, 20, 8],   // rafael
    [16, 1150, 20, 16, 6],   // isabela
    [17,  980, 17, 13, 5],   // gustavo
    [18, 2480, 50, 45, 20],  // vanessa bernardo
    [19, 1760, 34, 30, 13],  // felipe
    [20, 1320, 24, 20, 8],   // larissa
    [21, 1080, 19, 15, 6],   // diego
    [22,  870, 14, 11, 4],   // natalia
    [23, 2190, 43, 38, 16],  // anderson diadema
    [24, 1580, 30, 25, 10],  // renata
    [25, 1240, 23, 18, 7],   // bruno
    [26,  940, 16, 12, 5],   // aline
    [27, 2340, 47, 42, 18],  // paulo gua
    [28, 1690, 32, 28, 12],  // tatiane
    [29, 1430, 26, 22, 9],   // victor
    [30,  820, 13, 10, 3],   // claudia
    [31,  650, 10,  8, 2],   // rodrigo
  ]

  let pointsCreated = 0
  for (const [idx, points, tasksCompleted, tasksOnTime, loginStreak] of pointsData) {
    if (!createdUsers[idx]) continue
    await prisma.userPoints.upsert({
      where: { userId: createdUsers[idx].id },
      create: {
        userId: createdUsers[idx].id,
        points,
        tasksCompleted,
        tasksOnTime,
        loginStreak,
        tasksCreated: Math.floor(tasksCompleted * 0.6),
        eventsParticipated: Math.floor(points / 400),
        commentsPosted: Math.floor(tasksCompleted * 1.5),
        evidencesUploaded: Math.floor(tasksCompleted * 0.8),
        announcementsRead: Math.floor(points / 150),
        lastLoginDate: new Date(),
      },
      update: {}
    })
    pointsCreated++
  }
  console.log(`✅ ${pointsCreated} registros de pontos criados`)

  // ─── AVISOS ───────────────────────────────────────────────────────────────
  const adminUser  = createdUsers[0]
  const dirUser    = createdUsers[1]

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
      type: 'celebration',
      authorId: adminUser.id,
      publishAt: new Date('2025-04-01T08:00:00Z'),
      expiresAt: null,
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

— João Paulo Silva · Diretor de Educação`,
      type: 'warning',
      authorId: dirUser.id,
      publishAt: new Date('2025-04-10T09:00:00Z'),
      expiresAt: new Date('2025-04-30T23:59:00Z'),
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

O resultado será anunciado até 26/04/2025 e o horário definido na sequência.

Contamos com sua participação! 🙌

— Departamento de Educação · APS Sul`,
      type: 'info',
      authorId: adminUser.id,
      publishAt: new Date('2025-04-15T07:30:00Z'),
      expiresAt: new Date('2025-04-25T23:59:00Z'),
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
      type: 'celebration',
      authorId: adminUser.id,
      publishAt: new Date('2025-04-05T08:00:00Z'),
      expiresAt: null,
    },
  ]

  for (const aviso of avisos) {
    await prisma.announcement.upsert({
      where: { id: aviso.id },
      create: aviso,
      update: {}
    })
  }

  // Marcar alguns avisos como lidos por usuários
  const readData = [
    { announcementId: 'aviso-00000000-0000-0000-0001', userIdx: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
    { announcementId: 'aviso-00000000-0000-0000-0002', userIdx: [1, 2, 3, 4, 5, 8, 9, 13, 18, 23, 27] },
    { announcementId: 'aviso-00000000-0000-0000-0003', userIdx: [1, 3, 4, 8, 9, 13, 18, 19, 23, 24, 27, 28] },
    { announcementId: 'aviso-00000000-0000-0000-0004', userIdx: [1, 2, 3, 4, 5, 6, 8, 9, 10, 13, 14, 18, 19, 23, 27] },
  ]

  for (const rd of readData) {
    for (const idx of rd.userIdx) {
      if (!createdUsers[idx]) continue
      await prisma.announcementRead.upsert({
        where: { announcementId_userId: { announcementId: rd.announcementId, userId: createdUsers[idx].id } },
        create: { announcementId: rd.announcementId, userId: createdUsers[idx].id },
        update: {}
      })
    }
  }
  console.log(`✅ ${avisos.length} avisos criados com leituras`)

  // ─── 50 BADGES ───────────────────────────────────────────────────────────
  const badges = [
    // COMPROMETIMENTO
    { name: 'Primeira Missão', description: 'Deu o primeiro passo', criteria: 'Concluir a 1ª tarefa', category: 'commitment', level: 'bronze', pointsReward: 30, order: 1, unlockRule: { type: 'tasks_completed', count: 1 } },
    { name: 'Dedicação Inicial', description: 'Começa com tudo', criteria: 'Concluir 5 tarefas', category: 'commitment', level: 'bronze', pointsReward: 50, order: 2, unlockRule: { type: 'tasks_completed', count: 5 } },
    { name: 'Em Pleno Vapor', description: 'Ritmo crescente de trabalho', criteria: 'Concluir 15 tarefas', category: 'commitment', level: 'bronze', pointsReward: 80, order: 3, unlockRule: { type: 'tasks_completed', count: 15 } },
    { name: 'Nunca Desiste', description: 'Persistência comprovada', criteria: 'Concluir 30 tarefas', category: 'commitment', level: 'silver', pointsReward: 120, order: 4, unlockRule: { type: 'tasks_completed', count: 30 } },
    { name: 'Mão na Massa', description: 'Execução consistente', criteria: 'Concluir 50 tarefas', category: 'commitment', level: 'silver', pointsReward: 200, order: 5, unlockRule: { type: 'tasks_completed', count: 50 } },
    { name: 'Pilar da Equipe', description: 'Compromisso inabalável', criteria: 'Concluir 100 tarefas', category: 'commitment', level: 'silver', pointsReward: 300, order: 6, unlockRule: { type: 'tasks_completed', count: 100 } },
    { name: 'Força Total', description: 'Produção excepcional', criteria: 'Concluir 200 tarefas', category: 'commitment', level: 'gold', pointsReward: 500, order: 7, unlockRule: { type: 'tasks_completed', count: 200 } },
    { name: 'Guardião da Missão', description: 'Zelar pela equipe', criteria: 'Ter login streak de 30 dias', category: 'commitment', level: 'gold', pointsReward: 400, order: 8, unlockRule: { type: 'login_streak', days: 30 } },
    { name: 'Presença Constante', description: 'Login diário consistente', criteria: '7 dias consecutivos de login', category: 'commitment', level: 'silver', pointsReward: 150, order: 9, unlockRule: { type: 'login_streak', days: 7 } },
    { name: 'Comprometimento Total', description: 'Marca registrada', criteria: 'Login streak de 60 dias', category: 'commitment', level: 'gold', pointsReward: 600, order: 10, unlockRule: { type: 'login_streak', days: 60 } },
    // PONTUALIDADE
    { name: 'No Horário', description: 'Entrega pontual', criteria: '5 tarefas no prazo', category: 'punctuality', level: 'bronze', pointsReward: 60, order: 11, unlockRule: { type: 'tasks_on_time', count: 5 } },
    { name: 'Relojoeiro', description: 'Precisão de entrega', criteria: '15 tarefas no prazo', category: 'punctuality', level: 'bronze', pointsReward: 100, order: 12, unlockRule: { type: 'tasks_on_time', count: 15 } },
    { name: 'Antes do Previsto', description: 'Vai além do esperado', criteria: '3 tarefas no prazo', category: 'punctuality', level: 'bronze', pointsReward: 70, order: 13, unlockRule: { type: 'tasks_on_time', count: 3 } },
    { name: 'Mestre do Tempo', description: 'Gestão exemplar do tempo', criteria: '30 tarefas no prazo', category: 'punctuality', level: 'silver', pointsReward: 180, order: 14, unlockRule: { type: 'tasks_on_time', count: 30 } },
    { name: 'Velocidade Leal', description: 'Rápido e preciso', criteria: '50 tarefas no prazo', category: 'punctuality', level: 'silver', pointsReward: 250, order: 15, unlockRule: { type: 'tasks_on_time', count: 50 } },
    { name: 'Sem Atrasos', description: 'Sequência perfeita', criteria: '75 tarefas no prazo', category: 'punctuality', level: 'silver', pointsReward: 300, order: 16, unlockRule: { type: 'tasks_on_time', count: 75 } },
    { name: 'Executor Preciso', description: 'Pontualidade absoluta', criteria: '100 tarefas no prazo', category: 'punctuality', level: 'gold', pointsReward: 450, order: 17, unlockRule: { type: 'tasks_on_time', count: 100 } },
    { name: 'Além do Limite', description: 'Supera expectativas', criteria: '150 tarefas no prazo', category: 'punctuality', level: 'gold', pointsReward: 500, order: 18, unlockRule: { type: 'tasks_on_time', count: 150 } },
    { name: 'Maratona Pontual', description: 'Consistência ao longo do tempo', criteria: '200 tarefas no prazo', category: 'punctuality', level: 'gold', pointsReward: 600, order: 19, unlockRule: { type: 'tasks_on_time', count: 200 } },
    { name: 'Lendário do Prazo', description: 'Pontualidade histórica', criteria: '300 tarefas no prazo', category: 'punctuality', level: 'gold', pointsReward: 800, order: 20, unlockRule: { type: 'tasks_on_time', count: 300 } },
    // PRODUTIVIDADE
    { name: 'Sprint Inicial', description: 'Início acelerado', criteria: 'Enviar 3 evidências', category: 'productivity', level: 'bronze', pointsReward: 40, order: 21, unlockRule: { type: 'evidences_uploaded', count: 3 } },
    { name: 'Semana Poderosa', description: 'Alta produção semanal', criteria: 'Enviar 10 evidências', category: 'productivity', level: 'bronze', pointsReward: 80, order: 22, unlockRule: { type: 'evidences_uploaded', count: 10 } },
    { name: 'Checklist Completo', description: 'Detalhe que importa', criteria: 'Enviar 25 evidências', category: 'productivity', level: 'bronze', pointsReward: 120, order: 23, unlockRule: { type: 'evidences_uploaded', count: 25 } },
    { name: 'Evidências em Dia', description: 'Documentação impecável', criteria: 'Enviar 50 evidências', category: 'productivity', level: 'silver', pointsReward: 200, order: 24, unlockRule: { type: 'evidences_uploaded', count: 50 } },
    { name: 'Mês Produtivo', description: 'Mês de alta performance', criteria: 'Enviar 100 evidências', category: 'productivity', level: 'silver', pointsReward: 350, order: 25, unlockRule: { type: 'evidences_uploaded', count: 100 } },
    { name: 'Multitarefa', description: 'Vários focos simultâneos', criteria: '20 tarefas criadas', category: 'productivity', level: 'bronze', pointsReward: 100, order: 26, unlockRule: { type: 'tasks_created', count: 20 } },
    { name: 'Excelência Documental', description: 'Qualidade de registro', criteria: '50 tarefas criadas', category: 'productivity', level: 'silver', pointsReward: 200, order: 27, unlockRule: { type: 'tasks_created', count: 50 } },
    { name: 'Máquina de Resultados', description: 'Produção máxima', criteria: '100 tarefas criadas', category: 'productivity', level: 'gold', pointsReward: 400, order: 28, unlockRule: { type: 'tasks_created', count: 100 } },
    { name: 'Trimestre de Ouro', description: 'Alta produção contínua', criteria: '150 tarefas criadas', category: 'productivity', level: 'gold', pointsReward: 500, order: 29, unlockRule: { type: 'tasks_created', count: 150 } },
    { name: 'Velocidade de Cruzeiro', description: 'Performance sustentável', criteria: '1000 pontos totais', category: 'productivity', level: 'gold', pointsReward: 300, order: 30, unlockRule: { type: 'total_points', points: 1000 } },
    // EXCELÊNCIA
    { name: 'Primeira Estrela', description: 'Reconhecimento inicial', criteria: '100 pontos acumulados', category: 'excellence', level: 'bronze', pointsReward: 50, order: 31, unlockRule: { type: 'total_points', points: 100 } },
    { name: 'Padrão de Qualidade', description: 'Qualidade reconhecida', criteria: '300 pontos acumulados', category: 'excellence', level: 'bronze', pointsReward: 80, order: 32, unlockRule: { type: 'total_points', points: 300 } },
    { name: 'Destaque da Semana', description: 'Melhor da semana', criteria: '500 pontos acumulados', category: 'excellence', level: 'silver', pointsReward: 150, order: 33, unlockRule: { type: 'total_points', points: 500 } },
    { name: 'Destaque do Mês', description: 'Melhor do mês', criteria: '1000 pontos acumulados', category: 'excellence', level: 'silver', pointsReward: 200, order: 34, unlockRule: { type: 'total_points', points: 1000 } },
    { name: 'Feedback Positivo', description: 'Reconhecimento externo', criteria: '10 comentários postados', category: 'excellence', level: 'bronze', pointsReward: 80, order: 35, unlockRule: { type: 'comments_posted', count: 10 } },
    { name: 'Modelo a Seguir', description: 'Referência de qualidade', criteria: '2000 pontos acumulados', category: 'excellence', level: 'silver', pointsReward: 300, order: 36, unlockRule: { type: 'total_points', points: 2000 } },
    { name: 'Nível Elite', description: 'Alta performance contínua', criteria: '3500 pontos acumulados', category: 'excellence', level: 'gold', pointsReward: 400, order: 37, unlockRule: { type: 'total_points', points: 3500 } },
    { name: 'Campeão Trimestral', description: 'Melhor do trimestre', criteria: '6000 pontos acumulados', category: 'excellence', level: 'gold', pointsReward: 500, order: 38, unlockRule: { type: 'total_points', points: 6000 } },
    { name: 'Polo de Excelência', description: 'Referência institucional', criteria: '8000 pontos acumulados', category: 'excellence', level: 'gold', pointsReward: 600, order: 39, unlockRule: { type: 'total_points', points: 8000 } },
    { name: 'Lenda Viva', description: 'Legado de excelência', criteria: '10000 pontos acumulados', category: 'excellence', level: 'gold', pointsReward: 1000, order: 40, unlockRule: { type: 'total_points', points: 10000 } },
    // TRABALHO EM EQUIPE
    { name: 'Voz Ativa', description: 'Contribui com o grupo', criteria: '10 comentários postados em tarefas', category: 'teamwork', level: 'bronze', pointsReward: 80, order: 41, unlockRule: { type: 'comments_posted', count: 10 } },
    { name: 'Apoio Mútuo', description: 'Sempre presente para a equipe', criteria: '25 comentários postados', category: 'teamwork', level: 'silver', pointsReward: 150, order: 42, unlockRule: { type: 'comments_posted', count: 25 } },
    { name: 'União de Forças', description: 'Colaboração contínua', criteria: '50 comentários postados', category: 'teamwork', level: 'silver', pointsReward: 250, order: 43, unlockRule: { type: 'comments_posted', count: 50 } },
    { name: 'Elo da Corrente', description: 'Peça fundamental da equipe', criteria: '100 comentários postados', category: 'teamwork', level: 'gold', pointsReward: 400, order: 44, unlockRule: { type: 'comments_posted', count: 100 } },
    { name: 'Coração da Equipe', description: 'Referência humana', criteria: '200 comentários postados', category: 'teamwork', level: 'gold', pointsReward: 600, order: 45, unlockRule: { type: 'comments_posted', count: 200 } },
    // LIDERANÇA
    { name: 'Primeiro Passo', description: 'Inicia a liderança', criteria: 'Criar primeira tarefa', category: 'leadership', level: 'bronze', pointsReward: 50, order: 46, unlockRule: { type: 'tasks_created', count: 1 } },
    { name: 'Gestor Ativo', description: 'Gestão em prática', criteria: 'Criar 10 tarefas', category: 'leadership', level: 'silver', pointsReward: 150, order: 47, unlockRule: { type: 'tasks_created', count: 10 } },
    { name: 'Organizador de Eventos', description: 'Domina a execução', criteria: 'Criar 3 eventos', category: 'leadership', level: 'silver', pointsReward: 200, order: 48, unlockRule: { type: 'events_created', count: 3 } },
    { name: 'Comunicador Oficial', description: 'Voz da instituição', criteria: 'Publicar 10 avisos', category: 'leadership', level: 'silver', pointsReward: 200, order: 49, unlockRule: { type: 'announcements_published', count: 10 } },
    { name: 'Líder Completo', description: 'Gestão plena e exemplar', criteria: '100 tarefas criadas E 3 eventos criados', category: 'leadership', level: 'gold', pointsReward: 1000, order: 50, unlockRule: { type: 'composite', operator: 'AND', rules: [{ type: 'tasks_created', count: 100 }, { type: 'events_created', count: 3 }] } }
  ]

  let badgesCreated = 0
  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { id: `badge-${badge.order.toString().padStart(2, '0')}` },
      create: { id: `badge-${badge.order.toString().padStart(2, '0')}`, ...badge },
      update: {}
    })
    badgesCreated++
  }
  console.log(`✅ ${badgesCreated} selos criados`)

  console.log('\n🎉 Seed concluído com sucesso!')
  console.log('\n📋 Credenciais de acesso:')
  console.log('   Admin:    admin@aps.edu.br       | Admin@123')
  console.log('   Diretor:  diretor@aps.edu.br     | Diretor@123')
  console.log('   Outros:   <email>@aps.edu.br     | Teste@123\n')
  console.log('👥 Usuários criados por unidade:')
  console.log('   • Sede APS (2) • Ipiranga (6) • Santo André (5)')
  console.log('   • Mauá (5) • São Bernardo (5) • Diadema (4) • Guarulhos (5)')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
