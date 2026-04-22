'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'
import { TrophyIcon, StarIcon, ChartBarIcon } from '@heroicons/react/24/outline'

const levelColors = ['', 'bg-gray-100 text-gray-600', 'bg-blue-100 text-blue-700', 'bg-teal-100 text-teal-700', 'bg-indigo-100 text-indigo-700', 'bg-purple-100 text-purple-700', 'bg-yellow-100 text-yellow-700', 'bg-orange-100 text-orange-700', 'bg-red-100 text-red-700']

const badgeLevelColors: Record<string, string> = {
  bronze: 'bg-amber-50 text-amber-700 border-amber-200',
  silver: 'bg-slate-50 text-slate-600 border-slate-200',
  gold:   'bg-yellow-50 text-yellow-700 border-yellow-200',
}

const badgeLevelIcons: Record<string, string> = {
  bronze: '🥉',
  silver: '🥈',
  gold:   '🥇',
}

const categoryLabels: Record<string, string> = {
  commitment: '💪 Comprometimento',
  punctuality: '⏱ Pontualidade',
  productivity: '🚀 Produtividade',
  excellence: '⭐ Excelência',
  teamwork: '🤝 Trabalho em Equipe',
  leadership: '👑 Liderança',
}

const rankMedals = ['🥇', '🥈', '🥉']

export default function GamificationPage() {
  const [ranking, setRanking] = useState<any[]>([])
  const [badges, setBadges]   = useState<any[]>([])
  const [myStats, setMyStats] = useState<any>(null)
  const [scope, setScope]     = useState('global')
  const [activeTab, setActiveTab] = useState<'ranking' | 'badges' | 'stats'>('ranking')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/gamification/ranking?scope=${scope}&limit=30`),
      api.get('/gamification/badges'),
      api.get('/gamification/my-stats'),
    ])
      .then(([r, b, s]) => {
        setRanking(r.data.ranking || [])
        setBadges(b.data || [])
        setMyStats(s.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [scope])

  const badgesByCategory = badges.reduce((acc: any, b: any) => {
    if (!acc[b.category]) acc[b.category] = []
    acc[b.category].push(b)
    return acc
  }, {})

  const earnedCount = badges.filter((b: any) => b.earned).length

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gamificação</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ranking, selos e estatísticas de desempenho da rede
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center">
              <TrophyIcon className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{ranking.length}</p>
              <p className="text-xs text-gray-500">No Ranking</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <StarIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{badges.length}</p>
              <p className="text-xs text-gray-500">Selos Disponíveis</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <ChartBarIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{ranking[0]?.points ?? '—'}</p>
              <p className="text-xs text-gray-500">Maior Pontuação</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <span className="text-xl">🏅</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{myStats?.points ?? '—'}</p>
              <p className="text-xs text-gray-500">Meus Pontos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 w-fit">
        {(['ranking', 'badges', 'stats'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'ranking' ? '🏆 Ranking' : tab === 'badges' ? '🏅 Selos' : '📊 Meu Desempenho'}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}

      {/* ── RANKING TAB ── */}
      {!loading && activeTab === 'ranking' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">Ranking de Colaboradores</h2>
            <select
              value={scope}
              onChange={e => setScope(e.target.value)}
              className="border border-gray-200 rounded-lg text-sm px-3 py-1.5 focus:outline-none focus:border-blue-400 bg-white"
            >
              <option value="global">Geral</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
            </select>
          </div>

          {ranking.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <TrophyIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum dado de ranking ainda</p>
              <p className="text-xs mt-1">Os dados aparecem após o seed ser executado no servidor</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {ranking.map((item: any, i: number) => (
                <div
                  key={i}
                  className={`flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors ${
                    i === 0 ? 'bg-yellow-50/60' : i === 1 ? 'bg-gray-50/60' : i === 2 ? 'bg-amber-50/40' : ''
                  }`}
                >
                  {/* Position */}
                  <div className="w-8 text-center flex-shrink-0">
                    {i < 3 ? (
                      <span className="text-xl">{rankMedals[i]}</span>
                    ) : (
                      <span className="text-sm font-bold text-gray-400">#{i + 1}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: '#1B3A6B' }}
                  >
                    {(item.user?.name || 'U')[0]}
                  </div>

                  {/* Name + Unit */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.user?.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {item.user?.role?.name} · {item.user?.unit?.name}
                    </p>
                  </div>

                  {/* Points */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold" style={{ color: '#1B3A6B' }}>
                      {item.points.toLocaleString('pt-BR')} pts
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BADGES TAB ── */}
      {!loading && activeTab === 'badges' && (
        <div>
          {/* Badge summary */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex gap-3">
              {['bronze', 'silver', 'gold'].map((level) => {
                const count = badges.filter((b: any) => b.level === level).length
                return (
                  <div key={level} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${badgeLevelColors[level]}`}>
                    {badgeLevelIcons[level]} {count} {level === 'bronze' ? 'bronze' : level === 'silver' ? 'prata' : 'ouro'}
                  </div>
                )
              })}
            </div>
            <span className="text-xs text-gray-400 ml-2">
              {earnedCount} conquistados por você de {badges.length} disponíveis
            </span>
          </div>

          <div className="space-y-5">
            {Object.entries(badgesByCategory).map(([cat, items]: [string, any]) => (
              <div key={cat} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-50 bg-gray-50/60">
                  <h3 className="text-sm font-bold text-gray-700">{categoryLabels[cat] || cat}</h3>
                </div>
                <div className="p-4 flex flex-wrap gap-2.5">
                  {items.map((badge: any) => (
                    <div
                      key={badge.id}
                      title={`${badge.criteria}${badge.earned ? ' ✓ Conquistado!' : ''}`}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                        badge.earned
                          ? badgeLevelColors[badge.level] + ' ring-2 ring-offset-1 ' + (badge.level === 'gold' ? 'ring-yellow-300' : badge.level === 'silver' ? 'ring-slate-300' : 'ring-amber-300')
                          : 'bg-gray-50 text-gray-400 border-gray-200 opacity-60'
                      }`}
                    >
                      {badgeLevelIcons[badge.level]} {badge.name}
                      {badge.earned && <span className="text-emerald-500">✓</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MY STATS TAB ── */}
      {!loading && activeTab === 'stats' && myStats && (
        <div className="space-y-5">
          {/* Level card */}
          <div
            className="rounded-xl p-6 text-white relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #1B3A6B 0%, #2A5298 100%)' }}
          >
            <div className="absolute right-4 top-4 opacity-10 text-8xl font-black">
              {myStats.level?.level}
            </div>
            <p className="text-xs font-semibold tracking-widest opacity-60 uppercase mb-1">Nível Atual</p>
            <p className="text-3xl font-extrabold mb-0.5">
              {myStats.points?.toLocaleString('pt-BR')} pts
            </p>
            <p className="text-base font-semibold opacity-80">{myStats.level?.name}</p>
            {myStats.level?.nextLevel && (
              <div className="mt-4">
                <div className="flex justify-between text-xs opacity-60 mb-1">
                  <span>Progresso para {myStats.level.nextLevel.name}</span>
                  <span>{myStats.level.progress}%</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${myStats.level.progress}%`, backgroundColor: '#F8A303' }}
                  />
                </div>
                <p className="text-xs opacity-50 mt-1">
                  Faltam {myStats.level.pointsToNext.toLocaleString('pt-BR')} pts para o próximo nível
                </p>
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Tarefas Concluídas', value: myStats.stats?.tasksCompleted, icon: '✅' },
              { label: 'No Prazo', value: myStats.stats?.tasksOnTime, icon: '⏱' },
              { label: 'Login Streak', value: `${myStats.stats?.loginStreak} dias`, icon: '🔥' },
              { label: 'Eventos Participados', value: myStats.stats?.eventsParticipated, icon: '📅' },
              { label: 'Tarefas Criadas', value: myStats.stats?.tasksCreated, icon: '📋' },
              { label: 'Comentários', value: myStats.stats?.commentsPosted, icon: '💬' },
              { label: 'Evidências', value: myStats.stats?.evidencesUploaded, icon: '📎' },
              { label: 'Avisos Lidos', value: myStats.stats?.announcementsRead, icon: '📢' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                <div className="text-2xl mb-1">{s.icon}</div>
                <p className="text-xl font-bold text-gray-900">{s.value ?? 0}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* My badges */}
          {myStats.badges?.earned?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-700 mb-4">
                🏅 Meus Selos ({myStats.badges.earned.length} de {myStats.badges.total})
              </h3>
              <div className="flex flex-wrap gap-2">
                {myStats.badges.earned.map((ub: any) => (
                  <div
                    key={ub.badge?.id || ub.badgeId}
                    title={ub.badge?.criteria}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${
                      badgeLevelColors[ub.badge?.level] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {badgeLevelIcons[ub.badge?.level]} {ub.badge?.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  )
}
