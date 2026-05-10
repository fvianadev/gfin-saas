import { useState, useEffect, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, Filter, ArrowUpRight, ArrowDownLeft, Trash2, Edit2, Plus, Users, DollarSign, LayoutDashboard, MoreVertical, PieChart, List, Settings, Copy, Link2, CheckCircle, MessageCircle, ShieldAlert, History, User, Scissors, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { TransactionModal } from './TransactionModal'
import { formatCurrency, formatDateTime } from '../lib/format'

interface AdminDashboardProps {
  onBack: () => void
  estabelecimentoId: string
  membroId: string
  cargo: 'administrador' | 'usuario'
}

type Periodo = 'hoje' | '7dias' | '30dias' | 'todos'
type Tab = 'resumo' | 'transacoes' | 'equipe' | 'config' | 'auditoria' | 'itens'

export function AdminDashboard({ onBack, estabelecimentoId, membroId, cargo }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('resumo')
  const [periodo, setPeriodo] = useState<Periodo>('30dias')
  
  const [transactions, setTransactions] = useState<any[]>([])
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'receita' | 'despesa'>('todos')
  const [searchTx, setSearchTx] = useState('')
  const [membros, setMembros] = useState<any[]>([])

  const { filteredTransactions, stats, chartData } = useMemo(() => {
    let filtered = transactions;

    if (tipoFiltro !== 'todos') {
      filtered = filtered.filter(t => t.tipo === tipoFiltro);
    }

    if (cargo === 'administrador' && searchTx.trim()) {
      const term = searchTx.toLowerCase().trim();
      filtered = filtered.filter(t => {
        const desc = (t.descricao || '').toLowerCase();
        const cat = (t.categoria || '').toLowerCase();
        const membro = (t.membros_equipe?.nome || '').toLowerCase();
        return desc.includes(term) || cat.includes(term) || membro.includes(term);
      });
    }

    const rec = filtered.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + Number(t.valor), 0)
    const des = filtered.filter(t => t.tipo === 'despesa').reduce((acc, t) => acc + Number(t.valor), 0)
    const totalVendas = filtered.filter(t => t.tipo === 'receita').length
    const calcStats = { receita: rec, despesa: des, lucro: rec - des, ticketMedio: totalVendas > 0 ? rec / totalVendas : 0 }

    const grouped = filtered.reduce((acc: any, t) => {
      const date = new Date(t.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      if (!acc[date]) acc[date] = { name: date, receita: 0, despesa: 0 }
      if (t.tipo === 'receita') acc[date].receita += Number(t.valor)
      else acc[date].despesa += Number(t.valor)
      return acc
    }, {})
    
    return {
      filteredTransactions: filtered,
      stats: calcStats,
      chartData: Object.values(grouped).reverse()
    }
  }, [transactions, tipoFiltro, searchTx, cargo])
  const [loading, setLoading] = useState(true)
  const [auditData, setAuditData] = useState<any[]>([])
  const [transactionToEdit, setTransactionToEdit] = useState<any>(null)

  const [isMembroModalOpen, setIsMembroModalOpen] = useState(false)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)

  const [novoMembro, setNovoMembro] = useState({ nome: '', pin: '', cargo: 'usuario', whatsapp: '', ativo: true })
  const [membroError, setMembroError] = useState('')
  const [salvandoMembro, setSalvandoMembro] = useState(false)

  const [estab, setEstab] = useState<any>(null)
  const [configForm, setConfigForm] = useState({ nome: '', logo_url: '' })
  const [configSaving, setConfigSaving] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)
  const [urlCopied, setUrlCopied] = useState(false)
  
  const [itens, setItens] = useState<any[]>([])
  const [novoItem, setNovoItem] = useState({ nome: '', preco: '', tipo: 'receita' as 'receita' | 'despesa' })
  const [itemSaving, setItemSaving] = useState(false)

  const [devPassword, setDevPassword] = useState('')
  const [isDevMode, setIsDevMode] = useState(false)

  const fetchEstab = async () => {
    const { data } = await supabase.from('estabelecimentos').select('*').eq('id', estabelecimentoId).single()
    if (data) {
      setEstab(data)
      setConfigForm({ nome: data.nome, logo_url: data.configuracoes?.logo_url ?? '' })
    }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setConfigSaving(true)
    const { error } = await supabase.from('estabelecimentos').update({
      nome: configForm.nome.trim(),
      configuracoes: { ...(estab?.configuracoes ?? {}), logo_url: configForm.logo_url.trim() }
    }).eq('id', estabelecimentoId)
    setConfigSaving(false)
    if (!error) { setConfigSaved(true); fetchEstab(); setTimeout(() => setConfigSaved(false), 2500) }
    else alert('Erro ao salvar: ' + error.message)
  }

  const generateDemoData = async () => {
    setConfigSaving(true)
    const demoData = [
      { tipo: 'receita', valor: 450, descricao: 'Cortes da Semana', created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
      { tipo: 'receita', valor: 380, descricao: 'Serviços de Barba', created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() },
      { tipo: 'despesa', valor: 120, descricao: 'Produtos de Limpeza', created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
      { tipo: 'receita', valor: 600, descricao: 'Combo Premium', created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
      { tipo: 'receita', valor: 420, descricao: 'Venda de Produtos', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
      { tipo: 'despesa', valor: 85, descricao: 'Manutenção Equipamento', created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
      { tipo: 'receita', valor: 150, descricao: 'Corte e Barba', created_at: new Date().toISOString() },
    ]

    const toInsert = demoData.map(d => ({
      ...d,
      descricao: d.descricao + ' [DEMO]',
      estabelecimento_id: estabelecimentoId,
      membro_id: membroId
    }))

    const { error } = await supabase.from('transacoes').insert(toInsert)
    setConfigSaving(false)
    if (!error) {
      alert('Dados demo gerados com sucesso!')
      fetchAdminData()
    }
  }

  const removeDemoData = async () => {
    if (!confirm('Isso apagará TODAS as transações com [DEMO] no nome neste estabelecimento. Continuar?')) return
    setConfigSaving(true)
    const { error } = await supabase
      .from('transacoes')
      .delete()
      .eq('estabelecimento_id', estabelecimentoId)
      .like('descricao', '%[DEMO]%')
      
    setConfigSaving(false)
    if (!error) {
      alert('Dados demo removidos com sucesso!')
      fetchAdminData()
    } else {
      alert('Erro ao remover: ' + error.message)
    }
  }

  const copyUrl = () => {
    const url = `${window.location.origin}/${estab?.slug}/login`
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(() => {
        setUrlCopied(true)
        setTimeout(() => setUrlCopied(false), 2000)
      })
    } else {
      const textArea = document.createElement("textarea")
      textArea.value = url
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      textArea.style.top = "-999999px"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      try {
        document.execCommand('copy')
        setUrlCopied(true)
        setTimeout(() => setUrlCopied(false), 2000)
      } catch (err) {
        console.error('Falha ao copiar:', err)
      }
      document.body.removeChild(textArea)
    }
  }

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'receita' | 'despesa'>('receita')

  useEffect(() => {
    fetchAdminData()
    fetchMembros()
    fetchEstab()
    if (activeTab === 'auditoria') fetchAuditData()
    if (activeTab === 'itens') fetchItens()
  }, [periodo, activeTab])

  const fetchItens = async () => {
    const { data } = await supabase.from('servicos_produtos').select('*').eq('estabelecimento_id', estabelecimentoId).order('nome')
    setItens(data || [])
  }

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoItem.nome.trim()) return
    setItemSaving(true)
    const { error } = await supabase.from('servicos_produtos').insert({
      estabelecimento_id: estabelecimentoId,
      nome: novoItem.nome.trim(),
      preco_sugerido: novoItem.preco ? parseFloat(novoItem.preco.replace(',', '.')) : null,
      tipo: novoItem.tipo
    })
    setItemSaving(false)
    if (!error) {
      setNovoItem({ nome: '', preco: '', tipo: 'receita' })
      setIsItemModalOpen(false)
      fetchItens()
    } else alert('Erro ao salvar item: ' + error.message)
  }

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return
    const { error } = await supabase.from('servicos_produtos').delete().eq('id', id)
    if (!error) fetchItens()
  }

  const fetchAuditData = async () => {
    const { data } = await supabase
      .from('auditoria_transacoes')
      .select('*, membros_equipe(nome), transacoes(descricao, valor, tipo)')
      .order('created_at', { ascending: false })
    setAuditData(data || [])
  }

  const fetchMembros = async () => {
    const { data } = await supabase.from('membros_equipe').select('*').eq('estabelecimento_id', estabelecimentoId)
    setMembros(data || [])
  }

  const handleDelete = async (id: string) => {
    const motivo = prompt('Por favor, informe o motivo da exclusão:')
    if (!motivo) return

    const { error } = await supabase.from('transacoes').update({
      excluido: true,
      excluido_em: new Date().toISOString(),
      excluido_por: membroId,
      motivo_exclusao: motivo
    }).eq('id', id)

    if (!error) {
      await supabase.from('auditoria_transacoes').insert({
        transacao_id: id,
        membro_id: membroId,
        acao: 'exclusao',
        motivo: motivo
      })
      fetchAdminData()
    }
  }

  const fetchAdminData = async () => {
    try {
      setLoading(true)
      console.log('Admin: Buscando dados para Estabelecimento:', estabelecimentoId)
      
      let query = supabase.from('transacoes')
        .select('*, membros_equipe!transacoes_membro_id_fkey(nome)')
        .eq('estabelecimento_id', estabelecimentoId)
        .eq('excluido', false)

      if (cargo === 'usuario') {
        query = query.eq('membro_id', membroId)
      }

      const now = new Date()
      if (periodo === 'hoje') query = query.gte('created_at', new Date(now.setHours(0,0,0,0)).toISOString())
      else if (periodo === '7dias') { const d = new Date(); d.setDate(d.getDate() - 7); query = query.gte('created_at', d.toISOString()) }
      else if (periodo === '30dias') { const d = new Date(); d.setDate(d.getDate() - 30); query = query.gte('created_at', d.toISOString()) }

      const { data, error } = await query.order('created_at', { ascending: false })
      if (error) {
        console.error('Erro Admin Supabase:', error)
        throw error
      }

      console.log('Admin: Transações recebidas:', data?.length)
      if (data) {
        setTransactions(data)
      }
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }

  if (!estabelecimentoId) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
        <div className="glass-card p-8 border-rose-500/20 text-center space-y-4">
          <ShieldAlert size={48} className="text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold">Erro de Sessão</h2>
          <p className="text-slate-400">Não foi possível localizar o ID do seu estabelecimento. Por favor, saia e entre novamente.</p>
          <button onClick={onBack} className="bg-rose-500 px-6 py-3 rounded-xl font-bold">Voltar para Login</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col lg:flex-row pb-24 lg:pb-0">
      <aside className="hidden lg:flex w-64 bg-slate-900/50 border-r border-white/5 flex-col p-6 sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-10">
          {estab?.configuracoes?.logo_url ? (
            <img src={estab.configuracoes.logo_url} alt="Logo" className="w-10 h-10 rounded-xl object-cover shadow-lg border border-white/10" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20"><LayoutDashboard size={20} /></div>
          )}
          <div className="flex flex-col justify-center min-w-0">
            <span className="font-black text-sm sm:text-base leading-none tracking-tighter uppercase break-words line-clamp-2">
              {estab?.nome || 'GFin'}
            </span>
          </div>
        </div>
        <nav className="space-y-2 flex-1">
          <button onClick={() => setActiveTab('resumo')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'resumo' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}><PieChart size={18} /> Resumo</button>
          <button onClick={() => setActiveTab('transacoes')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'transacoes' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}><List size={18} /> Lançamentos</button>
          <button onClick={() => setActiveTab('itens')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'itens' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}><Scissors size={18} /> Serviços/Produtos</button>
          
          {cargo === 'administrador' && (
            <>
              <button onClick={() => setActiveTab('equipe')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'equipe' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}><Users size={18} /> Equipe</button>
              <button onClick={() => setActiveTab('auditoria')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'auditoria' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}><ShieldAlert size={18} /> Auditoria</button>
              <button onClick={() => setActiveTab('config')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'config' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}><Settings size={18} /> Configurações</button>
            </>
          )}
        </nav>
        <button onClick={onBack} className="flex items-center gap-3 px-4 py-3 text-rose-400 hover:bg-rose-500/10 rounded-xl mt-auto font-bold"><ArrowLeft size={18} /> Sair do Admin</button>
      </aside>

      <main className="flex-1 p-4 sm:p-8 lg:p-12 max-w-7xl mx-auto w-full">
        <header className="lg:hidden flex justify-between items-center mb-6">
           <div className="flex items-center gap-2">
              {estab?.configuracoes?.logo_url ? (
                <img src={estab.configuracoes.logo_url} alt="Logo" className="w-8 h-8 rounded-lg object-cover border border-white/10" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center"><LayoutDashboard size={16} /></div>
              )}
              <div>
                <h2 className="font-bold text-sm uppercase tracking-widest text-emerald-500 leading-tight">{estab?.nome || 'GFin'}</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase">{membros.find(m => m.id === membroId)?.nome || 'Carregando...'}</p>
              </div>
           </div>
           <button onClick={onBack} className="p-2 glass-card rounded-full text-rose-400"><ArrowLeft size={18} /></button>
        </header>

        {(activeTab === 'resumo' || activeTab === 'transacoes') && (
          <div className="space-y-4 mb-8 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex gap-1 bg-slate-900/50 p-1 rounded-full border border-white/5 w-full sm:w-auto overflow-x-auto scrollbar-hide">
                 {(['hoje', '7dias', '30dias', 'todos'] as Periodo[]).map(p => (
                   <button key={p} onClick={() => setPeriodo(p)} className={`flex-1 sm:flex-none px-4 py-2 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${periodo === p ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500'}`}>
                     {p === 'hoje' ? 'HOJE' : p === '7dias' ? '7 DIAS' : p === '30dias' ? '30 DIAS' : 'TUDO'}
                   </button>
                 ))}
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                 <button onClick={() => { setModalType('receita'); setIsModalOpen(true) }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-500 text-white px-4 py-3 rounded-xl font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"><Plus size={14} /> Receita</button>
                 <button onClick={() => { setModalType('despesa'); setIsModalOpen(true) }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-rose-500 text-white px-4 py-3 rounded-xl font-bold text-xs shadow-lg shadow-rose-500/20 active:scale-95 transition-all"><Plus size={14} /> Despesa</button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl border border-white/5 w-full md:w-auto">
                 {(['todos', 'receita', 'despesa'] as const).map(t => (
                   <button key={t} onClick={() => setTipoFiltro(t)} className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase ${tipoFiltro === t ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}>
                     {t}
                   </button>
                 ))}
              </div>
              {cargo === 'administrador' && (
                <div className="relative flex-1 group">
                  <input type="text" placeholder="Buscar por usuário, descrição ou categoria..." value={searchTx} onChange={e => setSearchTx(e.target.value)} className="w-full bg-slate-900 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={16} />
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'resumo' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
               <div className="glass-card p-6 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/20 relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:scale-150 transition-all" />
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Lucro Líquido</p>
                  <h3 className="text-3xl sm:text-4xl font-black text-white">{formatCurrency(stats.lucro)}</h3>
                  <div className="flex items-center gap-2 text-emerald-400 text-[9px] font-bold mt-2 bg-emerald-400/10 w-fit px-2 py-0.5 rounded-full"><TrendingUp size={10} /> Saudável</div>
               </div>
               <div className="glass-card p-6 border-white/5"><p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Receitas</p><h3 className="text-2xl font-black text-emerald-400">{formatCurrency(stats.receita)}</h3></div>
               <div className="glass-card p-6 border-white/5"><p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Despesas</p><h3 className="text-2xl font-black text-rose-500">{formatCurrency(stats.despesa)}</h3></div>
            </div>
            <section className="glass-card p-4 sm:p-8 border-white/5 overflow-hidden">
               <h3 className="font-bold mb-8 text-sm flex items-center gap-2 uppercase tracking-widest"><TrendingUp size={16} className="text-emerald-500" /> Fluxo de Caixa</h3>
               <div className="h-64 sm:h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                        <linearGradient id="colorDes" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/><stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="name" stroke="#475569" fontSize={9} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }} />
                      <Area type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRec)" />
                      <Area type="monotone" dataKey="despesa" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorDes)" />
                    </AreaChart>
                  </ResponsiveContainer>
               </div>
            </section>
          </div>
        )}

        {activeTab === 'transacoes' && (
           <section className="animate-in slide-in-from-bottom duration-300">
              <h3 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest px-2 mb-4">Lançamentos ({filteredTransactions.length})</h3>
              <div className="space-y-2">
                 {filteredTransactions.map(t => (
                    <div key={t.id} className="glass-card p-4 flex items-center justify-between border-white/5 group">
                       <div className="flex items-center gap-3 flex-1 min-w-0">
                         <div className={`p-2 rounded-lg flex-shrink-0 ${t.tipo === 'receita' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{t.tipo === 'receita' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}</div>
                         <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm truncate">{t.descricao || 'Lançamento'}</p>
                            <p className="text-[9px] text-slate-500 font-bold uppercase truncate">{new Date(t.created_at).toLocaleDateString()} • {t.membros_equipe?.nome}</p>
                         </div>
                       </div>
                       <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                         <div className="flex items-center gap-1">
                            <button 
                              onClick={() => { setModalType(t.tipo); setTransactionToEdit(t); setIsModalOpen(true) }}
                              className="p-2 text-slate-500 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => handleDelete(t.id)} 
                              className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                         </div>
                         <div className="w-24 text-right">
                           <p className={`font-mono font-black text-sm whitespace-nowrap ${t.tipo === 'receita' ? 'text-emerald-400' : 'text-rose-400'}`}>
                             {t.tipo === 'receita' ? '+' : '-'} {formatCurrency(t.valor)}
                           </p>
                         </div>
                       </div>
                    </div>
                 ))}
                 {transactions.length === 0 && <div className="text-center p-12 text-slate-600 font-bold">Nenhum lançamento encontrado</div>}
              </div>
           </section>
        )}

        {activeTab === 'equipe' && (
           <div className="space-y-6 animate-in slide-in-from-right duration-300">
              <div className="flex justify-between items-center">
                <h2 className="font-black text-lg uppercase tracking-widest text-slate-400">Equipe</h2>
                <button onClick={() => setIsMembroModalOpen(true)} className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2">
                  <Plus size={14} /> Novo Membro
                </button>
              </div>

              {isMembroModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-0">
                  <div className="bg-slate-950 w-full max-w-md rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                      <h3 className="font-bold text-lg">Novo Membro</h3>
                      <button onClick={() => setIsMembroModalOpen(false)} className="text-slate-500 hover:text-rose-500 p-2 rounded-full hover:bg-white/5 transition-all"><X size={20} /></button>
                    </div>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault()
                        setMembroError('')
                        const nome = novoMembro.nome.trim()
                        const pin = novoMembro.pin.trim()
                        if (!nome) { setMembroError('O nome é obrigatório.'); return }
                        if (!/^\d{4}$/.test(pin)) { setMembroError('O PIN deve ter exatamente 4 dígitos numéricos.'); return }
                        setSalvandoMembro(true)
                        const { error } = await supabase.from('membros_equipe').insert({
                          estabelecimento_id: estabelecimentoId,
                          nome,
                          pin_hash: pin,
                          cargo: novoMembro.cargo,
                          whatsapp: novoMembro.whatsapp.trim(),
                          ativo: true,
                        })
                        setSalvandoMembro(false)
                        if (error) {
                          if (error.code === '23505') setMembroError('Já existe um membro com esse nome ou PIN neste estabelecimento.')
                          else setMembroError(error.message)
                          return
                        }
                        setNovoMembro({ nome: '', pin: '', cargo: 'usuario', whatsapp: '', ativo: true })
                        setIsMembroModalOpen(false)
                        fetchMembros()
                      }}
                      className="p-6 space-y-4"
                    >
                 <input
                   className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                   placeholder="Nome"
                   value={novoMembro.nome}
                   onChange={e => setNovoMembro(prev => ({ ...prev, nome: e.target.value }))}
                 />
                 <input
                   maxLength={4}
                   inputMode="numeric"
                   className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                   placeholder="PIN (4 dígitos)"
                   value={novoMembro.pin}
                   onChange={e => setNovoMembro(prev => ({ ...prev, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                 />
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <select
                      className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      value={novoMembro.cargo}
                      onChange={e => setNovoMembro(prev => ({ ...prev, cargo: e.target.value }))}
                    >
                       <option value="usuario">Usuário</option>
                       <option value="administrador">Administrador</option>
                    </select>
                    <input
                      className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      placeholder="WhatsApp (ex: 5511999999999)"
                      value={novoMembro.whatsapp}
                      onChange={e => setNovoMembro(prev => ({ ...prev, whatsapp: e.target.value.replace(/\D/g, '') }))}
                    />
                 </div>
                 <label className="flex items-center justify-between bg-slate-900 border border-white/5 rounded-xl px-4 py-3 cursor-pointer">
                   <span className="text-sm text-slate-300 font-medium">Membro ativo</span>
                   <div
                     onClick={() => setNovoMembro(prev => ({ ...prev, ativo: !prev.ativo }))}
                     className={`relative w-11 h-6 rounded-full transition-all duration-300 ${novoMembro.ativo ? 'bg-emerald-500' : 'bg-slate-700'}`}
                   >
                     <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${novoMembro.ativo ? 'translate-x-5' : 'translate-x-0'}`} />
                   </div>
                 </label>
                 {membroError && <p className="text-rose-400 text-xs font-bold px-1">{membroError}</p>}
                  <button
                    type="submit"
                    disabled={salvandoMembro}
                    className="w-full bg-emerald-500 py-4 rounded-xl font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
                  >
                    {salvandoMembro ? 'Salvando...' : 'Salvar Membro'}
                  </button>
                    </form>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                 {membros.map(m => (
                   <div key={m.id} className="glass-card p-4 flex justify-between items-center border-white/5">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-emerald-500 uppercase">{m.nome.charAt(0)}</div>
                       <div>
                         <p className="font-bold text-sm">{m.nome}</p>
                         <div className="flex items-center gap-2 mt-1">
                           <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${m.cargo === 'administrador' ? 'bg-violet-500/15 text-violet-400' : 'bg-slate-700/60 text-slate-400'}`}>{m.cargo}</span>
                           <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${m.ativo ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>{m.ativo ? 'Ativo' : 'Inativo'}</span>
                         </div>
                       </div>
                     </div>
                     <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-[9px] text-slate-500 font-bold uppercase">PIN</p>
                          <p className="font-mono font-bold text-emerald-400">{m.pin_hash}</p>
                        </div>
                        {m.whatsapp && (
                          <button 
                            onClick={() => {
                              const msg = encodeURIComponent(`Olá ${m.nome}! Aqui está seu link de acesso ao GFin da ${estab?.nome}:\n\n🔗 ${window.location.origin}/${estab?.slug}/login\n\nSeu PIN de acesso é: ${m.pin_hash}`);
                              window.open(`https://wa.me/${m.whatsapp}?text=${msg}`, '_blank');
                            }}
                            className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-lg active:scale-90"
                            title="Enviar acesso via WhatsApp"
                          >
                            <MessageCircle size={20} />
                          </button>
                        )}
                     </div>
                   </div>
                 ))}
              </div>
           </div>
        )}

        {activeTab === 'auditoria' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <h2 className="font-black text-lg uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <History size={20} className="text-emerald-500" /> Histórico de Auditoria
            </h2>
            <div className="space-y-3">
              {auditData.map(log => (
                <div key={log.id} className="glass-card p-6 border-white/5 hover:border-emerald-500/20 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${log.acao === 'exclusao' ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                        {log.acao === 'exclusao' ? <Trash2 size={18} /> : <Edit2 size={18} />}
                      </div>
                      <div>
                        <p className="font-bold text-sm">
                          {log.acao === 'exclusao' ? 'Exclusão de Lançamento' : 'Edição de Lançamento'}
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">
                          {formatDateTime(log.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 font-bold uppercase mb-1 flex items-center justify-end gap-1">
                        <User size={10} /> Realizado por
                      </p>
                      <p className="text-xs font-bold text-emerald-500">{log.membros_equipe?.nome}</p>
                    </div>
                  </div>

                  <div className="bg-slate-900/50 rounded-xl p-4 border border-white/5 mb-4">
                    <p className="text-[9px] text-slate-500 font-bold uppercase mb-2">Detalhes da Transação</p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-300">{log.transacoes?.descricao}</span>
                      <span className={`text-sm font-black ${log.transacoes?.tipo === 'receita' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatCurrency(log.transacoes?.valor || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
                      <MessageCircle size={10} /> Motivo Justificado
                    </p>
                    <p className="text-sm text-slate-300 bg-white/5 p-3 rounded-lg border border-white/5 italic">
                      "{log.motivo}"
                    </p>
                  </div>
                </div>
              ))}
              {auditData.length === 0 && (
                <div className="text-center p-12 glass-card border-dashed border-white/5 text-slate-600 font-bold">
                  Nenhuma atividade de auditoria registrada ainda.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'itens' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
             <div className="flex justify-between items-center">
               <h2 className="font-black text-lg uppercase tracking-widest text-slate-400">Serviços e Produtos</h2>
               <button onClick={() => setIsItemModalOpen(true)} className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2">
                 <Plus size={14} /> Novo Item
               </button>
             </div>

             {isItemModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-0">
                  <div className="bg-slate-950 w-full max-w-md rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                      <h3 className="font-bold text-lg">Novo Serviço/Produto</h3>
                      <button onClick={() => setIsItemModalOpen(false)} className="text-slate-500 hover:text-rose-500 p-2 rounded-full hover:bg-white/5 transition-all"><X size={20} /></button>
                    </div>
                    <form onSubmit={handleSaveItem} className="p-6 space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Nome do Serviço/Produto</label>
                          <input required className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" value={novoItem.nome} onChange={e => setNovoItem(prev => ({ ...prev, nome: e.target.value }))} placeholder="Ex: Corte Degrade" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Preço Sugerido (Opcional)</label>
                          <input className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" value={novoItem.preco} onChange={e => setNovoItem(prev => ({ ...prev, preco: e.target.value }))} placeholder="0,00" />
                        </div>
                      </div>
                      <div className="flex gap-4">
                         <button type="button" onClick={() => setNovoItem(prev => ({ ...prev, tipo: 'receita' }))} className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${novoItem.tipo === 'receita' ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-slate-500 border border-white/5'}`}>RECEITA</button>
                         <button type="button" onClick={() => setNovoItem(prev => ({ ...prev, tipo: 'despesa' }))} className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${novoItem.tipo === 'despesa' ? 'bg-rose-500 text-white' : 'bg-slate-900 text-slate-500 border border-white/5'}`}>DESPESA</button>
                      </div>
                      <button type="submit" disabled={itemSaving} className="w-full bg-emerald-500 py-4 rounded-xl font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                        {itemSaving ? 'Salvando...' : 'Cadastrar Item'}
                      </button>
                    </form>
                  </div>
                </div>
             )}

             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {itens.map(item => (
                  <div key={item.id} className="glass-card p-4 border-white/5 flex justify-between items-center group">
                    <div>
                      <p className="font-bold text-sm">{item.nome}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${item.tipo === 'receita' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{item.tipo}</span>
                        {item.preco_sugerido && <span className="text-[10px] font-mono text-slate-400">{formatCurrency(item.preco_sugerido)}</span>}
                      </div>
                    </div>
                    <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-slate-500 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300 max-w-xl">
            <h2 className="font-black text-lg uppercase tracking-widest text-slate-400">Configurações do Estabelecimento</h2>
            <div className="glass-card p-6 border-emerald-500/20 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">
                <Link2 size={14} /> URL do Usuário
              </div>
              <div className="flex items-center gap-3 bg-slate-900 border border-white/5 rounded-xl px-4 py-3">
                <p className="text-sm text-slate-300 font-mono flex-1 break-all">
                  {window.location.origin}/{estab?.slug}/login
                </p>
                <button
                  onClick={copyUrl}
                  className={`p-2 rounded-lg transition-all ${urlCopied ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                  {urlCopied ? <CheckCircle size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-600 px-1">Compartilhe essa URL com seus funcionários para que eles façam login via PIN.</p>
            </div>

            <form onSubmit={handleSaveConfig} className="glass-card p-6 border-white/5 space-y-4">
              <h3 className="font-bold text-base mb-1">Dados da Empresa</h3>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Nome da Empresa</label>
                <input
                  required
                  className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  value={configForm.nome}
                  onChange={e => setConfigForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome da empresa"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase px-1">URL da Logo</label>
                <input
                  className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  value={configForm.logo_url}
                  onChange={e => setConfigForm(prev => ({ ...prev, logo_url: e.target.value }))}
                  placeholder="https://... (link da imagem)"
                />
              </div>
              {configForm.logo_url && (
                <div className="flex items-center gap-4 bg-slate-900 rounded-xl p-4 border border-white/5">
                  <img src={configForm.logo_url} alt="Logo preview" className="w-14 h-14 rounded-xl object-cover border border-white/10" onError={e => (e.currentTarget.style.display = 'none')} />
                  <p className="text-xs text-slate-400">Preview da logo</p>
                </div>
              )}
              <button
                type="submit"
                disabled={configSaving}
                className={`w-full py-4 rounded-xl font-bold shadow-lg active:scale-95 transition-all disabled:opacity-50 ${configSaved ? 'bg-teal-500 shadow-teal-500/20' : 'bg-emerald-500 shadow-emerald-500/20'}`}
              >
                {configSaved ? '✓ Salvo!' : configSaving ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </form>

            {isDevMode ? (
              <div className="glass-card p-6 border-amber-500/20 space-y-4">
                 <div className="flex justify-between items-center">
                   <h3 className="text-amber-400 font-bold text-sm uppercase tracking-widest flex items-center gap-2">
                     <ShieldAlert size={16} /> Área de Testes (Dev Mode)
                   </h3>
                   <button onClick={() => { setIsDevMode(false); setDevPassword(''); }} className="text-slate-500 hover:text-amber-500 p-2 rounded-full hover:bg-amber-500/10 transition-all" title="Ocultar Área de Testes">
                     <X size={16} />
                   </button>
                 </div>
                 <p className="text-xs text-slate-500">Gere lançamentos fictícios para testar a interface, e remova-os facilmente depois. Eles terão a tag [DEMO].</p>
                 <div className="flex flex-col sm:flex-row gap-4">
                   <button 
                     onClick={generateDemoData}
                     disabled={configSaving}
                     className="flex-1 py-3 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl font-bold hover:bg-amber-500 hover:text-white transition-all active:scale-95"
                   >
                     Gerar Dados Demo
                   </button>
                   <button 
                     onClick={removeDemoData}
                     disabled={configSaving}
                     className="flex-1 py-3 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl font-bold hover:bg-rose-500 hover:text-white transition-all active:scale-95"
                   >
                     Limpar Dados Demo
                   </button>
                 </div>
              </div>
            ) : (
              <div className="glass-card p-6 border-white/5 space-y-4">
                 <h3 className="font-bold text-sm text-slate-400 uppercase tracking-widest">Modo Desenvolvedor</h3>
                 <div className="flex gap-2">
                   <input 
                     type="password" 
                     placeholder="Senha de liberação" 
                     className="flex-1 bg-slate-900 border border-white/5 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" 
                     value={devPassword} 
                     onChange={e => setDevPassword(e.target.value)} 
                     onKeyDown={e => { if (e.key === 'Enter') { if (devPassword === 'gfin@dev') setIsDevMode(true); else alert('Senha incorreta') } }}
                   />
                   <button 
                     onClick={() => { if(devPassword === 'gfin@dev') setIsDevMode(true); else alert('Senha incorreta') }} 
                     className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-700 transition-all"
                   >
                     Desbloquear
                   </button>
                 </div>
              </div>
            )}
          </div>
        )}
      </main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-slate-950/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-2 z-50">
        <button onClick={() => setActiveTab('resumo')} className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'resumo' ? 'text-emerald-500 scale-110' : 'text-slate-500'}`}>
          <PieChart size={20} />
          <span className="text-[9px] font-bold uppercase">Resumo</span>
        </button>
        <button onClick={() => setActiveTab('transacoes')} className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'transacoes' ? 'text-emerald-500 scale-110' : 'text-slate-500'}`}>
          <List size={20} />
          <span className="text-[9px] font-bold uppercase">Lista</span>
        </button>
        {cargo === 'administrador' && (
          <>
            <button onClick={() => setActiveTab('equipe')} className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'equipe' ? 'text-emerald-500 scale-110' : 'text-slate-500'}`}>
              <Users size={20} />
              <span className="text-[9px] font-bold uppercase">Equipe</span>
            </button>
            <button onClick={() => setActiveTab('auditoria')} className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'auditoria' ? 'text-emerald-500 scale-110' : 'text-slate-500'}`}>
              <ShieldAlert size={20} />
              <span className="text-[9px] font-bold uppercase">Auditoria</span>
            </button>
          </>
        )}
        <button onClick={() => setActiveTab('itens')} className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'itens' ? 'text-emerald-500 scale-110' : 'text-slate-500'}`}>
          <Scissors size={20} />
          <span className="text-[9px] font-bold uppercase">Itens</span>
        </button>
        {cargo === 'administrador' && (
          <button onClick={() => setActiveTab('config')} className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'config' ? 'text-emerald-500 scale-110' : 'text-slate-500'}`}>
            <Settings size={20} />
            <span className="text-[9px] font-bold uppercase">Ajustes</span>
          </button>
        )}
      </nav>

      <TransactionModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setTransactionToEdit(null) }} 
        tipo={modalType} 
        membroId={membroId}
        membros={membros}
        estabelecimentoId={estabelecimentoId} 
        onSuccess={fetchAdminData}
        canSelectMember={true}
        editingTransaction={transactionToEdit}
      />
    </div>
  )
}
