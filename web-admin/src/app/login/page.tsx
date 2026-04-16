'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import api from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/auth/login', { email, password })
      const role = data.user.role.slug
      if (!['admin', 'director'].includes(role)) {
        setError('Acesso restrito ao painel administrativo.')
        setLoading(false); return
      }
      Cookies.set('accessToken', data.accessToken, { expires: 1 })
      Cookies.set('refreshToken', data.refreshToken, { expires: 30 })
      Cookies.set('user', JSON.stringify(data.user), { expires: 1 })
      router.replace('/dashboard')
    } catch {
      setError('E-mail ou senha incorretos.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Brand */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center px-16 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #003B55 0%, #132C45 55%, #0D2035 100%)' }}
      >
        {/* Decorative rings */}
        <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.06 }}>
          {[200, 340, 480, 620].map((size, i) => (
            <div key={i} className="absolute rounded-full border"
              style={{
                borderColor: '#F8A303',
                width: size, height: size,
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </div>

        <div className="relative z-10 text-center max-w-sm">
          {/* Cross Emblem */}
          <div className="flex items-center justify-center mb-8">
            <div className="w-28 h-28 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(248,163,3,0.08)', border: '2.5px solid #F8A303' }}>
              <div className="relative flex items-center justify-center">
                <div className="absolute rounded-full" style={{ width: 6, height: 52, backgroundColor: '#F8A303', borderRadius: 3 }} />
                <div className="absolute rounded-full" style={{ width: 36, height: 6, backgroundColor: '#F8A303', borderRadius: 3, top: 8 }} />
              </div>
            </div>
          </div>

          <h1 className="text-white font-extrabold text-5xl tracking-wide mb-2">APS Sul</h1>
          <p className="font-semibold text-sm tracking-widest mb-6"
            style={{ color: '#F8A303', letterSpacing: '4px' }}>
            EDUCAÇÃO ADVENTISTA
          </p>

          {/* Divider */}
          <div className="flex items-center gap-4 justify-center mb-7">
            <div className="h-px flex-1" style={{ backgroundColor: 'rgba(248,163,3,0.25)' }} />
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#F8A303' }} />
            <div className="h-px flex-1" style={{ backgroundColor: 'rgba(248,163,3,0.25)' }} />
          </div>

          <p className="text-2xl font-light text-white leading-relaxed mb-1">Formando Caráter,</p>
          <p className="text-2xl font-bold mb-10" style={{ color: '#F8A303' }}>Transformando Vidas</p>

          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Associação Paulista Sul — cuidando das escolas adventistas<br />
            da Zona Sul de São Paulo.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 mt-12 pt-10"
            style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {[
              { value: 'APS', label: 'Associação' },
              { value: 'Sul', label: 'Zona Sul SP' },
              { value: '🎓', label: 'Educação' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-8 py-12"
        style={{ backgroundColor: '#F5F7FA' }}>
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex flex-col items-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-3"
                style={{ backgroundColor: '#132C45', border: '2.5px solid #F8A303' }}>
                <div className="relative flex items-center justify-center">
                  <div className="absolute rounded-full" style={{ width: 4, height: 36, backgroundColor: '#F8A303', borderRadius: 2 }} />
                  <div className="absolute rounded-full" style={{ width: 24, height: 4, backgroundColor: '#F8A303', borderRadius: 2, top: 6 }} />
                </div>
              </div>
              <h1 className="font-extrabold text-3xl" style={{ color: '#132C45' }}>APS Sul</h1>
              <p className="text-xs font-semibold tracking-widest mt-1" style={{ color: '#F8A303' }}>
                EDUCAÇÃO ADVENTISTA
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-1.5" style={{ color: '#132C45' }}>Bem-vindo</h2>
              <p className="text-sm text-gray-500">Acesse o painel com suas credenciais institucionais</p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl flex items-center gap-3"
                style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                <span className="text-red-400">⚠️</span>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#132C45' }}>
                  E-mail institucional
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@aps.edu.br"
                  autoComplete="email"
                  className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors"
                  style={{ borderColor: '#E5E7EB', backgroundColor: '#FAFAFA' }}
                  onFocus={e => { e.target.style.borderColor = '#132C45'; e.target.style.boxShadow = '0 0 0 3px rgba(19,44,69,0.08)' }}
                  onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none' }}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: '#132C45' }}>
                  Senha
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors pr-12"
                    style={{ borderColor: '#E5E7EB', backgroundColor: '#FAFAFA' }}
                    onFocus={e => { e.target.style.borderColor = '#132C45'; e.target.style.boxShadow = '0 0 0 3px rgba(19,44,69,0.08)' }}
                    onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none' }}
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm px-1">
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-sm font-bold transition-all mt-2 flex items-center justify-center gap-2"
                style={{
                  backgroundColor: loading ? '#9CA3AF' : '#132C45',
                  color: '#FFFFFF',
                  letterSpacing: '0.5px',
                }}
              >
                {loading ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 rounded-full animate-spin"
                      style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                    Entrando...
                  </>
                ) : 'Entrar no Sistema →'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs mt-6" style={{ color: '#9CA3AF' }}>
            APS Sul — Associação Paulista Sul · Departamento de Educação<br />
            © {new Date().getFullYear()} APS EDU
          </p>
        </div>
      </div>
    </div>
  )
}
