'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'
import { TrophyIcon, StarIcon, ChartBarIcon } from '@heroicons/react/24/outline'

const BADGE_LEVEL_STYLE: Record<string, { bg: string; color: string; ring: string }> = {
  bronze: { bg: 'rgba(205,127,50,0.12)',  color: '#CD7F32', ring: 'rgba(205,127,50,0.4)' },
  silver: { bg: 'rgba(192,192,192,0.1)',  color: '#C0C0C0', ring: 'rgba(192,192,192,0.4)' },
  gold:   { bg: 'rgba(248,163,3,0.12)',   color: '#F8A303', ring: 'rgba(248,163,3,0.5)' },
}
const BADGE_ICONS: Record<string, string> = { bronze: '🥉', silver: '🥈', gold: '🥇' }
const CATEGORY_LABELS: Record<string, string> = {
  commitment: '💪 Comprometimento',
  punctuality: '⏱ Pontualidade',
  productivity: '🚀 Produtividade',
  excellence: '⭐ Excelência',
  teamwork: '🤝 Trabalho em Equipe',
  leadership: '👑 Liderança',
}
const RANK_MEDALS = ['🥇', '🥈', '🥉']
const AVATAR_GRADIENT_POOL = ['#F8A303','#4A9EFF','#0ABD78','#8B5CF6','#FF4757','#29ABE2','#F9C234']

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

  const avatarColor = (name: string) =>
    AVATAR_GRADIENT_POOL[(name?.charCodeAt(0) || 0) % AVATAR_GRADIENT_POOL.length]

  return (
    <AdminLayout>
      <div className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-extrabold text-white">Gamificação</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Ranking, selos e estatísticas de desempenho da rede
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-fade-in-up">
        {[
          { icon: TrophyIcon,  accent: '#F9C234', value: ranking.length,           label: 'No Ranking' },
          { icon: StarIcon,    accent: '#A78BFA', value: badges.length,            label: 'Selos Disponíveis' },
          { icon: ChartBarIcon,accent: '#4A9EFF', value: ranking[0]?.points ?? 0,  label: 'Maior Pontuação' },
          { icon: null,        accent: '#0ABD78', value: myStats?.points ?? 0,     label: 'Meus Pontos', emoji: '🏅' },
        ].map((kpi, i) => {
          const Icon = kpi.icon
          return (
          <div
            key={i}
            className="rounded-2xl p-4 transition-all duration-300 hover:scale-[1.02]"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${kpi.accent}15`, border: `1px solid ${kpi.accent}25` }}
              >
                {kpi.emoji
                  ? <span className="text-xl">{kpi.emoji}</span>
                  : Icon && <Icon className="w-5 h-5" style={{ color: kpi.accent }} />
                }
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: kpi.accent }}>
                  {typeof kpi.value === 'number' ? kpi.value.toLocaleString('pt-BR') : kpi.value}
                </p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{kpi.label}</p>
              </div>
            </div>
          </div>
        )})}
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 rounded-xl p-1 mb-5 w-fit animate-fade-in-up delay-100"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {(['ranking', 'badges', 'stats'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
            style={activeTab === tab
              ? { background: 'rgba(248,163,3,0.15)', color: '#F8A303', border: '1px solid rgba(248,163,3,0.25)' }
              : { color: 'rgba(255,255,255,0.4)', border: '1px solid transparent' }
            }
          >
            {tab === 'ranking' ? '🏆 Ranking' : tab === 'badges' ? '🏅 Selos' : '📊 Meu Desempenho'}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(248,163,3,0.3)', borderTopColor: '#F8A303' }} />
        </div>
      )}

      {/* ── RANKING TAB ── */}
      {!loading && activeTab === 'ranking' && (
        <div
          className="rounded-2xl overflow-hidden animate-fade-in-up"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div
            className="p-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <h2 className="font-semibold text-white text-sm">Ranking de Colaboradores</h2>
            <select
              value={scope}
              onChange={e => setScope(e.target.value)}
              className="rounded-lg text-sm px-3 py-1.5 outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
            >
              <option value="global">Geral</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
            </select>
          </div>

          {ranking.length === 0 ? (
            <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.2)' }}>
              <TrophyIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum dado de ranking ainda</p>
            </div>
          ) : (
            <div>
              {ranking.map((item: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors"
                  style={{
                    borderBottom: i < ranking.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: i === 0 ? 'rgba(248,163,3,0.05)' : i === 1 ? 'rgba(192,192,192,0.03)' : i === 2 ? 'rgba(205,127,50,0.03)' : 'transparent',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.025)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = i === 0 ? 'rgba(248,163,3,0.05)' : 'transparent'}
                >
                  <div className="w-8 text-center flex-shrink-0">
                    {i < 3 ? (
                      <span className="text-xl">{RANK_MEDALS[i]}</span>
                    ) : (
                      <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>#{i + 1}</span>
                    )}
                  </div>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${avatarColor(item.user?.name)}, ${avatarColor(item.user?.name)}aa)`,
                      color: '#fff',
                      boxShadow: `0 0 8px ${avatarColor(item.user?.name)}40`,
                    }}
                  >
                    {(item.user?.name || 'U')[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.user?.name}</p>
                    <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {item.user?.role?.name} · {item.user?.unit?.name}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold" style={{ color: '#F8A303' }}>
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
        <div className="animate-fade-in-up">
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <div className="flex gap-2">
              {['bronze', 'silver', 'gold'].map((level) => {
                const count = badges.filter((b: any) => b.level === level).length
                const bs = BADGE_LEVEL_STYLE[level]
                return (
                  <div
                    key={level}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{ background: bs.bg, color: bs.color, border: `1px solid ${bs.color}30` }}
                  >
                    {BADGE_ICONS[level]} {count} {level === 'bronze' ? 'bronze' : level === 'silver' ? 'prata' : 'ouro'}
                  </div>
                )
              })}
            </div>
            <span className="text-xs ml-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {earnedCount} conquistados de {badges.length} disponíveis
            </span>
          </div>

          <div className="space-y-4">
            {Object.entries(badgesByCategory).map(([cat, items]: [string, any]) => (
              <div
                key={cat}
                className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.025)' }}>
                  <h3 className="text-sm font-bold text-white">{CATEGORY_LABELS[cat] || cat}</h3>
                </div>
                <div className="p-4 flex flex-wrap gap-2.5">
                  {items.map((badge: any) => {
                    const bs = BADGE_LEVEL_STYLE[badge.level] || BADGE_LEVEL_STYLE.bronze
                    return (
                      <div
                        key={badge.id}
                        title={`${badge.criteria}${badge.earned ? ' ✓ Conquistado!' : ''}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                        style={badge.earned
                          ? { background: bs.bg, color: bs.color, border: `1px solid ${bs.color}30`, boxShadow: `0 0 8px ${bs.ring}` }
                          : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.07)' }
                        }
                      >
                        {BADGE_ICONS[badge.level]} {badge.name}
                        {badge.earned && <span style={{ color: '#0ABD78' }}>✓</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MY STATS TAB ── */}
      {!loading && activeTab === 'stats' && myStats && (
        <div className="space-y-5 animate-fade-in-up">
          {/* Level card */}
          <div
            className="rounded-2xl p-6 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(27,58,107,0.8) 0%, rgba(139,92,246,0.4) 100%)',
              border: '1px solid rgba(139,92,246,0.3)',
              boxShadow: '0 8px 40px rgba(139,92,246,0.2)',
            }}
          >
            <div className="absolute right-4 top-4 opacity-5 text-9xl font-black text-white select-none">
              {myStats.level?.level}
            </div>
            <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Nível Atual
            </p>
            <p className="text-4xl font-extrabold text-white mb-0.5">
              {myStats.points?.toLocaleString('pt-BR')} pts
            </p>
            <p className="text-base font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>{myStats.level?.name}</p>
            {myStats.level?.nextLevel && (
              <div className="mt-5">
                <div className="flex justify-between text-xs mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <span>Progresso para {myStats.level.nextLevel.name}</span>
                  <span>{myStats.level.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${myStats.level.progress}%`, background: 'linear-gradient(90deg, #F8A303, #FDC347)' }}
                  />
                </div>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Faltam {myStats.level.pointsToNext.toLocaleString('pt-BR')} pts para o próximo nível
                </p>
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Tarefas Concluídas', value: myStats.stats?.tasksCompleted, icon: '✅' },
              { label: 'No Prazo',           value: myStats.stats?.tasksOnTime,    icon: '⏱' },
              { label: 'Login Streak',       value: `${myStats.stats?.loginStreak} dias`, icon: '🔥' },
              { label: 'Eventos',            value: myStats.stats?.eventsParticipated, icon: '📅' },
              { label: 'Tarefas Criadas',    value: myStats.stats?.tasksCreated,   icon: '📋' },
              { label: 'Comentários',        value: myStats.stats?.commentsPosted, icon: '💬' },
              { label: 'Evidências',         value: myStats.stats?.evidencesUploaded, icon: '📎' },
              { label: 'Avisos Lidos',       value: myStats.stats?.announcementsRead, icon: '📢' },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl p-4 text-center transition-all hover:scale-[1.02]"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="text-2xl mb-1">{s.icon}</div>
                <p className="text-xl font-bold text-white">{s.value ?? 0}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {myStats.badges?.earned?.length > 0 && (
            <div
              className="rounded-2xl p-5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <h3 className="font-semibold text-white mb-4 text-sm">
                🏅 Meus Selos ({myStats.badges.earned.length} de {myStats.badges.total})
              </h3>
              <div className="flex flex-wrap gap-2">
                {myStats.badges.earned.map((ub: any) => {
                  const bs = BADGE_LEVEL_STYLE[ub.badge?.level] || BADGE_LEVEL_STYLE.bronze
                  return (
                    <div
                      key={ub.badge?.id || ub.badgeId}
                      title={ub.badge?.criteria}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                      style={{ background: bs.bg, color: bs.color, border: `1px solid ${bs.color}30` }}
                    >
                      {BADGE_ICONS[ub.badge?.level]} {ub.badge?.name}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  )
}
