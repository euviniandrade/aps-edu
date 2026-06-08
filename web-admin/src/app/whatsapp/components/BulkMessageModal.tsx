'use client'

import { useState } from 'react'
import { XMarkIcon, CheckIcon, ExclamationIcon } from '@heroicons/react/24/outline'
import type { Contact } from '../types'

interface BulkMessageModalProps {
  isOpen: boolean
  onClose: () => void
  contacts: Contact[]
  onSend: (recipients: string[], template: string) => Promise<void>
}

export function BulkMessageModal(props: BulkMessageModalProps) {
  const [template, setTemplate] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const toggleContact = (chatId: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(chatId)) {
      newSet.delete(chatId)
    } else {
      newSet.add(chatId)
    }
    setSelectedIds(newSet)
  }

  const toggleAll = () => {
    if (selectedIds.size === props.contacts.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(props.contacts.map(c => c.chatId)))
    }
  }

  const handleSend = async () => {
    if (!template.trim()) {
      setError('Escreva uma mensagem')
      return
    }
    if (selectedIds.size === 0) {
      setError('Selecione pelo menos um contato')
      return
    }

    setLoading(true)
    setError('')
    try {
      await props.onSend(Array.from(selectedIds), template)
      setSuccess(true)
      setTemplate('')
      setSelectedIds(new Set())
      setTimeout(() => {
        setSuccess(false)
        props.onClose()
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar')
    } finally {
      setLoading(false)
      setShowConfirm(false)
    }
  }

  if (!props.isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">📤 Envio em Massa</h2>
          <button
            onClick={props.onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-700">
            <CheckIcon className="h-5 w-5" />
            Envio iniciado com sucesso!
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-700">
            <ExclamationIcon className="h-5 w-5" />
            {error}
          </div>
        )}

        {/* Template Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700">
            Mensagem
          </label>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="Escreva a mensagem que será enviada para todos os selecionados..."
            className="mt-2 w-full rounded-lg border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
            rows={4}
            maxLength={650}
            disabled={loading}
          />
          <div className="mt-2 text-sm text-gray-500">
            {template.length}/650 caracteres
          </div>
        </div>

        {/* Contacts Selection */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              Destinatários ({selectedIds.size}/{props.contacts.length})
            </h3>
            <button
              onClick={toggleAll}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              {selectedIds.size === props.contacts.length ? 'Desselecionar todos' : 'Selecionar todos'}
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200">
            {props.contacts.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                Nenhum contato disponível
              </div>
            ) : (
              <div className="divide-y">
                {props.contacts.map((contact) => (
                  <label
                    key={contact.chatId}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(contact.chatId)}
                      onChange={() => toggleContact(contact.chatId)}
                      className="h-4 w-4 rounded border-gray-300 text-purple-600"
                      disabled={loading}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {contact.name || 'Sem nome'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {contact.phone}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {!showConfirm ? (
          <div className="flex gap-3">
            <button
              onClick={props.onClose}
              className="flex-1 rounded-lg border border-gray-300 py-2 font-medium text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              className="flex-1 rounded-lg bg-purple-600 py-2 font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              disabled={loading || selectedIds.size === 0 || !template.trim()}
            >
              {loading ? 'Enviando...' : 'Revisar'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
              <strong>Confirmação:</strong> Você está prestes a enviar a mensagem abaixo
              para <strong>{selectedIds.size} contato(s)</strong>.
              <div className="mt-2 rounded bg-white p-2 text-gray-800 italic">
                "{template}"
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-lg border border-gray-300 py-2 font-medium text-gray-700 hover:bg-gray-50"
                disabled={loading}
              >
                Voltar
              </button>
              <button
                onClick={handleSend}
                className="flex-1 rounded-lg bg-green-600 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? '⏳ Enviando...' : '✅ Confirmar Envio'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
