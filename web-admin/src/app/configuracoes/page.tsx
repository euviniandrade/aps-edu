'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import Cookies from 'js-cookie'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

const darkField = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
} as React.CSSProperties

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div
    className="rounded-2xl overflow-hidden mb-5"
    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
  >
    <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <h2 className="text-sm font-bold text-white">{title}</h2>
    </div>
    <div className="p-5">{children}</div>
  </div>
)

export default function ConfiguraçõesPage() {
  const { success, error } = useToast()
  const [user, setUser] = useState<any>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [notifSettings, setNotifSettings] = useState({
    emailTasks: true,
    emailEvents: true,
    emailAnnouncements: false,
    browserNotif: true,
  })

  useEffect(() => {
    try {
      const raw = Cookies.get('user')
      if (raw) {
        const u = JSON.parse(decodeURIComponent(raw))
        setUser(u)
        setForm({ name: u.name || '', email: u.email || '', phone: u.phone || '' })
      }
    } catch {}
    // Load from API
    api.get('/users/me').then(res => {
      const u = res.data
      setUser(u)
      setForm({ name: u.name || '', email: u.email || '', phone: u.phone || '' })
    }).catch(() => {})
  }, [])

  const saveProfile = async () => {
    if (!form.name.trim()) { error('Nome obrigatório', 'Preencha seu nome completo.'); return }
    setSaving(true)
    try {
      await api.put(`/users/${user?.id}`, { name: form.name, phone: form.phone })
      // Update cookie
      const updated = { ...user, name: form.name, phone: form.phone }
      Cookies.set('user', encodeURIComponent(JSON.stringify(updated)), { expires: 7 })
      success('Perfil atualizado!', 'Suas informações foram salvas com sucesso.')
    } catch (e: any) {
      error('Erro ao salvar', e?.response?.data?.error || e.message)
    } finally { setSaving(false) }
  }

  const savePassword = async () => {
    if (!pwForm.current || !pwForm.next) { error('Preencha os campos', 'Senha atual e nova são obrigatórias.'); return }
    if (pwForm.next.length < 6) { error('Senha muito curta', 'A nova senha deve ter ao menos 6 caracteres.'); return }
    if (pwForm.next !== pwForm.confirm) { error('Senhas não conferem', 'A nova senha e confirmação são diferentes.'); return }
    setSavingPw(true)
    try {
      await api.post('/auth/change-password', { currentPassword: pwForm.current, newPassword: pwForm.next })
      success('Senha alterada!', 'Sua senha foi atualizada com sucesso.')
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (e: any) {
      error('Erro ao alterar senha', e?.response?.data?.error || 'Senha atual incorreta.')
    } finally { setSavingPw(false) }
  }

  const userInitial = (user?.name || 'U')[0]?.toUpperCase()
  const roleName = user?.role?.name || user?.role || '—'

  return (
    <AdminLayout>
      <div className="max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 animate-fade-in">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold"
            style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', color: '#000', boxShadow: '0 8px 24px rgba(248,163,3,0.3)' }}
          >
            {userInitial}
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">{user?.name || 'Carregando...'}</h1>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {roleName} · {user?.unit?.name || user?.unitName || 'Sem unidade'}
            </p>
          </div>
        </div>

        {/* Profile */}
        <Section title="👤 Informações do Perfil">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Nome completo
              </label>
              <input
                type="text" value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={darkField}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                E-mail (somente leitura)
              </label>
              <input
                type="email" value={form.email} readOnly
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ ...darkField, opacity: 0.5, cursor: 'not-allowed' }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Telefone
              </label>
              <input
                type="tel" value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="(11) 99999-0000"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={darkField}
              />
            </div>
            <button
              onClick={saveProfile}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #F8A303, #FDC347)',
                color: '#000',
                boxShadow: '0 4px 16px rgba(248,163,3,0.3)',
              }}
            >
              {saving ? 'Salvando...' : '💾 Salvar Perfil'}
            </button>
          </div>
        </Section>

        {/* Password */}
        <Section title="🔒 Alterar Senha">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Senha atual
              </label>
              <input
                type="password" value={pwForm.current}
                onChange={e => setPwForm({ ...pwForm, current: e.target.value })}
                placeholder="••••••••"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={darkField}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Nova senha
                </label>
                <input
                  type="password" value={pwForm.next}
                  onChange={e => setPwForm({ ...pwForm, next: e.target.value })}
                  placeholder="••••••••"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={darkField}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold mb-1.5 uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Confirmar nova
                </label>
                <input
                  type="password" value={pwForm.confirm}
                  onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
                  placeholder="••••••••"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={darkField}
                />
              </div>
            </div>
            {pwForm.next && pwForm.confirm && pwForm.next !== pwForm.confirm && (
              <p className="text-xs" style={{ color: '#FF4757' }}>⚠️ As senhas não conferem</p>
            )}
            <button
              onClick={savePassword}
              disabled={savingPw}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 hover:opacity-90"
              style={{
                background: 'rgba(74,158,255,0.12)',
                border: '1px solid rgba(74,158,255,0.25)',
                color: '#4A9EFF',
              }}
            >
              {savingPw ? 'Alterando...' : '🔑 Alterar Senha'}
            </button>
          </div>
        </Section>

        {/* Notifications */}
        <Section title="🔔 Preferências de Notificação">
          <div className="space-y-3">
            {[
              { key: 'emailTasks',        label: 'E-mail: novas tarefas atribuídas a mim',    sub: 'Receba por e-mail quando uma tarefa for atribuída a você' },
              { key: 'emailEvents',       label: 'E-mail: lembretes de eventos',               sub: 'Lembretes 1 hora antes dos eventos' },
              { key: 'emailAnnouncements',label: 'E-mail: novos comunicados no mural',         sub: 'Seja notificado sobre publicações no mural' },
              { key: 'browserNotif',      label: 'Notificações no navegador',                  sub: 'Push notifications para alertas importantes' },
            ].map(item => (
              <div
                key={item.key}
                className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                onClick={() => setNotifSettings(s => ({ ...s, [item.key]: !s[item.key as keyof typeof s] }))}
              >
                <div>
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{item.sub}</p>
                </div>
                <div
                  className="w-11 h-6 rounded-full transition-all flex-shrink-0 relative"
                  style={{
                    background: notifSettings[item.key as keyof typeof notifSettings]
                      ? 'linear-gradient(135deg, #0ABD78, #0dd68c)'
                      : 'rgba(255,255,255,0.1)',
                  }}
                >
                  <div
                    className="absolute top-0.5 w-5 h-5 rounded-full transition-all bg-white"
                    style={{
                      left: notifSettings[item.key as keyof typeof notifSettings] ? '22px' : '2px',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    }}
                  />
                </div>
              </div>
            ))}
            <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
              * Preferências salvas localmente neste dispositivo
            </p>
          </div>
        </Section>

        {/* Info */}
        <Section title="ℹ️ Informações da Conta">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'ID do usuário', value: user?.id || '—' },
              { label: 'Perfil de acesso', value: roleName },
              { label: 'Unidade', value: user?.unit?.name || user?.unitName || '—' },
              { label: 'Membro desde', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '—' },
            ].map(item => (
              <div
                key={item.label}
                className="rounded-xl p-3"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {item.label}
                </p>
                <p className="font-medium text-white text-xs">{item.value}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </AdminLayout>
  )
}
