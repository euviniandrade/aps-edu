'use client'
import { useEffect, useState } from 'react'
import AdminLayout from '@/components/layout/AdminLayout'
import Cookies from 'js-cookie'
import api from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

const darkField = {
  background: '#FFFFFF',
  border: '1px solid #C9DBEA',
  color: '#001B3F',
} as React.CSSProperties

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div
    className="mb-5 overflow-hidden rounded-[24px] border border-[#D8E5F0] bg-white shadow-[0_18px_44px_rgba(0,63,117,0.07)]"
  >
    <div className="border-b border-[#E3EEF7] px-5 py-4">
      <h2 className="text-sm font-black text-[#001B3F]">{title}</h2>
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
      <div className="max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 animate-fade-in">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold"
            style={{ background: 'linear-gradient(135deg, #F8A303, #FDC347)', color: '#000', boxShadow: '0 8px 24px rgba(248,163,3,0.3)' }}
          >
            {userInitial}
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#6B7F94]">Configurações</p>
            <h1 className="mt-1 text-3xl font-black text-[#001B3F]">{user?.name || 'Carregando...'}</h1>
            <p className="mt-1 text-sm font-semibold text-[#5D7085]">
              {roleName} · {user?.unit?.name || user?.unitName || 'Sem unidade'}
            </p>
          </div>
        </div>

        {/* Profile */}
        <Section title="Informações do perfil">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#6B7F94]">
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
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#6B7F94]">
                E-mail (somente leitura)
              </label>
              <input
                type="email" value={form.email} readOnly
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ ...darkField, background: '#F7FBFF', color: '#5D7085', cursor: 'not-allowed' }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#6B7F94]">
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
              {saving ? 'Salvando...' : 'Salvar perfil'}
            </button>
          </div>
        </Section>

        {/* Password */}
        <Section title="Alterar senha">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#6B7F94]">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#6B7F94]">
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
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-[#6B7F94]">
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
              <p className="text-xs font-bold" style={{ color: '#FF4757' }}>As senhas não conferem.</p>
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
              {savingPw ? 'Alterando...' : 'Alterar senha'}
            </button>
          </div>
        </Section>

        {/* Notifications */}
        <Section title="Preferências de notificação">
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
                style={{ background: '#F7FBFF', border: '1px solid #D8E5F0' }}
                onClick={() => setNotifSettings(s => ({ ...s, [item.key]: !s[item.key as keyof typeof s] }))}
              >
                <div>
                  <p className="text-sm font-black text-[#001B3F]">{item.label}</p>
                  <p className="mt-0.5 text-xs font-semibold text-[#6B7F94]">{item.sub}</p>
                </div>
                <div
                  className="w-11 h-6 rounded-full transition-all flex-shrink-0 relative"
                  style={{
                    background: notifSettings[item.key as keyof typeof notifSettings]
                      ? 'linear-gradient(135deg, #0ABD78, #0dd68c)'
                      : '#D8E5F0',
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
            <p className="mt-2 text-xs font-semibold text-[#6B7F94]">
              Preferências salvas localmente neste dispositivo.
            </p>
          </div>
        </Section>

        {/* Info */}
        <Section title="Informações da conta">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              { label: 'ID do usuário', value: user?.id || '—' },
              { label: 'Perfil de acesso', value: roleName },
              { label: 'Unidade', value: user?.unit?.name || user?.unitName || '—' },
              { label: 'Membro desde', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '—' },
            ].map(item => (
              <div
                key={item.label}
                className="rounded-xl p-3"
                style={{ background: '#F7FBFF', border: '1px solid #D8E5F0' }}
              >
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#6B7F94]">
                  {item.label}
                </p>
                <p className="text-xs font-black text-[#001B3F]">{item.value}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </AdminLayout>
  )
}
