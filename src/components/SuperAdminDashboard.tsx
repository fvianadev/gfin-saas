import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/format'
import {
  LayoutDashboard, Users, Store, Settings, LogOut, TrendingUp, TrendingDown,
  Shield, Search, ChevronDown, X, CheckCircle, Clock, AlertCircle,
  Edit3, Save, RefreshCw, ExternalLink, Crown, Zap, Star,
  Phone, Mail, Instagram, Globe, BarChart2, Activity, Package
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
}

interface SaasConfig {
  id: number
  titulo_hero: string
  subtitulo_hero: string
  email_contato: string
  whatsapp_contato: string
  instagram_url: string
  created_at: string
  updated_at: string
}

interface Stats {
  totalEstabs: number
  estabsAtivos: number
  estabsPro: number
  estabsPremium: number
  totalStaff: number
  totalTransacoes: number
  totalReceita: number
}

type Tab = 'dashboard' | 'estabelecimentos' | 'configuracoes'

// ========================
// PLANO CONFIG
// ========================
const PLANO_CONFIG = {
  gratis: { label: 'Grátis', icon: Package, color: 'text-slate-400', bg: 'bg-slate-800/60', border: 'border-slate-700/50' },
  pro: { label: 'Pro', icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-900/30', border: 'border-emerald-700/50' },
  premium: { label: 'Premium', icon: Crown, color: 'text-amber-400', bg: 'bg-amber-900/30', border: 'border-amber-700/50' },
}

const STATUS_CONFIG = {
  ativo: { label: 'Ativo', icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-900/20', border: 'border-emerald-700/30' },
  pendente: { label: 'Pendente', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-900/20', border: 'border-amber-700/30' },
  inativo: { label: 'Inativo', icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-900/20', border: 'border-rose-700/30' },
}

const PIE_COLORS = ['#64748b', '#10b981', '#f59e0b']

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
  const cfg = PLANO_CONFIG[plano]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  )
}

function StatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const cfg = STATUS_CONFIG[status]
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
    { name: 'Grátis', value: estabelecimentos.filter(e => e.plano === 'gratis').length },
    { name: 'Pro', value: estabelecimentos.filter(e => e.plano === 'pro').length },
    { name: 'Premium', value: estabelecimentos.filter(e => e.plano === 'premium').length },
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
        <StatCard icon={Crown} label="Premium + Pro" value={stats.estabsPremium + stats.estabsPro} sub="planos pagos" color="amber" />
        <StatCard icon={Users} label="Total Staff" value={stats.totalStaff} sub="colaboradores" color="violet" />
        <StatCard icon={TrendingUp} label="Receita SaaS" value={`R$ ${((stats.estabsPro * 49) + (stats.estabsPremium * 99)).toFixed(2).replace('.', ',')}`} sub="estimativa mensal" color="blue" />
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
                <Planobage plano={e.plano} />
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
          <option value="gratis">Grátis</option>
          <option value="pro">Pro</option>
          <option value="premium">Premium</option>
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
                  {e.trial_active ? `Trial: ${new Date(e.trial_start).toLocaleDateString('pt-BR')} – ${new Date(e.trial_end).toLocaleDateString('pt-BR')}` : 'No trial'}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Plano */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-600 font-bold uppercase tracking-wider">Plano:</span>
                  <div className="flex gap-1">
                    {(['gratis', 'pro', 'premium'] as const).map(p => {
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

function ConfiguracoesTab() {
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
    const { id, created_at, updated_at, ...updateData } = form as any
    if (config?.id) {
      await supabase.from('saas_configuracoes').update({ ...updateData, updated_at: new Date().toISOString() }).eq('id', config.id)
    } else {
      await supabase.from('saas_configuracoes').insert(updateData)
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    fetchConfig()
  }

  const Field = ({ label, field, icon: Icon, placeholder, type = 'text' }: {
    label: string, field: keyof SaasConfig, icon: any, placeholder?: string, type?: string
  }) => (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
        <Icon size={10} className="text-emerald-500" /> {label}
      </label>
      <input
        type={type}
        value={(form[field] as string) || ''}
        onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
        placeholder={placeholder}
        className="w-full bg-slate-900/80 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-700 outline-none focus:border-emerald-500/50 transition-all"
      />
    </div>
  )

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

        <Field label="Título Principal (Hero)" field="titulo_hero" icon={Star} placeholder="Ex: GFin SaaS" />
        <Field label="Subtítulo (Hero)" field="subtitulo_hero" icon={Activity} placeholder="Ex: Gestão financeira para sua barbearia." />
      </div>

      <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-5 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Phone size={16} className="text-emerald-500" />
          <p className="font-bold text-white">Contatos</p>
        </div>

        <Field label="E-mail de Contato" field="email_contato" icon={Mail} placeholder="contato@seudominio.com" type="email" />
        <Field label="WhatsApp de Contato" field="whatsapp_contato" icon={Phone} placeholder="5511999999999" />
        <Field label="URL do Instagram" field="instagram_url" icon={Instagram} placeholder="https://instagram.com/seu_perfil" />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${saved ? 'bg-emerald-600 text-white' : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20'}`}
      >
        {saving ? <RefreshCw size={14} className="animate-spin" /> : saved ? <CheckCircle size={14} /> : <Save size={14} />}
        {saving ? 'Salvando...' : saved ? 'Salvo com sucesso!' : 'Salvar Configurações'}
      </button>
    </div>
  )
}

// ========================
// MAIN COMPONENT
// ========================
export function SuperAdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([])
  const [stats, setStats] = useState<Stats>({ totalEstabs: 0, estabsAtivos: 0, estabsPro: 0, estabsPremium: 0, totalStaff: 0, totalTransacoes: 0, totalReceita: 0 })
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [estabRes, staffRes, transRes] = await Promise.all([
        supabase.from('estabelecimentos').select('*').order('created_at', { ascending: false }),
        supabase.from('membros_equipe').select('id', { count: 'exact', head: true }),
        supabase.from('transacoes').select('valor, tipo').eq('excluido', false),
      ])

      const estabs: Estabelecimento[] = estabRes.data || []
      setEstabelecimentos(estabs)

      const totalReceita = (transRes.data || [])
        .filter(t => t.tipo === 'receita')
        .reduce((acc, t) => acc + Number(t.valor), 0)

      setStats({
        totalEstabs: estabs.length,
        estabsAtivos: estabs.filter(e => e.status_assinatura === 'ativo').length,
        estabsPro: estabs.filter(e => e.plano === 'pro').length,
        estabsPremium: estabs.filter(e => e.plano === 'premium').length,
        totalStaff: staffRes.count || 0,
        totalTransacoes: transRes.data?.length || 0,
        totalReceita,
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
          <div>
            <p className="font-black text-sm text-white leading-none">GFin</p>
            <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest leading-none">Super Admin</p>
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
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center">
            <Shield size={16} />
          </div>
          <div>
            <p className="font-black text-xs text-white leading-none">GFin</p>
            <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Super Admin</p>
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
        {activeTab === 'configuracoes' && <ConfiguracoesTab />}
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
