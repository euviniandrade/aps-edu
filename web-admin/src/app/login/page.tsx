'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Cookies from 'js-cookie'
import api from '@/lib/api'
import {
  EnvelopeIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import { ShieldCheckIcon } from '@heroicons/react/24/solid'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/auth/login', { email, password })
      const role = data.user.role.slug
      if (!['admin', 'director'].includes(role)) {
        setError('Acesso restrito ao painel administrativo.')
        setLoading(false)
        return
      }
      Cookies.set('accessToken', data.accessToken, { expires: 1 })
      Cookies.set('refreshToken', data.refreshToken, { expires: 30 })
      Cookies.set('user', JSON.stringify(data.user), { expires: 1 })
      router.replace('/dashboard')
    } catch {
      setError('E-mail ou senha incorretos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-white overflow-hidden">

      {/* ── LEFT PANEL — Video Background ────────────────── */}
      <div className="hidden lg:flex lg:w-[58%] relative flex-col overflow-hidden">

        {/* Video background */}
        <video
          autoPlay muted loop playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.35) saturate(1.2)' }}
        >
          <source src="/aps30-video.mp4" type="video/mp4" />
        </video>

        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(160deg, rgba(27,58,107,0.82) 0%, rgba(17,40,80,0.72) 50%, rgba(10,30,64,0.88) 100%)',
          }}
        />

        {/* Dot-grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1.5px, transparent 1.5px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Ambient glow bottom-left */}
        <div
          className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(41,171,226,0.18) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -top-24 -right-24 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(248,163,3,0.1) 0%, transparent 70%)' }}
        />

        {/* Top: EA logo + title */}
        <div className={`relative z-10 p-10 ${mounted ? 'animate-fade-in-left' : 'opacity-0'}`}>
          <div className="flex items-center gap-4">
            <img src="/icon-ea-white.svg" alt="Educação Adventista" className="h-14 w-auto flex-shrink-0 drop-shadow-lg" />
            <div>
              <p className="text-white font-extrabold text-xl leading-tight tracking-tight drop-shadow">
                Educação Adventista
              </p>
              <p className="text-xs font-medium tracking-[0.18em] mt-0.5 uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Associação Paulista Sul
              </p>
            </div>
          </div>
        </div>

        {/* Center hero content */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-10 pb-6">

          {/* Live badge */}
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-8 w-fit ${mounted ? 'animate-fade-in-up delay-200' : 'opacity-0'}`}
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Painel Administrativo
            </span>
          </div>

          {/* Headline */}
          <h1
            className={`text-white text-[3rem] font-extrabold leading-[1.08] mb-4 tracking-tight ${mounted ? 'animate-fade-in-up delay-300' : 'opacity-0'}`}
          >
            Formando
            <br />
            <span style={{ color: '#F8A303' }}>Caráter,</span>
            <br />
            Transformando
            <br />
            Vidas
          </h1>

          <p
            className={`text-sm leading-relaxed max-w-sm mt-2 ${mounted ? 'animate-fade-in-up delay-400' : 'opacity-0'}`}
            style={{ color: 'rgba(255,255,255,0.45)' }}
          >
            Plataforma de gestão educacional da Associação Paulista Sul —
            cuidando das escolas adventistas com dedicação e excelência.
          </p>

          {/* School level cards */}
          <div className={`mt-10 flex gap-3 ${mounted ? 'animate-fade-in-up delay-500' : 'opacity-0'}`}>
            {[
              { emoji: '👧', label: 'Ensino Infantil', color: '#29ABE2' },
              { emoji: '📚', label: 'Fundamental', color: '#F8A303' },
              { emoji: '🎓', label: 'Médio', color: '#1B5FAD' },
            ].map((card) => (
              <div
                key={card.label}
                className="flex-1 rounded-2xl px-4 py-5 flex flex-col gap-2 card-hover"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <span className="text-2xl">{card.emoji}</span>
                <span className="text-xs font-semibold text-white">{card.label}</span>
                <div className="h-1 rounded-full w-8 mt-1" style={{ backgroundColor: card.color }} />
              </div>
            ))}
          </div>

          {/* APS30 logo */}
          <div
            className={`mt-8 inline-flex items-center gap-4 rounded-2xl px-5 py-3 w-fit ${mounted ? 'animate-fade-in-up delay-600' : 'opacity-0'}`}
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Image
              src="/aps30-logo.png"
              alt="APS30"
              width={48}
              height={48}
              className="object-contain"
              style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.2))' }}
            />
            <div>
              <p className="text-white text-sm font-bold leading-none">APS 30 anos</p>
              <p className="text-white/50 text-xs mt-0.5">Propósito em Ação</p>
            </div>
          </div>
        </div>

        {/* Bottom APS30 color band */}
        <div className="relative z-10 flex h-1.5">
          <div className="flex-1" style={{ backgroundColor: '#F9C234' }} />
          <div className="flex-1" style={{ backgroundColor: '#29ABE2' }} />
          <div className="flex-1" style={{ backgroundColor: '#E07B39' }} />
          <div className="flex-1" style={{ backgroundColor: '#1B5FAD' }} />
        </div>
      </div>

      {/* ── RIGHT PANEL — Form ───────────────────────────── */}
      <div
        className="w-full lg:w-[42%] flex flex-col items-center justify-center px-8 py-14"
        style={{ backgroundColor: '#F7F9FC' }}
      >
        <div className={`w-full max-w-[360px] ${mounted ? 'animate-slide-in-right' : 'opacity-0'}`}>

          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-lg"
              style={{ backgroundColor: '#1B3A6B' }}
            >
              <img src="/icon-ea-white.svg" alt="EA" className="h-10 w-auto" />
            </div>
            <p className="font-extrabold text-xl" style={{ color: '#1B3A6B' }}>
              Educação Adventista
            </p>
            <p className="text-xs font-medium tracking-widest mt-0.5 text-gray-400 uppercase">
              Associação Paulista Sul
            </p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-7">
              <div>
                <h2 className="text-2xl font-extrabold leading-tight" style={{ color: '#1B3A6B' }}>
                  Bem-vindo
                  <br />
                  de volta 👋
                </h2>
                <p className="text-sm text-gray-400 mt-1.5">
                  Acesse com suas credenciais institucionais
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#EEF3FA' }}
              >
                <ShieldCheckIcon className="w-5 h-5" style={{ color: '#1B3A6B' }} />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="mb-5 p-3.5 rounded-xl flex items-center gap-2.5 text-sm animate-scale-in"
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#DC2626',
                }}
              >
                <span className="font-bold text-base leading-none">!</span>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#374151' }}>
                  E-mail institucional
                </label>
                <div className="relative">
                  <EnvelopeIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" style={{ width: 18, height: 18 }} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@aps.edu.br"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border text-sm outline-none transition-all bg-gray-50 focus:bg-white"
                    style={{ borderColor: '#E5E7EB' }}
                    onFocus={(e) => { e.target.style.borderColor = '#1B3A6B'; e.target.style.boxShadow = '0 0 0 3px rgba(27,58,107,0.1)' }}
                    onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#374151' }}>
                  Senha
                </label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" style={{ width: 18, height: 18 }} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-3 rounded-xl border text-sm outline-none transition-all bg-gray-50 focus:bg-white"
                    style={{ borderColor: '#E5E7EB' }}
                    onFocus={(e) => { e.target.style.borderColor = '#1B3A6B'; e.target.style.boxShadow = '0 0 0 3px rgba(27,58,107,0.1)' }}
                    onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPass ? <EyeSlashIcon style={{ width: 18, height: 18 }} /> : <EyeIcon style={{ width: 18, height: 18 }} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all mt-1 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98]"
                style={{ backgroundColor: loading ? '#9CA3AF' : '#1B3A6B' }}
              >
                {loading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar no sistema
                    <ArrowRightIcon style={{ width: 16, height: 16 }} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-xs mt-6 text-gray-400 leading-relaxed">
            © {new Date().getFullYear()} Educação Adventista · Associação Paulista Sul
            <br />
            Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  )
}
