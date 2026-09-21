'use client'

import { useEffect, useMemo, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import api from '@/lib/api'
import {
  ArrowPathIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  CloudIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  LinkIcon,
  LockClosedIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline'

type Provider = {
  id: string
  name: string
  services: string[]
  envReady: boolean
  connected: boolean
  verified?: boolean
  operational?: boolean
  connectUrl?: string | null
  account?: string | null
  lastSync?: string | null
  note?: string
}

type Status = {
  providers: Provider[]
  tokenVault?: { ready?: boolean; detail?: string }
}

const workspaceLinks = [
  { title: 'Google Agenda', href: 'https://calendar.google.com', icon: CalendarDaysIcon, detail: 'Calendários, prazos e convites' },
  { title: 'Google Drive', href: 'https://drive.google.com', icon: FolderIcon, detail: 'Arquivos, pastas e relatórios' },
  { title: 'Google Docs', href: 'https://docs.google.com', icon: DocumentTextIcon, detail: 'Documentos e atas' },
  { title: 'Google Sheets', href: 'https://sheets.google.com', icon: CloudIcon, detail: 'Planilhas e controles' },
  { title: 'Gmail', href: 'https://mail.google.com', icon: PaperAirplaneIcon, detail: 'Comunicação e automações' },
  { title: 'Calendário Apple', href: 'https://www.icloud.com/calendar', icon: CalendarDaysIcon, detail: 'iCloud, iPhone e Mac' },
]

const fallbackStatus: Status = {
  providers: [
    {
      id: 'google',
      name: 'Google Workspace',
      services: ['Gmail', 'Google Drive', 'Google Agenda', 'Google Docs', 'Google Sheets'],
      envReady: false,
      connected: false,
      connectUrl: '/api/integrations/oauth/start?provider=google',
      note: 'Status online indisponível. Conecte ou revise as credenciais do Google Cloud.',
    },
    {
      id: 'microsoft',
      name: 'Microsoft 365',
      services: ['Outlook', 'OneDrive', 'Calendário Microsoft', 'SharePoint', 'Planner'],
      envReady: false,
      connected: false,
      connectUrl: '/api/integrations/oauth/start?provider=microsoft',
      note: 'Status online indisponível. Conecte ou revise as credenciais Microsoft.',
    },
    {
      id: 'icloud',
      name: 'Apple iCloud',
      services: ['Calendário iCloud', 'Contatos iCloud', 'CalDAV/CardDAV'],
      envReady: true,
      connected: false,
      connectUrl: null,
      note: 'Use senha específica de app ou exporte .ics pela Agenda central.',
    },
  ],
  tokenVault: {
    ready: false,
    detail: 'Status do cofre indisponível nesta sessão.',
  },
}

export default function IntegracoesPage() {
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [appleId, setAppleId] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [calendarUrl, setCalendarUrl] = useState('https://caldav.icloud.com')
  const [savingApple, setSavingApple] = useState(false)

  async function refresh() {
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/integrations/status', { cache: 'no-store' })
      if (!response.ok) throw new Error('status_unavailable')
      const data = await response.json()
      setStatus(Array.isArray(data?.providers) ? data : fallbackStatus)
    } catch {
      setStatus(fallbackStatus)
      setMessage('Não foi possível ler o status das integrações agora.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === '1') setMessage('Integração conectada e salva no backend.')
    if (params.get('setup')) setMessage(`A conexão precisa de ajuste: ${params.get('setup')}`)
  }, [])

  const providers = status?.providers || []
  const connectedCount = providers.filter(provider => provider.connected).length
  const readyCount = providers.filter(provider => provider.envReady).length

  async function saveApple() {
    if (!appleId.trim() || !appPassword.trim()) {
      setMessage('Informe Apple ID e senha específica de app para configurar o iCloud.')
      return
    }
    setSavingApple(true)
    setMessage('')
    try {
      await api.post('/integrations/icloud/configure', {
        appleId: appleId.trim(),
        appPassword: appPassword.trim(),
        calendarUrl: calendarUrl.trim() || 'https://caldav.icloud.com',
      })
      setAppPassword('')
      setMessage('iCloud configurado com credenciais criptografadas no backend.')
      await refresh()
    } catch (error: any) {
      setMessage(error?.response?.data?.error || 'Não foi possível salvar o iCloud. Verifique login e senha específica de app.')
    } finally {
      setSavingApple(false)
    }
  }

  const steps = useMemo(() => [
    'Conectar Google Workspace para Drive, Gmail e Google Agenda.',
    'Usar a Agenda central como painel diário da operação e da faculdade.',
    'Exportar .ics para Apple Calendar quando quiser replicar no iPhone/Mac.',
    'Manter tokens no backend, nunca no navegador.',
  ], [])

  return (
    <AdminLayout>
      <div className="space-y-5">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-lg border border-[#dbe6ef] bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#718096]">Hub de ferramentas</p>
            <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-4xl font-black leading-none text-[#0f172a]">Integrações profissionais</h1>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-[#64748b]">
                  Google Workspace, calendários externos, iCloud/iOS e Microsoft 365 organizados em uma central clara, com status real de conexão.
                </p>
              </div>
              <button onClick={refresh} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#dbe6ef] bg-white px-4 text-sm font-black text-[#334155]">
                <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar status
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <Metric label="Conectadas" value={connectedCount} detail="contas validadas" />
              <Metric label="Prontas" value={readyCount} detail="credenciais configuradas" />
              <Metric label="Cofre" value={status?.tokenVault?.ready ? 'Ativo' : 'Verificar'} detail="tokens no backend" />
            </div>
          </div>

          <aside className="rounded-lg border border-[#dbe6ef] bg-[#f9fcff] p-5">
            <div className="flex items-center gap-3">
              <LockClosedIcon className="h-7 w-7 text-[#006b7a]" />
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#718096]">Segurança</p>
                <h2 className="text-xl font-black text-[#0f172a]">Nada de token falso</h2>
              </div>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#64748b]">
              A interface só marca como conectado quando o backend confirma armazenamento criptografado. Exportação para Apple fica separada de sincronização real.
            </p>
            {message && <p className="mt-4 rounded-lg border border-[#dbe6ef] bg-white px-4 py-3 text-xs font-bold text-[#475569]">{message}</p>}
          </aside>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          {providers.map(provider => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
          {!providers.length && (
            <div className="rounded-lg border border-[#dbe6ef] bg-white p-6 text-sm font-bold text-[#64748b]">
              Carregando provedores de integração.
            </div>
          )}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="rounded-lg border border-[#dbe6ef] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#718096]">Atalhos de trabalho</p>
                <h2 className="mt-1 text-2xl font-black text-[#0f172a]">Pacote Google e Apple</h2>
              </div>
              <a href="/agenda" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#006b7a] px-4 text-sm font-black text-white">
                <CalendarDaysIcon className="h-4 w-4" /> Abrir agenda
              </a>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {workspaceLinks.map(({ icon: Icon, ...link }) => (
                <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="grid grid-cols-[36px_minmax(0,1fr)_16px] items-center gap-3 rounded-lg border border-[#dbe6ef] bg-[#fbfdff] p-4 no-underline hover:bg-white">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#e8f6f3] text-[#006b7a]"><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0">
                    <b className="block text-sm font-black text-[#172033]">{link.title}</b>
                    <small className="mt-1 block text-xs font-bold text-[#64748b]">{link.detail}</small>
                  </span>
                  <LinkIcon className="h-4 w-4 text-[#94a3b8]" />
                </a>
              ))}
            </div>
          </div>

          <aside className="rounded-lg border border-[#dbe6ef] bg-white p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#718096]">Apple e iOS</p>
            <h2 className="mt-1 text-2xl font-black text-[#0f172a]">iCloud CalDAV</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#64748b]">
              Para sincronização real com iPhone/Mac, use uma senha específica de app da Apple. Para uso rápido, exporte `.ics` pela Agenda central.
            </p>
            <div className="mt-4 grid gap-3">
              <input value={appleId} onChange={event => setAppleId(event.target.value)} placeholder="Apple ID" className="h-11 rounded-lg border border-[#dbe6ef] bg-white px-3 text-sm font-bold text-[#172033] outline-none" />
              <input value={appPassword} onChange={event => setAppPassword(event.target.value)} placeholder="Senha específica de app" type="password" className="h-11 rounded-lg border border-[#dbe6ef] bg-white px-3 text-sm font-bold text-[#172033] outline-none" />
              <input value={calendarUrl} onChange={event => setCalendarUrl(event.target.value)} placeholder="URL CalDAV" className="h-11 rounded-lg border border-[#dbe6ef] bg-white px-3 text-sm font-bold text-[#172033] outline-none" />
              <button onClick={saveApple} disabled={savingApple} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#00a9a4] px-4 text-sm font-black text-white disabled:opacity-60">
                {savingApple ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <CheckCircleIcon className="h-4 w-4" />} Salvar iCloud
              </button>
            </div>
          </aside>
        </section>

        <section className="rounded-lg border border-[#dbe6ef] bg-[#f9fcff] p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#718096]">Próxima rotina</p>
          <div className="mt-3 grid gap-3 md:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step} className="rounded-lg border border-[#dbe6ef] bg-white p-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#eef8f6] text-sm font-black text-[#006b7a]">{index + 1}</span>
                <p className="mt-3 text-sm font-bold leading-6 text-[#475569]">{step}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-lg border border-[#dbe6ef] bg-[#fbfdff] p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#718096]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#0f172a]">{value}</p>
      <p className="mt-1 text-xs font-bold text-[#64748b]">{detail}</p>
    </div>
  )
}

function ProviderCard({ provider }: { provider: Provider }) {
  const connected = provider.connected || provider.operational
  return (
    <article className="rounded-lg border border-[#dbe6ef] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#718096]">{provider.id}</p>
          <h2 className="mt-1 text-xl font-black text-[#0f172a]">{provider.name}</h2>
          {provider.account && <p className="mt-1 text-xs font-bold text-[#64748b]">{provider.account}</p>}
        </div>
        {connected ? <CheckCircleIcon className="h-7 w-7 text-[#00a36c]" /> : <ExclamationTriangleIcon className="h-7 w-7 text-[#f59e0b]" />}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {provider.services.map(service => (
          <span key={service} className="rounded-full bg-[#eef5f8] px-3 py-1 text-[11px] font-black text-[#475569]">{service}</span>
        ))}
      </div>
      <div className="mt-5 grid gap-2 text-xs font-bold text-[#64748b]">
        <p>Ambiente: {provider.envReady ? 'credenciais configuradas' : 'credenciais pendentes'}</p>
        <p>Status: {connected ? 'conectado ao backend' : 'aguardando conexão'}</p>
        {provider.note && <p>{provider.note}</p>}
      </div>
      {provider.connectUrl && (
        <a href={provider.connectUrl} className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#006b7a] px-4 text-sm font-black text-white">
          <LinkIcon className="h-4 w-4" /> Conectar {provider.name}
        </a>
      )}
    </article>
  )
}
