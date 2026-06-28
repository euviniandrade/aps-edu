'use client'
import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  danger = false, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => confirmRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onConfirm, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div
        className="rounded-2xl w-full max-w-sm animate-scale-in"
        style={{
          background: 'rgba(10,12,28,0.99)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0"
              style={{
                background: danger ? 'rgba(255,71,87,0.12)' : 'rgba(248,163,3,0.12)',
                border: `1px solid ${danger ? 'rgba(255,71,87,0.25)' : 'rgba(248,163,3,0.25)'}`,
              }}
            >
              {danger ? '⚠️' : '❓'}
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">{title}</h3>
              <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {message}
              </p>
            </div>
          </div>
        </div>
        <div
          className="flex gap-3 p-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              background: danger
                ? 'linear-gradient(135deg, #FF4757, #ff6070)'
                : 'linear-gradient(135deg, #F8A303, #FDC347)',
              color: danger ? '#fff' : '#000',
              boxShadow: danger
                ? '0 4px 16px rgba(255,71,87,0.3)'
                : '0 4px 16px rgba(248,163,3,0.3)',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
