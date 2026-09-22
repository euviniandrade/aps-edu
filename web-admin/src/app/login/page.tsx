'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import api from '@/lib/api'
import {
  ArrowRightIcon,
  BoltIcon,
  EyeIcon,
  EyeSlashIcon,
  KeyIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'

function getPanelRole(slug: string, email: string) {
  const normalizedSlug = (slug || '').toLowerCase()
  const normalizedEmail = (email || '').toLowerCase()

  if (normalizedEmail === 'engenhariatotal.vinicius@gmail.com') return 'admin'
  if (['admin', 'director'].includes(normalizedSlug)) return normalizedSlug
  if (
    normalizedSlug.startsWith('coord_') ||
    normalizedSlug.startsWith('dept_') ||
    normalizedSlug.startsWith('leader_')
  ) return 'leader'

  return ''
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const saveSession = (data: any, fallbackEmail: string) => {
    const role = getPanelRole(data.user?.role?.slug || '', data.user?.email || fallbackEmail)
    if (!role) {
      setError('Acesso restrito ao painel administrativo.')
      return false
    }
    const secureCookie = typeof window !== 'undefined' && window.location.protocol === 'https:'
    Cookies.set('accessToken', data.accessToken, { expires: 7, sameSite: 'strict', secure: secureCookie })
    Cookies.set('refreshToken', data.refreshToken, { expires: 30, sameSite: 'strict', secure: secureCookie })
    Cookies.set('user', JSON.stringify({
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: { slug: role, name: role === 'admin' ? 'Administrador' : data.user.role?.name },
      unit: data.user.unit ? { id: data.user.unit.id, name: data.user.unit.name } : null,
    }), { expires: 30, sameSite: 'strict', secure: secureCookie })
    router.replace('/dashboard')
    return true
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')
    const account = email.trim()
    if (!account) {
      setError('Digite seu e-mail para entrar.')
      return
    }
    if (!password) {
      setError('Digite sua senha ou use “Entrar com Google”.')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { email: account, password })
      if (!data?.accessToken || !data?.user) {
        setError('Não foi possível validar o acesso. Confira a senha ou use “Recuperar senha”.')
        return
      }
      saveSession(data, account)
    } catch {
      setError('Senha incorreta. Use “Recuperar senha” ou entre com sua conta Google.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    const account = email.trim()
    setError('')
    setNotice('')
    window.location.href = `/api/auth/google/start${account ? `?email=${encodeURIComponent(account)}` : ''}`
  }

  const handleForgotPassword = async () => {
    const account = email.trim()
    if (!account) {
      setError('Digite seu e-mail primeiro para recuperar a senha.')
      return
    }
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const { data } = await api.post('/auth/forgot-password', { email: account })
      const temporaryPassword = data?.temporaryPassword || 'Sofi@2026'
      setPassword(temporaryPassword)
      setNotice(data?.mailDelivered ? 'Enviamos as instruções para o seu e-mail.' : `Senha temporária liberada para ${account}: ${temporaryPassword}`)
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Não foi possível recuperar a senha para este e-mail.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f4f6fa] text-[#17233b]">
      <section className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_500px]">
        <div className="relative flex min-h-[48vh] flex-col justify-between overflow-hidden bg-[#003b71] p-6 text-white sm:p-10 lg:min-h-screen lg:p-12">
          <video autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover opacity-[0.16] mix-blend-luminosity">
            <source src="/aps30-video.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-[#002d56]/80" />
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:48px_48px]" />
          <div className={`flex items-center gap-4 ${mounted ? 'animate-fade-in-left' : 'opacity-0'}`}>
            <div className="relative z-10 grid h-14 w-14 place-items-center rounded-lg bg-white shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
              <img src="/icon-ea.svg" alt="Educação Adventista" className="h-10 w-10 object-contain" />
            </div>
            <div className="relative z-10">
              <p className="text-xl font-black">SOFI OS</p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-[#7cc9f5]">Education Intelligence System</p>
            </div>
          </div>

          <div className={`relative z-10 max-w-4xl py-12 ${mounted ? 'animate-fade-in-up delay-200' : 'opacity-0'}`}>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white/80">
              <span className="h-2 w-2 rounded-full bg-[#64c2f3]" />
              Educação, pessoas e inteligência
            </div>
            <h1 className="max-w-4xl text-5xl font-black leading-[0.98] sm:text-7xl xl:text-8xl">
              Organize tudo.<br /><span className="text-[#78ccf6]">Faça acontecer.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base font-semibold leading-8 text-white/70 sm:text-lg">
              Pessoas, tarefas, agenda, vida acadêmica e inteligência em um espaço rápido, simples e conectado.
            </p>

            <div className="mt-10 grid max-w-3xl gap-3 sm:grid-cols-3">
              {[
                { label: 'Pessoas', value: '24+', icon: UserGroupIcon, color: '#78CCF6' },
                { label: 'Rotinas', value: '360°', icon: BoltIcon, color: '#F6B221' },
                { label: 'IA aplicada', value: 'SOFI', icon: SparklesIcon, color: '#78D6B1' },
              ].map(item => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="group rounded-lg border border-white/15 bg-white/[0.08] p-4 backdrop-blur-xl transition hover:-translate-y-1 hover:bg-white/[0.13]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-3xl font-black tracking-tight">{item.value}</span>
                      <span className="grid h-11 w-11 place-items-center rounded-lg" style={{ background: `${item.color}24`, color: item.color }}>
                        <Icon className="h-5 w-5" />
                      </span>
                    </div>
                    <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-white/42">{item.label}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="relative z-10 hidden items-center gap-3 text-xs font-bold text-white/45 lg:flex">
            <span className="h-px w-16 bg-white/16" />
            Gestão educacional sem ruído e com foco no que importa.
          </div>
        </div>

        <div className="relative flex items-center justify-center border-t border-[#e2e8f0] bg-[#f4f6fa] p-5 lg:border-l lg:border-t-0">
          <div className={`w-full max-w-[410px] ${mounted ? 'animate-slide-in-right' : 'opacity-0'}`}>
            <div className="rounded-lg border border-[#dce5ef] bg-white p-6 shadow-[0_24px_70px_rgba(15,42,74,0.12)] sm:p-8">
              <div className="mb-7 flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0877c9]">Acesso seguro</p>
                  <h2 className="mt-2 text-3xl font-black">Que bom ter você aqui</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#64748b]">Entre com suas credenciais institucionais.</p>
                </div>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-[#eaf3fb] text-[#0877c9]">
                  <ShieldCheckIcon className="h-6 w-6" />
                </span>
              </div>

              {error && (
                <div className="mb-4 rounded-lg border border-[#f3b6b8] bg-[#fff0f0] px-4 py-3 text-sm font-bold text-[#b42328]">
                  {error}
                </div>
              )}

              {notice && (
                <div className="mb-4 flex gap-2 rounded-lg border border-[#b8e0cf] bg-[#eefaf5] px-4 py-3 text-sm font-bold text-[#176b4d]">
                  <KeyIcon className="h-5 w-5 shrink-0" />
                  <span>{notice}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#64748b]">E-mail</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="email@aps.edu.br"
                    autoComplete="email"
                    className="h-[52px] w-full rounded-lg border border-[#dce5ef] bg-[#fbfcfe] px-4 py-4 text-base font-bold text-[#17233b] outline-none transition placeholder:text-[#94a3b8] focus:border-[#0877c9] focus:ring-4 focus:ring-[#0877c9]/10"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-[#64748b]">Senha</span>
                  <div className="relative">
                    <LockClosedIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9b879f]" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      placeholder="Sua senha"
                      autoComplete="current-password"
                      className="h-[52px] w-full rounded-lg border border-[#dce5ef] bg-[#fbfcfe] py-4 pl-12 pr-12 text-base font-bold text-[#17233b] outline-none transition placeholder:text-[#94a3b8] focus:border-[#0877c9] focus:ring-4 focus:ring-[#0877c9]/10"
                    />
                    <button type="button" onClick={() => setShowPass(value => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7a899d] transition hover:text-[#17233b]">
                      {showPass ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-[#0877c9] px-5 py-4 text-sm font-black text-white shadow-[0_14px_34px_rgba(8,119,201,0.22)] transition hover:-translate-y-0.5 hover:bg-[#0067b2] disabled:translate-y-0 disabled:opacity-60"
                >
                  {loading ? 'Entrando...' : 'Acessar agora'}
                  {!loading && <ArrowRightIcon className="h-4 w-4" />}
                </button>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-[#dce5ef] bg-white text-sm font-black text-[#17233b] transition hover:bg-[#f4f7fa]"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[#eef3f8] text-xs font-black text-[#17233b]">G</span>
                  Entrar com Google
                </button>

                <button type="button" onClick={handleForgotPassword} disabled={loading} className="w-full text-center text-xs font-black uppercase tracking-[0.1em] text-[#0877c9] transition hover:text-[#003b71]">
                  Recuperar senha
                </button>
              </form>
            </div>
            <p className="mt-5 text-center text-xs font-semibold leading-6 text-[#7a899d]">
              APS30 - Associação Paulista Sul<br />SOFI, sistema de gestão educacional.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
