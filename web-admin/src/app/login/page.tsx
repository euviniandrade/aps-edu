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
    Cookies.set('accessToken', data.accessToken, { expires: 7, sameSite: 'strict', secure: true })
    Cookies.set('refreshToken', data.refreshToken, { expires: 30, sameSite: 'strict', secure: true })
    Cookies.set('user', JSON.stringify({
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: { slug: role, name: role === 'admin' ? 'Administrador' : data.user.role?.name },
      unit: data.user.unit ? { id: data.user.unit.id, name: data.user.unit.name } : null,
    }), { expires: 30, sameSite: 'strict', secure: true })
    router.replace('/dashboard')
    return true
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const { data } = await api.post('/auth/login', { email, password })
      if (!data?.accessToken || !data?.user) {
        setError('E-mail ou senha incorretos.')
        return
      }
      saveSession(data, email)
    } catch {
      setError('E-mail ou senha incorretos.')
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
    <main className="relative min-h-screen overflow-hidden bg-[#050914] text-white">
      <video autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover opacity-26">
        <source src="/aps30-video.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(2,8,23,0.96)_0%,rgba(3,20,43,0.86)_46%,rgba(0,63,117,0.72)_100%)]" />
      <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:54px_54px]" />
      <div className="absolute left-1/2 top-0 h-full w-[1px] bg-gradient-to-b from-transparent via-white/16 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#050914] to-transparent" />

      <section className="relative z-10 grid min-h-screen lg:grid-cols-[minmax(0,1fr)_480px]">
        <div className="flex min-h-[48vh] flex-col justify-between p-6 sm:p-10 lg:min-h-screen lg:p-12">
          <div className={`flex items-center gap-4 ${mounted ? 'animate-fade-in-left' : 'opacity-0'}`}>
            <div className="grid h-16 w-16 place-items-center rounded-[24px] border border-white/12 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
              <img src="/aps30-logo.png" alt="APS30" className="h-11 w-11 object-contain" />
            </div>
            <div>
              <p className="text-xl font-black tracking-tight">SOFI APS EDU</p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.22em] text-[#F6B221]">Sistema vivo de gestão</p>
            </div>
          </div>

          <div className={`max-w-4xl py-12 ${mounted ? 'animate-fade-in-up delay-200' : 'opacity-0'}`}>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.07] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white/72 backdrop-blur-xl">
              <span className="h-2 w-2 rounded-full bg-[#0ABD78]" />
              Educação, pessoas e inteligência
            </div>
            <h1 className="max-w-4xl text-5xl font-black leading-[0.96] tracking-tight sm:text-7xl xl:text-8xl">
              Gestão escolar com presença de produto global.
            </h1>
            <p className="mt-7 max-w-2xl text-base font-semibold leading-8 text-white/62 sm:text-lg">
              Um ambiente para enxergar a rede, cuidar das pessoas, organizar compromissos acadêmicos e transformar dados em decisões rápidas.
            </p>

            <div className="mt-10 grid max-w-3xl gap-3 sm:grid-cols-3">
              {[
                { label: 'Pessoas', value: '24+', icon: UserGroupIcon, color: '#8B5CF6' },
                { label: 'Rotinas', value: '360°', icon: BoltIcon, color: '#F6B221' },
                { label: 'IA aplicada', value: 'SOFI', icon: SparklesIcon, color: '#0ABD78' },
              ].map(item => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="group rounded-[26px] border border-white/10 bg-white/[0.075] p-4 backdrop-blur-2xl transition hover:-translate-y-1 hover:bg-white/[0.11]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-3xl font-black tracking-tight">{item.value}</span>
                      <span className="grid h-11 w-11 place-items-center rounded-2xl" style={{ background: `${item.color}24`, color: item.color }}>
                        <Icon className="h-5 w-5" />
                      </span>
                    </div>
                    <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-white/42">{item.label}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="hidden items-center gap-3 text-xs font-bold text-white/38 lg:flex">
            <span className="h-px w-16 bg-white/16" />
            Inspirado em experiências digitais premium, adaptado para operação educacional real.
          </div>
        </div>

        <div className="flex items-center justify-center border-t border-white/10 bg-[#061427]/78 p-5 backdrop-blur-2xl lg:border-l lg:border-t-0">
          <div className={`w-full max-w-[410px] ${mounted ? 'animate-slide-in-right' : 'opacity-0'}`}>
            <div className="rounded-[34px] border border-white/14 bg-white/[0.09] p-5 shadow-[0_34px_120px_rgba(0,0,0,0.38)] backdrop-blur-2xl sm:p-7">
              <div className="mb-7 flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#F6B221]">Acesso seguro</p>
                  <h2 className="mt-2 text-3xl font-black tracking-tight">Entrar na plataforma</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-white/52">Use suas credenciais institucionais para acessar a central.</p>
                </div>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#F6B221]/20 bg-[#F6B221]/12 text-[#F6B221]">
                  <ShieldCheckIcon className="h-6 w-6" />
                </span>
              </div>

              {error && (
                <div className="mb-4 rounded-[18px] border border-[#FF4757]/25 bg-[#FF4757]/12 px-4 py-3 text-sm font-bold text-[#FF9AA3]">
                  {error}
                </div>
              )}

              {notice && (
                <div className="mb-4 flex gap-2 rounded-[18px] border border-[#0ABD78]/25 bg-[#0ABD78]/12 px-4 py-3 text-sm font-bold text-[#8EF7C2]">
                  <KeyIcon className="h-5 w-5 shrink-0" />
                  <span>{notice}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-white/42">E-mail</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    placeholder="email@aps.edu.br"
                    autoComplete="email"
                    className="h-[52px] w-full rounded-[18px] border border-white/12 bg-white/[0.08] px-4 py-4 text-base font-bold text-white outline-none transition placeholder:text-white/26 focus:border-[#F6B221]/70 focus:bg-white/[0.12] focus:ring-4 focus:ring-[#F6B221]/12"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-white/42">Senha</span>
                  <div className="relative">
                    <LockClosedIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/28" />
                    <input
                      type={showPass ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      placeholder="Sua senha"
                      autoComplete="current-password"
                      className="h-[52px] w-full rounded-[18px] border border-white/12 bg-white/[0.08] py-4 pl-12 pr-12 text-base font-bold text-white outline-none transition placeholder:text-white/26 focus:border-[#F6B221]/70 focus:bg-white/[0.12] focus:ring-4 focus:ring-[#F6B221]/12"
                    />
                    <button type="button" onClick={() => setShowPass(value => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/36 transition hover:text-white">
                      {showPass ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#F6B221] px-5 py-4 text-sm font-black text-[#001B3F] shadow-[0_18px_44px_rgba(246,178,33,0.34)] transition hover:-translate-y-0.5 hover:bg-[#FFD15C] disabled:translate-y-0 disabled:opacity-60"
                >
                  {loading ? 'Entrando...' : 'Acessar agora'}
                  {!loading && <ArrowRightIcon className="h-4 w-4" />}
                </button>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="flex h-12 w-full items-center justify-center gap-3 rounded-[18px] border border-white/12 bg-white/[0.07] text-sm font-black text-white/82 transition hover:bg-white/[0.11]"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-xs font-black text-[#001B3F]">G</span>
                  Entrar com Google
                </button>

                <button type="button" onClick={handleForgotPassword} disabled={loading} className="w-full text-center text-xs font-black uppercase tracking-[0.12em] text-[#F6B221] transition hover:text-[#FFD15C]">
                  Recuperar senha
                </button>
              </form>
            </div>
            <p className="mt-5 text-center text-xs font-semibold leading-6 text-white/30">
              APS30 - Associação Paulista Sul<br />SOFI, sistema de gestão educacional.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
