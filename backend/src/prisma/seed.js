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

  // ─── EVENTOS ─────────────────────────────────────────────────────────────
  // Atalhos para criadores (índices em createdUsers)
  const u = (i) => createdUsers[i]  // helper

  const eventosData = [
    {
      id: 'event-000000-0000-0000-0001',
      name: 'Encontro de Diretores APS Sul 2025',
      description: 'Reunião anual de liderança com foco em metas pedagógicas, resultados do 1º trimestre e planejamento estratégico do 2º semestre. Presença obrigatória de todos os diretores e vice-diretores da rede.',
      startDate: new Date('2025-05-10T08:00:00Z'),
      endDate:   new Date('2025-05-10T17:00:00Z'),
      location:  'Sede APS — Auditório Principal, São Paulo',
      status:    'planned',
      progressPercent: 35,
      createdById: u(0).id,
      unitId:    unit.id,
    },
    {
      id: 'event-000000-0000-0000-0002',
      name: 'Semana da Família — Colégio Ipiranga',
      description: 'Programação especial de integração com as famílias dos alunos, incluindo apresentações culturais, reuniões pedagógicas abertas e atividades recreativas. Evento estratégico para engajamento da comunidade escolar.',
      startDate: new Date('2025-05-19T08:00:00Z'),
      endDate:   new Date('2025-05-23T17:00:00Z'),
      location:  'Colégio Adventista do Ipiranga — Quadra e Auditório',
      status:    'planned',
      progressPercent: 20,
      createdById: u(3).id,
      unitId:    unitIpiranga.id,
    },
    {
      id: 'event-000000-0000-0000-0003',
      name: 'Olimpíada Interna de Matemática — Santo André',
      description: 'Competição entre turmas do Ensino Fundamental II e Médio. Premiação com troféus e medalhas para os 3 primeiros colocados de cada categoria. Inscrições encerradas.',
      startDate: new Date('2025-04-25T08:00:00Z'),
      endDate:   new Date('2025-04-25T16:00:00Z'),
      location:  'Colégio Adventista de Santo André — Salas de Aula',
      status:    'planned',
      progressPercent: 70,
      createdById: u(8).id,
      unitId:    unitAndre.id,
    },
    {
      id: 'event-000000-0000-0000-0004',
      name: 'Culto de Abertura do 1º Semestre — Rede APS Sul',
      description: 'Culto comemorativo de abertura do ano letivo 2025 com participação de todas as unidades. Transmissão ao vivo pelo canal oficial. Mensagem do presidente da APS Sul e homenagem aos colaboradores com mais de 10 anos na rede.',
      startDate: new Date('2025-02-05T07:30:00Z'),
      endDate:   new Date('2025-02-05T10:00:00Z'),
      location:  'Igreja Central Adventista — São Paulo (SP)',
      status:    'completed',
      progressPercent: 100,
      createdById: u(0).id,
      unitId:    unit.id,
    },
    {
      id: 'event-000000-0000-0000-0005',
      name: 'Treinamento em Gestão Escolar — Coordenadores',
      description: 'Capacitação de dois dias voltada para coordenadores pedagógicos, com foco em liderança de equipes, gestão de conflitos, avaliação por competências e uso da plataforma APS EDU. Certificado de 16h.',
      startDate: new Date('2025-04-08T08:00:00Z'),
      endDate:   new Date('2025-04-09T17:00:00Z'),
      location:  'Sede APS Sul — Sala de Capacitação, São Paulo',
      status:    'completed',
      progressPercent: 100,
      createdById: u(1).id,
      unitId:    unit.id,
    },
    {
      id: 'event-000000-0000-0000-0006',
      name: 'Feira de Ciências — Colégio de Mauá',
      description: 'Mostra científica anual com projetos dos alunos do Fundamental I ao Médio. Avaliação por bancas compostas por professores e pais. Os 5 melhores projetos participarão da feira regional.',
      startDate: new Date('2025-06-12T08:00:00Z'),
      endDate:   new Date('2025-06-13T16:00:00Z'),
      location:  'Colégio Adventista de Mauá — Ginásio Poliesportivo',
      status:    'planned',
      progressPercent: 10,
      createdById: u(13).id,
      unitId:    unitMaua.id,
    },
    {
      id: 'event-000000-0000-0000-0007',
      name: 'Concurso Cultural APS30 — Propósito em Ação',
      description: 'Concurso entre todas as unidades da APS Sul celebrando os 30 anos da associação. Categorias: redação, música, artes visuais e vídeo. Premiação especial para os destaques. Inscrições abertas até 31/05.',
      startDate: new Date('2025-06-20T08:00:00Z'),
      endDate:   new Date('2025-06-20T18:00:00Z'),
      location:  'Centro de Convenções — São Bernardo do Campo',
      status:    'planned',
      progressPercent: 15,
      createdById: u(0).id,
      unitId:    unit.id,
    },
    {
      id: 'event-000000-0000-0000-0008',
      name: 'Confraternização de Encerramento do 1º Semestre',
      description: 'Celebração dos resultados do 1º semestre com reconhecimento dos colaboradores destaques, entrega de certificados de conquistas na gamificação e confraternização com toda a equipe. Traje: social.',
      startDate: new Date('2025-07-05T17:00:00Z'),
      endDate:   new Date('2025-07-05T22:00:00Z'),
      location:  'Sede APS Sul — Salão de Eventos',
      status:    'planned',
      progressPercent: 5,
      createdById: u(1).id,
      unitId:    unit.id,
    },
  ]

  const createdEvents = []
  for (const ev of eventosData) {
    const evt = await prisma.event.upsert({
      where: { id: ev.id },
      create: ev,
      update: {}
    })
    createdEvents.push(evt)
  }
  // Responsáveis pelos eventos
  const eventResp = [
    { ei: 0, uis: [0, 1, 3, 8, 13, 18, 23, 27] },
    { ei: 1, uis: [3, 4, 5, 6] },
    { ei: 2, uis: [8, 9, 10] },
    { ei: 3, uis: [0, 1, 3, 8, 13, 18, 23, 27] },
    { ei: 4, uis: [1, 2, 5, 10, 14] },
    { ei: 5, uis: [13, 14, 15] },
    { ei: 6, uis: [0, 1, 3, 8, 13, 18, 23, 27] },
    { ei: 7, uis: [0, 1, 2, 3, 8, 13, 18, 23, 27] },
  ]
  for (const { ei, uis } of eventResp) {
    for (const ui of uis) {
      if (!createdEvents[ei] || !u(ui)) continue
      await prisma.eventResponsible.upsert({
        where: { eventId_userId: { eventId: createdEvents[ei].id, userId: u(ui).id } },
        create: { eventId: createdEvents[ei].id, userId: u(ui).id },
        update: {}
      })
    }
  }
  console.log(`✅ ${createdEvents.length} eventos criados`)

  // ─── TAREFAS ─────────────────────────────────────────────────────────────
  const now = new Date()
  const d = (daysOffset) => new Date(now.getTime() + daysOffset * 86400000)

  const tasksData = [
    // ── Sede / Administrativo
    { id: 'task-00001', title: 'Revisar e aprovar Planos Pedagógicos 1º Semestre', description: 'Verificar todos os planos enviados pelas 6 unidades escolares, validar alinhamento com a grade curricular APS e retornar feedback até 30/04.', status: 'in_progress', priority: 'critical', progressPercent: 60, dueDate: d(8),  createdById: u(0).id, assignedToId: u(1).id, unitId: unit.id },
    { id: 'task-00002', title: 'Preparar relatório trimestral de desempenho da rede',  description: 'Compilar dados de frequência, notas médias e indicadores de engajamento de todas as unidades para apresentação ao Conselho Diretivo.', status: 'in_progress', priority: 'high',   progressPercent: 45, dueDate: d(12), createdById: u(0).id, assignedToId: u(1).id, unitId: unit.id },
    { id: 'task-00003', title: 'Atualizar cadastros de colaboradores no sistema',       description: 'Revisar dados cadastrais de todos os 32 colaboradores: cargo, unidade, contato e status ativo/inativo.',                                  status: 'pending',     priority: 'medium', progressPercent: 0,  dueDate: d(15), createdById: u(1).id, assignedToId: u(2).id, unitId: unit.id },
    { id: 'task-00004', title: 'Elaborar pauta do Encontro de Diretores — Maio/2025',  description: 'Definir tópicos, ordem do dia, duração de cada bloco e material de apresentação para o encontro de 10/05.',                                status: 'in_progress', priority: 'high',   progressPercent: 55, dueDate: d(5),  createdById: u(0).id, assignedToId: u(1).id, unitId: unit.id },
    { id: 'task-00005', title: 'Concluir orçamento de materiais didáticos 2025',        description: 'Levantar necessidades de cada unidade e consolidar proposta de compra para aprovação financeira.',                                           status: 'completed',   priority: 'high',   progressPercent: 100,dueDate: d(-5), createdById: u(1).id, assignedToId: u(0).id, unitId: unit.id },
    { id: 'task-00006', title: 'Publicar manual de uso da plataforma APS EDU',          description: 'Criar e disponibilizar guia prático com passo a passo para todas as funcionalidades do painel administrativo.',                               status: 'pending',     priority: 'medium', progressPercent: 20, dueDate: d(20), createdById: u(0).id, assignedToId: u(2).id, unitId: unit.id },

    // ── Ipiranga
    { id: 'task-00007', title: 'Entregar plano pedagógico — Ipiranga 1º Sem',           description: 'Finalizar e submeter o plano pedagógico completo de todas as disciplinas ao departamento de educação da APS.',                               status: 'overdue',     priority: 'critical',progressPercent: 80, dueDate: d(-3), createdById: u(3).id, assignedToId: u(4).id, unitId: unitIpiranga.id },
    { id: 'task-00008', title: 'Organizar Semana da Família — logística e programação', description: 'Definir programação detalhada, contratar fornecedores (som, buffet), comunicar famílias e treinar equipe de recepção.',                     status: 'in_progress', priority: 'high',   progressPercent: 40, dueDate: d(10), createdById: u(3).id, assignedToId: u(5).id, unitId: unitIpiranga.id },
    { id: 'task-00009', title: 'Aplicar avaliação diagnóstica — turmas 6º ao 9º',       description: 'Conduzir avaliação de nivelamento nas disciplinas de Português e Matemática e consolidar resultados por turma.',                            status: 'completed',   priority: 'high',   progressPercent: 100,dueDate: d(-10),createdById: u(4).id, assignedToId: u(5).id, unitId: unitIpiranga.id },
    { id: 'task-00010', title: 'Renovar contrato de prestadores de serviço',            description: 'Verificar vencimento dos contratos com fornecedores de limpeza, segurança e manutenção. Renovar ou publicar novo processo.',                  status: 'pending',     priority: 'medium', progressPercent: 0,  dueDate: d(25), createdById: u(3).id, assignedToId: u(7).id, unitId: unitIpiranga.id },
    { id: 'task-00011', title: 'Capacitação em primeiros socorros para docentes',       description: 'Agendar e organizar treinamento de primeiros socorros para 100% dos professores conforme exigência da ANVISA.',                              status: 'pending',     priority: 'medium', progressPercent: 0,  dueDate: d(30), createdById: u(4).id, assignedToId: u(6).id, unitId: unitIpiranga.id },
    { id: 'task-00012', title: 'Revisão do projeto político-pedagógico (PPP)',          description: 'Atualizar o PPP com as novas diretrizes curriculares e incluir as metas de sustentabilidade exigidas pelo MEC.',                               status: 'in_progress', priority: 'high',   progressPercent: 35, dueDate: d(18), createdById: u(3).id, assignedToId: u(5).id, unitId: unitIpiranga.id },

    // ── Santo André
    { id: 'task-00013', title: 'Organizar Olimpíada Interna de Matemática',            description: 'Preparar questões, organizar bancas avaliadoras, reservar salas e comunicar alunos participantes sobre regras e datas.',                     status: 'in_progress', priority: 'high',   progressPercent: 70, dueDate: d(3),  createdById: u(8).id,  assignedToId: u(10).id,unitId: unitAndre.id },
    { id: 'task-00014', title: 'Entregar relatório financeiro — 1º trimestre',         description: 'Consolidar balancete financeiro da unidade e enviar à tesouraria da APS Sul com todos os comprovantes.',                                       status: 'overdue',     priority: 'critical',progressPercent: 90, dueDate: d(-2), createdById: u(8).id,  assignedToId: u(12).id,unitId: unitAndre.id },
    { id: 'task-00015', title: 'Implantação do programa de tutoria entre pares',       description: 'Selecionar alunos tutores do 9º ano e 3º médio para apoio individualizado a estudantes com dificuldades de aprendizagem.',                   status: 'pending',     priority: 'medium', progressPercent: 10, dueDate: d(22), createdById: u(9).id,  assignedToId: u(10).id,unitId: unitAndre.id },
    { id: 'task-00016', title: 'Atualização do regimento escolar 2025',                description: 'Revisar normas disciplinares, atualizar capítulos sobre uso de celulares e tecnologia, submeter ao Conselho Escolar.',                        status: 'pending',     priority: 'low',    progressPercent: 0,  dueDate: d(40), createdById: u(8).id,  assignedToId: u(11).id,unitId: unitAndre.id },
    { id: 'task-00017', title: 'Compra de equipamentos audiovisuais — salas de aula',  description: 'Levantar demanda, obter 3 orçamentos e encaminhar para aprovação. Prioridade para salas sem projetor.',                                       status: 'completed',   priority: 'high',   progressPercent: 100,dueDate: d(-8), createdById: u(9).id,  assignedToId: u(12).id,unitId: unitAndre.id },

    // ── Mauá
    { id: 'task-00018', title: 'Montar comissão organizadora da Feira de Ciências',    description: 'Selecionar professores coordenadores por área (Biologia, Química, Física, Matemática) e definir cronograma de preparação dos projetos.',      status: 'in_progress', priority: 'medium', progressPercent: 50, dueDate: d(7),  createdById: u(13).id, assignedToId: u(14).id,unitId: unitMaua.id },
    { id: 'task-00019', title: 'Diagnóstico de infraestrutura — laboratórios',         description: 'Vistoriar laboratórios de Ciências e Informática, registrar necessidades de manutenção e enviar solicitação à manutenção da APS.',             status: 'completed',   priority: 'medium', progressPercent: 100,dueDate: d(-12),createdById: u(13).id, assignedToId: u(15).id,unitId: unitMaua.id },
    { id: 'task-00020', title: 'Formação continuada — professores do Fundamental I',   description: 'Organizar workshop de 8h sobre metodologias ativas e gamificação em sala de aula para professores do EF1.',                                    status: 'pending',     priority: 'medium', progressPercent: 0,  dueDate: d(28), createdById: u(14).id, assignedToId: u(16).id,unitId: unitMaua.id },
    { id: 'task-00021', title: 'Implementar projeto de leitura — Mauá Lê',             description: 'Criar biblioteca de sala em todas as turmas do EF1, selecionar acervo inicial de 30 títulos por classe e treinar professores.',               status: 'in_progress', priority: 'low',    progressPercent: 25, dueDate: d(35), createdById: u(13).id, assignedToId: u(14).id,unitId: unitMaua.id },
    { id: 'task-00022', title: 'Controle de frequência — inserir dados fevereiro',     description: 'Lançar frequência do mês de fevereiro para todas as turmas no sistema até o prazo estabelecido pela coordenação.',                            status: 'overdue',     priority: 'high',   progressPercent: 60, dueDate: d(-15),createdById: u(14).id, assignedToId: u(17).id,unitId: unitMaua.id },

    // ── São Bernardo
    { id: 'task-00023', title: 'Preparar inscrições para o Concurso APS30',            description: 'Divulgar regulamento, orientar alunos nas categorias (redação, artes, vídeo, música) e coletar inscrições até 31/05.',                       status: 'in_progress', priority: 'medium', progressPercent: 30, dueDate: d(14), createdById: u(18).id, assignedToId: u(19).id,unitId: unitBernardo.id },
    { id: 'task-00024', title: 'Readequação do calendário letivo — reposição',         description: 'Replanejar as aulas não ministradas em fevereiro devido ao feriado municipal. Enviar novo calendário à APS e comunicar famílias.',             status: 'completed',   priority: 'high',   progressPercent: 100,dueDate: d(-6), createdById: u(18).id, assignedToId: u(20).id,unitId: unitBernardo.id },
    { id: 'task-00025', title: 'Reunião de pais e mestres — 2ª bimestre',              description: 'Organizar local, definir horários por turma, preparar boletins e orientar professores para atendimento individualizado.',                       status: 'pending',     priority: 'medium', progressPercent: 0,  dueDate: d(18), createdById: u(19).id, assignedToId: u(21).id,unitId: unitBernardo.id },
    { id: 'task-00026', title: 'Protocolo de prevenção — dengue e H1N1',               description: 'Elaborar e divulgar protocolo de higienização para prevenção de doenças sazonais. Providenciar material de apoio para sala de aula.',          status: 'completed',   priority: 'critical',progressPercent: 100,dueDate: d(-4), createdById: u(18).id, assignedToId: u(22).id,unitId: unitBernardo.id },

    // ── Diadema
    { id: 'task-00027', title: 'Cadastro de novos alunos — matrículas 2025',           description: 'Processar e validar documentação dos novos alunos matriculados para o 2º semestre. Inserir dados no sistema e emitir declarações.',            status: 'in_progress', priority: 'high',   progressPercent: 65, dueDate: d(9),  createdById: u(23).id, assignedToId: u(26).id,unitId: unitDiadema.id },
    { id: 'task-00028', title: 'Revisão do cardápio da cantina — nutricionista',       description: 'Solicitar revisão e assinatura do nutricionista responsável no cardápio mensal. Verificar conformidade com as normas da ANVISA.',              status: 'pending',     priority: 'medium', progressPercent: 0,  dueDate: d(20), createdById: u(23).id, assignedToId: u(25).id,unitId: unitDiadema.id },
    { id: 'task-00029', title: 'Semana da Bíblia — programação e material',            description: 'Elaborar programação completa da Semana da Bíblia (estudos, palestras, quiz interativo) e produzir material didático para todas as turmas.', status: 'in_progress', priority: 'medium', progressPercent: 45, dueDate: d(11), createdById: u(24).id, assignedToId: u(25).id,unitId: unitDiadema.id },
    { id: 'task-00030', title: 'Entrega do relatório de inadimplência — março',        description: 'Consolidar lista de alunos com mensalidades em atraso e encaminhar ao financeiro da APS Sul com proposta de negociação.',                      status: 'overdue',     priority: 'critical',progressPercent: 70, dueDate: d(-7), createdById: u(23).id, assignedToId: u(26).id,unitId: unitDiadema.id },

    // ── Guarulhos
    { id: 'task-00031', title: 'Lançar notas do 1º bimestre — sistema acadêmico',      description: 'Coletar boletins de todos os professores e lançar no sistema acadêmico até o prazo definido pela secretaria.',                               status: 'completed',   priority: 'high',   progressPercent: 100,dueDate: d(-1), createdById: u(27).id, assignedToId: u(31).id,unitId: unitGua.id },
    { id: 'task-00032', title: 'Elaborar projeto de reforço escolar — Guarulhos',      description: 'Identificar alunos com rendimento abaixo de 50% e montar grade de reforço para as disciplinas críticas (Matemática, Português, Ciências).',   status: 'in_progress', priority: 'high',   progressPercent: 40, dueDate: d(13), createdById: u(27).id, assignedToId: u(29).id,unitId: unitGua.id },
    { id: 'task-00033', title: 'Visita técnica — Museu do Ipiranga',                   description: 'Organizar visita educativa ao Museu do Ipiranga para turmas do 7º e 8º ano. Solicitar ônibus, seguro e autorização dos pais.',                  status: 'pending',     priority: 'low',    progressPercent: 0,  dueDate: d(35), createdById: u(28).id, assignedToId: u(29).id,unitId: unitGua.id },
    { id: 'task-00034', title: 'Ata da reunião pedagógica — abril',                    description: 'Redigir e circular a ata da reunião pedagógica de abril para assinatura de todos os presentes e arquivamento.',                                 status: 'in_progress', priority: 'medium', progressPercent: 80, dueDate: d(2),  createdById: u(28).id, assignedToId: u(31).id,unitId: unitGua.id },
    { id: 'task-00035', title: 'Inspeção de segurança patrimonial',                    description: 'Realizar vistoria de extintores, saídas de emergência e instalações elétricas. Contratar empresa credenciada para laudo técnico.',              status: 'pending',     priority: 'high',   progressPercent: 0,  dueDate: d(20), createdById: u(27).id, assignedToId: u(30).id,unitId: unitGua.id },
  ]

  let tasksCreated = 0
  const createdTasks = []
  for (const t of tasksData) {
    const task = await prisma.task.upsert({
      where: { id: t.id },
      create: t,
      update: {}
    })
    createdTasks.push(task)
    tasksCreated++
  }
  console.log(`✅ ${tasksCreated} tarefas criadas`)

  // ── Checklists das tarefas principais
  const checklistsData = [
    { taskId: 'task-00001', items: ['Receber planos de todas as unidades','Verificar alinhamento curricular','Dar feedback ao Ipiranga','Dar feedback ao Santo André','Dar feedback ao Mauá','Aprovar planos conformes'] },
    { taskId: 'task-00004', items: ['Definir tópicos prioritários','Preparar apresentação de resultados','Convidar palestrantes externos','Confirmar local e coffee-break'] },
    { taskId: 'task-00008', items: ['Reservar ginásio e auditório','Contratar serviço de som','Enviar convites às famílias','Treinar equipe de recepção','Preparar programação cultural'] },
    { taskId: 'task-00013', items: ['Elaborar 40 questões por categoria','Selecionar professores avaliadores','Preparar lista de participantes','Comprar medalhas e troféus','Comunicar turmas participantes'] },
    { taskId: 'task-00032', items: ['Levantar alunos com notas < 50%','Definir grade horária de reforço','Selecionar professores tutores','Comunicar famílias','Iniciar aulas de reforço'] },
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

  // ── Comentários nas tarefas
  const commentsData = [
    { id: 'cmt-001', taskId: 'task-00001', userId: u(1).id,  content: 'Recebi os planos do Ipiranga e de Santo André. Ainda aguardo Mauá, São Bernardo, Diadema e Guarulhos.' },
    { id: 'cmt-002', taskId: 'task-00001', userId: u(3).id,  content: 'Ipiranga enviou. Confirmo o recebimento. Plano está completo conforme as diretrizes.' },
    { id: 'cmt-003', taskId: 'task-00001', userId: u(8).id,  content: 'Santo André já enviou também. Segue em anexo na tarefa.' },
    { id: 'cmt-004', taskId: 'task-00007', userId: u(3).id,  content: 'Estamos finalizando os últimos dois componentes curriculares. Envio até quinta-feira.' },
    { id: 'cmt-005', taskId: 'task-00007', userId: u(1).id,  content: 'Atenção: o prazo já passou. Por favor, priorizar a entrega hoje.' },
    { id: 'cmt-006', taskId: 'task-00008', userId: u(5).id,  content: 'Já confirmei o espaço do auditório. Falta fechar o buffet — tenho 2 propostas para analisar.' },
    { id: 'cmt-007', taskId: 'task-00013', userId: u(10).id, content: 'Questões das categorias bronze e prata já estão prontas. Trabalhando nas de ouro.' },
    { id: 'cmt-008', taskId: 'task-00013', userId: u(8).id,  content: 'Ótimo progresso! Confirmar se precisamos de sala extra para a categoria de 9º ano.' },
    { id: 'cmt-009', taskId: 'task-00014', userId: u(12).id, content: 'Balancete quase pronto. Falta apenas o conciliação de uma conta do fornecedor de limpeza.' },
    { id: 'cmt-010', taskId: 'task-00030', userId: u(23).id, content: 'Lista com 18 alunos inadimplentes. Preciso de orientação do financeiro da APS antes de enviar.' },
    { id: 'cmt-011', taskId: 'task-00002', userId: u(0).id,  content: 'Dados de frequência já consolidados. Aguardando métricas de engajamento da plataforma.' },
    { id: 'cmt-012', taskId: 'task-00029', userId: u(25).id, content: 'Quiz interativo já está preparado para 6 turmas. Material da Semana da Bíblia em impressão.' },
    { id: 'cmt-013', taskId: 'task-00027', userId: u(26).id, content: '47 novos alunos cadastrados. Restam 12 com documentação incompleta. Mandei e-mail às famílias.' },
    { id: 'cmt-014', taskId: 'task-00034', userId: u(31).id, content: 'Ata redigida e enviada para revisão. Aguardando assinaturas de 3 professores.' },
  ]
  for (const c of commentsData) {
    await prisma.taskComment.upsert({
      where: { id: c.id },
      create: { id: c.id, taskId: c.taskId, userId: c.userId, content: c.content },
      update: {}
    })
  }
  console.log('✅ Checklists e comentários de tarefas criados')

  // ─── FEEDBACK ─────────────────────────────────────────────────────────────
  const feedbacksData = [
    { id: 'fb-001', category: 'suggestion', content: 'Seria ótimo ter um módulo de comunicação direta entre coordenadores e professores dentro da plataforma, com histórico de mensagens por turma.', isAnonymous: false, userId: u(5).id, status: 'read' },
    { id: 'fb-002', category: 'problem',    content: 'Estou tendo dificuldade para anexar arquivos grandes (acima de 5MB) nas evidências das tarefas. O sistema apresenta erro 413 e não informa claramente o limite.', isAnonymous: false, userId: u(10).id, status: 'resolved' },
    { id: 'fb-003', category: 'idea',       content: 'Proposta: criar um "Mural de Conquistas" visível para todos na tela inicial, onde apareçam os badges recém-conquistados pelos colaboradores. Isso aumentaria a motivação!', isAnonymous: false, userId: u(14).id, status: 'pending' },
    { id: 'fb-004', category: 'praise',     content: 'Parabéns pela plataforma APS EDU! Está muito intuitiva e organizada. Facilitou muito o nosso dia a dia na coordenação. Esperamos novidades em breve!', isAnonymous: false, userId: u(4).id,  status: 'read' },
    { id: 'fb-005', category: 'suggestion', content: 'Sugiro adicionar filtro por unidade na tela de tarefas, para que diretores possam ver rapidamente apenas as tarefas da própria escola sem precisar rolar a lista toda.', isAnonymous: true,  userId: null,   status: 'pending' },
    { id: 'fb-006', category: 'problem',    content: 'O relatório de desempenho por unidade está demorando muito para carregar (mais de 30 segundos). Isso dificulta o trabalho de análise nos dias de reunião.', isAnonymous: false, userId: u(9).id,  status: 'pending' },
    { id: 'fb-007', category: 'idea',       content: 'Que tal integrar um calendário compartilhado na plataforma, onde todos os eventos da rede apareçam de forma visual? Hoje precisamos consultar e-mails separados.', isAnonymous: false, userId: u(19).id, status: 'read' },
    { id: 'fb-008', category: 'praise',     content: 'O sistema de gamificação está sendo um diferencial enorme! Nossa equipe está mais engajada em concluir as tarefas no prazo para ganhar pontos. Excelente iniciativa!', isAnonymous: false, userId: u(24).id, status: 'read' },
    { id: 'fb-009', category: 'suggestion', content: 'Seria muito útil poder exportar os relatórios em PDF com logo da APS e formatação oficial, para apresentar nas reuniões com pais e conselho escolar.', isAnonymous: false, userId: u(28).id, status: 'pending' },
    { id: 'fb-010', category: 'problem',    content: 'Na tela de usuários, ao tentar editar o cargo de um colaborador, o sistema fecha o modal sem salvar. Aconteceu comigo 3 vezes hoje.', isAnonymous: true,  userId: null,   status: 'pending' },
    { id: 'fb-011', category: 'idea',       content: 'VOTAÇÃO — Encontro de Diretores: Opção B (tarde, 13h-17h)', isAnonymous: false, userId: u(3).id,  status: 'read' },
    { id: 'fb-012', category: 'idea',       content: 'VOTAÇÃO — Encontro de Diretores: Opção A (manhã, 8h-12h)', isAnonymous: false, userId: u(8).id,  status: 'read' },
    { id: 'fb-013', category: 'idea',       content: 'VOTAÇÃO — Encontro de Diretores: Opção B (tarde, 13h-17h)', isAnonymous: false, userId: u(13).id, status: 'read' },
    { id: 'fb-014', category: 'idea',       content: 'VOTAÇÃO — Encontro de Diretores: Opção A (manhã, 8h-12h)', isAnonymous: false, userId: u(18).id, status: 'read' },
    { id: 'fb-015', category: 'idea',       content: 'VOTAÇÃO — Encontro de Diretores: Opção C (período integral, 8h-17h)', isAnonymous: false, userId: u(23).id, status: 'read' },
    { id: 'fb-016', category: 'idea',       content: 'VOTAÇÃO — Encontro de Diretores: Opção B (tarde, 13h-17h)', isAnonymous: false, userId: u(27).id, status: 'read' },
    { id: 'fb-017', category: 'suggestion', content: 'Colégio de Diadema indica como representante do Comitê APS30: Renata Melo (Coordenadora Pedagógica).', isAnonymous: false, userId: u(23).id, status: 'read' },
    { id: 'fb-018', category: 'suggestion', content: 'Guarulhos indica como representante do Comitê APS30: Tatiane Nunes (Vice-Diretora).', isAnonymous: false, userId: u(27).id, status: 'pending' },
    { id: 'fb-019', category: 'praise',     content: 'Agradeço o treinamento de gestão escolar oferecido pela APS. Foi muito enriquecedor e prático. Os conteúdos sobre avaliação por competências foram especialmente úteis!', isAnonymous: false, userId: u(14).id, status: 'read' },
    { id: 'fb-020', category: 'problem',    content: 'A notificação de badge conquistado apareceu mas o badge não aparece na minha tela de gamificação. Por favor, verificar.', isAnonymous: false, userId: u(20).id, status: 'pending' },
  ]

  let fbCreated = 0
  for (const fb of feedbacksData) {
    await prisma.feedback.upsert({
      where: { id: fb.id },
      create: fb,
      update: {}
    })
    fbCreated++
  }
  console.log(`✅ ${fbCreated} feedbacks criados`)

  // ─── USER BADGES ─────────────────────────────────────────────────────────
  // Atribuir badges coerentes com os pontos/tarefas de cada usuário
  const userBadgesData = [
    // Admin (4200 pts, 87 tarefas) — badges de excelência e comprometimento
    { userId: u(0).id, badgeIds: ['badge-01','badge-02','badge-03','badge-04','badge-05','badge-09','badge-11','badge-12','badge-13','badge-14','badge-21','badge-22','badge-23','badge-31','badge-32','badge-33','badge-34','badge-36','badge-37','badge-46','badge-47'] },
    // Diretor Sede (3850 pts, 72 tarefas)
    { userId: u(1).id, badgeIds: ['badge-01','badge-02','badge-03','badge-04','badge-05','badge-09','badge-11','badge-12','badge-13','badge-14','badge-21','badge-22','badge-31','badge-32','badge-33','badge-34','badge-36','badge-46','badge-47'] },
    // Coord Ipiranga (2980 pts, 61 tarefas)
    { userId: u(2).id, badgeIds: ['badge-01','badge-02','badge-03','badge-04','badge-09','badge-11','badge-12','badge-21','badge-22','badge-31','badge-32','badge-33','badge-34','badge-46'] },
    // Diretor Ipiranga (2650 pts, 54 tarefas)
    { userId: u(3).id, badgeIds: ['badge-01','badge-02','badge-03','badge-04','badge-09','badge-11','badge-12','badge-21','badge-22','badge-31','badge-32','badge-33','badge-46'] },
    // Patricia Andre (3100 pts, 65 tarefas)
    { userId: u(8).id, badgeIds: ['badge-01','badge-02','badge-03','badge-04','badge-05','badge-09','badge-11','badge-12','badge-21','badge-22','badge-31','badge-32','badge-33','badge-34','badge-36','badge-46','badge-47'] },
    // Eduardo Mauá (2750 pts, 56 tarefas)
    { userId: u(13).id, badgeIds: ['badge-01','badge-02','badge-03','badge-04','badge-09','badge-11','badge-12','badge-21','badge-31','badge-32','badge-33','badge-46'] },
    // Vanessa Bernardo (2480 pts, 50 tarefas)
    { userId: u(18).id, badgeIds: ['badge-01','badge-02','badge-03','badge-04','badge-05','badge-09','badge-11','badge-12','badge-21','badge-31','badge-32','badge-33','badge-46'] },
    // Anderson Diadema (2190 pts, 43 tarefas)
    { userId: u(23).id, badgeIds: ['badge-01','badge-02','badge-03','badge-09','badge-11','badge-12','badge-21','badge-31','badge-32','badge-33','badge-46'] },
    // Paulo Guarulhos (2340 pts, 47 tarefas)
    { userId: u(27).id, badgeIds: ['badge-01','badge-02','badge-03','badge-04','badge-09','badge-11','badge-12','badge-21','badge-31','badge-32','badge-33','badge-46'] },
    // Usuários menores — apenas badges iniciais
    { userId: u(5).id,  badgeIds: ['badge-01','badge-02','badge-03','badge-11','badge-31','badge-32'] },
    { userId: u(9).id,  badgeIds: ['badge-01','badge-02','badge-11','badge-31','badge-32'] },
    { userId: u(14).id, badgeIds: ['badge-01','badge-02','badge-11','badge-31'] },
    { userId: u(19).id, badgeIds: ['badge-01','badge-02','badge-11','badge-31'] },
    { userId: u(24).id, badgeIds: ['badge-01','badge-02','badge-11'] },
    { userId: u(28).id, badgeIds: ['badge-01','badge-02','badge-11','badge-31','badge-32'] },
  ]

  let badgesAwarded = 0
  for (const ub of userBadgesData) {
    for (const badgeId of ub.badgeIds) {
      try {
        await prisma.userBadge.upsert({
          where: { userId_badgeId: { userId: ub.userId, badgeId } },
          create: { userId: ub.userId, badgeId, notified: true },
          update: {}
        })
        badgesAwarded++
      } catch (_) { /* badge pode não existir */ }
    }
  }
  console.log(`✅ ${badgesAwarded} badges atribuídos aos usuários`)

  console.log('\n🎉 Seed concluído com sucesso!')
  console.log('\n📋 Credenciais de acesso:')
  console.log('   Admin:    admin@aps.edu.br       | Admin@123')
  console.log('   Diretor:  diretor@aps.edu.br     | Diretor@123')
  console.log('   Outros:   <email>@aps.edu.br     | Teste@123\n')
  console.log('📊 Resumo dos dados:')
  console.log('   • 32 usuários em 7 unidades')
  console.log('   • 35 tarefas (pending/in_progress/completed/overdue)')
  console.log('   • 8 eventos (planned/ongoing/completed)')
  console.log('   • 4 avisos com leituras')
  console.log('   • 20 feedbacks')
  console.log('   • Badges atribuídos aos colaboradores destaques')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
