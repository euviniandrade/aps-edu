'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AdminLayout from '@/components/layout/AdminLayout'
import {
  ArrowTrendingUpIcon,
  BoltIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  CubeIcon,
  KeyIcon,
  SparklesIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import {
  capabilityMatrix,
  executiveMetrics,
  hubLinks,
  operatingRoadmap,
  personalTools,
  priorityWorkflows,
  smartAutomations,
  suiteModules,
  type Capability,
  type SuiteDomain,
} from '@/lib/apsSuite'

const domainIcon: Record<SuiteDomain, any> = {
  trabalho: ClipboardDocumentCheckIcon,
  pessoas: UserGroupIcon,
  educacao: ChartBarIcon,
  operacao: CubeIcon,
  inteligencia: SparklesIcon,
}

const impactStyle: Record<Capability['impact'], { label: string; color: string; bg: string }> = {
  critico: { label: 'Critico', color: '#FF4757', bg: 'rgba(255,71,87,0.12)' },
  alto: { label: 'Alto', color: '#F8A303', bg: 'rgba(248,163,3,0.12)' },
  medio: { label: 'Medio', color: '#4A9EFF', bg: 'rgba(74,158,255,0.12)' },
}

const statusStyle: Record<Capability['status'], { label: string; color: string; bg: string }> = {
  ativo: { label: 'Ativo', color: '#0ABD78', bg: 'rgba(10,189,120,0.12)' },
  prototipo: { label: 'Prototipo', color: '#4A9EFF', bg: 'rgba(74,158,255,0.12)' },
  planejado: { label: 'Planejado', color: '#A78BFA', bg: 'rgba(167,139,250,0.12)' },
}

function MetricCard({ metric }: { metric: (typeof executiveMetrics)[number] }) {
  return (
    <div className="rounded-lg p-5" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.34)' }}>{metric.label}</p>
          <p className="mt-3 text-3xl font-black" style={{ color: metric.color }}>{metric.value}</p>
          <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.46)' }}>{metric.trend}</p>
        </div>
        <div className="rounded-lg p-3" style={{ background: `${metric.color}18`, border: `1px solid ${metric.color}35` }}>
          <ArrowTrendingUpIcon className="h-5 w-5" style={{ color: metric.color }} />
        </div>
      </div>
    </div>
  )
}

function ModuleCard({ module }: { module: (typeof suiteModules)[number] }) {
  const Icon = domainIcon[module.id]
  return (
    <article className="rounded-lg p-5" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2.5" style={{ background: `${module.color}18`, border: `1px solid ${module.color}35` }}>
              <Icon className="h-5 w-5" style={{ color: module.color }} />
            </div>
            <div>
              <h2 className="text-base font-black text-white">{module.title}</h2>
              <p className="text-xs" style={{ color: module.color }}>{module.benchmark}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6" style={{ color: 'rgba(255,255,255,0.55)' }}>{module.subtitle}</p>
        </div>
        <span className="rounded-lg px-2.5 py-1 text-xs font-black" style={{ color: module.color, background: `${module.color}14` }}>
          {module.maturity}%
        </span>
      </div>
      <div className="mt-5 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-2 rounded-full" style={{ width: `${module.maturity}%`, background: module.color }} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {module.signals.map(signal => (
          <span key={signal} className="rounded-md px-2 py-1 text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.56)' }}>
            {signal}
          </span>
        ))}
      </div>
    </article>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: '#F8A303' }}>APS EDU Suite</p>
      <h2 className="mt-2 text-xl font-black text-white">{title}</h2>
      <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.46)' }}>{subtitle}</p>
    </div>
  )
}

function QuickLinkCard({ item }: { item: (typeof hubLinks)[number] }) {
  return (
    <Link href={item.href} className="block rounded-lg p-4 transition-all hover:scale-[1.01]" style={{ background: item.primary ? `${item.color}12` : 'rgba(255,255,255,0.035)', border: `1px solid ${item.primary ? item.color + '35' : 'rgba(255,255,255,0.07)'}` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-white">{item.title}</h3>
          <p className="mt-2 text-xs leading-5" style={{ color: 'rgba(255,255,255,0.48)' }}>{item.description}</p>
        </div>
        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
      </div>
    </Link>
  )
}

function PersonalToolCard({ tool }: { tool: (typeof personalTools)[number] }) {
  return (
    <Link href={tool.href} className="block rounded-lg p-4 transition-all hover:scale-[1.01]" style={{ background: `${tool.color}10`, border: `1px solid ${tool.color}30` }}>
      <div className="flex items-start gap-3">
        <div className="rounded-lg p-2" style={{ background: `${tool.color}18`, border: `1px solid ${tool.color}35` }}>
          {tool.title.includes('Cofre') ? <KeyIcon className="h-4 w-4" style={{ color: tool.color }} /> : <SparklesIcon className="h-4 w-4" style={{ color: tool.color }} />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-white">{tool.title}</h3>
            <span className="rounded-md px-1.5 py-0.5 text-[10px] font-black" style={{ color: tool.color, background: `${tool.color}14` }}>{tool.metric}</span>
          </div>
          <p className="mt-2 text-xs leading-5" style={{ color: 'rgba(255,255,255,0.52)' }}>{tool.description}</p>
        </div>
      </div>
    </Link>
  )
}

export default function GestaoPage() {
  const [personalStats, setPersonalStats] = useState({ notes: 0, hasVault: false, hasWorkday: false })

  useEffect(() => {
    try {
      const notes = JSON.parse(localStorage.getItem('aps_edu_notebooks_v1') || '[]')
      setPersonalStats({
        notes: Array.isArray(notes) ? notes.length : 0,
        hasVault: !!localStorage.getItem('aps_edu_vault_pin'),
        hasWorkday: !!localStorage.getItem('aps_workday'),
      })
    } catch {
      setPersonalStats({ notes: 0, hasVault: false, hasWorkday: false })
    }
  }, [])

  const groupedLinks = useMemo(() => ({
    trabalho: hubLinks.filter(item => item.group === 'trabalho'),
    rede: hubLinks.filter(item => item.group === 'rede'),
    inteligencia: hubLinks.filter(item => item.group === 'inteligencia'),
  }), [])

  return (
    <AdminLayout>
      <div className="min-h-full p-4 lg:p-8 space-y-7">
        <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Educacao Adventista <span>/</span> Plataforma Unificada
            </div>
            <h1 className="mt-4 max-w-4xl text-3xl font-black leading-tight text-white lg:text-5xl">
              Centro de Gestao APS EDU
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 lg:text-base" style={{ color: 'rgba(255,255,255,0.52)' }}>
              O melhor dos grandes sistemas de tarefas, pessoas, colegios e estoque em uma operacao unica para a rede APS.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/tasks" className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
              <CheckCircleIcon className="h-4 w-4" /> Trabalho
            </a>
            <a href="/estoque" className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-black" style={{ background: '#F8A303' }}>
              <CubeIcon className="h-4 w-4" /> Operacao
            </a>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {executiveMetrics.map(metric => <MetricCard key={metric.label} metric={metric} />)}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.05fr_1.35fr]">
          <div className="rounded-lg p-5" style={{ background: 'linear-gradient(135deg, rgba(248,163,3,0.14), rgba(167,139,250,0.08))', border: '1px solid rgba(248,163,3,0.18)' }}>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <SectionTitle title="Minha central" subtitle="A antiga area pessoal agora fica dentro do Centro de Gestao." />
              <div className="flex gap-2">
                <span className="rounded-lg px-2.5 py-1 text-xs font-black" style={{ color: '#F8A303', background: 'rgba(248,163,3,0.12)' }}>{personalStats.hasWorkday ? 'Rotina ativa' : 'Rotina pronta'}</span>
                <span className="rounded-lg px-2.5 py-1 text-xs font-black" style={{ color: '#A78BFA', background: 'rgba(167,139,250,0.12)' }}>{personalStats.notes} notas</span>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {personalTools.map(tool => <PersonalToolCard key={tool.title} tool={tool} />)}
            </div>
            <div className="mt-4 rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.16)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs leading-5" style={{ color: 'rgba(255,255,255,0.54)' }}>
                Cofre {personalStats.hasVault ? 'configurado' : 'pendente'} · rotina {personalStats.hasWorkday ? 'personalizada' : 'padrao'} · notas locais integradas ao cockpit.
              </p>
            </div>
          </div>

          <div className="rounded-lg p-5" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <SectionTitle title="Ferramentas organizadas" subtitle="Menos abas no menu, mais clareza: o hub leva para cada ferramenta quando ela for necessaria." />
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div>
                <h3 className="mb-3 text-xs font-black uppercase tracking-wide" style={{ color: '#0ABD78' }}>Trabalho</h3>
                <div className="space-y-3">{groupedLinks.trabalho.map(item => <QuickLinkCard key={item.href} item={item} />)}</div>
              </div>
              <div>
                <h3 className="mb-3 text-xs font-black uppercase tracking-wide" style={{ color: '#4A9EFF' }}>Rede</h3>
                <div className="space-y-3">{groupedLinks.rede.map(item => <QuickLinkCard key={item.href} item={item} />)}</div>
              </div>
              <div>
                <h3 className="mb-3 text-xs font-black uppercase tracking-wide" style={{ color: '#A78BFA' }}>Inteligencia</h3>
                <div className="space-y-3">{groupedLinks.inteligencia.map(item => <QuickLinkCard key={item.href} item={item} />)}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-5">
          {suiteModules.map(module => <ModuleCard key={module.id} module={module} />)}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.45fr_0.9fr]">
          <div className="rounded-lg" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="border-b p-5" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <SectionTitle title="Matriz do melhor dos 100" subtitle="Capacidades consolidadas, sem repetir ferramentas que fazem a mesma coisa." />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.34)' }}>
                    <th className="px-5 py-3 font-semibold">Capacidade</th>
                    <th className="px-5 py-3 font-semibold">Benchmark</th>
                    <th className="px-5 py-3 font-semibold">Como entra no APS</th>
                    <th className="px-5 py-3 font-semibold">Impacto</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {capabilityMatrix.map(capability => (
                    <tr key={`${capability.domain}-${capability.name}`} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      <td className="px-5 py-4">
                        <p className="text-sm font-black text-white">{capability.name}</p>
                        <p className="text-xs capitalize" style={{ color: 'rgba(255,255,255,0.34)' }}>{capability.domain}</p>
                      </td>
                      <td className="px-5 py-4 text-sm" style={{ color: 'rgba(255,255,255,0.62)' }}>{capability.bestFrom}</td>
                      <td className="px-5 py-4 text-sm leading-6" style={{ color: 'rgba(255,255,255,0.58)' }}>{capability.apsImplementation}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-lg px-2.5 py-1 text-xs font-black" style={{ background: impactStyle[capability.impact].bg, color: impactStyle[capability.impact].color }}>
                          {impactStyle[capability.impact].label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-lg px-2.5 py-1 text-xs font-black" style={{ background: statusStyle[capability.status].bg, color: statusStyle[capability.status].color }}>
                          {statusStyle[capability.status].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-lg p-5" style={{ background: 'linear-gradient(135deg, rgba(248,163,3,0.16), rgba(74,158,255,0.08))', border: '1px solid rgba(248,163,3,0.18)' }}>
              <div className="flex items-center gap-3">
                <div className="rounded-lg p-2.5" style={{ background: 'rgba(248,163,3,0.18)', border: '1px solid rgba(248,163,3,0.28)' }}>
                  <SparklesIcon className="h-5 w-5" style={{ color: '#F8A303' }} />
                </div>
                <div>
                  <h2 className="text-base font-black text-white">Sofi como camada de inteligencia</h2>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.46)' }}>Resumo, alerta, recomendacao e busca natural.</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6" style={{ color: 'rgba(255,255,255,0.62)' }}>
                A IA fica acima dos modulos para cruzar tarefas, pessoas, unidades, eventos e estoque, priorizando o que exige decisao humana.
              </p>
            </div>

            <div className="rounded-lg p-5" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <SectionTitle title="Roadmap operacional" subtitle="Entrega em camadas para sair do painel bonito e virar plataforma de gestao." />
              <div className="mt-5 space-y-4">
                {operatingRoadmap.map(phase => (
                  <div key={phase.phase} className="border-l-2 pl-4" style={{ borderColor: '#F8A303' }}>
                    <p className="text-xs font-black uppercase tracking-wide" style={{ color: '#F8A303' }}>{phase.phase}</p>
                    <h3 className="mt-1 text-sm font-black text-white">{phase.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {phase.items.map(item => (
                        <span key={item} className="rounded-md px-2 py-1 text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.52)' }}>{item}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-lg p-5" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <SectionTitle title="Automacoes inteligentes" subtitle="Regras inspiradas nas melhores plataformas enterprise, adaptadas para escola." />
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {smartAutomations.map(automation => {
                const module = suiteModules.find(item => item.id === automation.domain)
                return (
                  <article key={automation.title} className="rounded-lg p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg p-2" style={{ background: `${module?.color || '#F8A303'}18`, border: `1px solid ${module?.color || '#F8A303'}35` }}>
                        <BoltIcon className="h-4 w-4" style={{ color: module?.color || '#F8A303' }} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white">{automation.title}</h3>
                        <p className="mt-2 text-xs leading-5" style={{ color: 'rgba(255,255,255,0.48)' }}>{automation.trigger}</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 text-xs leading-5" style={{ color: 'rgba(255,255,255,0.58)' }}>
                      <p><span className="font-bold text-white">Acao:</span> {automation.action}</p>
                      <p><span className="font-bold text-white">Resultado:</span> {automation.result}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>

          <div className="rounded-lg p-5" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <SectionTitle title="Workflows principais" subtitle="As rotinas mais valiosas reunidas em fluxos que atravessam modulos." />
            <div className="mt-5 space-y-4">
              {priorityWorkflows.map(workflow => (
                <article key={workflow.title} className="rounded-lg p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-sm font-black text-white">{workflow.title}</h3>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>{workflow.owner}</p>
                    </div>
                    <span className="rounded-md px-2 py-1 text-xs font-bold" style={{ color: '#0ABD78', background: 'rgba(10,189,120,0.12)' }}>
                      {workflow.steps.length} etapas
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-5">
                    {workflow.steps.map((step, index) => (
                      <div key={step} className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.16)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <p className="text-[10px] font-black" style={{ color: '#F8A303' }}>{String(index + 1).padStart(2, '0')}</p>
                        <p className="mt-1 text-xs font-bold leading-4 text-white">{step}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}
