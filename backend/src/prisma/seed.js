const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...\n')

  // ─── ROLES ───────────────────────────────────────────────────────────────
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

  // ─── UNIT ─────────────────────────────────────────────────────────────────
  const unit = await prisma.unit.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    create: { id: '00000000-0000-0000-0000-000000000001', name: 'Sede APS — Departamento de Educação', city: 'São Paulo', type: 'headquarters', region: 'São Paulo' },
    update: {}
  })

  const schoolUnit = await prisma.unit.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    create: { id: '00000000-0000-0000-0000-000000000002', name: 'Escola Central APS', city: 'São Paulo', type: 'school', region: 'São Paulo' },
    update: {}
  })
  console.log('✅ Unidades criadas')

  // ─── USERS ────────────────────────────────────────────────────────────────
  const adminRole = roles.find(r => r.slug === 'admin')
  const directorRole = roles.find(r => r.slug === 'director')
  const coordRole = roles.find(r => r.slug === 'coordinator')

  await prisma.user.upsert({
    where: { email: 'admin@aps.edu.br' },
    create: { name: 'Administrador APS', email: 'admin@aps.edu.br', passwordHash: await bcrypt.hash('Admin@123', 12), roleId: adminRole.id, unitId: unit.id },
    update: {}
  })

  await prisma.user.upsert({
    where: { email: 'diretor@aps.edu.br' },
    create: { name: 'João Silva — Diretor', email: 'diretor@aps.edu.br', passwordHash: await bcrypt.hash('Diretor@123', 12), roleId: directorRole.id, unitId: unit.id },
    update: {}
  })

  await prisma.user.upsert({
    where: { email: 'coord@aps.edu.br' },
    create: { name: 'Maria Santos — Coordenadora', email: 'coord@aps.edu.br', passwordHash: await bcrypt.hash('Coord@123', 12), roleId: coordRole.id, unitId: schoolUnit.id },
    update: {}
  })
  console.log('✅ Usuários criados')

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
  console.log('   Admin:   admin@aps.edu.br   | Admin@123')
  console.log('   Diretor: diretor@aps.edu.br | Diretor@123')
  console.log('   Coord:   coord@aps.edu.br   | Coord@123\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
