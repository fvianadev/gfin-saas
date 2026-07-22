import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/format'
import { compressImage, uploadImage, deleteOldImage } from '../lib/compressImage'
import {
  LayoutDashboard, Users, Store, Settings, LogOut, TrendingUp, TrendingDown,
  Shield, Search, ChevronDown, X, CheckCircle, Clock, AlertCircle,
  Edit3, Save, RefreshCw, ExternalLink, Crown, Zap, Star,
  Phone, Mail, Instagram, Globe, BarChart2, Activity, Package,
  DollarSign, MessageCircle, CalendarDays, CreditCard, Banknote, ArrowRight, History,
  Menu
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar
} from 'recharts'
import { AlertTriangle, Trash2, Camera, Plus } from 'lucide-react'

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
  valor_assinatura: number
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
  totalStaff: number
  totalTransacoes: number
  totalReceita: number
  realSaasReceita: number
}

type Tab = 'dashboard' | 'estabelecimentos' | 'faturamento' | 'configuracoes' | 'admins' | 'marketplace'

// ========================
// PLANO CONFIG
// ========================
const PLANO_CONFIG = {
  gratis: { label: 'Grátis (Teste)', icon: Package, color: 'text-slate-400', bg: 'bg-slate-800/60', border: 'border-slate-700/50' },
  pro: { label: 'Pro (Assinante)', icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-900/30', border: 'border-emerald-700/50' },
  premium: { label: 'Premium', icon: Crown, color: 'text-amber-400', bg: 'bg-amber-900/30', border: 'border-amber-700/50' },
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

function DashboardTab({ estabelecimentos, stats, loading, saasConfig }: {
  estabelecimentos: Estabelecimento[], stats: Stats, loading: boolean, saasConfig: SaasConfig | null
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
        <StatCard icon={Crown} label="Assinantes Pro" value={stats.estabsPro} sub="planos ativos" color="amber" />
        <StatCard icon={Users} label="Total Staff" value={stats.totalStaff} sub="colaboradores" color="violet" />
        <StatCard icon={TrendingUp} label="Receita SaaS Real" value={`R$ ${stats.realSaasReceita.toFixed(2).replace('.', ',')}`} sub={`Estimativa mensal: R$ ${(stats.estabsPro * (saasConfig?.valor_assinatura ?? 0)).toFixed(2).replace('.', ',')}`} color="blue" />
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
              <div className="w-9 h-9 rounded-xl bg-emerald-900/40 border border-emerald-700/30 flex-shrink-0 relative overflow-hidden">
                {e.configuracoes?.logo_url && (
                  <img
                    src={e.configuracoes.logo_url}
                    alt={e.nome}
                    className="w-full h-full object-cover absolute inset-0 z-10"
                    onError={el => { (el.currentTarget as HTMLImageElement).style.display = 'none' }}
                  />
                )}
                <div className="w-full h-full flex items-center justify-center text-sm font-black text-emerald-400">
                  {e.nome.charAt(0)}
                </div>
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

  const [deleteModal, setDeleteModal] = useState<Estabelecimento | null>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

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

  const handleDeleteConfirm = async () => {
    if (!deleteModal || deleteConfirmText !== deleteModal.slug) return
    setIsDeleting(true)
    
    // Call the RPC to delete the user which cascades to the establishment
    const { error } = await supabase.rpc('delete_saas_user', { target_user_id: deleteModal.owner_id })
    
    setIsDeleting(false)
    if (!error) {
      setDeleteModal(null)
      onUpdate()
    } else {
      alert("Erro ao excluir: " + error.message)
    }
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
                <div className="w-10 h-10 rounded-xl bg-emerald-900/40 border border-emerald-700/30 flex-shrink-0 relative overflow-hidden">
                  {e.configuracoes?.logo_url && (
                    <img
                      src={e.configuracoes.logo_url}
                      alt={e.nome}
                      className="w-full h-full object-cover absolute inset-0 z-10"
                      onError={el => { (el.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                  <div className="w-full h-full flex items-center justify-center text-sm font-black text-emerald-400">
                    {e.nome.charAt(0)}
                  </div>
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

                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => { setDeleteModal(e); setDeleteConfirmText('') }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 hover:text-rose-400 text-rose-500 border border-rose-500/20 transition-all"
                  >
                    <Trash2 size={11} /> Excluir
                  </button>
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

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8">
            <div className="p-4 sm:p-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-white text-base sm:text-lg">Confirme a exclusão de {deleteModal.nome}</h3>
              <button onClick={() => setDeleteModal(null)} className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all"><X size={18}/></button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <div className="flex items-start sm:items-center gap-3 p-3 sm:p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 font-bold text-sm">
                <AlertTriangle size={20} className="flex-shrink-0 mt-0.5 sm:mt-0" /> 
                <span>Esta ação não pode ser desfeita.</span>
              </div>

              <div className="text-sm text-slate-300 space-y-3">
                <p>Isso excluirá permanentemente o estabelecimento <strong>{deleteModal.nome}</strong> e <strong>TODOS</strong> os seus dados, incluindo transações, membros, serviços e configurações.</p>
                <p>O usuário dono (<strong>{deleteModal.email_dono}</strong>) também será <strong>excluído permanentemente</strong> do sistema.</p>
              </div>

              <div className="bg-slate-950 p-4 sm:p-5 rounded-xl border border-white/5 mt-4">
                <label className="text-xs sm:text-sm font-bold text-slate-400 mb-2 sm:mb-3 block">Digite <strong className="text-white select-all">{deleteModal.slug}</strong> para confirmar.</label>
                <input 
                  type="text" 
                  value={deleteConfirmText} 
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder={deleteModal.slug}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-rose-500 transition-all text-sm font-mono"
                />
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-white/5 bg-slate-900/50 flex flex-col sm:flex-row justify-end gap-3">
              <button 
                onClick={() => setDeleteModal(null)} 
                className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all order-2 sm:order-1"
              >
                Cancelar
              </button>
              <button 
                disabled={deleteConfirmText.trim() !== deleteModal.slug || isDeleting}
                onClick={handleDeleteConfirm}
                className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 order-1 sm:order-2"
              >
                {isDeleting ? <RefreshCw className="animate-spin" size={16}/> : <Trash2 size={16}/>}
                Entendi, exclua este estabelecimento.
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, icon: Icon, placeholder, type = 'text', onBlur }: {
  label: string, value: string, onChange: (val: string) => void, icon: any, placeholder?: string, type?: string, onBlur?: () => void
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
        onBlur={onBlur}
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

  const [valorInput, setValorInput] = useState('')
  useEffect(() => {
    if (form.valor_assinatura !== undefined) {
      setValorInput(form.valor_assinatura.toFixed(2).replace('.', ','))
    }
  }, [form.valor_assinatura])

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      const { id, created_at, updated_at, ...updateData } = form as any
      updateData.valor_assinatura = parseFloat(valorInput.replace(',', '.')) || 0
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
        <Field label="Valor da Assinatura Mensal (R$)" value={valorInput} onChange={setValorInput} icon={DollarSign} placeholder="Ex: 49,90" type="text" onBlur={() => setForm(prev => ({ ...prev, valor_assinatura: parseFloat(valorInput.replace(',', '.')) || 0 }))} />
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
function FaturamentoTab({ estabelecimentos, saasConfig, whatsappAdmin, onUpdate }: {
  estabelecimentos: Estabelecimento[]
  saasConfig: SaasConfig | null
  whatsappAdmin: string
  onUpdate?: () => void
}) {
  const [pagamentos, setPagamentos] = useState<SaasPagamento[]>([])
  const [loadingPag, setLoadingPag] = useState(true)
  const [confirmModal, setConfirmModal] = useState<Estabelecimento | null>(null)
  const [goFaturamento, setGoFaturamento] = useState<boolean | null>(null)
  const valorPadrao = (saasConfig?.valor_assinatura ?? 0).toFixed(2).replace('.', ',')
  const [form, setForm] = useState({ valor: valorPadrao, referencia: '', metodo: 'pix' as const, observacoes: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [selectedEstab, setSelectedEstab] = useState<string | null>(null)

  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  const [refMes, setRefMes] = useState(() => {
    const m = new Date().toLocaleDateString('pt-BR', { month: 'long' })
    return m.charAt(0).toUpperCase() + m.slice(1)
  })
  const [refAno, setRefAno] = useState(() => String(new Date().getFullYear()))

  useEffect(() => {
    setForm(prev => ({ ...prev, referencia: `${refMes}/${refAno}`, valor: (saasConfig?.valor_assinatura ?? 0).toFixed(2).replace('.', ',') }))
    fetchPagamentos()
  }, [])

  useEffect(() => {
    setForm(prev => ({ ...prev, referencia: `${refMes}/${refAno}` }))
  }, [refMes, refAno])

  useEffect(() => {
    setForm(prev => ({ ...prev, valor: (saasConfig?.valor_assinatura ?? 0).toFixed(2).replace('.', ',') }))
  }, [saasConfig])

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

    // Verificar se já existe pagamento para esta empresa + referência
    const { data: duplicado } = await supabase
      .from('saas_pagamentos')
      .select('id')
      .eq('estabelecimento_id', confirmModal.id)
      .eq('referencia', form.referencia)
      .maybeSingle()

    if (duplicado) {
      alert(`Já existe um pagamento registrado para "${confirmModal.nome}" referente a "${form.referencia}".`)
      setSaving(false)
      return
    }

    const { error } = await supabase.from('saas_pagamentos').insert({
      estabelecimento_id: confirmModal.id,
      valor,
      referencia: form.referencia,
      metodo_pagamento: form.metodo,
      observacoes: form.observacoes || null,
      status: 'pago',
      pago_em: new Date().toISOString(),
    })
    if (!error) {
      const hoje = new Date()
      const dataUltimo = hoje.toISOString().split('T')[0]
      
      // Próxima cobrança daqui a 30 dias
      const proximaCobranca = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      // Atualizar status do estabelecimento e limpar trial
      await supabase.from('estabelecimentos').update({
        plano: 'pro',
        status_assinatura: 'ativo',
        data_ultimo_pagamento: dataUltimo,
        data_proxima_cobranca: proximaCobranca,
        trial_active: false,
        trial_start: null,
        trial_end: null,
      }).eq('id', confirmModal.id)
      setSaved(confirmModal.id)
      fetchPagamentos()
      onUpdate?.()
      setSaving(false)
      setGoFaturamento(true)
    } else {
      console.error('Erro ao inserir pagamento:', error)
      alert('Erro ao registrar pagamento: ' + error.message)
      setSaving(false)
    }
  }

  const handleDeletePagamento = async (pagamento: SaasPagamento, estabNome: string) => {
    if (!confirm(`Excluir pagamento de ${pagamento.referencia} de ${estabNome}?`)) return
    const { error } = await supabase.from('saas_pagamentos').delete().eq('id', pagamento.id)
    if (!error) {
      fetchPagamentos()
      onUpdate?.()
    }
  }

  const METODOS = [
    { value: 'pix', label: 'PIX', icon: <CreditCard size={14}/> },
    { value: 'dinheiro', label: 'Dinheiro', icon: <Banknote size={14}/> },
    { value: 'cartao', label: 'Cartão', icon: <CreditCard size={14}/> },
    { value: 'manual', label: 'Outro', icon: <DollarSign size={14}/> },
  ]

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
      <div className="rounded-2xl border border-white/5 bg-slate-900/50">
        <div className="p-4 border-b border-white/5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Status de Assinatura por Estabelecimento</p>
        </div>
        <div className="divide-y divide-white/5">
          {estabelecimentos.map(estab => {
            const statusKey = getStatus(estab)
            const statusCfg = STATUS_PAG[statusKey]
            const ultimo = getUltimoPagamento(estab.id)
            const expanded = selectedEstab === estab.id
            return (
              <div key={estab.id}>
                <div className="flex items-center gap-3 p-4 hover:bg-white/2 transition-all">
                  <div className="w-9 h-9 rounded-xl bg-emerald-900/40 border border-emerald-700/30 flex-shrink-0 relative overflow-hidden">
                    {estab.configuracoes?.logo_url && (
                      <img
                        src={estab.configuracoes.logo_url}
                        alt={estab.nome}
                        className="w-full h-full object-cover absolute inset-0 z-10"
                        onError={el => { (el.currentTarget as HTMLImageElement).style.display = 'none' }}
                      />
                    )}
                    <div className="w-full h-full flex items-center justify-center text-sm font-black text-emerald-400">
                      {estab.nome.charAt(0)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{estab.nome}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {ultimo ? `Último pag: ${new Date(ultimo.pago_em).toLocaleDateString('pt-BR')} — ${ultimo.referencia}` : 'Sem pagamentos registrados'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold border ${statusCfg.bg} ${statusCfg.border} ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                    {/* Botão histórico */}
                    <button
                      onClick={() => setSelectedEstab(selectedEstab === estab.id ? null : estab.id)}
                      className={`p-1.5 rounded-lg transition-all ${expanded ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'}`}
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
                      onClick={() => {
                      const m = new Date().toLocaleDateString('pt-BR', { month: 'long' })
                      setRefMes(m.charAt(0).toUpperCase() + m.slice(1))
                      setRefAno(String(new Date().getFullYear()))
                      setConfirmModal(estab); setGoFaturamento(null); setSaved(null); setForm(prev => ({ ...prev, valor: (saasConfig?.valor_assinatura ?? 0).toFixed(2).replace('.', ',') }))
                    }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all"
                    >
                      <DollarSign size={12}/> Receber
                    </button>
                  </div>
                </div>

                {/* Histórico expansível */}
                {expanded && (
                  <div className="border-t border-white/5 bg-slate-950/50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Histórico de Pagamentos</p>
                    </div>
                    {(() => {
                      const estabHistory = pagamentos.filter(p => p.estabelecimento_id === estab.id)
                      if (loadingPag) return (
                        <div className="p-6 text-center"><div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
                      )
                      if (estabHistory.length === 0) return (
                        <div className="p-6 text-center text-slate-600 text-sm">Nenhum pagamento registrado.</div>
                      )
                      return (
                        <div className="divide-y divide-white/5">
                          {estabHistory.map(p => (
                            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                              <div className="w-8 h-8 rounded-lg bg-emerald-900/20 flex items-center justify-center text-emerald-400">
                                <DollarSign size={14}/>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-bold text-white">{p.referencia}</p>
                                <p className="text-xs text-slate-500">{p.metodo_pagamento.toUpperCase()} • {new Date(p.pago_em).toLocaleDateString('pt-BR')}</p>
                              </div>
                              <p className="text-emerald-400 font-bold text-sm">{formatCurrency(p.valor)}</p>
                              <button
                                onClick={() => handleDeletePagamento(p, estab.nome)}
                                className="p-1.5 rounded-lg bg-rose-900/20 hover:bg-rose-800/40 text-rose-400 transition-all"
                                title="Excluir pagamento"
                              >
                                <Trash2 size={13}/>
                              </button>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

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
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Referência (mês/ano)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={refMes}
                        onChange={e => setRefMes(e.target.value)}
                        className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50 text-sm cursor-pointer"
                      >
                        {meses.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <select
                        value={refAno}
                        onChange={e => setRefAno(e.target.value)}
                        className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50 text-sm cursor-pointer"
                      >
                        {Array.from({ length: 10 }, (_, i) => String(new Date().getFullYear() - 2 + i)).map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
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
                    Confirmar Recebimento
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
// ADMINS TAB
// ========================
interface SaasAdmin {
  id: string
  email: string
  created_at: string
}

function AdminsTab({ currentUserId }: { currentUserId: string }) {
  const [admins, setAdmins] = useState<SaasAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addSenha, setAddSenha] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  const fetchAdmins = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('saas_admins')
      .select('id, email, created_at')
      .order('created_at', { ascending: true })
    setAdmins(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchAdmins() }, [])

  const handleDelete = async (admin: SaasAdmin) => {
    if (!confirm(`Excluir permanentemente o admin "${admin.email}"?\n\nEsta ação removerá o usuário completamente do sistema (Auth + banco de dados) e não pode ser desfeita.`)) return
    setDeletingId(admin.id)
    const { error } = await supabase.rpc('delete_saas_user', { target_user_id: admin.id })
    if (error) {
      alert('Erro ao excluir admin: ' + error.message)
    } else {
      fetchAdmins()
    }
    setDeletingId(null)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError('')
    if (!addEmail.includes('@')) { setAddError('Informe um e-mail válido.'); return }
    if (addSenha.length < 6) { setAddError('A senha deve ter no mínimo 6 caracteres.'); return }
    setAdding(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: addEmail,
        password: addSenha,
      })
      if (authError) {
        const lower = authError.message?.toLowerCase() || '';
        if (lower.includes('confirmation') || lower.includes('smtp') || lower.includes('failed to send')) {
          throw new Error('Erro ao enviar e‑mail de confirmação. Verifique as configurações de Auth (SMTP) no painel do Supabase ou desative a confirmação de e‑mail para testes.');
        }
        throw authError;
      }
      if (!authData.user) throw new Error('Falha ao criar usuário.')
      const { data: newAdmin, error: rpcError } = await supabase
        .rpc('add_saas_admin', { p_email: addEmail })
      if (rpcError) throw rpcError
      setShowAddModal(false)
      setAddEmail('')
      setAddSenha('')
      fetchAdmins()
      alert(`✅ Admin "${addEmail}" adicionado com sucesso!`)
    } catch (err: any) {
      setAddError(err?.message || 'Erro ao adicionar admin.')
    } finally {
      setAdding(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header com botão de adicionar */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
          {admins.length} admin{admins.length !== 1 ? 's' : ''} cadastrado{admins.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-white transition-all shadow-lg shadow-emerald-500/20"
        >
          <Shield size={14} /> Adicionar novo Admin
        </button>
      </div>

      {/* Aviso informativo */}
      <div className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-sm">
        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
        <span>Excluir um admin o remove <strong>permanentemente do sistema</strong> — incluindo o acesso de autenticação (Auth). Esta ação não pode ser desfeita.</span>
      </div>

      {/* Lista */}
      <div className="rounded-2xl border border-white/5 bg-slate-900/50 overflow-hidden">
        {admins.length === 0 ? (
          <div className="p-10 text-center text-slate-600">
            <Shield size={36} className="mx-auto mb-3 opacity-20" />
            <p className="font-bold">Nenhum admin cadastrado.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {admins.map(admin => {
              const isSelf = admin.id === currentUserId
              return (
                <div key={admin.id} className="flex items-center gap-4 p-4 hover:bg-white/2 transition-all">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-emerald-900/40 border border-emerald-700/30 flex items-center justify-center text-sm font-black text-emerald-400 flex-shrink-0">
                    {admin.email.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white truncate">{admin.email}</p>
                      {isSelf && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          <Crown size={9} /> Você
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Admin desde {new Date(admin.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  </div>

                  {/* Ação */}
                  {isSelf ? (
                    <span
                      title="Você não pode remover a si mesmo"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800/50 text-slate-600 border border-slate-700/30 cursor-not-allowed"
                    >
                      <Trash2 size={11} /> Remover
                    </span>
                  ) : (
                    <button
                      onClick={() => handleDelete(admin)}
                      disabled={deletingId === admin.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 hover:text-rose-400 text-rose-500 border border-rose-500/20 transition-all disabled:opacity-50"
                    >
                      {deletingId === admin.id
                        ? <RefreshCw size={11} className="animate-spin" />
                        : <Trash2 size={11} />}
                      Remover
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal Adicionar Admin */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl my-8">
            <div className="p-4 sm:p-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-bold text-white text-base sm:text-lg">Adicionar novo Admin</h3>
              <button onClick={() => { setShowAddModal(false); setAddError('') }} className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all"><X size={18}/></button>
            </div>
            <form onSubmit={handleAdd} className="p-4 sm:p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">E-mail do novo admin</label>
                <input
                  required type="email" value={addEmail}
                  onChange={e => setAddEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50 transition-all"
                  placeholder="admin@exemplo.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Senha inicial</label>
                <input
                  required type="password" value={addSenha}
                  onChange={e => setAddSenha(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500/50 transition-all"
                  placeholder="mínimo 6 caracteres"
                />
              </div>
              {addError && (
                <div className="bg-rose-600/20 border border-rose-600 text-rose-200 rounded-xl p-3 text-xs">{addError}</div>
              )}
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setAddError('') }}
                  className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all order-2 sm:order-1"
                >
                  Cancelar
                </button>
                <button
                  disabled={adding}
                  className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-white disabled:opacity-50 transition-all flex items-center justify-center gap-2 order-1 sm:order-2"
                >
                  {adding ? <RefreshCw className="animate-spin" size={16} /> : <Shield size={16} />}
                  {adding ? 'Adicionando...' : 'Adicionar Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ========================
// MARKETPLACE TAB
// ========================

interface MarketplaceDestaque {
  id: string
  estabelecimento_id: string
  imagem_url: string | null
  premium: boolean
  ordem: number
  ativo: boolean
  dados: Record<string, any>
}

function MarketplaceTab({ estabelecimentos, onUpdate }: {
  estabelecimentos: Estabelecimento[]
  onUpdate: () => void
}) {
  const [destaques, setDestaques] = useState<MarketplaceDestaque[]>([])
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState<{
    estab: Estabelecimento
    destaque?: MarketplaceDestaque
  } | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const fetchDestaques = async () => {
    setLoading(true)
    const { data } = await supabase.from('marketplace_destaques').select('*')
    setDestaques(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchDestaques() }, [])

  // Only show Pro establishments
  const proEstabs = estabelecimentos.filter(e => e.plano === 'pro')

  const getDestaque = (estabId: string) => destaques.find(d => d.estabelecimento_id === estabId)

  const handleToggle = async (estab: Estabelecimento, current?: MarketplaceDestaque) => {
    setSavingId(estab.id)
    if (current) {
      // Desativar
      await supabase.from('marketplace_destaques').update({ ativo: !current.ativo }).eq('id', current.id)
    } else {
      // Ativar (criar)
      await supabase.from('marketplace_destaques').insert({
        estabelecimento_id: estab.id,
        ativo: true,
      })
    }
    await Promise.all([fetchDestaques(), onUpdate()])
    setSavingId(null)
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Assinantes Pro</p>
          <p className="text-3xl font-black text-white">{proEstabs.length}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">No Marketplace</p>
          <p className="text-3xl font-black text-emerald-400">{destaques.filter(d => d.ativo).length}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">Premium</p>
          <p className="text-3xl font-black text-amber-400">{destaques.filter(d => d.premium).length}</p>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {proEstabs.length === 0 && (
            <div className="text-center py-16 text-slate-600">
              <Star size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-bold">Nenhum assinante Pro ainda.</p>
              <p className="text-sm mt-1">Estabelecimentos com plano Pro aparecerão aqui.</p>
            </div>
          )}
          {proEstabs.map(estab => {
            const destaque = getDestaque(estab.id)
            const ativo = destaque?.ativo ?? false
            return (
              <div
                key={estab.id}
                className={`rounded-2xl border bg-slate-900/50 p-4 transition-all hover:border-white/10 ${savingId === estab.id ? 'opacity-50 pointer-events-none' : 'border-white/5'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-900/40 border border-emerald-700/30 flex-shrink-0 relative overflow-hidden">
                    {estab.configuracoes?.logo_url && (
                      <img
                        src={estab.configuracoes.logo_url}
                        alt={estab.nome}
                        className="w-full h-full object-cover absolute inset-0 z-10"
                        onError={el => { (el.currentTarget as HTMLImageElement).style.display = 'none' }}
                      />
                    )}
                    <div className="w-full h-full flex items-center justify-center text-sm font-black text-emerald-400">
                      {estab.nome.charAt(0)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-white truncate">{estab.nome}</p>
                      {destaque?.premium && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">
                          <Crown size={9} /> Premium
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">/{estab.slug}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {ativo ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <CheckCircle size={10} /> Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold bg-slate-800/60 border border-slate-700/30 text-slate-400">
                        Inativo
                      </span>
                    )}
                    <button
                      onClick={() => setEditModal({ estab, destaque })}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                      title="Editar"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => handleToggle(estab, destaque)}
                      disabled={savingId === estab.id}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        ativo
                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                    >
                      {ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL DE EDIÇÃO */}
      {editModal && (
        <MarketplaceEditModal
          estab={editModal.estab}
          destaque={editModal.destaque}
          onClose={() => setEditModal(null)}
          onSaved={() => {
            setEditModal(null)
            fetchDestaques()
            onUpdate()
          }}
        />
      )}
    </div>
  )
}

// ========================
// MARKETPLACE EDIT MODAL
// ========================

function MarketplaceEditModal({ estab, destaque, onClose, onSaved }: {
  estab: Estabelecimento
  destaque?: MarketplaceDestaque
  onClose: () => void
  onSaved: () => void
}) {
  const [imagemPreview, setImagemPreview] = useState<string | null>(
    destaque?.imagem_url || (estab.configuracoes as any)?.logo_url || null
  )
  const [imagemFile, setImagemFile] = useState<File | null>(null)
  const [premium, setPremium] = useState(destaque?.premium ?? false)
  const [ordem, setOrdem] = useState(destaque?.ordem ?? 0)
  const [ativo, setAtivo] = useState(destaque?.ativo ?? false)
  const [dados, setDados] = useState({ rating: 5, tags: [] as string[], horario: '', ...(destaque?.dados || {}) })
  const dadosRef = useRef(dados)
  dadosRef.current = dados
  const [tagsInput, setTagsInput] = useState('')
  const [saving, setSaving] = useState(false)

  const adicionarTags = () => {
    if (!tagsInput.trim()) return
    const novas = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    setDados(prev => {
      const existentes = prev.tags || []
      const unicas = novas.filter(n => !existentes.includes(n))
      return unicas.length ? { ...prev, tags: [...existentes, ...unicas] } : prev
    })
    setTagsInput('')
  }

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      adicionarTags()
    }
  }

  const handleRemoveTag = (tag: string) => {
    setDados(prev => ({ ...prev, tags: (prev.tags || []).filter((t: string) => t !== tag) }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      let finalImagemUrl = destaque?.imagem_url || null

      // Upload de nova imagem
      if (imagemFile) {
        const fileExt = imagemFile.name.split('.').pop()
        const uuid = crypto.randomUUID?.() || Math.random().toString(36).substring(2)
        const fileName = `${estab.id}/${uuid}.${fileExt}`
        finalImagemUrl = await uploadImage(supabase, imagemFile, 'marketplace', fileName)

        // Garbage collection: remove imagem antiga do marketplace
        if (destaque?.imagem_url && destaque.imagem_url !== finalImagemUrl) {
          deleteOldImage(supabase, 'marketplace', destaque.imagem_url)
        }
      }

      const payload = {
        estabelecimento_id: estab.id,
        imagem_url: finalImagemUrl,
        premium,
        ordem,
        ativo,
        dados: dadosRef.current,
      }

      if (destaque?.id) {
        await supabase.from('marketplace_destaques').update(payload).eq('id', destaque.id)
      } else {
        await supabase.from('marketplace_destaques').upsert(payload, {
          onConflict: 'estabelecimento_id',
        })
      }

      onSaved()
    } catch (err: any) {
      alert('Erro ao salvar: ' + (err.message || JSON.stringify(err)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl my-8">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-lg">Editar Card</h3>
            <p className="text-xs text-slate-500">{estab.nome}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Imagem */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Camera size={10} className="text-emerald-500" /> Imagem do Card
            </label>
            <div className="flex items-center gap-4 bg-slate-800/50 rounded-xl p-4 border border-white/5">
              <div className="w-24 h-16 rounded-xl border border-white/10 bg-slate-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                {imagemPreview ? (
                  <img
                    src={imagemPreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <span className="text-slate-600 text-xs text-center px-1">Sem imagem</span>
                )}
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <label
                  htmlFor="mp-image-upload"
                  className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium text-slate-300 transition-colors border border-white/10"
                >
                  <Camera size={14} /> {imagemPreview ? 'Alterar' : 'Upload'}
                </label>
                <input
                  id="mp-image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setImagemFile(file)
                      setImagemPreview(URL.createObjectURL(file))
                    }
                  }}
                />
                {imagemFile && <p className="text-[10px] text-emerald-400 truncate">{imagemFile.name}</p>}
                {destaque?.imagem_url && (
                  <button
                    type="button"
                    className="text-[10px] text-rose-400 hover:text-rose-300 text-left transition-colors"
                    onClick={() => {
                      deleteOldImage(supabase, 'marketplace', destaque.imagem_url!)
                      setImagemPreview(null)
                      setImagemFile(null)
                    }}
                  >
                    Remover imagem
                  </button>
                )}
              </div>
            </div>
            <p className="text-[10px] text-slate-600">
              Se não definir imagem, usará a logo do estabelecimento. Máx 5MB.
            </p>
          </div>

          {/* Rating */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rating (0.0 - 5.0)</label>
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={dados.rating ?? 5}
              onChange={e => setDados(prev => ({ ...prev, rating: Math.min(5, Math.max(0, parseFloat(e.target.value) || 0)) }))}
              className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50 text-sm"
            />
          </div>

          {/* Horário */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Horário de Exibição</label>
            <input
              type="text"
              value={dados.horario ?? ''}
              onChange={e => setDados(prev => ({ ...prev, horario: e.target.value }))}
              placeholder="Ex: 09:00 - 20:00"
              className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50 text-sm placeholder-slate-600"
            />
            <p className="text-[10px] text-slate-600">Texto livre. Se vazio, não exibe horário no card.</p>
          </div>

          {/* Premium toggle */}
          <div className="flex items-center justify-between bg-slate-800/50 rounded-xl p-4 border border-white/5">
            <div>
              <p className="text-sm font-bold text-white">Premium</p>
              <p className="text-[10px] text-slate-500">Exibe badge dourado "Premium" no card</p>
            </div>
            <button
              onClick={() => setPremium(!premium)}
              className={`w-12 h-7 rounded-full relative transition-all ${premium ? 'bg-amber-500' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-md ${premium ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tags de Serviços</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(dados.tags ?? []).map((tag: string) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                >
                  {tag}
                  <button onClick={() => handleRemoveTag(tag)} className="hover:text-white transition-colors">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagsInput}
                onChange={e => setTagsInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Ex: Corte, Barba, Hidratação"
                className="flex-1 bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-emerald-500/50 placeholder-slate-600"
              />
              <button
                onClick={adicionarTags}
                disabled={!tagsInput.trim()}
                className="px-4 py-3 rounded-xl text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>
          </div>

          {/* Ordem */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ordem no Carrossel</label>
            <input
              type="number"
              min={0}
              value={ordem}
              onChange={e => setOrdem(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-emerald-500/50 text-sm"
            />
          </div>

          {/* Ativo toggle */}
          <div className="flex items-center justify-between bg-slate-800/50 rounded-xl p-4 border border-white/5">
            <div>
              <p className="text-sm font-bold text-white">Ativo no Marketplace</p>
              <p className="text-[10px] text-slate-500">Exibir este card na landing page</p>
            </div>
            <button
              onClick={() => setAtivo(!ativo)}
              className={`w-12 h-7 rounded-full relative transition-all ${ativo ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-md ${ativo ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
        </div>

        <div className="p-5 border-t border-white/5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
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
  const [stats, setStats] = useState<Stats>({ totalEstabs: 0, estabsAtivos: 0, estabsPro: 0, totalStaff: 0, totalTransacoes: 0, totalReceita: 0, realSaasReceita: 0 })
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [saasConfig, setSaasConfig] = useState<any>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')

  const [authorized, setAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setAuthorized(false)
        return
      }
      setCurrentUserId(data.user.id)

      let { data: admin } = await supabase
        .from('saas_admins')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!admin && data.user.user_metadata?.is_saas_admin) {
        const { data: confirmed } = await supabase.rpc('confirm_saas_admin')
        if (confirmed) {
          admin = { id: data.user.id }
        }
      }

      setAuthorized(!!admin)
    })
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [estabRes, staffRes, transRes, saasPagRes, configRes] = await Promise.all([
        supabase.from('estabelecimentos').select('*').order('created_at', { ascending: false }),
        supabase.from('membros_equipe').select('id', { count: 'exact', head: true }),
        supabase.from('transacoes').select('valor, tipo').eq('excluido', false),
        supabase.from('saas_pagamentos').select('valor').eq('status', 'pago'),
        supabase.from('saas_configuracoes').select('*').limit(1).maybeSingle(),
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

  if (authorized === false) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white flex-col gap-4 p-4">
        <Shield size={48} className="text-rose-500" />
        <h1 className="text-2xl font-black">Acesso negado</h1>
        <p className="text-slate-400 text-sm">Você não tem permissão para acessar esta área.</p>
        <button onClick={onLogout} className="mt-4 px-6 py-2 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold transition-colors">
          Voltar ao Login
        </button>
      </div>
    )
  }

  if (authorized === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  const TABS: { id: Tab, label: string, icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'estabelecimentos', label: 'Estabelecimentos', icon: Store },
    { id: 'faturamento', label: 'Faturamento', icon: DollarSign },
    { id: 'marketplace', label: 'Marketplace', icon: Star },
    { id: 'admins', label: 'Admins', icon: Shield },
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
          {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      </div>

      {/* MOBILE OVERLAY MENU */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute top-16 right-3 left-3 bg-slate-900/95 border border-white/10 px-4 py-3 space-y-1 rounded-2xl shadow-2xl backdrop-blur-md">
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
          <DashboardTab estabelecimentos={estabelecimentos} stats={stats} loading={loading} saasConfig={saasConfig} />
        )}
        {activeTab === 'estabelecimentos' && (
          <EstabelecimentosTab estabelecimentos={estabelecimentos} onUpdate={fetchData} loading={loading} />
        )}
        {activeTab === 'faturamento' && (
          <FaturamentoTab estabelecimentos={estabelecimentos} saasConfig={saasConfig} whatsappAdmin="" onUpdate={fetchData} />
        )}
        {activeTab === 'admins' && <AdminsTab currentUserId={currentUserId} />}
        {activeTab === 'marketplace' && <MarketplaceTab estabelecimentos={estabelecimentos} onUpdate={fetchData} />}
        {activeTab === 'configuracoes' && <ConfiguracoesTab onSaved={fetchData} />}
      </main>

      {/* MOBILE BOTTOM NAV - só 3 primeiros + botão Mais */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-md border-t border-white/5 flex items-center justify-around px-2 py-2 z-30">
        {TABS.slice(0, 3).map(t => {
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
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all ${sidebarOpen ? 'text-emerald-400' : 'text-slate-600 hover:text-slate-400'}`}
        >
          <Menu size={18} />
          <span className="text-[9px] font-bold uppercase tracking-wider">Mais</span>
        </button>
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

