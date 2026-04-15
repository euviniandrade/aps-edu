'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'

export default function GamificationPage() {
  const [ranking, setRanking] = useState<any[]>([])
  const [badges, setBadges] = useState<any[]>([])
  const [scope, setScope] = useState('global')

  useEffect(() => {
    Promise.all([
      api.get(`/gamification/ranking?scope=${scope}&limit=20`),
      api.get('/gamification/badges')
    ]).then(([r, b]) => { setRanking(r.data.ranking || []); setBadges(b.data || []) })
  }, [scope])

  const levelColors: Record<string, string> = {
    bronze: 'bg-amber-100 text-amber-700 border-amber-200',
    silver: 'bg-gray-100 text-gray-600 border-gray-200',
    gold: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  }

  const categoryLabels: Record<string, string> = {
    commitment: 'Comprometimento', punctuality: 'Pontualidade',
    productivity: 'Produtividade', excellence: 'Excelência',
    teamwork: 'Equipe', leadership: 'Liderança',
  }

  const badgesByCategory = badges.reduce((acc: any, b: any) => {
    if (!acc[b.category]) acc[b.category] = []
    acc[b.category].push(b)
    return acc
  }, {})

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Gamificação</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">🏆 Ranking</h2>
            <select value={scope} onChange={e => setScope(e.target.value)}
              className="border border-gray-200 rounded-lg text-sm px-3 py-1.5 focus:outline-none">
              <option value="global">Geral</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
            </select>
          </div>
          <div className="divide-y divide-gray-50">
            {ranking.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl w-8 text-center">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-gray-400 text-sm font-bold">#{i+1}</span>}
                </span>
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                  {(item.user?.name || 'U')[0]}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{item.user?.name}</p>
                  <p className="text-xs text-gray-400">{item.user?.role?.name} — {item.user?.unit?.name}</p>
                </div>
                <span className="text-sm font-bold text-blue-600">{item.points} pts</span>
              </div>
            ))}
          </div>
        </div>

        {/* Selos por categoria */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700">🏅 50 Selos ({badges.length} total)</h2>
          </div>
          <div className="p-4 overflow-y-auto max-h-[500px] space-y-4">
            {Object.entries(badgesByCategory).map(([cat, items]: [string, any]) => (
              <div key={cat}>
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">{categoryLabels[cat] || cat}</h3>
                <div className="flex flex-wrap gap-2">
                  {items.map((badge: any) => (
                    <div key={badge.id} title={badge.criteria}
                      className={`px-2 py-1 rounded-full text-xs border font-medium ${levelColors[badge.level] || ''}`}>
                      {badge.name}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
