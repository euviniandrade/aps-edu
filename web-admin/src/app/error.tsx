'use client'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[APS EDU] Client error:', error)
  }, [error])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 px-6"
      style={{ backgroundColor: '#F4F6FA', color: '#17233B' }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
        style={{ background: 'rgba(255,71,87,0.15)', border: '1px solid rgba(255,71,87,0.3)' }}
      >
        ⚠️
      </div>
      <div className="text-center max-w-sm">
        <h1 className="text-xl font-bold mb-2">Algo deu errado</h1>
        <p className="text-sm" style={{ color: '#64748B' }}>
          {error?.message || 'Erro inesperado na aplicação.'}
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: '#0877C9',
            color: '#FFFFFF',
          }}
        >
          Tentar novamente
        </button>
        <a
          href="/login"
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: '#FFFFFF',
            border: '1px solid #DCE5EF',
            color: '#53647A',
          }}
        >
          Ir para o login
        </a>
      </div>
    </div>
  )
}
