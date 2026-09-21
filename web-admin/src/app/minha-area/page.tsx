'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownTrayIcon,
  BoltIcon,
  CheckIcon,
  ClipboardDocumentIcon,
  DocumentIcon,
  DocumentTextIcon,
  EyeIcon,
  EyeSlashIcon,
  FolderIcon,
  KeyIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PaperClipIcon,
  PlusIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import AdminLayout from '@/components/layout/AdminLayout'

const NOTEBOOK_KEY = 'aps_edu_notebooks_v1'
const VAULT_KEY = 'aps_edu_vault_v2'
const VAULT_PIN_KEY = 'aps_edu_vault_pin'
const FILES_KEY = 'aps_edu_files_v1'

type Tab = 'notes' | 'files' | 'vault'
type NoteType = 'ideia' | 'reuniao' | 'frase' | 'plano' | 'livre'

type Note = {
  id: string
  title: string
  type: NoteType
  content: string
  tags: string[]
  favorite: boolean
  aiOutput?: string
  createdAt: string
  updatedAt: string
}

type StoredFile = {
  id: string
  name: string
  type: string
  size: number
  createdAt: string
  data?: string
}

type Credential = {
  id: string
  service: string
  url?: string
  email: string
  password: string
  notes?: string
  category: string
  createdAt: string
}

const noteTypes: { id: NoteType; label: string }[] = [
  { id: 'ideia', label: 'Ideia' },
  { id: 'reuniao', label: 'Reunião' },
  { id: 'plano', label: 'Plano' },
  { id: 'frase', label: 'Referência' },
  { id: 'livre', label: 'Nota livre' },
]

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function newNote(type: NoteType = 'livre'): Note {
  const now = new Date().toISOString()
  return {
    id: makeId(),
    title: 'Nova anotação',
    type,
    content: '',
    tags: [],
    favorite: false,
    createdAt: now,
    updatedAt: now,
  }
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

async function deriveVaultBits(pin: string, salt: Uint8Array, usage: 'verify' | 'encrypt') {
  const material = await crypto.subtle.importKey('raw', toArrayBuffer(new TextEncoder().encode(pin)), 'PBKDF2', false, ['deriveBits', 'deriveKey'])
  if (usage === 'verify') {
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: toArrayBuffer(salt), iterations: 210_000, hash: 'SHA-256' }, material, 256))
  }
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations: 210_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function setVaultPin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await deriveVaultBits(pin, salt, 'verify') as Uint8Array
  localStorage.setItem(VAULT_PIN_KEY, JSON.stringify({ v: 3, salt: bytesToBase64(salt), hash: bytesToBase64(hash) }))
}

async function verifyVaultPin(pin: string) {
  try {
    const raw = localStorage.getItem(VAULT_PIN_KEY)
    if (!raw) return false
    if (!raw.trim().startsWith('{')) return raw === pin
    const stored = JSON.parse(raw)
    const actual = await deriveVaultBits(pin, base64ToBytes(stored.salt), 'verify') as Uint8Array
    const expected = base64ToBytes(stored.hash)
    return actual.length === expected.length && actual.every((byte, index) => byte === expected[index])
  } catch {
    return false
  }
}

async function saveVault(items: Credential[], pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveVaultBits(pin, salt, 'encrypt') as CryptoKey
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, new TextEncoder().encode(JSON.stringify(items)))
  localStorage.setItem(VAULT_KEY, JSON.stringify({ v: 3, salt: bytesToBase64(salt), iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(encrypted)) }))
}

async function loadVault(pin: string): Promise<Credential[] | null> {
  try {
    const raw = localStorage.getItem(VAULT_KEY)
    if (!raw) return []
    if (!raw.trim().startsWith('{')) {
      const decoded = decodeURIComponent(escape(atob(raw)))
      const split = decoded.lastIndexOf('|||')
      if (split < 0 || decoded.slice(split + 3) !== pin) return null
      return JSON.parse(decoded.slice(0, split))
    }
    const stored = JSON.parse(raw)
    const key = await deriveVaultBits(pin, base64ToBytes(stored.salt), 'encrypt') as CryptoKey
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(stored.iv)) },
      key,
      toArrayBuffer(base64ToBytes(stored.data)),
    )
    return JSON.parse(new TextDecoder().decode(decrypted))
  } catch {
    return null
  }
}

export default function MinhaAreaPage() {
  const [tab, setTab] = useState<Tab>('notes')
  const [notes, setNotes] = useState<Note[]>([])
  const [activeId, setActiveId] = useState('')
  const [query, setQuery] = useState('')
  const [files, setFiles] = useState<StoredFile[]>([])

  useEffect(() => {
    try {
      const loaded = JSON.parse(localStorage.getItem(NOTEBOOK_KEY) || '[]') as Note[]
      const initial = loaded.length ? loaded : [newNote('livre')]
      setNotes(initial)
      setActiveId(initial[0].id)
      if (!loaded.length) localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(initial))
    } catch {
      const initial = [newNote('livre')]
      setNotes(initial)
      setActiveId(initial[0].id)
    }
    try { setFiles(JSON.parse(localStorage.getItem(FILES_KEY) || '[]')) } catch {}
  }, [])

  const active = notes.find(note => note.id === activeId) || notes[0]
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return notes
    return notes.filter(note => `${note.title} ${note.content} ${(note.tags || []).join(' ')}`.toLowerCase().includes(term))
  }, [notes, query])

  function persistNotes(next: Note[]) {
    setNotes(next)
    localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(next))
  }

  function addNote(type: NoteType = 'livre') {
    const note = newNote(type)
    persistNotes([note, ...notes])
    setActiveId(note.id)
  }

  function updateNote(patch: Partial<Note>) {
    if (!active) return
    persistNotes(notes.map(note => note.id === active.id ? { ...note, ...patch, updatedAt: new Date().toISOString() } : note))
  }

  function removeNote(id: string) {
    const next = notes.filter(note => note.id !== id)
    const safe = next.length ? next : [newNote()]
    persistNotes(safe)
    setActiveId(safe[0].id)
  }

  function persistFiles(next: StoredFile[]) {
    setFiles(next)
    localStorage.setItem(FILES_KEY, JSON.stringify(next))
  }

  async function addFile(file?: File) {
    if (!file) return
    if (file.size > 1_000_000) {
      persistFiles([{ id: makeId(), name: file.name, type: file.type, size: file.size, createdAt: new Date().toISOString() }, ...files])
      return
    }
    const reader = new FileReader()
    reader.onload = () => persistFiles([{ id: makeId(), name: file.name, type: file.type, size: file.size, data: String(reader.result), createdAt: new Date().toISOString() }, ...files])
    reader.readAsDataURL(file)
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1500px] space-y-5 pb-10">
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase text-teal-700">Biblioteca pessoal</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">Notas, arquivos e acessos</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">Um espaço privado e organizado para pensar, arquivar e guardar credenciais com criptografia local.</p>
          </div>
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-1 shadow-sm">
            <TabButton active={tab === 'notes'} onClick={() => setTab('notes')} icon={DocumentTextIcon}>Notas</TabButton>
            <TabButton active={tab === 'files'} onClick={() => setTab('files')} icon={FolderIcon}>Arquivos</TabButton>
            <TabButton active={tab === 'vault'} onClick={() => setTab('vault')} icon={KeyIcon}>Cofre de acessos</TabButton>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <Metric icon={DocumentTextIcon} label="Anotações" value={notes.length} detail="conteúdo preservado" />
          <Metric icon={PaperClipIcon} label="Arquivos" value={files.length} detail="itens catalogados" />
          <Metric icon={ShieldCheckIcon} label="Segurança" value="AES-256" detail="cofre protegido por PIN" />
        </div>

        {tab === 'notes' && (
          <NotesWorkspace
            notes={filtered}
            active={active}
            query={query}
            setQuery={setQuery}
            setActiveId={setActiveId}
            addNote={addNote}
            updateNote={updateNote}
            removeNote={removeNote}
          />
        )}
        {tab === 'files' && <FilesWorkspace files={files} onAdd={addFile} onChange={persistFiles} />}
        {tab === 'vault' && <VaultWorkspace />}
      </div>
    </AdminLayout>
  )
}

function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: React.ElementType; children: React.ReactNode }) {
  return <button onClick={onClick} className={`inline-flex h-10 items-center gap-2 rounded px-3 text-xs font-bold transition ${active ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Icon className="h-4 w-4" />{children}</button>
}

function Metric({ icon: Icon, label, value, detail }: { icon: React.ElementType; label: string; value: string | number; detail: string }) {
  return <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><span className="grid h-10 w-10 place-items-center rounded-md bg-teal-50 text-teal-700"><Icon className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className="text-xl font-bold text-slate-950">{value}</p><p className="text-xs text-slate-500">{detail}</p></div></div>
}

function NotesWorkspace({ notes, active, query, setQuery, setActiveId, addNote, updateNote, removeNote }: {
  notes: Note[]
  active?: Note
  query: string
  setQuery: (value: string) => void
  setActiveId: (id: string) => void
  addNote: (type?: NoteType) => void
  updateNote: (patch: Partial<Note>) => void
  removeNote: (id: string) => void
}) {
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')

  async function analyze() {
    if (!active?.content.trim()) return
    setAiBusy(true)
    setAiError('')
    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: `Organize esta anotação em português do Brasil. Entregue resumo executivo, decisões, pendências e próximos passos.\n\nTítulo: ${active.title}\n\n${active.content}` }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'A IA não respondeu.')
      updateNote({ aiOutput: data.content })
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Falha ao consultar a IA.')
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <section className="grid min-h-[650px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-slate-50 p-4 lg:border-b-0 lg:border-r">
        <div className="relative"><MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar notas..." className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-teal-500" /></div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => addNote('livre')} className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 text-xs font-bold text-white hover:bg-teal-800"><PlusIcon className="h-4 w-4" />Nova anotação</button>
          {noteTypes.slice(0, 4).map(type => <button key={type.id} onClick={() => addNote(type.id)} className="rounded-md border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-600 hover:border-teal-300">{type.label}</button>)}
        </div>
        <div className="mt-4 space-y-2">
          {notes.map(note => <button key={note.id} onClick={() => setActiveId(note.id)} className={`w-full rounded-md border p-3 text-left transition ${active?.id === note.id ? 'border-teal-300 bg-teal-50' : 'border-transparent hover:border-slate-200 hover:bg-white'}`}><p className="truncate text-sm font-bold text-slate-900">{note.title || 'Sem título'}</p><p className="mt-1 text-[11px] text-slate-500">{noteTypes.find(type => type.id === note.type)?.label || 'Nota'} · {new Date(note.updatedAt).toLocaleDateString('pt-BR')}</p></button>)}
        </div>
      </aside>
      {active ? <div className="flex min-w-0 flex-col p-5 lg:p-7">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center">
          <input value={active.title} onChange={event => updateNote({ title: event.target.value })} className="min-w-0 flex-1 border-0 bg-transparent text-2xl font-bold text-slate-950 outline-none" />
          <select value={active.type} onChange={event => updateNote({ type: event.target.value as NoteType })} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none">{noteTypes.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}</select>
          <button onClick={() => removeNote(active.id)} className="grid h-10 w-10 place-items-center rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50" title="Excluir nota"><TrashIcon className="h-4 w-4" /></button>
        </div>
        <textarea value={active.content} onChange={event => updateNote({ content: event.target.value })} placeholder="Escreva livremente. As alterações são salvas automaticamente..." className="min-h-80 flex-1 resize-none border-0 bg-white py-6 text-[15px] leading-7 text-slate-700 outline-none" />
        <div className="border-t border-slate-100 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">Análise com IA</p><p className="text-xs text-slate-500">Transforme a nota em decisões e próximos passos.</p></div><button onClick={analyze} disabled={aiBusy || !active.content.trim()} className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-900 px-4 text-xs font-bold text-white disabled:opacity-40"><SparklesIcon className="h-4 w-4" />{aiBusy ? 'Analisando...' : 'Analisar anotação'}</button></div>
          {aiError && <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{aiError}</p>}
          {active.aiOutput && <div className="mt-4 whitespace-pre-wrap rounded-lg border border-teal-200 bg-teal-50 p-5 text-sm leading-6 text-slate-700"><p className="mb-2 font-bold text-teal-800">Resultado da IA</p>{active.aiOutput}</div>}
        </div>
      </div> : <div className="grid place-items-center p-10 text-sm text-slate-500">Selecione ou crie uma anotação.</div>}
    </section>
  )
}

function FilesWorkspace({ files, onAdd, onChange }: { files: StoredFile[]; onAdd: (file?: File) => void; onChange: (files: StoredFile[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  return <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
    <header className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center"><div><h2 className="text-lg font-bold text-slate-950">Arquivos pessoais</h2><p className="text-sm text-slate-500">Arquivos pequenos ficam disponíveis neste dispositivo; os maiores são catalogados sem duplicação.</p></div><button onClick={() => input.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-xs font-bold text-white"><PaperClipIcon className="h-4 w-4" />Adicionar arquivo</button><input ref={input} type="file" className="hidden" onChange={event => { onAdd(event.target.files?.[0]); event.currentTarget.value = '' }} /></header>
    <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">{files.map(file => <article key={file.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-4"><span className="grid h-10 w-10 place-items-center rounded-md bg-sky-50 text-sky-700"><DocumentIcon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{file.name}</p><p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB · {new Date(file.createdAt).toLocaleDateString('pt-BR')}</p></div>{file.data && <a href={file.data} download={file.name} className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-500" title="Baixar"><ArrowDownTrayIcon className="h-4 w-4" /></a>}<button onClick={() => onChange(files.filter(item => item.id !== file.id))} className="grid h-9 w-9 place-items-center rounded-md border border-rose-100 text-rose-500" title="Remover"><TrashIcon className="h-4 w-4" /></button></article>)}{!files.length && <div className="col-span-full grid min-h-64 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center"><div><FolderIcon className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-700">Nenhum arquivo catalogado</p><p className="mt-1 text-xs text-slate-500">Adicione documentos, imagens e referências.</p></div></div>}</div>
  </section>
}

function VaultWorkspace() {
  const [hasVault, setHasVault] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [items, setItems] = useState<Credential[]>([])
  const [show, setShow] = useState<Record<string, boolean>>({})
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ service: '', url: '', email: '', password: '', notes: '', category: 'Geral' })

  useEffect(() => { setHasVault(Boolean(localStorage.getItem(VAULT_PIN_KEY))) }, [])

  async function unlock() {
    setError('')
    if (!hasVault) {
      if (pin.length < 4 || pin !== confirmPin) { setError('Crie um PIN de pelo menos 4 dígitos e confirme corretamente.'); return }
      await setVaultPin(pin)
      await saveVault([], pin)
      setHasVault(true)
      setUnlocked(true)
      return
    }
    if (!(await verifyVaultPin(pin))) { setError('PIN incorreto. Seus dados continuam protegidos.'); return }
    const restored = await loadVault(pin)
    if (!restored) { setError('Não foi possível abrir o cofre antigo com este PIN.'); return }
    setItems(restored)
    setUnlocked(true)
  }

  async function persist(next: Credential[]) {
    setItems(next)
    await saveVault(next, pin)
  }

  async function addCredential() {
    if (!form.service.trim() || !form.email.trim() || !form.password) { setError('Serviço, login e senha são obrigatórios.'); return }
    const item: Credential = { ...form, id: makeId(), createdAt: new Date().toISOString() }
    await persist([item, ...items])
    setForm({ service: '', url: '', email: '', password: '', notes: '', category: 'Geral' })
    setAdding(false)
    setError('')
  }

  if (!unlocked) return <section className="grid min-h-[560px] place-items-center rounded-lg border border-slate-200 bg-white p-6 shadow-sm"><div className="w-full max-w-md text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-lg bg-slate-900 text-white"><LockClosedIcon className="h-7 w-7" /></span><h2 className="mt-5 text-2xl font-bold text-slate-950">{hasVault ? 'Seu cofre foi encontrado' : 'Criar cofre de acessos'}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{hasVault ? 'Digite o mesmo PIN usado anteriormente para restaurar os logins e senhas já salvos.' : 'As credenciais serão criptografadas no navegador com AES-256 e protegidas por um PIN.'}</p><div className="mt-6 space-y-3"><input type="password" value={pin} onChange={event => setPin(event.target.value)} placeholder="PIN do cofre" className="h-11 w-full rounded-md border border-slate-200 px-3 text-center text-sm outline-none focus:border-teal-500" />{!hasVault && <input type="password" value={confirmPin} onChange={event => setConfirmPin(event.target.value)} placeholder="Confirmar PIN" className="h-11 w-full rounded-md border border-slate-200 px-3 text-center text-sm outline-none focus:border-teal-500" />}<button onClick={unlock} className="h-11 w-full rounded-md bg-teal-700 text-sm font-bold text-white hover:bg-teal-800">{hasVault ? 'Desbloquear e restaurar' : 'Criar cofre protegido'}</button>{error && <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}</div></div></section>

  return <section className="rounded-lg border border-slate-200 bg-white shadow-sm"><header className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><ShieldCheckIcon className="h-5 w-5 text-emerald-600" /><h2 className="text-lg font-bold text-slate-950">Cofre desbloqueado</h2></div><p className="mt-1 text-sm text-slate-500">{items.length} credenciais recuperadas e protegidas neste dispositivo.</p></div><div className="flex gap-2"><button onClick={() => { setUnlocked(false); setPin(''); setItems([]) }} className="h-10 rounded-md border border-slate-200 px-4 text-xs font-bold text-slate-600">Bloquear</button><button onClick={() => setAdding(value => !value)} className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-xs font-bold text-white"><PlusIcon className="h-4 w-4" />Novo acesso</button></div></header>{adding && <div className="grid gap-3 border-b border-slate-100 bg-slate-50 p-5 md:grid-cols-2"><input value={form.service} onChange={event => setForm({ ...form, service: event.target.value })} placeholder="Serviço ou sistema" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" /><input value={form.url} onChange={event => setForm({ ...form, url: event.target.value })} placeholder="Link de acesso" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" /><input value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="E-mail ou usuário" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" /><input type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="Senha" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" /><input value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Observações" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" /><button onClick={addCredential} className="h-10 rounded-md bg-slate-900 text-sm font-bold text-white">Salvar no cofre</button>{error && <p className="md:col-span-2 text-sm text-rose-700">{error}</p>}</div>}<div className="grid gap-3 p-5 lg:grid-cols-2">{items.map(item => <article key={item.id} className="rounded-lg border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-950">{item.service}</p>{item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-teal-700 hover:underline">Abrir sistema</a> : <p className="text-xs text-slate-400">{item.category}</p>}</div><button onClick={() => persist(items.filter(credential => credential.id !== item.id))} className="text-rose-500" title="Remover"><TrashIcon className="h-4 w-4" /></button></div><div className="mt-4 space-y-2"><CopyRow value={item.email} /><div className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2"><span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700">{show[item.id] ? item.password : '••••••••••••'}</span><button onClick={() => setShow({ ...show, [item.id]: !show[item.id] })} title="Mostrar ou ocultar senha">{show[item.id] ? <EyeSlashIcon className="h-4 w-4 text-slate-400" /> : <EyeIcon className="h-4 w-4 text-slate-400" />}</button><button onClick={() => navigator.clipboard.writeText(item.password)} title="Copiar senha"><ClipboardDocumentIcon className="h-4 w-4 text-slate-400" /></button></div></div>{item.notes && <p className="mt-3 text-xs leading-5 text-slate-500">{item.notes}</p>}</article>)}{!items.length && <div className="col-span-full grid min-h-56 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">O cofre está vazio. Adicione o primeiro acesso.</div>}</div></section>
}

function CopyRow({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return <div className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2"><span className="min-w-0 flex-1 truncate text-xs text-slate-700">{value}</span><button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200) }} title="Copiar">{copied ? <CheckIcon className="h-4 w-4 text-emerald-600" /> : <ClipboardDocumentIcon className="h-4 w-4 text-slate-400" />}</button></div>
}
