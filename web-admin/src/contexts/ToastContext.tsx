'use client'
import React, { createContext, useCallback, useContext, useState } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
}

interface ToastContextValue {
  toasts: Toast[]
  toast: (type: ToastType, title: string, message?: string) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev.slice(-4), { id, type, title, message }])
    setTimeout(() => dismiss(id), type === 'error' ? 6000 : 4000)
  }, [dismiss])

  const success = useCallback((t: string, m?: string) => toast('success', t, m), [toast])
  const error   = useCallback((t: string, m?: string) => toast('error', t, m), [toast])
  const warning = useCallback((t: string, m?: string) => toast('warning', t, m), [toast])
  const info    = useCallback((t: string, m?: string) => toast('info', t, m), [toast])

  return (
    <ToastContext.Provider value={{ toasts, toast, success, error, warning, info, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

const TOAST_STYLES: Record<ToastType, { border: string; icon: string; iconBg: string; iconColor: string }> = {
  success: { border: '#0ABD78', icon: '✓', iconBg: 'rgba(10,189,120,0.15)', iconColor: '#0ABD78' },
  error:   { border: '#FF4757', icon: '✕', iconBg: 'rgba(255,71,87,0.15)',  iconColor: '#FF4757' },
  warning: { border: '#F8A303', icon: '!', iconBg: 'rgba(248,163,3,0.15)',  iconColor: '#F8A303' },
  info:    { border: '#4A9EFF', icon: 'i', iconBg: 'rgba(74,158,255,0.15)', iconColor: '#4A9EFF' },
}

function ToastContainer({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => {
        const s = TOAST_STYLES[t.type]
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl min-w-[280px] max-w-sm animate-slide-up"
            style={{
              background: 'rgba(10,12,28,0.97)',
              border: `1px solid rgba(255,255,255,0.1)`,
              borderLeft: `3px solid ${s.border}`,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
              style={{ background: s.iconBg, color: s.iconColor }}
            >
              {s.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">{t.title}</p>
              {t.message && (
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {t.message}
                </p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-xs leading-none flex-shrink-0 mt-0.5 transition-opacity hover:opacity-70"
              style={{ color: 'rgba(255,255,255,0.25)' }}
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}
