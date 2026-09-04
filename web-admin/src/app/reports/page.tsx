'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'
import restoredPromoterSubmissions from '@/data/restored-promoter-submissions.json'
import {
  BuildingLibraryIcon,
  PrinterIcon,
  UserGroupIcon,
  UserIcon,
} from '@heroicons/react/24/outline'

type Person = {
  id: string
  name: string
  role: string
  unit: string
  email?: string
  phone?: string
  leadership: number
  productivity: number
  relationship: number
}

function percent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function avg(values: number[]) {
  if (!values.length) return 0
  return percent(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function mapSubmission(item: any, index: number): Person {
  const raw = typeof item?.raw === 'string' ? JSON.parse(item.raw || '{}') : item?.raw || item
  const computed = raw?.computed || item?.computed || {}
  const indices = computed?.indices || {}
  const temperament = computed?.temperament || {}
  const productivity = computed?.productivity || {}
  const name = raw?.promoterName || item?.promoterName || item?.name || `Pessoa ${index + 1}`
  return {
    id: String(item?.id || raw?.id || raw?.email || name),
    name: String(name),
    role: String(raw?.role || item?.role || 'Promotor'),
    unit: String(raw?.unit || item?.unit || 'Sem unidade'),
    email: String(raw?.email || item?.email || ''),
    phone: String(raw?.phone || item?.phone || ''),
    leadership: percent(indices?.leadershipPotential?.score || indices?.leadership?.score || 60),
    productivity: percent(productivity?.index || indices?.productivity?.score || 79),
    relationship: percent(indices?.interpersonalRelationship?.score || temperament?.primaryPercent || 75),
  }
}

function normalizeKeyPart(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function personKey(person: Person) {
  const email = normalizeKeyPart(person.email || '')
  if (email) return `email:${email}`
  return `person:${normalizeKeyPart(person.name)}|${normalizeKeyPart(person.unit)}|${normalizeKeyPart(person.role)}`
}

function uniquePeople(people: Person[]) {
  const byKey = new Map<string, Person>()
  for (const person of people) {
    const key = personKey(person)
    const current = byKey.get(key)
    byKey.set(key, current ? { ...current, ...person } : person)
  }
  return Array.from(byKey.values())
}

const fallbackPeople = uniquePeople((restoredPromoterSubmissions as any[]).map(mapSubmission))

function StatCard({ label, value, detail, color }: { label: string; value: string; detail: string; color: string }) {
  return (
    <div className="rounded-[22px] border border-[#D8E5F0] bg-white p-4 shadow-[0_14px_34px_rgba(0,63,117,0.06)]">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#6B7F94]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#001B3F]">{value}</p>
      <p className="mt-1 text-xs font-bold" style={{ color }}>{detail}</p>
    </div>
  )
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-xs font-black text-[#5D7085]">{label}</span>
        <span className="text-xs font-black" style={{ color }}>{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-[#EAF4FF]">
        <div className="h-2 rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const [people, setPeople] = useState<Person[]>(fallbackPeople)
  const [selectedUnit, setSelectedUnit] = useState('')
  const [selectedPerson, setSelectedPerson] = useState('')
  const [tab, setTab] = useState<'unit' | 'person'>('unit')
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState<'api' | 'fallback'>('fallback')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const { data } = await api.get('/management')
        const managementPeople = Array.isArray(data?.people)
          ? data.people.map((person: any, index: number) => ({
              id: String(person.id || person.email || person.name || index),
              name: String(person.name || `Pessoa ${index + 1}`),
              role: String(person.role || 'Colaborador'),
              unit: String(person.unit || 'Sem unidade'),
              email: String(person.email || ''),
              phone: String(person.phone || ''),
              leadership: percent(person.leadershipPercent || (person.score || 0) * 20 || 60),
              productivity: percent(person.productivityIndex || 79),
              relationship: percent(person.behavioralProfilePercent || person.pulse || 75),
            }))
          : []
        if (!active) return
        setPeople(uniquePeople([...managementPeople, ...fallbackPeople]).sort((a, b) => a.name.localeCompare(b.name)))
        setSource(managementPeople.length ? 'api' : 'fallback')
      } catch {
        if (active) {
          setPeople([...fallbackPeople].sort((a, b) => a.name.localeCompare(b.name)))
          setSource('fallback')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  const units = useMemo(() => Array.from(new Set(people.map(person => person.unit).filter(Boolean))).sort(), [people])
  const selectedGroup = tab === 'unit'
    ? people.filter(person => person.unit === selectedUnit)
    : people.filter(person => person.id === selectedPerson)
  const reportPeople = selectedGroup.length ? selectedGroup : people
  const report = {
    total: reportPeople.length,
    leadership: avg(reportPeople.map(person => person.leadership)),
    productivity: avg(reportPeople.map(person => person.productivity)),
    relationship: avg(reportPeople.map(person => person.relationship)),
    promoters: reportPeople.filter(person => person.role.toLowerCase().includes('promotor')).length,
    attention: reportPeople.filter(person => person.leadership < 60 || person.productivity < 60).length,
  }
  const topPeople = [...reportPeople]
    .sort((a, b) => (b.leadership + b.productivity + b.relationship) - (a.leadership + a.productivity + a.relationship))
    .slice(0, 8)

  return (
    <AdminLayout>
      <div className="space-y-5">
        <section className="rounded-[28px] border border-white/80 bg-white/92 p-5 shadow-[0_22px_70px_rgba(0,63,117,0.10)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#6B7F94]">Inteligência operacional</p>
              <h1 className="mt-2 text-3xl font-black text-[#001B3F]">Relatórios</h1>
              <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-[#5D7085]">
                Visão consolidada por unidade ou pessoa, usando os cadastros publicados e os dados restaurados do Drive.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#D8E5F0] bg-white px-4 text-sm font-black text-[#003F75]"
            >
              <PrinterIcon className="h-4 w-4" />
              Imprimir
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-[#6B7F94]">
            <span className="rounded-full bg-[#EAF4FF] px-3 py-1">{loading ? 'Carregando dados...' : `${people.length} pessoas disponíveis`}</span>
            <span className="rounded-full bg-[#EAF4FF] px-3 py-1">{source === 'api' ? 'Fonte: sistema + Drive' : 'Fonte: restauração do Drive'}</span>
          </div>
        </section>

        <section className="rounded-[28px] border border-white/80 bg-white/88 p-4 shadow-[0_20px_60px_rgba(0,63,117,0.08)]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <div className="flex rounded-2xl bg-[#EAF4FF] p-1">
              <button
                type="button"
                onClick={() => setTab('unit')}
                className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-black ${tab === 'unit' ? 'bg-[#005DAA] text-white' : 'text-[#005DAA]'}`}
              >
                <BuildingLibraryIcon className="h-4 w-4" />
                Por unidade
              </button>
              <button
                type="button"
                onClick={() => setTab('person')}
                className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-black ${tab === 'person' ? 'bg-[#005DAA] text-white' : 'text-[#005DAA]'}`}
              >
                <UserIcon className="h-4 w-4" />
                Por pessoa
              </button>
            </div>

            {tab === 'unit' ? (
              <select value={selectedUnit} onChange={event => setSelectedUnit(event.target.value)} className="h-11 min-w-[280px] flex-1 rounded-2xl border border-[#C9DBEA] bg-white px-4 text-sm font-bold text-[#001B3F] outline-none">
                <option value="">Todas as unidades</option>
                {units.map(unit => <option key={unit} value={unit}>{unit}</option>)}
              </select>
            ) : (
              <select value={selectedPerson} onChange={event => setSelectedPerson(event.target.value)} className="h-11 min-w-[280px] flex-1 rounded-2xl border border-[#C9DBEA] bg-white px-4 text-sm font-bold text-[#001B3F] outline-none">
                <option value="">Todas as pessoas</option>
                {people.map(person => <option key={person.id} value={person.id}>{person.name} · {person.unit}</option>)}
              </select>
            )}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Pessoas" value={String(report.total)} detail="base analisada" color="#005DAA" />
          <StatCard label="Promotores" value={String(report.promoters)} detail="função comercial" color="#0ABD78" />
          <StatCard label="Liderança" value={`${report.leadership}%`} detail="média do grupo" color="#F8A303" />
          <StatCard label="Produtividade" value={`${report.productivity}%`} detail="média do grupo" color="#0ABD78" />
          <StatCard label="Atenção" value={String(report.attention)} detail="casos para revisar" color="#FF4757" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-[28px] border border-white/80 bg-white/92 p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6B7F94]">Desempenho</p>
            <h2 className="mt-1 text-2xl font-black text-[#001B3F]">Indicadores médios</h2>
            <div className="mt-5 space-y-4">
              <Meter label="Liderança" value={report.leadership} color="#F8A303" />
              <Meter label="Produtividade" value={report.productivity} color="#0ABD78" />
              <Meter label="Relacionamento" value={report.relationship} color="#29ABE2" />
            </div>
            <div className="mt-5 rounded-2xl bg-[#F7FBFF] p-4 text-sm font-semibold leading-6 text-[#5D7085]">
              Este painel evita tela vazia: quando a API protegida não responde, ele usa a base restaurada do Drive para manter a leitura executiva disponível.
            </div>
          </div>

          <div className="rounded-[28px] border border-white/80 bg-white/92 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6B7F94]">Ranking</p>
                <h2 className="mt-1 text-2xl font-black text-[#001B3F]">Pessoas em destaque</h2>
              </div>
              <UserGroupIcon className="h-8 w-8 text-[#005DAA]" />
            </div>
            <div className="mt-4 divide-y divide-[#D8E5F0] overflow-hidden rounded-2xl border border-[#D8E5F0]">
              {topPeople.map((person, index) => {
                const score = avg([person.leadership, person.productivity, person.relationship])
                return (
                  <div key={`${person.id}-${index}`} className="grid gap-3 bg-white p-4 md:grid-cols-[36px_1fr_88px] md:items-center">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#EAF4FF] text-sm font-black text-[#005DAA]">{index + 1}</div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#001B3F]">{person.name}</p>
                      <p className="mt-1 truncate text-xs font-bold text-[#6B7F94]">{person.role} · {person.unit}</p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-xl font-black text-[#001B3F]">{score}%</p>
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-[#6B7F94]">média</p>
                    </div>
                  </div>
                )
              })}
              {!topPeople.length && (
                <div className="p-8 text-center text-sm font-semibold text-[#6B7F94]">
                  Nenhuma pessoa disponível para este filtro.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}
