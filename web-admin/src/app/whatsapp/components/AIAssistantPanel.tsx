'use client'

import { useState } from 'react'
import {
  SparklesIcon, CheckIcon, XMarkIcon, PencilIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

interface AIAssistantPanelProps {
  conversationId: string
  onAccept: (text: string) => Promise<void>
  onReject: () => void
  disabled?: boolean
}

export function AIAssistantPanel(props: AIAssistantPanelProps) {
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [error, setError] = useState('')

  const fetchSuggestion = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/v1/whatsapp/ai/suggest/' + props.conversationId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await response.json()
      if (data.success && data.suggestion) {
        setSuggestion(data.suggestion)
        setEditText(data.suggestion)
      } else {
        setError('Não consegui gerar uma sugestão')
      }
    } catch (err: any) {
      setError('Erro ao buscar sugestão: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    const text = editing ? editText : suggestion
    if (!text) return
    await props.onAccept(text)
    setSuggestion(null)
    setEditText('')
    setEditing(false)
  }

  const handleReject = () => {
    setSuggestion(null)
    setEditText('')
    setEditing(false)
    props.onReject()
  }

  if (!suggestion) {
    return (
      <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SparklesIcon className="h-5 w-5 text-purple-600" />
            <span className="font-medium text-purple-900">Sugestão de IA</span>
          </div>
          <button
            onClick={fetchSuggestion}
            disabled={loading || props.disabled}
            className="rounded-lg bg-purple-600 px-3 py-1 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <SparklesIcon className="h-4 w-4" />
                Sugerir
              </>
            )}
          </button>
        </div>
        {error && (
          <div className="mt-2 text-sm text-red-600">{error}</div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <SparklesIcon className="h-5 w-5 text-green-600" />
        <span className="font-medium text-green-900">
          {editing ? 'Editar sugestão' : 'Sugestão de Resposta'}
        </span>
      </div>

      {editing ? (
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="mb-3 w-full rounded-lg border border-green-300 p-3 focus:outline-none focus:ring-2 focus:ring-green-500"
          rows={3}
          maxLength={650}
        />
      ) : (
        <div className="mb-3 rounded-lg bg-white p-3 text-gray-800 border border-green-200">
          {suggestion}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleReject}
          className="flex-1 rounded-lg border border-gray-300 py-2 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
        >
          <XMarkIcon className="h-4 w-4" />
          Rejeitar
        </button>

        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex-1 rounded-lg border border-blue-300 bg-blue-50 py-2 px-3 text-sm font-medium text-blue-700 hover:bg-blue-100 flex items-center justify-center gap-2"
          >
            <PencilIcon className="h-4 w-4" />
            Editar
          </button>
        )}

        <button
          onClick={handleAccept}
          className="flex-1 rounded-lg bg-green-600 py-2 px-3 text-sm font-medium text-white hover:bg-green-700 flex items-center justify-center gap-2"
        >
          <CheckIcon className="h-4 w-4" />
          {editing ? 'Enviar' : 'Aceitar'}
        </button>
      </div>
    </div>
  )
}
