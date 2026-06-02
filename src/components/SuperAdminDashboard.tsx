import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/format'
import {
  LayoutDashboard, Users, Store, Settings, LogOut, TrendingUp, TrendingDown,
  Shield, Search, ChevronDown, X, CheckCircle, Clock, AlertCircle,
  Edit3, Save, RefreshCw, ExternalLink, Crown, Zap, Star,
  Phone, Mail, Instagram, Globe, BarChart2, Activity, Package,
  DollarSign, MessageCircle, CalendarDays, CreditCard, Banknote, ArrowRight, History
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar
} from 'recharts'

// ========================
// TYPES
// ========================
interface Estabelecimento {
  id: string
  nome: string
  slug: string
  email_dono: string
  owner_id: string
  plano: 'gratis' | 'pro' | 'premium'
  status_assinatura: 'ativo' | 'inativo' | 'pendente'
  created_at: string
  configuracoes: any
  trial_start: string | null
  trial_end: string | null
  trial_active: boolean
  data_ultimo_pagamento: string | null
  data_proxima_cobranca: string | null
}

interface SaasConfig {
  id: number
  titulo_hero: string
  subtitulo_hero: string
  email_contato: string
  whatsapp_contato: string
  instagram_url: string
  trial_dias: number
  grace_period_dias: number
  aviso_trial_dias: number
  created_at: string
  updated_at: string
}

interface SaasPagamento {
  id: string
  estabelecimento_id: string
  valor: number
  referencia: string
  metodo_pagamento: 'manual' | 'pix' | 'dinheiro' | 'cartao'
  status: 'pago' | 'pendente' | 'cancelado'
  observacoes: string | null
  pago_em: string
  criado_em: string
}

interface Stats {
  totalEstabs: number
  estabsAtivos: number
  estabsPro: number
  estabsPremium: number
  totalStaff: number
  totalTransacoes: number
  totalReceita: number
  realSaasReceita: number
}

type Tab = 'dashboard' | 'estabelecimentos' | 'faturamento' | 'configuracoes'

// ========================
// PLANO CONFIG
// ========================
const PLANO_CONFIG = {
  gratis: { label: 'Grátis (Teste)', icon: Package, color: 'text-slate-400', bg: 'bg-slate-800/60', border: 'border-slate-700/50' },
  pro: { label: 'Pro (Assinante)', icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-900/30', border: 'border-emerald-700/50' },
  premium: { label: 'Pro (Assinante)', icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-900/30', border: 'border-emerald-700/50' },
}

const STATUS_CONFIG = {
  ativo: { label: 'Ativo', icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-900/20', border: 'border-emerald-700/30' },
  pendente: { label: 'Pendente', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-900/20', border: 'border-amber-700/30' },
  inativo: { label: 'Inativo', icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-900/20', border: 'border-rose-700/30' },
}

const PIE_COLORS = ['#64748b', '#10b981']

// ========================
// SUB-COMPONENTS
// ========================

function StatCard({ icon: Icon, label, value, sub, color = 'emerald' }: {
  icon: any, label: string, value: string | number, sub?: string, color?: string
}) {
  const colorMap: Record<string, string> = {
    emerald: 'from-emerald-500/20 to-transparent border-emerald-500/20 text-emerald-400',
    amber: 'from-amber-500/20 to-transparent border-amber-500/20 text-amber-400',
    violet: 'from-violet-500/20 to-transparent border-violet-500/20 text-violet-400',
    blue: 'from-blue-500/20 to-transparent border-blue-500/20 text-blue-400',
    rose: 'from-rose-500/20 to-transparent border-rose-500/20 text-rose-400',
  }
  const cls = colorMap[color] || colorMap.emerald
  return (
    <div className={`relative rounded-2xl border bg-gradient-to-br p-5 overflow-hidden transition-all hover:scale-[1.02] ${cls}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">{label}</p>
          <p className="text-3xl font-black text-white">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/5`}>
          <Icon size={20} className={cls.split(' ').find(c => c.startsWith('text-'))} />
        </div>
      </div>
    </div>
  )
}

function Planobadge({ plano }: { plano: keyof typeof PLANO_CONFIG }) {
  const cfg = PLANO_CONFIG[plano] || PLANO_CONFIG.gratis
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  )
}

function StatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pendente
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  )
}

// ========================
// TABS
// ========================

function DashboardTab({ estabelecimentos, stats, loading }: {
  estabelecimentos: Estabelecimento[], stats: Stats, loading: boolean
}) {
  const planosData = [
    { name: 'Grátis (Teste)', value: estabelecimentos.filter(e => e.plano === 'gratis').length },
    { name: 'Pro (Assinante)', value: estabelecimentos.filter(e => e.plano === 'pro' || e.plano === 'premium').length },
  ]

  const cadastrosRecentes = estabelecimentos
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  // Agrupar cadastros por dia (últimos 7 dias)
  const ultimosDias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const label = d.toLocaleDateString('pt-BR', { weekday: 'short' })
    const dateStr = d.toISOString().split('T')[0]
    const count = estabelecimentos.filter(e => e.created_at.startsWith(dateStr)).length
    return { label, count }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Store} label="Total Tenants" value={stats.totalEstabs} sub={`${stats.estabsAtivos} ativos`} color="emerald" />
        <StatCard icon={Crown} label="Assinantes Pro" value={stats.estabsPremium + stats.estabsPro} sub="planos ativos" color="amber" />
        <StatCard icon={Users} label="Total Staff" value={stats.totalStaff} sub="colaboradores" color="violet" />
        <StatCard icon={TrendingUp} label="Receita SaaS Real" value={`R$ ${stats.realSaasReceita.toFixed(2).replace('.', ',')}`} sub={`Estimativa mensal: R$ ${((stats.estabsPro + stats.estabsPremium) * 49.90).toFixed(2).replace('.', ',')}`} color="blue" />
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area chart - Cadastros por dia */}
        <div className="lg:col-span-2 rounded-2xl border border-white/5 bg-slate-900/50 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Cadastros (últimos 7 dias)</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={ultimosDias}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#475569', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, color: '#e2e8f0', fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area type="monotone" dataKey="count" name="Cadastros" stroke="#10b981" strokeWidth={2} fill="url(#grad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart - Distribuição de planos */}
        <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Distribuição de Planos</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={planosData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                {planosData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, color: '#e2e8f0', fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-1 mt-2">
            {planosData.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i] }} />
                <span className="text-slate-400">{p.name}</span>
                <span className="ml-auto font-bold text-white">{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CADASTROS RECENTES */}
      <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Cadastros Recentes</p>
        <div className="space-y-2">
          {cadastrosRecentes.length === 0 && (
            <p className="text-slate-600 text-sm text-center py-4">Nenhum estabelecimento cadastrado ainda.</p>
          )}
          {cadastrosRecentes.map(e => (
            <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 hover:bg-white/5 transition-all">
              <div className="w-9 h-9 rounded-xl bg-emerald-900/40 border border-emerald-700/30 flex items-center justify-center text-sm font-black text-emerald-400 flex-shrink-0">
                {e.nome.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{e.nome}</p>
                <p className="text-xs text-slate-500 truncate">{e.email_dono}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Planobadge plano={e.plano} />
                <StatusBadge status={e.status_assinatura} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function EstabelecimentosTab({ estabelecimentos, onUpdate, loading }: {
  estabelecimentos: Estabelecimento[]
  onUpdate: () => void
  loading: boolean
}) {
  const [search, setSearch] = useState('')
  const [filterPlano, setFilterPlano] = useState<string>('todos')
  const [filterStatus, setFilterStatus] = useState<string>('todos')
  const [updating, setUpdating] = useState<string | null>(null)

  const filtered = estabelecimentos.filter(e => {
    const matchSearch = e.nome.toLowerCase().includes(search.toLowerCase()) ||
      e.email_dono.toLowerCase().includes(search.toLowerCase()) ||
      e.slug.toLowerCase().includes(search.toLowerCase())
    const matchPlano = filterPlano === 'todos' || e.plano === filterPlano
    const matchStatus = filterStatus === 'todos' || e.status_assinatura === filterStatus
    return matchSearch && matchPlano && matchStatus
  })

  const updateField = async (id: string, field: string, value: string) => {
    setUpdating(id)
    const { error } = await supabase.from('estabelecimentos').update({ [field]: value }).eq('id', id)
    if (!error) onUpdate()
    setUpdating(null)
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome, email ou slug..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900/80 border border-white/5 rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-500/50 transition-all"
          />
        </div>
        <select
          value={filterPlano}
          onChange={e => setFilterPlano(e.target.value)}
          className="bg-slate-900/80 border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50 transition-all"
        >
          <option value="todos">Todos os planos</option>
          <option value="gratis">Grátis (Teste)</option>
          <option value="pro">Pro (Assinante)</option>
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-slate-900/80 border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50 transition-all"
        >
          <option value="todos">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="pendente">Pendente</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      {/* Contagem */}
      <p className="text-xs text-slate-600 font-bold uppercase tracking-widest">
        {filtered.length} estabelecimento{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-600">
              <Store size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-bold">Nenhum estabelecimento encontrado.</p>
            </div>
          )}
          {filtered.map(e => (
            <div
              key={e.id}
              className={`rounded-2xl border bg-slate-900/50 p-4 transition-all hover:border-white/10 ${updating === e.id ? 'opacity-50 pointer-events-none' : 'border-white/5'}`}
            >
              {/* Header */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-900/40 border border-emerald-700/30 flex items-center justify-center text-sm font-black text-emerald-400 flex-shrink-0">
                  {e.nome.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white truncate">{e.nome}</p>
                  <p className="text-xs text-slate-500 truncate">{e.email_dono}</p>
                  <p className="text-xs text-slate-600">/{e.slug}</p>
                </div>
                <div className="text-xs text-slate-600 text-right flex-shrink-0">
                  {new Date(e.created_at).toLocaleDateString('pt-BR')}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {e.plano === 'gratis' && e.trial_start && e.trial_end ? (
                    // Plano Grátis: mostra período de trial
                    // Usa split para evitar bug de fuso horário do toLocaleDateString com strings ISO
                    (() => {
                      const [sy, sm, sd] = e.trial_start.split('-')
                      const [ey, em, ed] = e.trial_end.split('-')
                      const start = `${sd}/${sm}/${sy}`
                      const end = `${ed}/${em}/${ey}`
                      return `Trial: ${start} – ${end}`
                    })()
                  ) : e.plano === 'pro' || e.plano === 'premium' ? (
                    // Plano Pro: mostra próxima cobrança
                    e.data_proxima_cobranca ? (() => {
                      const [y, m, d] = e.data_proxima_cobranca.split('-')
                      return `Próx. cobrança: ${d}/${m}/${y}`
                    })() : 'Cobrança: não definida'
                  ) : null}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Plano */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">Plano:</span>
                  <div className="flex gap-1">
                    {(['gratis', 'pro'] as const).map(p => {
                      const cfg = PLANO_CONFIG[p]
                      const active = e.plano === p
                      return (
                        <button
                          key={p}
                          onClick={() => updateField(e.id, 'plano', p)}
                          className={`px-2 py-0.5 rounded-lg text-xs font-bold border transition-all ${active ? `${cfg.bg} ${cfg.border} ${cfg.color}` : 'bg-transparent border-slate-700/30 text-slate-600 hover:border-slate-500/50 hover:text-slate-400'}`}
                        >
                          {cfg.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="h-4 w-px bg-white/5 mx-1 hidden sm:block" />

                {/* Status */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">Status:</span>
                  <div className="flex gap-1">
                    {(['ativo', 'pendente', 'inativo'] as const).map(s => {
                      const cfg = STATUS_CONFIG[s]
                      const active = e.status_assinatura === s
                      return (
                        <button
                          key={s}
                          onClick={() => updateField(e.id, 'status_assinatura', s)}
                          className={`px-2 py-0.5 rounded-lg text-xs font-bold border transition-all ${active ? `${cfg.bg} ${cfg.border} ${cfg.color}` : 'bg-transparent border-slate-700/30 text-slate-600 hover:border-slate-500/50 hover:text-slate-400'}`}
                        >
                          {cfg.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="ml-auto">
                  <a
                    href={`/${e.slug}/login`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/5 hover:bg-emerald-900/30 hover:text-emerald-400 text-slate-400 border border-white/5 transition-all"
                  >
                    <ExternalLink size={11} /> Acessar
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, icon: Icon, placeholder, type = 'text' }: {
  label: string, value: string, onChange: (val: string) => void, icon: any, placeholder?: string, type?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
        <Icon size={10} className="text-emerald-500" /> {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-900/80 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-700 outline-none focus:border-emerald-500/50 transition-all"
      />
    </div>
  )
}

function ConfiguracoesTab({ onSaved }: { onSaved?: () => void }) {
  const [config, setConfig] = useState<SaasConfig | null>(null)
  const [form, setForm] = useState<Partial<SaasConfig>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchConfig = async () => {
    setLoading(true)
    const { data } = await supabase.from('saas_configuracoes').select('*').limit(1).maybeSingle()
    if (data) { setConfig(data); setForm(data) }
    setLoading(false)
  }

  useEffect(() => { fetchConfig() }, [])

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      const { id, created_at, updated_at, ...updateData } = form as any
      if (config?.id) {
        const { error } = await supabase.from('saas_configuracoes').update({ ...updateData, updated_at: new Date().toISOString() }).eq('id', config.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('saas_configuracoes').insert(updateData)
        if (error) throw error
      }
      setSaved(true)
      setConfig(form as SaasConfig)
      onSaved?.()
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      alert('Erro ao salvar configurações: ' + (err.message || JSON.stringify(err)))
    } finally {
      setSaving(false)
    }
  }

  // Field component extraído para fora para evitar re-render/perda de foco

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Globe size={16} className="text-emerald-500" />
          <p className="font-bold text-white">Landing Page</p>
          <span className="text-xs text-slate-600">— configurações públicas do site</span>
        </div>

        <Field label="Título Principal (Hero)" value={(form.titulo_hero as string) || ''} onChange={val => setForm(prev => ({ ...prev, titulo_hero: val }))} icon={Star} placeholder="Ex: GFin SaaS" />
        <Field label="Subtítulo (Hero)" value={(form.subtitulo_hero as string) || ''} onChange={val => setForm(prev => ({ ...prev, subtitulo_hero: val }))} icon={Activity} placeholder="Ex: Gestão financeira para sua barbearia." />
      </div>

      <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Phone size={16} className="text-emerald-500" />
          <p className="font-bold text-white">Contatos</p>
        </div>

        <Field label="E-mail de Contato" value={(form.email_contato as string) || ''} onChange={val => setForm(prev => ({ ...prev, email_contato: val }))} icon={Mail} placeholder="contato@seudominio.com" type="email" />
        <Field label="WhatsApp de Contato" value={(form.whatsapp_contato as string) || ''} onChange={val => setForm(prev => ({ ...prev, whatsapp_contato: val }))} icon={Phone} placeholder="5511999999999" />
        <Field label="URL do Instagram" value={(form.instagram_url as string) || ''} onChange={val => setForm(prev => ({ ...prev, instagram_url: val }))} icon={Instagram} placeholder="https://instagram.com/seu_perfil" />
      </div>

      <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Settings size={16} className="text-emerald-500" />
          <p className="font-bold text-white">Regras de Assinatura</p>
        </div>

        <Field label="Dias de Teste Grátis (Trial)" value={String(form.trial_dias || '')} onChange={val => setForm(prev => ({ ...prev, trial_dias: parseInt(val) || 0 }))} icon={Clock} placeholder="Ex: 14" type="number" />
        <Field label="Aviso de Expiração do Trial (dias antes)" value={String(form.aviso_trial_dias || '')} onChange={val => setForm(prev => ({ ...prev, aviso_trial_dias: parseInt(val) || 0 }))} icon={AlertCircle} placeholder="Ex: 3" type="number" />
        <Field label="Carência Pós-Vencimento (dias)" value={String(form.grace_period_dias || '')} onChange={val => setForm(prev => ({ ...prev, grace_period_dias: parseInt(val) || 0 }))} icon={CalendarDays} placeholder="Ex: 5" type="number" />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${saved ? 'bg-emerald-600 text-white' : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20'}`}
      >
        <span className="flex items-center justify-center">
          {saving ? <RefreshCw size={14} className="animate-spin" /> : saved ? <CheckCircle size={14} /> : <Save size={14} />}
        </span>
        <span>
          {saving ? 'Salvando...' : saved ? 'Salvo com sucesso!' : 'Salvar Configurações'}
        </span>
      </button>
    </div>
  )
}

// ========================
// FATURAMENTO TAB
// ========================
function FaturamentoTab({ estabelecimentos, whatsappAdmin, onUpdate }: {
  estabelecimentos: Estabelecimento[]
  whatsappAdmin: string
  onUpdate?: () => void
}) {
  const [pagamentos, setPagamentos] = useState<SaasPagamento[]>([])
  const [loadingPag, setLoadingPag] = useState(true)
  const [confirmModal, setConfirmModal] = useState<Estabelecimento | null>(null)
  const [goFaturamento, setGoFaturamento] = useState<boolean | null>(null)
  const [form, setForm] = useState({ valor: '49,90', referencia: '', metodo: 'pix' as const, observacoes: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [selectedEstab, setSelectedEstab] = useState<string | null>(null)

  const currentMonth = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  useEffect(() => {
    setForm(prev => ({ ...prev, referencia: currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1) }))
    fetchPagamentos()
  }, [])

  const fetchPagamentos = async () => {
    setLoadingPag(true)
    const { data } = await supabase
      .from('saas_pagamentos')
      .select('*')
      .order('criado_em', { ascending: false })
    setPagamentos(data || [])
    setLoadingPag(false)
  }

  const getUltimoPagamento = (estabId: string) =>
    pagamentos.filter(p => p.estabelecimento_id === estabId && p.status === 'pago')
      .sort((a, b) => new Date(b.pago_em).getTime() - new Date(a.pago_em).getTime())[0]

  const getStatus = (estab: Estabelecimento) => {
    const ultimo = getUltimoPagamento(estab.id)
    if (!ultimo) return 'sem_pagamento'
    const diasPassados = Math.floor((Date.now() - new Date(ultimo.pago_em).getTime()) / 86400000)
    if (diasPassados > 35) return 'inadimplente'
    if (diasPassados > 25) return 'vencendo'
    return 'em_dia'
  }

  const STATUS_PAG = {
    em_dia: { label: 'Em dia', color: 'text-emerald-400', bg: 'bg-emerald-900/20', border: 'border-emerald-700/30' },
    vencendo: { label: 'Vencendo', color: 'text-amber-400', bg: 'bg-amber-900/20', border: 'border-amber-700/30' },
    inadimplente: { label: 'Inadimplente', color: 'text-rose-400', bg: 'bg-rose-900/20', border: 'border-rose-700/30' },
    sem_pagamento: { label: 'Nunca pagou', color: 'text-slate-400', bg: 'bg-slate-800/40', border: 'border-slate-700/30' },
  }

  const buildWhatsApp = (estab: Estabelecimento) => {
    const msg = encodeURIComponent(
      `Olá! 👋 Aqui é o suporte do GFin SaaS.\n\n` +
      `Notamos que a assinatura da *${estab.nome}* está pendente.\n\n` +
      `Para continuar usando todos os recursos do sistema sem interrupção, por favor realize o pagamento.\n\n` +
      `📲 PIX ou entre em contato para mais detalhes.\n\n` +
      `Qualquer dúvida, estamos à disposição! 😊`
    )
    
    // Obter número da coluna configuracoes.whatsapp
    const rawWhatsapp = estab.configuracoes?.whatsapp || ''
    const digits = rawWhatsapp.replace(/\D/g, '')
    
    // Se o número tiver 10 ou 11 dígitos (padrão Brasil) e não começar com o DDI 55, adiciona 55
    let cleanNumber = digits
    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
      cleanNumber = '55' + digits
    }
    
    return `https://wa.me/${cleanNumber}?text=${msg}`
  }

  const handleConfirmar = async () => {
    if (!confirmModal) return
    setSaving(true)
    const valor = parseFloat(form.valor.replace(',', '.'))
    const { error } = await supabase.from('saas_pagamentos').insert({
      estabelecimento_id: confirmModal.id,
      valor,
      referencia: form.referencia,
      metodo_pagamento: form.metodo,
      observacoes: form.observacoes || null,
      status: 'pago',
    })
    if (!error) {
      const hoje = new Date()
      const dataUltimo = hoje.toISOString().split('T')[0]
      
      // Próxima cobrança daqui a 30 dias
      const proximaCobranca = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      // Atualizar status do estabelecimento
      await supabase.from('estabelecimentos').update({
        plano: 'pro',
        status_assinatura: 'ativo',
        data_ultimo_pagamento: dataUltimo,
        data_proxima_cobranca: proximaCobranca,
      }).eq('id', confirmModal.id)
      setSaved(confirmModal.id)
      fetchPagamentos()
      onUpdate?.()
    }
    setSaving(false)
    // Pergunta sobre redirecionar ao faturamento
    setGoFaturamento(true)
  }

  const METODOS = [
    { value: 'pix', label: 'PIX', icon: <CreditCard size={14}/> },
    { value: 'dinheiro', label: 'Dinheiro', icon: <Banknote size={14}/> },
    { value: 'cartao', label: 'Cartão', icon: <CreditCard size={14}/> },
    { value: 'manual', label: 'Outro', icon: <DollarSign size={14}/> },
  ]

  const estabsView = selectedEstab
    ? pagamentos.filter(p => p.estabelecimento_id === selectedEstab)
    : []

  const estabSelected = selectedEstab
    ? estabelecimentos.find(e => e.id === selectedEstab)
    : null

  return (
    <div className="space-y-6">
      {/* HEADER STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Em dia', value: estabelecimentos.filter(e => getStatus(e) === 'em_dia').length, color: 'text-emerald-400' },
          { label: 'Vencendo', value: estabelecimentos.filter(e => getStatus(e) === 'vencendo').length, color: 'text-amber-400' },
          { label: 'Inadimplentes', value: estabelecimentos.filter(e => getStatus(e) === 'inadimplente').length, color: 'text-rose-400' },
          { label: 'Sem pagamento', value: estabelecimentos.filter(e => getStatus(e) === 'sem_pagamento').length, color: 'text-slate-400' },
        ].map((s, i) => (
          <div key={i} className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">{s.label}</p>
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* LISTA DE ESTABELECIMENTOS */}
      <div className="rounded-2xl border border-white/5 bg-slate-900/50 overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Status de Assinatura por Estabelecimento</p>
        </div>
        <div className="divide-y divide-white/5">
          {estabelecimentos.map(estab => {
            const statusKey = getStatus(estab)
            const statusCfg = STATUS_PAG[statusKey]
            const ultimo = getUltimoPagamento(estab.id)
            return (
              <div key={estab.id} className="flex items-center gap-3 p-4 hover:bg-white/2 transition-all">
                <div className="w-9 h-9 rounded-xl bg-emerald-900/40 border border-emerald-700/30 flex items-center justify-center text-sm font-black text-emerald-400 flex-shrink-0">
                  {estab.nome.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{estab.nome}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {ultimo ? `Último pag: ${new Date(ultimo.pago_em).toLocaleDateString('pt-BR')} — ${ultimo.referencia}` : 'Sem pagamentos registrados'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold border ${statusCfg.bg} ${statusCfg.border} ${statusCfg.color}`}>
                    {statusCfg.label}
                  </span>
                  {/* Botão histórico */}
                  <button
                    onClick={() => setSelectedEstab(selectedEstab === estab.id ? null : estab.id)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                    title="Ver histórico"
                  >
                    <History size={13}/>
                  </button>
                  {/* Botão cobrar por WhatsApp */}
                  <a
                    href={buildWhatsApp(estab)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-emerald-900/30 hover:bg-emerald-800/50 text-emerald-400 border border-emerald-700/30 transition-all"
                    title="Disparar cobrança no WhatsApp"
                  >
                    <MessageCircle size={13}/>
                  </a>
                  {/* Botão confirmar pagamento */}
                  <button
                    onClick={() => { setConfirmModal(estab); setGoFaturamento(null); setSaved(null) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all"
                  >
                    <DollarSign size={12}/> Pago
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* HISTÓRICO DO ESTABELECIMENTO SELECIONADO */}
      {selectedEstab && estabSelected && (
        <div className="rounded-2xl border border-white/5 bg-slate-900/50 overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">{estabSelected.nome}</p>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Histórico de Pagamentos</p>
            </div>
            <button onClick={() => setSelectedEstab(null)} className="text-slate-500 hover:text-white">
              <X size={16}/>
            </button>
          </div>
          {loadingPag ? (
            <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : estabsView.length === 0 ? (
            <div className="p-8 text-center text-slate-600 text-sm">Nenhum pagamento registrado.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {estabsView.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-900/20 flex items-center justify-center text-emerald-400">
                    <DollarSign size={14}/>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">{p.referencia}</p>
                    <p className="text-xs text-slate-500">{p.metodo_pagamento.toUpperCase()} • {new Date(p.pago_em).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <p className="text-emerald-400 font-bold text-sm">{formatCurrency(p.valor)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: CONFIRMAR PAGAMENTO */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">

            {/* Etapa 1: Preencher dados */}
            {goFaturamento === null && (
              <>
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white">Confirmar Recebimento</p>
                    <p className="text-xs text-slate-500 truncate max-w-xs">{confirmModal.nome}</p>
                  </div>
                  <button onClick={() => setConfirmModal(null)} className="text-slate-500 hover:text-white"><X size={18}/></button>
                </div>
                <div className="p-5 space-y-4">
                  {/* Valor */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Valor Recebido (R$)</label>
                    <input
                      type="text"
                      value={form.valor}
                      onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50 text-sm"
                      placeholder="49,90"
                    />
                  </div>
                  {/* Referência */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Referência (mês/período)</label>
                    <input
                      type="text"
                      value={form.referencia}
                      onChange={e => setForm(p => ({ ...p, referencia: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50 text-sm"
                      placeholder="Junho/2026"
                    />
                  </div>
                  {/* Método */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Forma de Pagamento</label>
                    <div className="grid grid-cols-4 gap-2">
                      {METODOS.map(m => (
                        <button
                          key={m.value}
                          onClick={() => setForm(p => ({ ...p, metodo: m.value as any }))}
                          className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-xs font-bold border transition-all ${
                            form.metodo === m.value
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-slate-800 border-white/5 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {m.icon} {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Observações */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Observações (opcional)</label>
                    <input
                      type="text"
                      value={form.observacoes}
                      onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                      className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50 text-sm"
                      placeholder="Ex: Pago via PIX Viana"
                    />
                  </div>
                </div>
                <div className="p-5 border-t border-white/5 flex gap-3">
                  <button
                    onClick={() => setConfirmModal(null)}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmar}
                    disabled={saving || !form.valor || !form.referencia}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle size={14}/>}
                    Confirmar Pago
                  </button>
                </div>
              </>
            )}

            {/* Etapa 2: Pergunta pós-confirmação */}
            {goFaturamento === true && (
              <>
                <div className="p-6 text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                    <CheckCircle size={28} className="text-emerald-400"/>
                  </div>
                  <div>
                    <p className="font-bold text-white text-lg">Pagamento registrado!</p>
                    <p className="text-slate-400 text-sm mt-1">
                      <span className="font-bold text-emerald-400">{confirmModal?.nome}</span> teve a assinatura renovada.
                    </p>
                  </div>
                  <p className="text-slate-500 text-sm">Deseja ver o histórico de faturamento deste estabelecimento?</p>
                </div>
                <div className="p-5 border-t border-white/5 flex gap-3">
                  <button
                    onClick={() => { setConfirmModal(null); setGoFaturamento(null) }}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 transition-all"
                  >
                    Não, fechar
                  </button>
                  <button
                    onClick={() => {
                      setSelectedEstab(confirmModal?.id || null)
                      setConfirmModal(null)
                      setGoFaturamento(null)
                    }}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
                  >
                    Ver Faturamento <ArrowRight size={14}/>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ========================
// MAIN COMPONENT
// ========================
export function SuperAdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('aba') as Tab) || 'dashboard'
  const setActiveTab = (tab: Tab) => setSearchParams({ aba: tab }, { replace: true })
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([])
  const [stats, setStats] = useState<Stats>({ totalEstabs: 0, estabsAtivos: 0, estabsPro: 0, estabsPremium: 0, totalStaff: 0, totalTransacoes: 0, totalReceita: 0, realSaasReceita: 0 })
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [saasConfig, setSaasConfig] = useState<any>(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [estabRes, staffRes, transRes, saasPagRes, configRes] = await Promise.all([
        supabase.from('estabelecimentos').select('*').order('created_at', { ascending: false }),
        supabase.from('membros_equipe').select('id', { count: 'exact', head: true }),
        supabase.from('transacoes').select('valor, tipo').eq('excluido', false),
        supabase.from('saas_pagamentos').select('valor').eq('status', 'pago'),
        supabase.from('saas_configuracoes').select('saas_nome').limit(1).maybeSingle(),
      ])

      const estabs: Estabelecimento[] = estabRes.data || []
      setEstabelecimentos(estabs)
      setSaasConfig(configRes.data)

      const totalReceita = (transRes.data || [])
        .filter(t => t.tipo === 'receita')
        .reduce((acc, t) => acc + Number(t.valor), 0)

      const realSaasReceita = (saasPagRes.data || [])
        .reduce((acc, p) => acc + Number(p.valor), 0)

      setStats({
        totalEstabs: estabs.length,
        estabsAtivos: estabs.filter(e => e.status_assinatura === 'ativo').length,
        estabsPro: estabs.filter(e => e.plano === 'pro').length,
        estabsPremium: estabs.filter(e => e.plano === 'premium').length,
        totalStaff: staffRes.count || 0,
        totalTransacoes: transRes.data?.length || 0,
        totalReceita,
        realSaasReceita,
      })
    } catch (err) {
      console.error('Erro ao buscar dados do Super Admin:', err)
      alert('Erro ao carregar o painel. Veja o console para detalhes.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { fetchData() }, [])

  const TABS: { id: Tab, label: string, icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'estabelecimentos', label: 'Estabelecimentos', icon: Store },
    { id: 'faturamento', label: 'Faturamento', icon: DollarSign },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col lg:flex-row">

      {/* SIDEBAR - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900/60 border-r border-white/5 p-5 sticky top-0 h-screen">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Shield size={20} />
          </div>
          <div className="min-w-0">
            <p className="font-black text-sm text-white leading-none truncate">{saasConfig?.saas_nome || 'GFin'}</p>
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest leading-none mt-1">Super Admin</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1">
          {TABS.map(t => {
            const Icon = t.icon
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left ${active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
              >
                <Icon size={16} />
                {t.label}
                {t.id === 'estabelecimentos' && (
                  <span className="ml-auto text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-lg font-bold">{estabelecimentos.length}</span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/5 pt-4 mt-4">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 transition-all"
          >
            <LogOut size={16} />
            Sair do Sistema
          </button>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-white/5 sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center flex-shrink-0">
            <Shield size={16} />
          </div>
          <div className="min-w-0">
            <p className="font-black text-xs text-white leading-none truncate">{saasConfig?.saas_nome || 'GFin'}</p>
            <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mt-0.5">Super Admin</p>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 text-slate-400"
        >
          {sidebarOpen ? <X size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* MOBILE DROPDOWN MENU */}
      {sidebarOpen && (
        <div className="lg:hidden bg-slate-900/95 border-b border-white/5 px-4 py-3 space-y-1 backdrop-blur-md">
          {TABS.map(t => {
            const Icon = t.icon
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); setSidebarOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left ${active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
              >
                <Icon size={16} />
                {t.label}
              </button>
            )
          })}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-rose-400 transition-all"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 p-4 lg:p-8 overflow-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl lg:text-2xl font-black text-white">
              {TABS.find(t => t.id === activeTab)?.label}
            </h1>
            <p className="text-xs text-slate-600 font-bold uppercase tracking-widest mt-0.5">
              GFin SaaS — Painel Administrativo Global
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-bold transition-all border border-white/5"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        {/* TAB CONTENT */}
        {activeTab === 'dashboard' && (
          <DashboardTab estabelecimentos={estabelecimentos} stats={stats} loading={loading} />
        )}
        {activeTab === 'estabelecimentos' && (
          <EstabelecimentosTab estabelecimentos={estabelecimentos} onUpdate={fetchData} loading={loading} />
        )}
        {activeTab === 'faturamento' && (
          <FaturamentoTab estabelecimentos={estabelecimentos} whatsappAdmin="" onUpdate={fetchData} />
        )}
        {activeTab === 'configuracoes' && <ConfiguracoesTab onSaved={fetchData} />}
      </main>

      {/* MOBILE BOTTOM NAV */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-md border-t border-white/5 flex items-center justify-around px-2 py-2 z-30">
        {TABS.map(t => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); setSidebarOpen(false) }}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all ${active ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-400'}`}
            >
              <Icon size={18} />
              <span className="text-[9px] font-bold uppercase tracking-wider">{t.label}</span>
            </button>
          )
        })}
      </nav>

    </div>
  )
}

// Fix typo alias
const Planobage = Planobage_ as any
function Planobage_({ plano }: { plano: keyof typeof PLANO_CONFIG }) {
  return <PlanosBadge plano={plano} />
}
function PlanosBadge({ plano }: { plano: keyof typeof PLANO_CONFIG }) {
  const cfg = PLANO_CONFIG[plano]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  )
}
