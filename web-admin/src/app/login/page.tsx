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
      if (!data?.accessToken || !data?.user) {
        setError('E-mail ou senha incorretos.')
        setLoading(false)
        return
      }
      const role = data.user?.role?.slug || ''
      if (!['admin', 'director'].includes(role)) {
        setError('Acesso restrito ao painel administrativo.')
        setLoading(false)
        return
      }
      Cookies.set('accessToken', data.accessToken, { expires: 365 })
      Cookies.set('refreshToken', data.refreshToken, { expires: 365 })
      // Salva apenas os campos essenciais para evitar estourar o limite de 4KB do cookie
      const userMinimal = {
        id:    data.user.id,
        name:  data.user.name,
        email: data.user.email,
        role:  { slug: data.user.role?.slug, name: data.user.role?.name },
        unit:  data.user.unit ? { id: data.user.unit.id, name: data.user.unit.name } : null,
      }
      Cookies.set('user', JSON.stringify(userMinimal), { expires: 365 })
      router.replace('/dashboard')
    } catch {
      setError('E-mail ou senha incorretos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ backgroundColor: '#06070F' }}>

      {/* ── LEFT PANEL — Video Background ────────────────── */}
      <div className="hidden lg:flex lg:w-[58%] relative flex-col overflow-hidden">

        {/* Video background */}
        <video
          autoPlay muted loop playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'brightness(0.2) saturate(1.4)' }}
        >
          <source src="/aps30-video.mp4" type="video/mp4" />
        </video>

        {/* Deep dark gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(160deg, rgba(6,8,20,0.75) 0%, rgba(10,15,40,0.55) 50%, rgba(6,8,20,0.85) 100%)',
          }}
        />

        {/* Dot-grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.035) 1.5px, transparent 1.5px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Ambient glow orbs */}
        <div
          className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(74,158,255,0.12) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -top-24 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(248,163,3,0.09) 0%, transparent 70%)' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(27,58,107,0.15) 0%, transparent 60%)' }}
        />

        {/* Top: EA logo + title */}
        <div className={`relative z-10 p-10 ${mounted ? 'animate-fade-in-left' : 'opacity-0'}`}>
          <div className="flex items-center gap-4">
            <img
              src="/aps30-logo.png"
              alt="APS30"
              className="h-14 w-14 object-contain flex-shrink-0"
              style={{ filter: 'drop-shadow(0 0 12px rgba(248,163,3,0.5))' }}
            />
            <div>
              <p className="text-white font-extrabold text-xl leading-tight tracking-tight">
                Educação Adventista
              </p>
              <p
                className="text-[10px] font-semibold tracking-[0.2em] mt-0.5 uppercase"
                style={{ color: 'rgba(248,163,3,0.7)' }}
              >
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
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Painel Administrativo
            </span>
          </div>

          {/* Headline */}
          <h1
            className={`text-white text-[3.2rem] font-extrabold leading-[1.05] mb-4 tracking-tight ${mounted ? 'animate-fade-in-up delay-300' : 'opacity-0'}`}
          >
            Formando
            <br />
            <span
              className="text-gold-gradient"
              style={{
                background: 'linear-gradient(135deg, #F8A303, #FDC347)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Caráter,
            </span>
            <br />
            Transformando
            <br />
            Vidas
          </h1>

          <p
            className={`text-sm leading-relaxed max-w-sm mt-2 ${mounted ? 'animate-fade-in-up delay-400' : 'opacity-0'}`}
            style={{ color: 'rgba(255,255,255,0.38)' }}
          >
            Plataforma de gestão educacional da Associação Paulista Sul —
            cuidando das escolas adventistas com dedicação e excelência.
          </p>

          {/* School level cards */}
          <div className={`mt-10 flex gap-3 ${mounted ? 'animate-fade-in-up delay-500' : 'opacity-0'}`}>
            {[
              { emoji: '👧', label: 'Ensino Infantil', color: '#29ABE2' },
              { emoji: '📚', label: 'Fundamental', color: '#F8A303' },
              { emoji: '🎓', label: 'Médio', color: '#8B5CF6' },
            ].map((card) => (
              <div
                key={card.label}
                className="flex-1 rounded-2xl px-4 py-5 flex flex-col gap-2 transition-all duration-300 hover:scale-[1.03]"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <span className="text-2xl">{card.emoji}</span>
                <span className="text-xs font-semibold text-white">{card.label}</span>
                <div
                  className="h-0.5 rounded-full w-8 mt-1"
                  style={{ background: `linear-gradient(90deg, ${card.color}, transparent)` }}
                />
              </div>
            ))}
          </div>

          {/* APS30 stats row */}
          <div className={`mt-8 flex gap-5 ${mounted ? 'animate-fade-in-up delay-600' : 'opacity-0'}`}>
            {[
              { value: '15', label: 'Unidades' },
              { value: '142+', label: 'Colaboradores' },
              { value: '30', label: 'Anos de história' },
            ].map((stat) => (
              <div key={stat.label}>
                <p
                  className="text-2xl font-extrabold leading-none"
                  style={{
                    background: 'linear-gradient(135deg, #F8A303, #FDC347)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {stat.value}
                </p>
                <p className="text-[10px] text-white/30 mt-0.5 uppercase tracking-wider">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom APS30 color band */}
        <div className="relative z-10 flex h-1">
          <div className="flex-1" style={{ backgroundColor: '#F9C234' }} />
          <div className="flex-1" style={{ backgroundColor: '#29ABE2' }} />
          <div className="flex-1" style={{ backgroundColor: '#E07B39' }} />
          <div className="flex-1" style={{ backgroundColor: '#1B5FAD' }} />
        </div>
      </div>

      {/* ── RIGHT PANEL — Dark Glass Form ───────────────── */}
      <div
        className="w-full lg:w-[42%] flex flex-col items-center justify-center px-8 py-14 relative"
        style={{ backgroundColor: 'rgba(6,8,20,0.98)' }}
      >
        {/* Subtle ambient orb */}
        <div
          className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(248,163,3,0.05) 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(74,158,255,0.06) 0%, transparent 70%)' }}
        />

        <div className={`w-full max-w-[360px] relative z-10 ${mounted ? 'animate-slide-in-right' : 'opacity-0'}`}>

          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <img
              src="/aps30-logo.png"
              alt="APS30"
              className="w-16 h-16 object-contain mb-3"
              style={{ filter: 'drop-shadow(0 0 12px rgba(248,163,3,0.5))' }}
            />
            <p className="font-extrabold text-xl text-white">Educação Adventista</p>
            <p className="text-xs font-medium tracking-widest mt-0.5 uppercase" style={{ color: 'rgba(248,163,3,0.6)' }}>
              Associação Paulista Sul
            </p>
          </div>

          {/* Form card */}
          <div
            className="rounded-3xl p-8"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-7">
              <div>
                <h2 className="text-2xl font-extrabold leading-tight text-white">
                  Bem-vindo
                  <br />
                  de volta
                </h2>
                <p className="text-sm mt-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Acesse com suas credenciais institucionais
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(248,163,3,0.2), rgba(248,163,3,0.08))',
                  border: '1px solid rgba(248,163,3,0.2)',
                }}
              >
                <ShieldCheckIcon className="w-5 h-5" style={{ color: '#F8A303' }} />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                className="mb-5 p-3.5 rounded-xl flex items-center gap-2.5 text-sm animate-scale-in"
                style={{
                  background: 'rgba(255,71,87,0.12)',
                  border: '1px solid rgba(255,71,87,0.25)',
                  color: '#FF4757',
                }}
              >
                <span className="font-bold text-base leading-none flex-shrink-0">!</span>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email */}
              <div>
                <label
                  className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  E-mail institucional
                </label>
                <div className="relative">
                  <EnvelopeIcon
                    className="absolute left-3.5 top-1/2 -translate-y-1/2"
                    style={{ width: 17, height: 17, color: 'rgba(255,255,255,0.25)' }}
                  />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@aps.edu.br"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'white',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'rgba(248,163,3,0.5)'
                      e.target.style.boxShadow = '0 0 0 3px rgba(248,163,3,0.1)'
                      e.target.style.background = 'rgba(255,255,255,0.08)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(255,255,255,0.08)'
                      e.target.style.boxShadow = 'none'
                      e.target.style.background = 'rgba(255,255,255,0.06)'
                    }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  className="block text-[10px] font-semibold mb-1.5 uppercase tracking-[0.12em]"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  Senha
                </label>
                <div className="relative">
                  <LockClosedIcon
                    className="absolute left-3.5 top-1/2 -translate-y-1/2"
                    style={{ width: 17, height: 17, color: 'rgba(255,255,255,0.25)' }}
                  />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-11 py-3 rounded-xl text-sm outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'white',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'rgba(248,163,3,0.5)'
                      e.target.style.boxShadow = '0 0 0 3px rgba(248,163,3,0.1)'
                      e.target.style.background = 'rgba(255,255,255,0.08)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(255,255,255,0.08)'
                      e.target.style.boxShadow = 'none'
                      e.target.style.background = 'rgba(255,255,255,0.06)'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                  >
                    {showPass
                      ? <EyeSlashIcon style={{ width: 17, height: 17 }} />
                      : <EyeIcon style={{ width: 17, height: 17 }} />
                    }
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-black transition-all mt-2 flex items-center justify-center gap-2 active:scale-[0.98]"
                style={{
                  background: loading
                    ? 'rgba(255,255,255,0.12)'
                    : 'linear-gradient(135deg, #F8A303, #FDC347)',
                  color: loading ? 'rgba(255,255,255,0.4)' : '#000',
                  boxShadow: loading ? 'none' : '0 8px 32px rgba(248,163,3,0.35)',
                }}
              >
                {loading ? (
                  <>
                    <span
                      className="inline-block w-4 h-4 border-2 rounded-full animate-spin"
                      style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'rgba(255,255,255,0.7)' }}
                    />
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
          <p
            className="text-center text-[11px] mt-6 leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.2)' }}
          >
            © {new Date().getFullYear()} Educação Adventista · Associação Paulista Sul
            <br />
            Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  )
}
