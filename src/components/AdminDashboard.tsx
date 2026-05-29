import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ArrowLeft, ArrowRight, TrendingUp, TrendingDown, Lock, Shield, Calendar, Filter, ArrowUpRight, ArrowDownLeft, Trash2, Edit2, Plus, Users, DollarSign, LayoutDashboard, MoreVertical, PieChart, List, Settings, Copy, Link2, CheckCircle, MessageCircle, ShieldAlert, History, User, Scissors, Search, X, Download, Printer, CheckSquare, Square, RefreshCw, Clock } from 'lucide-react'
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
type Tab = 'resumo' | 'transacoes' | 'equipe' | 'config' | 'auditoria' | 'itens' | 'relatorios' | 'agenda'

export function AdminDashboard({ onBack, estabelecimentoId, membroId, cargo }: AdminDashboardProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('aba') as Tab) || 'resumo'
  const setActiveTab = (tab: Tab) => setSearchParams({ aba: tab }, { replace: true })
  
  const applyPhoneMask = (value: string) => {
    const rawValue = value.replace(/\D/g, '')
    if (rawValue.length <= 11) {
      return rawValue
        .replace(/^(\d{2})(\d)/g, '($1) $2')
        .replace(/(\d)(\d{4})$/, '$1-$2')
    }
    return rawValue.slice(0, 11)
      .replace(/^(\d{2})(\d)/g, '($1) $2')
      .replace(/(\d)(\d{4})$/, '$1-$2')
  }
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false)
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
      const date = t.data_competencia ? t.data_competencia.split('-').reverse().slice(0, 2).join('/') : new Date(t.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
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
  const [auditFilterAcao, setAuditFilterAcao] = useState<string>('todos')
  const [auditFilterMembro, setAuditFilterMembro] = useState<string>('todos')
  const [auditSearch, setAuditSearch] = useState<string>('')

  const filteredAuditData = useMemo(() => {
    return auditData.filter(log => {
      const matchAcao = auditFilterAcao === 'todos' || log.acao === auditFilterAcao;
      const matchMembro = auditFilterMembro === 'todos' || log.membro_id === auditFilterMembro;
      const term = auditSearch.toLowerCase();
      const matchSearch = !term || 
        (log.motivo && log.motivo.toLowerCase().includes(term)) ||
        (log.transacoes?.descricao && log.transacoes.descricao.toLowerCase().includes(term)) ||
        (log.dados_anteriores?.descricao && log.dados_anteriores.descricao.toLowerCase().includes(term)) ||
        (log.membros_equipe?.nome && log.membros_equipe.nome.toLowerCase().includes(term));
      
      return matchAcao && matchMembro && matchSearch;
    });
  }, [auditData, auditFilterAcao, auditFilterMembro, auditSearch]);

  const [transactionToEdit, setTransactionToEdit] = useState<any>(null)

  const [isMembroModalOpen, setIsMembroModalOpen] = useState(false)
  const [isItemModalOpen, setIsItemModalOpen] = useState(false)

  const [novoMembro, setNovoMembro] = useState({ nome: '', pin: '', cargo: 'usuario', whatsapp: '', ativo: true, percentual_comissao: 0 })
  const [membroParaEditar, setMembroParaEditar] = useState<string | null>(null)
  const [membroError, setMembroError] = useState('')
  const [salvandoMembro, setSalvandoMembro] = useState(false)

  const [estab, setEstab] = useState<any>(null)
  const [saasConfig, setSaasConfig] = useState<any>(null)
  const [configForm, setConfigForm] = useState({ nome: '', logo_url: '', whatsapp: '' })
  const [configSaving, setConfigSaving] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)
  const [urlCopied, setUrlCopied] = useState<string | null>(null)
  
  const [itens, setItens] = useState<any[]>([])
  const [novoItem, setNovoItem] = useState({ nome: '', preco: '', tipo: 'receita' as 'receita' | 'despesa', categoria: 'Geral', duracao: '30' })
  const [itemParaEditar, setItemParaEditar] = useState<string | null>(null)
  const [itemSaving, setItemSaving] = useState(false)
 
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [carregandoAgendamentos, setCarregandoAgendamentos] = useState(false)
  const [isAgendamentoModalOpen, setIsAgendamentoModalOpen] = useState(false)
  const [agendamentoParaEditar, setAgendamentoParaEditar] = useState<any>(null)
  const [novoAgendamento, setNovoAgendamento] = useState({
    id: '',
    cliente_nome: '',
    cliente_whatsapp: '',
    servico_id: '',
    membro_id: '',
    data: '',
    hora: '',
    status: 'pendente'
  })
  const [agendamentoSaving, setAgendamentoSaving] = useState(false)
  const [horarios, setHorarios] = useState<any[]>([])
  const [salvandoHorario, setSalvandoHorario] = useState<string | null>(null)

  const [devPassword, setDevPassword] = useState('')
  const [isDevMode, setIsDevMode] = useState(false)

  const subscriptionStatus = useMemo(() => {
    if (!estab) return { status: 'loading', daysLeft: 0, showWarning: false }

    const todayStr = new Date().toISOString().split('T')[0]

    // 0. PENDENTE — carência manual concedida pelo admin do SaaS
    //    Acesso liberado, mas exibe aviso para o dono regularizar o plano.
    //    Sobrepõe qualquer verificação de data — é uma extensão humana de prazo.
    if (estab.status_assinatura === 'pendente') {
      return { status: 'warning', daysLeft: 0, showWarning: true, reason: 'pending_admin' }
    }

    // 1. INATIVO — bloqueio manual imediato pelo admin do SaaS
    if (estab.status_assinatura === 'inativo') {
      return { status: 'blocked', daysLeft: 0, showWarning: false, reason: 'unpaid' }
    }

    // 2. Plano GRATUITO (Período de Teste)
    if (estab.plano === 'gratis') {
      const trialEnd = estab.trial_end
      if (!trialEnd) return { status: 'active', daysLeft: 14, showWarning: false }

      const diffTime = new Date(trialEnd).getTime() - new Date(todayStr).getTime()
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (daysLeft < 0) {
        return { status: 'blocked', daysLeft: 0, showWarning: false, reason: 'trial_expired' }
      }

      // Aviso se faltar 3 dias ou menos
      if (daysLeft <= 3) {
        return { status: 'active', daysLeft, showWarning: true, reason: 'trial_warning' }
      }

      return { status: 'active', daysLeft, showWarning: false }
    }

    // 3. Plano PRO / ASSINANTE
    if (estab.plano === 'pro' || estab.plano === 'premium') {
      const dueDate = estab.data_proxima_cobranca
      if (!dueDate) return { status: 'active', daysLeft: 30, showWarning: false }

      const diffTime = new Date(dueDate).getTime() - new Date(todayStr).getTime()
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      // Carência automática de 5 dias após vencimento
      if (daysLeft < -5) {
        return { status: 'blocked', daysLeft: 0, showWarning: false, reason: 'expired' }
      }

      // Dentro da carência automática
      if (daysLeft < 0) {
        const graceDaysLeft = 5 + daysLeft
        return { status: 'warning', daysLeft: graceDaysLeft, showWarning: true, reason: 'grace_period', dueDate }
      }

      return { status: 'active', daysLeft, showWarning: false }
    }

    return { status: 'active', daysLeft: 0, showWarning: false }
  }, [estab])

  const [relatorioFiltro, setRelatorioFiltro] = useState({
    dataInicio: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dataFim: new Date().toISOString().split('T')[0],
    membrosIds: [] as string[]
  })
  const [relatorioDados, setRelatorioDados] = useState<any[]>([])
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false)


  const gerarRelatorio = async () => {
    setGerandoRelatorio(true)
    let query = supabase
      .from('transacoes')
      .select('*, membros_equipe!transacoes_membro_id_fkey(id, nome, percentual_comissao)')
      .eq('estabelecimento_id', estabelecimentoId)
      .eq('tipo', 'receita')
      .eq('excluido', false)
      .gte('data_competencia', relatorioFiltro.dataInicio)
      .lte('data_competencia', relatorioFiltro.dataFim)

    if (relatorioFiltro.membrosIds.length > 0) {
      query = query.in('membro_id', relatorioFiltro.membrosIds)
    }

    const { data, error } = await query
    
    if (error) {
      console.error("Erro ao gerar relatório:", error)
      alert("Erro ao gerar relatório: " + error.message)
    }
    
    if (data) {
      const agrupado = data.reduce((acc: any, t: any) => {
        const m = t.membros_equipe
        if (!m) return acc
        if (!acc[m.id]) {
          acc[m.id] = { nome: m.nome, comissao_pct: m.percentual_comissao || 0, total_receita: 0, total_comissao: 0, qtd_servicos: 0 }
        }
        const valor = Number(t.valor) || 0
        acc[m.id].total_receita += valor
        acc[m.id].qtd_servicos += 1
        acc[m.id].total_comissao += valor * ((m.percentual_comissao || 0) / 100)
        return acc
      }, {})
      setRelatorioDados(Object.values(agrupado).sort((a: any, b: any) => b.total_receita - a.total_receita))
    }
    setGerandoRelatorio(false)
  }

  const baixarCSV = () => {
    let csv = "Profissional,Servicos,Total Produzido,Comissao (%),Comissao Devida\n"
    relatorioDados.forEach(row => {
      csv += `${row.nome},${row.qtd_servicos},${row.total_receita.toFixed(2)},${row.comissao_pct}%,${row.total_comissao.toFixed(2)}\n`
    })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.setAttribute('href', url)
    a.setAttribute('download', `relatorio_producao_${relatorioFiltro.dataInicio}_a_${relatorioFiltro.dataFim}.csv`)
    a.click()
  }

  const fetchEstab = async () => {
    const { data } = await supabase.from('estabelecimentos').select('*').eq('id', estabelecimentoId).single()
    if (data) {
      setEstab(data)
      setConfigForm({ 
        nome: data.nome, 
        logo_url: data.configuracoes?.logo_url || '',
        whatsapp: data.configuracoes?.whatsapp || ''
      })
    }
  }

  const fetchSaasConfig = async () => {
    const { data } = await supabase.from('saas_configuracoes').select('*').limit(1).maybeSingle()
    if (data) {
      setSaasConfig(data)
    }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setConfigSaving(true)
    const { error } = await supabase.from('estabelecimentos').update({
      nome: configForm.nome,
      configuracoes: { 
        ...estab?.configuracoes, 
        logo_url: configForm.logo_url,
        whatsapp: configForm.whatsapp 
      }
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

  const copyText = (text: string, type: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setUrlCopied(type)
        setTimeout(() => setUrlCopied(null), 2000)
      })
    } else {
      const textArea = document.createElement("textarea")
      textArea.value = text
      textArea.style.position = "fixed"
      textArea.style.left = "-999999px"
      textArea.style.top = "-999999px"
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      try {
        document.execCommand('copy')
        setUrlCopied(type)
        setTimeout(() => setUrlCopied(null), 2000)
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
    fetchSaasConfig()
    if (activeTab === 'auditoria') fetchAuditData()
    if (activeTab === 'itens' || activeTab === 'agenda') fetchItens()
    if (activeTab === 'config') fetchHorarios()
    if (activeTab === 'agenda') fetchAgendamentos()
  }, [periodo, activeTab])

  const fetchAgendamentos = async () => {
    setCarregandoAgendamentos(true)
    const { data } = await supabase
      .from('agendamentos')
      .select('*, membros_equipe(nome), servicos_produtos(nome, preco_sugerido)')
      .eq('estabelecimento_id', estabelecimentoId)
      .order('data_hora_inicio', { ascending: true })
    
    setAgendamentos(data || [])
    setCarregandoAgendamentos(false)
  }

  const handleAgendamentoAction = async (ag: any, novoStatus: 'confirmado' | 'cancelado' | 'concluido') => {
    try {
      // 1. Atualizar o status do agendamento
      const { error: errorStatus } = await supabase.from('agendamentos').update({ status: novoStatus }).eq('id', ag.id)
      
      if (errorStatus) {
        alert("Erro ao atualizar status: " + errorStatus.message)
        return
      }

      // 2. Se for CONCLUÍDO, gerar transação financeira automática
      if (novoStatus === 'concluido') {
        const servico = Array.isArray(ag.servicos_produtos) ? ag.servicos_produtos[0] : ag.servicos_produtos;
        const preco = servico?.preco_sugerido || 0;
        
        const { error: errorTx } = await supabase.from('transacoes').insert({
          estabelecimento_id: estabelecimentoId,
          membro_id: ag.membro_id || membroId,
          tipo: 'receita',
          valor: preco,
          descricao: `Agendamento: ${ag.cliente_nome} (${ag.servicos_produtos?.nome || 'Serviço'})`,
          categoria: ag.servicos_produtos?.categoria || 'Geral',
          data_competencia: new Date().toISOString().split('T')[0],
          metadata: { agendamento_id: ag.id }
        })

        if (errorTx) {
          alert("Agendamento concluído, mas houve um erro ao gerar a transação financeira: " + errorTx.message)
        } else {
          alert(`Agendamento de ${ag.cliente_nome} finalizado e receita de ${formatCurrency(preco)} lançada no caixa!`)
          fetchAdminData() // Atualiza os gráficos e totais do dashboard
        }
      }

      fetchAgendamentos()
      
      // 3. Notificar via WhatsApp apenas para Confirmação ou Cancelamento
      if (novoStatus !== 'concluido') {
        const querAvisar = confirm(
          novoStatus === 'confirmado'
            ? `Agendamento confirmado! Deseja enviar o WhatsApp de confirmação para ${ag.cliente_nome}?`
            : `Agendamento cancelado. Deseja enviar o aviso de indisponibilidade para ${ag.cliente_nome}?`
        )

        if (querAvisar) {
          const dataObj = new Date(ag.data_hora_inicio)
          const dataFormatada = dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          const horaFormatada = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

          const msg = encodeURIComponent(
            novoStatus === 'confirmado'
              ? `Olá ${ag.cliente_nome}! Seu agendamento na ${estab.nome} para o dia ${dataFormatada} às ${horaFormatada} foi CONFIRMADO. \u2705\n\nTe aguardamos! \uD83D\uDE0A`
              : `Olá ${ag.cliente_nome}, infelizmente não poderemos te atender na data e hora solicitada (${dataFormatada} às ${horaFormatada}) na ${estab.nome}. \u274C\n\nPoderia escolher outro horário? \uD83D\uDE4F`
          )
          
          const fone = ag.cliente_whatsapp?.replace(/\D/g, '')
          if (fone) {
            window.open(`https://wa.me/55${fone}?text=${msg}`, '_blank')
          }
        }
      }
    } catch (err: any) {
      console.error("Erro fatal na função:", err)
      alert("Erro Crítico: " + err.message)
    }
  }

  const handleSaveAgendamento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoAgendamento.cliente_nome || !novoAgendamento.data || !novoAgendamento.hora) return
    setAgendamentoSaving(true)

    // Forçar o fuso horário de Brasília (-03:00)
    const pad = (n: number) => n.toString().padStart(2, '0')
    const [ano, mes, dia] = novoAgendamento.data.split('-').map(Number)
    const [h, min] = novoAgendamento.hora.split(':').map(Number)
    const dataHoraBrasil = `${ano}-${pad(mes)}-${pad(dia)}T${pad(h)}:${pad(min)}:00-03:00`
    
    const payload = {
      cliente_nome: novoAgendamento.cliente_nome,
      cliente_whatsapp: novoAgendamento.cliente_whatsapp.replace(/\D/g, ''),
      servico_id: novoAgendamento.servico_id || null,
      membro_id: novoAgendamento.membro_id || null,
      data_hora_inicio: dataHoraBrasil,
      data_hora_fim: dataHoraBrasil, 
      status: novoAgendamento.status
    }

    const { error } = await supabase
      .from('agendamentos')
      .update(payload)
      .eq('id', novoAgendamento.id)

    setAgendamentoSaving(false)
    if (!error) {
      setIsAgendamentoModalOpen(false)
      fetchAgendamentos()
    } else {
      alert("Erro ao salvar: " + error.message)
    }
  }

  const deletarAgendamento = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir permanentemente este agendamento?')) return
    const { error } = await supabase.from('agendamentos').delete().eq('id', id)
    if (error) {
      console.error("Erro ao deletar:", error)
      alert("Erro ao excluir: " + error.message)
    } else {
      fetchAgendamentos()
    }
  }

  const fetchHorarios = async () => {
    if (!estabelecimentoId) return
    const { data } = await supabase
      .from('horarios_funcionamento')
      .select('*')
      .eq('estabelecimento_id', estabelecimentoId)
      .order('dia_semana', { ascending: true })
    
    if (data && data.length > 0) {
      setHorarios(data)
    } else {
      const padrao = [
        { dia_semana: 0, hora_inicio: '08:00', hora_fim: '18:00', ativo: false },
        { dia_semana: 1, hora_inicio: '08:00', hora_fim: '18:00', ativo: true },
        { dia_semana: 2, hora_inicio: '08:00', hora_fim: '18:00', ativo: true },
        { dia_semana: 3, hora_inicio: '08:00', hora_fim: '18:00', ativo: true },
        { dia_semana: 4, hora_inicio: '08:00', hora_fim: '18:00', ativo: true },
        { dia_semana: 5, hora_inicio: '08:00', hora_fim: '18:00', ativo: true },
        { dia_semana: 6, hora_inicio: '08:00', hora_fim: '18:00', ativo: true },
      ]
      setHorarios(padrao)
    }
  }

  const updateHorario = async (diaSemana: number, campo: string, valor: any) => {
    const index = horarios.findIndex(item => item.dia_semana === diaSemana)
    
    let novoHorario;
    const novosHorarios = [...horarios];

    if (index !== -1) {
      novoHorario = { ...novosHorarios[index], [campo]: valor };
      novosHorarios[index] = novoHorario;
    } else {
      // Se não existe no estado (ainda não salvo no banco), cria o objeto base
      novoHorario = { 
        dia_semana: diaSemana, 
        hora_inicio: '08:00', 
        hora_fim: '18:00', 
        ativo: false,
        [campo]: valor 
      };
      novosHorarios.push(novoHorario);
    }

    setHorarios(novosHorarios);

    if (novoHorario.id) {
      await supabase.from('horarios_funcionamento').update({
        hora_inicio: novoHorario.hora_inicio,
        hora_fim: novoHorario.hora_fim,
        ativo: novoHorario.ativo
      }).eq('id', novoHorario.id)
    } else {
      const { data, error } = await supabase.from('horarios_funcionamento').insert({
        estabelecimento_id: estabelecimentoId,
        dia_semana: novoHorario.dia_semana,
        hora_inicio: novoHorario.hora_inicio,
        hora_fim: novoHorario.hora_fim,
        ativo: novoHorario.ativo
      }).select()
      
      if (error) {
        console.error("Erro ao inserir horário:", error)
        alert("Erro ao salvar horário: " + error.message)
      } else if (data) {
        // Recarrega para garantir que temos os IDs do banco
        fetchHorarios()
      }
    }
  }

  const fetchItens = async () => {
    const { data } = await supabase.from('servicos_produtos').select('*').eq('estabelecimento_id', estabelecimentoId).order('nome')
    setItens(data || [])
  }

   const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoItem.nome.trim()) return
    setItemSaving(true)

    const payload = {
      estabelecimento_id: estabelecimentoId,
      nome: novoItem.nome.trim(),
      preco_sugerido: novoItem.preco ? parseFloat(novoItem.preco.toString().replace(',', '.')) : null,
      tipo: novoItem.tipo,
      categoria: novoItem.categoria,
      duracao_minutos: parseInt(novoItem.duracao) || 30
    }

    let error = null
    if (itemParaEditar) {
      const result = await supabase.from('servicos_produtos').update(payload).eq('id', itemParaEditar)
      error = result.error
    } else {
      const result = await supabase.from('servicos_produtos').insert(payload)
      error = result.error
    }

    setItemSaving(false)
    if (!error) {
      setNovoItem({ nome: '', preco: '', tipo: 'receita', categoria: 'Geral', duracao: '30' })
      setItemParaEditar(null)
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
      .select(`
        *,
        membros_equipe(nome),
        transacoes(descricao, valor, tipo)
      `)
      .eq('estabelecimento_id', estabelecimentoId)
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
      // Registrar auditoria de exclusão
      await supabase.from('auditoria_transacoes').insert({
        transacao_id: id,
        membro_id: membroId,
        estabelecimento_id: estabelecimentoId,
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
      const formatDate = (d: Date) => d.toLocaleDateString('en-CA')
      
      if (periodo === 'hoje') query = query.eq('data_competencia', formatDate(now))
      else if (periodo === '7dias') { 
        const d = new Date(); d.setDate(d.getDate() - 7); 
        query = query.gte('data_competencia', formatDate(d)) 
      }
      else if (periodo === '30dias') { 
        const d = new Date(); d.setDate(d.getDate() - 30); 
        query = query.gte('data_competencia', formatDate(d)) 
      }

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

  // --- LÓGICA DE BLOQUEIO ---
  if (subscriptionStatus.status === 'blocked') {
    const rawSupportPhone = saasConfig?.whatsapp_contato || ''
    const supportPhoneDigits = rawSupportPhone.replace(/\D/g, '')
    let cleanSupportPhone = supportPhoneDigits
    if ((supportPhoneDigits.length === 10 || supportPhoneDigits.length === 11) && !supportPhoneDigits.startsWith('55')) {
      cleanSupportPhone = '55' + supportPhoneDigits
    }

    const whatsappMessage = encodeURIComponent(
      `Olá! Minha barbearia (${estab?.nome || 'Minha Barbearia'}) está bloqueada no GFin SaaS. Gostaria de regularizar meu plano.`
    )
    const supportEmail = saasConfig?.email_contato || 'suporte@gfin.com.br'

    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
        {/* Efeito de Gradiente de Fundo Premium */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-rose-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/4 w-[250px] h-[250px] bg-amber-500/5 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="glass-card w-full max-w-lg p-6 sm:p-8 border-rose-500/20 text-center space-y-6 md:space-y-8 animate-in fade-in zoom-in-95 duration-500 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10 animate-bounce">
            <Lock size={32} className="text-rose-500" />
          </div>
          
          <div className="space-y-2.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Acesso Suspenso</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest text-emerald-500">{estab?.nome}</p>
          </div>
          
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-md mx-auto">
            {subscriptionStatus.reason === 'trial_expired' ? (
              <span>Seu período de teste grátis de 14 dias expirou. Para continuar gerindo as finanças e a agenda da sua barbearia com o GFin, assine o plano Pro.</span>
            ) : (
              <span>Sua mensalidade do plano Pro expirou e o prazo limite de carência passou. Para restabelecer seu acesso total aos dados, por favor realize o pagamento.</span>
            )}
          </p>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-3 text-left">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-1.5 flex items-center gap-1.5"><Shield size={12} className="text-emerald-500" /> Canais de Regularização</p>
            <div className="space-y-2 text-xs sm:text-sm">
              {saasConfig?.whatsapp_contato && (
                <p className="text-slate-300 flex items-center gap-2">
                  <span className="font-bold text-slate-500">WhatsApp:</span> {saasConfig.whatsapp_contato}
                </p>
              )}
              <p className="text-slate-300 flex items-center gap-2">
                <span className="font-bold text-slate-500">E-mail:</span> {supportEmail}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button 
              onClick={onBack}
              className="flex-1 py-3.5 rounded-xl font-bold text-sm bg-slate-900 border border-white/5 text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition-all"
            >
              Voltar ao Login
            </button>
            {cleanSupportPhone && (
              <a 
                href={`https://wa.me/${cleanSupportPhone}?text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3.5 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex justify-center items-center gap-2"
              >
                <MessageCircle size={16} /> Regularizar Plano
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col lg:flex-row pb-24 lg:pb-0">
      <aside className="hidden lg:flex w-64 bg-slate-900/50 border-r border-white/5 flex-col p-6 sticky top-0 h-screen print:hidden">
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
              <button onClick={() => setActiveTab('agenda')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'agenda' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}><Calendar size={18} /> Agenda</button>
              <button onClick={() => setActiveTab('auditoria')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'auditoria' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}><ShieldAlert size={18} /> Auditoria</button>
              <button onClick={() => setActiveTab('relatorios')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'relatorios' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}><PieChart size={18} /> Relatórios</button>
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

        {subscriptionStatus.showWarning && (
          <div className={`mb-6 p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-top-4 duration-500 ${
            subscriptionStatus.reason === 'trial_warning' 
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 flex-shrink-0">
                <ShieldAlert size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest">
                  {subscriptionStatus.reason === 'pending_admin' ? 'Pagamento Pendente' : 'Aviso de Expiração'}
                </p>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5 leading-relaxed">
                  {subscriptionStatus.reason === 'trial_warning' ? (
                    <span>Seu período de teste grátis termina em <strong className="text-white">{subscriptionStatus.daysLeft} {subscriptionStatus.daysLeft === 1 ? 'dia' : 'dias'}</strong> ({estab.trial_end ? new Date(estab.trial_end).toLocaleDateString('pt-BR') : ''}). Assine o Pro para evitar o bloqueio!</span>
                  ) : subscriptionStatus.reason === 'pending_admin' ? (
                    <span>Seu plano está com <strong className="text-white">pagamento pendente</strong>. O acesso está temporariamente liberado, mas regularize o quanto antes para evitar o bloqueio do sistema.</span>
                  ) : (
                    <span>Sua assinatura venceu em <strong className="text-white">{subscriptionStatus.dueDate ? new Date(subscriptionStatus.dueDate).toLocaleDateString('pt-BR') : ''}</strong>. Você está em período de carência com <strong className="text-white">{subscriptionStatus.daysLeft} {subscriptionStatus.daysLeft === 1 ? 'dia restante' : 'dias restantes'}</strong> antes do bloqueio do sistema.</span>
                  )}
                </p>
              </div>
            </div>
            
            {saasConfig?.whatsapp_contato && (
              <a
                href={`https://wa.me/${saasConfig.whatsapp_contato.replace(/\D/g, '').startsWith('55') ? saasConfig.whatsapp_contato.replace(/\D/g, '') : '55' + saasConfig.whatsapp_contato.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Olá! Gostaria de regularizar o plano Pro da minha barbearia (${estab?.nome || 'Minha Barbearia'}).`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-4 py-2 rounded-lg font-bold text-xs bg-white/5 hover:bg-white/10 text-white border border-white/5 transition-all text-center flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <MessageCircle size={12} /> Regularizar Agora
              </a>
            )}
          </div>
        )}

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
                            <p className="text-[9px] text-slate-500 font-bold uppercase truncate">
                              {t.data_competencia ? t.data_competencia.split('-').reverse().join('/') : new Date(t.created_at).toLocaleDateString()} • {t.membros_equipe?.nome}
                            </p>
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
                <button onClick={() => {
                  setMembroParaEditar(null)
                  setNovoMembro({ nome: '', pin: '', cargo: 'usuario', whatsapp: '', ativo: true, percentual_comissao: 0 })
                  setIsMembroModalOpen(true)
                }} className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2">
                  <Plus size={14} /> Novo Membro
                </button>
              </div>

              {isMembroModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-0">
                  <div className="bg-slate-950 w-full max-w-md rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                      <h3 className="font-bold text-lg">{membroParaEditar ? 'Editar Membro' : 'Novo Membro'}</h3>
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
                        
                        let error = null
                        if (membroParaEditar) {
                          const result = await supabase.from('membros_equipe').update({
                            nome,
                            pin_hash: pin,
                            cargo: novoMembro.cargo,
                            whatsapp: novoMembro.whatsapp.trim(),
                            percentual_comissao: Number(novoMembro.percentual_comissao) || 0,
                            ativo: novoMembro.ativo,
                          }).eq('id', membroParaEditar)
                          error = result.error
                        } else {
                          const result = await supabase.from('membros_equipe').insert({
                            estabelecimento_id: estabelecimentoId,
                            nome,
                            pin_hash: pin,
                            cargo: novoMembro.cargo,
                            whatsapp: novoMembro.whatsapp.trim(),
                            percentual_comissao: Number(novoMembro.percentual_comissao) || 0,
                            ativo: true,
                          })
                          error = result.error
                        }
                        
                        setSalvandoMembro(false)
                        if (error) {
                          if (error.code === '23505') setMembroError('Já existe um membro com esse nome ou PIN neste estabelecimento.')
                          else setMembroError(error.message)
                          return
                        }
                        setNovoMembro({ nome: '', pin: '', cargo: 'usuario', whatsapp: '', ativo: true, percentual_comissao: 0 })
                        setMembroParaEditar(null)
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
                      value={applyPhoneMask(novoMembro.whatsapp)}
                      onChange={e => setNovoMembro(prev => ({ ...prev, whatsapp: e.target.value.replace(/\D/g, '') }))}
                    />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Comissão Padrão (%)</label>
                   <input
                     type="number"
                     min="0"
                     max="100"
                     className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                     placeholder="Ex: 50"
                     value={novoMembro.percentual_comissao === 0 ? '' : novoMembro.percentual_comissao}
                     onChange={e => setNovoMembro(prev => ({ ...prev, percentual_comissao: Number(e.target.value) }))}
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
                        <button 
                          onClick={() => {
                            setMembroParaEditar(m.id)
                            setNovoMembro({
                              nome: m.nome,
                              pin: m.pin_hash,
                              cargo: m.cargo,
                              whatsapp: m.whatsapp || '',
                              ativo: m.ativo,
                              percentual_comissao: m.percentual_comissao || 0
                            })
                            setIsMembroModalOpen(true)
                          }}
                          className="p-3 bg-white/5 text-slate-400 rounded-xl hover:bg-white/10 hover:text-white transition-all shadow-lg active:scale-90"
                          title="Editar Membro"
                        >
                          <Edit2 size={20} />
                        </button>
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



        {activeTab === 'itens' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
             <div className="flex justify-between items-center">
               <h2 className="font-black text-lg uppercase tracking-widest text-slate-400">Serviços e Produtos</h2>
               <button onClick={() => {
                  setItemParaEditar(null)
                  setNovoItem({ nome: '', preco: '', tipo: 'receita', categoria: 'Geral', duracao: '30' })
                  setIsItemModalOpen(true)
                }} className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2">
                 <Plus size={14} /> Novo Item
               </button>
             </div>

             {isItemModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-0">
                  <div className="bg-slate-950 w-full max-w-md rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                      <h3 className="font-bold text-lg">{itemParaEditar ? 'Editar Item' : 'Novo Item'}</h3>
                      <button onClick={() => { setIsItemModalOpen(false); setItemParaEditar(null); }} className="text-slate-500 hover:text-rose-500 p-2 rounded-full hover:bg-white/5 transition-all"><X size={20} /></button>
                    </div>
                     <form onSubmit={handleSaveItem} className="p-6 space-y-4">
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Nome do Serviço/Produto</label>
                          <input required className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" value={novoItem.nome} onChange={e => setNovoItem(prev => ({ ...prev, nome: e.target.value }))} placeholder="Ex: Corte Degrade" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Categoria</label>
                            <input className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" value={novoItem.categoria} onChange={e => setNovoItem(prev => ({ ...prev, categoria: e.target.value }))} placeholder="Ex: Cabelo" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Preço Sugerido</label>
                            <input className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" value={novoItem.preco} onChange={e => setNovoItem(prev => ({ ...prev, preco: e.target.value }))} placeholder="0,00" />
                          </div>
                        </div>
                        {novoItem.tipo === 'receita' && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Duração (Minutos)</label>
                            <input type="number" className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" value={novoItem.duracao} onChange={e => setNovoItem(prev => ({ ...prev, duracao: e.target.value }))} placeholder="30" />
                          </div>
                        )}
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

        {/* MODAL EDITAR AGENDAMENTO */}
        {isAgendamentoModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-0">
            <div className="bg-slate-950 w-full max-w-lg rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in duration-300">
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                <h3 className="font-black text-lg uppercase tracking-widest text-emerald-500">Editar Agendamento</h3>
                <button onClick={() => setIsAgendamentoModalOpen(false)} className="text-slate-500 hover:text-rose-500 transition-all"><X size={20} /></button>
              </div>
              
              <form onSubmit={handleSaveAgendamento} className="p-8 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Nome do Cliente</label>
                    <input 
                      required 
                      type="text" 
                      className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-emerald-500 transition-all"
                      value={novoAgendamento.cliente_nome}
                      onChange={e => setNovoAgendamento(prev => ({ ...prev, cliente_nome: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase px-1">WhatsApp</label>
                    <input 
                      required 
                      type="text" 
                      className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-emerald-500 transition-all"
                      value={applyPhoneMask(novoAgendamento.cliente_whatsapp)}
                      onChange={e => setNovoAgendamento(prev => ({ ...prev, cliente_whatsapp: e.target.value.replace(/\D/g, '') }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Serviço</label>
                    <select 
                      className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-emerald-500 transition-all appearance-none"
                      value={novoAgendamento.servico_id}
                      onChange={e => setNovoAgendamento(prev => ({ ...prev, servico_id: e.target.value }))}
                    >
                      <option value="">Selecione um serviço</option>
                      {itens.map(i => (
                        <option key={i.id} value={i.id}>{i.nome} - {formatCurrency(i.preco_sugerido || 0)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Profissional</label>
                    <select 
                      className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-emerald-500 transition-all appearance-none"
                      value={novoAgendamento.membro_id}
                      onChange={e => setNovoAgendamento(prev => ({ ...prev, membro_id: e.target.value }))}
                    >
                      <option value="">Qualquer Profissional</option>
                      {membros.map(m => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Data</label>
                    <input 
                      required 
                      type="date" 
                      className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-emerald-500 transition-all color-scheme-dark"
                      value={novoAgendamento.data}
                      onChange={e => setNovoAgendamento(prev => ({ ...prev, data: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Horário</label>
                    <input 
                      required 
                      type="time" 
                      className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-emerald-500 transition-all color-scheme-dark"
                      value={novoAgendamento.hora}
                      onChange={e => setNovoAgendamento(prev => ({ ...prev, hora: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAgendamentoModalOpen(false)}
                    className="flex-1 bg-slate-900 py-4 rounded-2xl font-bold text-sm border border-white/5 active:scale-95 transition-all uppercase tracking-widest"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={agendamentoSaving}
                    className="flex-1 bg-emerald-500 py-4 rounded-2xl font-bold text-sm shadow-xl shadow-emerald-500/20 active:scale-95 transition-all uppercase tracking-widest disabled:opacity-50"
                  >
                    {agendamentoSaving ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </form>
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
                  onClick={() => copyText(`${window.location.origin}/${estab?.slug}/login`, 'login')}
                  className={`p-2 rounded-lg transition-all ${urlCopied === 'login' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                  {urlCopied === 'login' ? <CheckCircle size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-600 px-1">Compartilhe essa URL com seus funcionários para que eles façam login via PIN.</p>
            </div>

            <div className="glass-card p-6 border-emerald-500/20 space-y-3 mb-6">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">
                <Calendar size={14} /> Link de Agendamento (Clientes)
              </div>
              <div className="flex items-center gap-3 bg-slate-900 border border-white/5 rounded-xl px-4 py-3">
                <p className="text-sm text-slate-300 font-mono flex-1 break-all">
                  {window.location.origin}/{estab?.slug}/agendar
                </p>
                <button
                  onClick={() => copyText(`${window.location.origin}/${estab?.slug}/agendar`, 'agendar')}
                  className={`p-2 rounded-lg transition-all ${urlCopied === 'agendar' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                >
                  {urlCopied === 'agendar' ? <CheckCircle size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-600 px-1">Envie este link para seus clientes realizarem agendamentos online.</p>
            </div>

            <form onSubmit={handleSaveConfig} className="glass-card p-6 border-white/5 space-y-4 mb-6">
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
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase px-1">WhatsApp de Atendimento (Com DDD)</label>
                <input
                  className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  value={applyPhoneMask(configForm.whatsapp)}
                  onChange={e => setConfigForm(prev => ({ ...prev, whatsapp: e.target.value.replace(/\D/g, '') }))}
                  placeholder="(99) 9 9999-9999"
                />
                <p className="text-[9px] text-slate-600 px-1 italic">* Use apenas números, começando com 55 e o DDD.</p>
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

            <div className="glass-card p-6 border-white/5 space-y-6">
              <div>
                <h3 className="font-bold text-base mb-1 text-white">Horário de Funcionamento</h3>
                <p className="text-[10px] text-slate-500 uppercase font-bold">Defina quando sua agenda estará aberta para clientes</p>
              </div>

              <div className="space-y-3">
                {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((dia, idx) => {
                  const h = horarios.find(item => item.dia_semana === idx) || { ativo: false, hora_inicio: '08:00', hora_fim: '18:00' };
                  return (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-4 bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                      <div className="flex-1 flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-200">{dia}</p>
                        <button 
                          onClick={() => updateHorario(idx, 'ativo', !h.ativo)}
                          className={`w-10 h-6 rounded-full relative transition-all sm:hidden ${h.ativo ? 'bg-emerald-500' : 'bg-slate-700'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${h.ativo ? 'left-5' : 'left-1'}`} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="time" 
                          disabled={!h.ativo}
                          className="flex-1 sm:flex-none bg-slate-900 border border-white/5 rounded-lg p-2 text-xs text-slate-300 disabled:opacity-30" 
                          value={h.hora_inicio}
                          onChange={(e) => updateHorario(idx, 'hora_inicio', e.target.value)}
                        />
                        <span className="text-slate-600 text-[10px]">até</span>
                        <input 
                          type="time" 
                          disabled={!h.ativo}
                          className="flex-1 sm:flex-none bg-slate-900 border border-white/5 rounded-lg p-2 text-xs text-slate-300 disabled:opacity-30" 
                          value={h.hora_fim}
                          onChange={(e) => updateHorario(idx, 'hora_fim', e.target.value)}
                        />
                      </div>
                      <button 
                        onClick={() => updateHorario(idx, 'ativo', !h.ativo)}
                        className={`w-10 h-6 rounded-full relative transition-all hidden sm:block ${h.ativo ? 'bg-emerald-500' : 'bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${h.ativo ? 'left-5' : 'left-1'}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

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
                     onKeyDown={e => { if (e.key === 'Enter') { if (devPassword === import.meta.env.VITE_DEV_PASSWORD) setIsDevMode(true); else alert('Senha incorreta') } }}
                   />
                   <button 
                     onClick={() => { if(devPassword === import.meta.env.VITE_DEV_PASSWORD) setIsDevMode(true); else alert('Senha incorreta') }} 
                     className="bg-slate-800 text-slate-300 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-700 transition-all"
                   >
                     Desbloquear
                   </button>
                 </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'agenda' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <div className="flex justify-between items-center">
               <h2 className="font-black text-lg uppercase tracking-widest text-slate-400">Agenda de Clientes</h2>
               <button onClick={fetchAgendamentos} className="p-2 text-slate-500 hover:text-emerald-500 transition-all"><RefreshCw size={18} className={carregandoAgendamentos ? 'animate-spin' : ''} /></button>
            </div>

            <div className="grid grid-cols-1 gap-4">
               {agendamentos.length === 0 ? (
                 <div className="text-center p-12 glass-card border-dashed border-white/5 text-slate-600 font-bold">
                   Nenhum agendamento encontrado.
                 </div>
               ) : (
                 agendamentos.map(ag => {
                   const data = new Date(ag.data_hora_inicio);
                   return (
                     <div key={ag.id} className="glass-card p-5 border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                       <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-white/5 flex flex-col items-center justify-center text-slate-400">
                           <span className="text-[10px] font-black uppercase leading-none">{data.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                           <span className="text-lg font-black text-white leading-none mt-1">{data.getDate()}</span>
                         </div>
                         <div>
                           <div className="flex items-center gap-2">
                             <p className="font-bold text-sm text-white">{ag.cliente_nome}</p>
                             <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                               ag.status === 'pendente' ? 'bg-amber-500/10 text-amber-500' : 
                               ag.status === 'confirmado' ? 'bg-emerald-500/10 text-emerald-500' : 
                               ag.status === 'concluido' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800 text-slate-500'
                             }`}>
                               {ag.status}
                             </span>
                           </div>
                           <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                             <Clock size={10} /> {data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {ag.servicos_produtos?.nome}
                           </p>
                           <p className="text-[10px] text-emerald-500/60 font-bold uppercase tracking-widest mt-0.5">Profissional: {ag.membros_equipe?.nome || 'Qualquer'}</p>
                         </div>
                       </div>
                       
                        <div className="flex items-center gap-2 border-t border-white/5 sm:border-0 pt-3 sm:pt-0">
                          {ag.status !== 'concluido' && (
                            <button 
                              onClick={() => {
                                const servico = Array.isArray(ag.servicos_produtos) ? ag.servicos_produtos[0] : ag.servicos_produtos;
                                const preco = servico?.preco_sugerido || 0;
                                if(confirm(`Deseja finalizar o serviço de ${ag.cliente_nome} e lançar o valor de ${formatCurrency(preco)} no caixa?`)) {
                                  handleAgendamentoAction(ag, 'concluido')
                                }
                              }} 
                              className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-2"
                              title="Finalizar e Cobrar"
                            >
                              <DollarSign size={14} /> Finalizar
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              const d = new Date(ag.data_hora_inicio)
                              const hh = d.getHours().toString().padStart(2, '0')
                              const mm = d.getMinutes().toString().padStart(2, '0')
                              
                              setNovoAgendamento({
                                id: ag.id,
                                cliente_nome: ag.cliente_nome,
                                cliente_whatsapp: ag.cliente_whatsapp,
                                servico_id: ag.servico_id || '',
                                membro_id: ag.membro_id || '',
                                data: d.toISOString().split('T')[0],
                                hora: `${hh}:${mm}`,
                                status: ag.status
                              })
                              setIsAgendamentoModalOpen(true)
                            }}
                            className="p-2 bg-slate-900 text-slate-400 hover:text-emerald-500 rounded-xl border border-white/5 transition-all"
                            title="Editar Agendamento"
                          >
                            <Edit2 size={16} />
                          </button>
                          {ag.status !== 'concluido' && (
                            <button 
                              onClick={() => handleAgendamentoAction(ag, 'confirmado')} 
                              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${
                                ag.status === 'confirmado' 
                                  ? 'bg-emerald-500/20 text-emerald-500 cursor-default' 
                                  : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 active:scale-95'
                              }`}
                              title="Confirmar"
                            >
                              {ag.status === 'confirmado' ? 'Confirmado' : 'Confirmar'}
                            </button>
                          )}
                          
                          <button 
                            onClick={() => handleAgendamentoAction(ag, 'cancelado')} 
                            className={`p-2 rounded-xl border border-white/5 transition-all ${
                              ag.status === 'cancelado'
                                ? 'bg-rose-500/20 text-rose-500 cursor-default'
                                : 'bg-slate-900 text-slate-400 hover:text-rose-500'
                            }`}
                            title="Cancelar"
                          >
                            <X size={16} />
                          </button>

                          <button 
                            onClick={() => deletarAgendamento(ag.id)} 
                            className="p-2 bg-slate-900 text-slate-700 hover:text-rose-500 rounded-xl border border-white/5 transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                     </div>
                   )
                 })
               )}
            </div>
          </div>
        )}

        {activeTab === 'auditoria' && (
           <section className="space-y-6 animate-in slide-in-from-right duration-300 flex flex-col h-full max-h-screen">
              <div className="flex items-center gap-3 mb-2 flex-shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/5"><ShieldAlert size={24} /></div>
                <div>
                  <h2 className="font-black text-xl uppercase tracking-tighter">Auditoria de Segurança</h2>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Rastreamento de alterações e exclusões</p>
                </div>
              </div>

              {/* Barra de Filtros */}
              <div className="glass-card p-4 border-white/5 flex flex-col sm:flex-row gap-4 flex-shrink-0">
                <div className="flex-1 relative">
                   <input type="text" placeholder="Buscar por motivo, item ou usuário..." value={auditSearch} onChange={e => setAuditSearch(e.target.value)} className="w-full bg-slate-900 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-slate-600" />
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <select value={auditFilterAcao} onChange={e => setAuditFilterAcao(e.target.value)} className="bg-slate-900 border border-white/5 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-300 font-bold cursor-pointer">
                     <option value="todos">Todas as Ações</option>
                     <option value="edicao">Apenas Edições</option>
                     <option value="exclusao">Apenas Exclusões</option>
                     <option value="criacao_retroativa">Apenas Lanç. Retroativos</option>
                  </select>
                  <select value={auditFilterMembro} onChange={e => setAuditFilterMembro(e.target.value)} className="bg-slate-900 border border-white/5 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-slate-300 font-bold cursor-pointer">
                     <option value="todos">Todos os Usuários</option>
                     {membros.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </div>
              </div>

              {/* Visualização Híbrida: Tabela (Desktop) / Cards (Mobile) */}
              <div className="glass-card border-white/5 flex-1 min-h-0 overflow-hidden flex flex-col">
                <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1">
                  
                  {/* MOBILE VIEW (Cards Compactos) */}
                  <div className="md:hidden divide-y divide-white/5">
                    {filteredAuditData.length === 0 ? (
                         <div className="text-center py-16">
                            <History size={32} className="mx-auto text-slate-700 mb-3" />
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Nenhum registro</p>
                         </div>
                    ) : (
                      filteredAuditData.map(log => {
                          const diffs = [];
                          if (log.dados_anteriores && log.dados_novos) {
                            if (log.dados_anteriores.valor !== log.dados_novos.valor) diffs.push({ label: 'VAL', old: formatCurrency(log.dados_anteriores.valor), new: formatCurrency(log.dados_novos.valor) });
                            if (log.dados_anteriores.descricao !== log.dados_novos.descricao) diffs.push({ label: 'DESC', old: log.dados_anteriores.descricao, new: log.dados_novos.descricao });
                            if (log.dados_anteriores.data_competencia !== log.dados_novos.data_competencia) diffs.push({ label: 'DATA', old: log.dados_anteriores.data_competencia?.split('-').reverse().join('/') || '', new: log.dados_novos.data_competencia?.split('-').reverse().join('/') || '' });
                          }
                          
                          const isExc = log.acao === 'exclusao';
                          const isEdi = log.acao === 'edicao';

                          return (
                            <div key={log.id} className="p-4 space-y-3 hover:bg-white/[0.02] transition-colors">
                              <div className="flex justify-between items-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-black uppercase text-[8px] tracking-wider ${
                                   isExc ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
                                   isEdi ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                                   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                 }`}>
                                   {isExc ? <Trash2 size={10} /> : isEdi ? <Edit2 size={10} /> : <Plus size={10} />}
                                   {isExc ? 'Exclusão' : isEdi ? 'Edição' : 'Retroativo'}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono tracking-tighter">{new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              
                              <p className="text-xs font-medium text-slate-300 leading-snug">
                                <span className="font-black text-white">{log.membros_equipe?.nome}</span> alterou o item <span className="text-emerald-400 font-bold">"{log.transacoes?.descricao || log.dados_anteriores?.descricao || 'Item Removido'}"</span>
                              </p>

                              <div className="bg-white/5 border border-white/5 p-2 rounded-lg flex gap-2">
                                <MessageCircle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                                <span className="text-[11px] text-amber-500/90 italic">{log.motivo || 'Sem justificativa'}</span>
                              </div>

                              {diffs.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                  {diffs.map((d, i) => (
                                    <div key={i} className="flex items-center gap-2 text-[10px]">
                                        <span className="text-slate-600 font-black uppercase tracking-widest w-8 shrink-0">{d.label}:</span>
                                        <span className="text-rose-400/60 line-through truncate max-w-[80px]" title={d.old}>{d.old}</span>
                                        <ArrowRight size={10} className="text-slate-600 shrink-0" />
                                        <span className="text-emerald-400 font-bold truncate max-w-[80px]" title={d.new}>{d.new}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                      })
                    )}
                  </div>

                  {/* DESKTOP VIEW (Data Table) */}
                  <table className="hidden md:table w-full text-left border-collapse whitespace-nowrap">
                    <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10">
                      <tr className="border-b border-white/5">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Data / Hora</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Usuário</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Ação</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Item Afetado</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-1/4">Motivo / Justificativa</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Alterações (Antes ➔ Depois)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredAuditData.length === 0 ? (
                         <tr>
                           <td colSpan={6} className="text-center py-16">
                              <History size={32} className="mx-auto text-slate-700 mb-3" />
                              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Nenhum registro encontrado</p>
                           </td>
                         </tr>
                      ) : (
                         filteredAuditData.map(log => {
                            const diffs = [];
                            if (log.dados_anteriores && log.dados_novos) {
                              if (log.dados_anteriores.valor !== log.dados_novos.valor) diffs.push({ label: 'VAL', old: formatCurrency(log.dados_anteriores.valor), new: formatCurrency(log.dados_novos.valor) });
                              if (log.dados_anteriores.descricao !== log.dados_novos.descricao) diffs.push({ label: 'DESC', old: log.dados_anteriores.descricao, new: log.dados_novos.descricao });
                              if (log.dados_anteriores.data_competencia !== log.dados_novos.data_competencia) diffs.push({ label: 'DATA', old: log.dados_anteriores.data_competencia?.split('-').reverse().join('/') || '', new: log.dados_novos.data_competencia?.split('-').reverse().join('/') || '' });
                            }
                            
                            const isExc = log.acao === 'exclusao';
                            const isEdi = log.acao === 'edicao';
                            
                            return (
                               <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                                 <td className="px-6 py-4 text-xs text-slate-400 font-mono tracking-tight">{new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                                 <td className="px-6 py-4 text-xs font-black text-slate-200">{log.membros_equipe?.nome}</td>
                                 <td className="px-6 py-4 text-xs">
                                   <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-bold uppercase text-[9px] tracking-wider ${
                                     isExc ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
                                     isEdi ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                                     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                   }`}>
                                     {isExc ? <Trash2 size={10} /> : isEdi ? <Edit2 size={10} /> : <Plus size={10} />}
                                     {isExc ? 'Exclusão' : isEdi ? 'Edição' : 'Retroativo'}
                                   </span>
                                 </td>
                                 <td className="px-6 py-4 text-xs font-bold text-slate-300 max-w-[200px] truncate" title={log.transacoes?.descricao || log.dados_anteriores?.descricao}>
                                   {log.transacoes?.descricao || log.dados_anteriores?.descricao || 'Item Removido'}
                                 </td>
                                 <td className="px-6 py-4 text-xs text-amber-500/90 italic max-w-[250px] truncate" title={log.motivo}>
                                   {log.motivo || '-'}
                                 </td>
                                 <td className="px-6 py-4 text-[11px] space-y-1.5">
                                    {diffs.length > 0 ? diffs.map((d, i) => (
                                       <div key={i} className="flex items-center gap-2">
                                          <span className="text-slate-600 font-black uppercase text-[9px] tracking-widest w-8 shrink-0">{d.label}:</span>
                                          <span className="text-rose-400/60 line-through truncate max-w-[100px]" title={d.old}>{d.old}</span>
                                          <ArrowRight size={10} className="text-slate-600 shrink-0" />
                                          <span className="text-emerald-400 font-bold truncate max-w-[100px]" title={d.new}>{d.new}</span>
                                       </div>
                                    )) : (
                                       <span className="text-slate-600 italic text-[10px]">Sem alterações numéricas</span>
                                    )}
                                 </td>
                               </tr>
                            )
                         })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
           </section>
        )}

        {activeTab === 'relatorios' && (
          <div className="space-y-6 animate-in fade-in duration-300 print:space-y-0">
             <div className="flex items-center justify-between mb-6 print:hidden">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500"><PieChart size={20} /></div>
                  <div>
                    <h2 className="font-bold text-lg text-white">Relatórios de Produção</h2>
                    <p className="text-xs text-slate-400">Emissão de comissões e fechamento</p>
                  </div>
                </div>
             </div>
             
             {/* Print Header */}
             <div className="hidden print:block text-center mb-8">
                <h1 className="text-2xl font-black text-black">{estab?.nome || 'GFin'}</h1>
                <p className="text-sm text-gray-500">Relatório de Produção e Comissões</p>
                <p className="text-xs text-gray-400">Período: {relatorioFiltro.dataInicio.split('-').reverse().join('/')} a {relatorioFiltro.dataFim.split('-').reverse().join('/')}</p>
             </div>

             <div className="glass-card p-6 border-white/5 space-y-6 print:hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Data Inicial</label>
                    <input type="date" className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" value={relatorioFiltro.dataInicio} onChange={e => setRelatorioFiltro(prev => ({ ...prev, dataInicio: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Data Final</label>
                    <input type="date" className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" value={relatorioFiltro.dataFim} onChange={e => setRelatorioFiltro(prev => ({ ...prev, dataFim: e.target.value }))} />
                  </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Profissionais (Deixe vazio para todos)</label>
                   <div className="flex flex-wrap gap-2">
                     {membros.map(m => {
                       const isSelected = relatorioFiltro.membrosIds.includes(m.id)
                       return (
                         <button 
                           key={m.id}
                           onClick={() => {
                             setRelatorioFiltro(prev => ({
                               ...prev,
                               membrosIds: isSelected ? prev.membrosIds.filter(id => id !== m.id) : [...prev.membrosIds, m.id]
                             }))
                           }}
                           className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isSelected ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-slate-900 text-slate-400 border-white/5 hover:border-white/20'}`}
                         >
                           {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                           {m.nome}
                         </button>
                       )
                     })}
                   </div>
                </div>

                <button 
                  onClick={gerarRelatorio} 
                  disabled={gerandoRelatorio}
                  className="w-full py-3 bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex justify-center items-center gap-2"
                >
                  {gerandoRelatorio ? 'Processando...' : <><PieChart size={18} /> Gerar Relatório</>}
                </button>
             </div>

             {relatorioDados.length > 0 && (
               <div className="glass-card overflow-hidden border-white/5 print:border-none print:shadow-none print:bg-white print:text-black">
                 <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse">
                     <thead>
                       <tr className="bg-slate-900/50 text-[10px] uppercase tracking-widest text-slate-500 print:bg-gray-100 print:text-gray-700 border-b border-white/5 print:border-gray-200">
                         <th className="p-4 font-bold">Profissional</th>
                         <th className="p-4 font-bold text-center">Serviços</th>
                         <th className="p-4 font-bold text-right">Total Produzido</th>
                         <th className="p-4 font-bold text-center">Comissão (%)</th>
                         <th className="p-4 font-bold text-right text-emerald-500 print:text-emerald-700">Comissão Devida</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5 print:divide-gray-200 text-sm">
                       {relatorioDados.map((row, i) => (
                         <tr key={i} className="hover:bg-white/5 print:hover:bg-transparent transition-colors">
                           <td className="p-4 font-bold text-white print:text-black">{row.nome}</td>
                           <td className="p-4 text-center text-slate-400 print:text-gray-600">{row.qtd_servicos}</td>
                           <td className="p-4 text-right text-slate-300 print:text-gray-800">{formatCurrency(row.total_receita)}</td>
                           <td className="p-4 text-center text-slate-500 print:text-gray-500">{row.comissao_pct}%</td>
                           <td className="p-4 text-right font-black text-emerald-400 print:text-emerald-600">{formatCurrency(row.total_comissao)}</td>
                         </tr>
                       ))}
                       {/* Linha de Totais */}
                       <tr className="bg-slate-900/30 print:bg-gray-50 border-t-2 border-white/10 print:border-gray-300">
                         <td className="p-4 font-black text-indigo-400 print:text-indigo-700">TOTAL</td>
                         <td className="p-4 text-center font-bold text-slate-300 print:text-gray-700">{relatorioDados.reduce((a, b) => a + b.qtd_servicos, 0)}</td>
                         <td className="p-4 text-right font-bold text-slate-300 print:text-gray-700">{formatCurrency(relatorioDados.reduce((a, b) => a + b.total_receita, 0))}</td>
                         <td className="p-4 text-center font-bold text-slate-500 print:text-gray-500">-</td>
                         <td className="p-4 text-right font-black text-emerald-400 print:text-emerald-700">{formatCurrency(relatorioDados.reduce((a, b) => a + b.total_comissao, 0))}</td>
                       </tr>
                     </tbody>
                   </table>
                 </div>
                 
                 <div className="p-4 bg-slate-900/50 border-t border-white/5 flex flex-col sm:flex-row gap-4 print:hidden">
                   <button onClick={() => window.print()} className="flex-1 py-3 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-all flex justify-center items-center gap-2">
                     <Printer size={16} /> Salvar PDF
                   </button>
                   <button onClick={baixarCSV} className="flex-1 py-3 bg-indigo-500/10 text-indigo-400 rounded-xl font-bold hover:bg-indigo-500 hover:text-white transition-all flex justify-center items-center gap-2">
                     <Download size={16} /> Baixar Planilha
                   </button>
                 </div>
               </div>
             )}
          </div>
        )}
      </main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-slate-950/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-2 z-40">
        <button onClick={() => { setActiveTab('resumo'); setIsMoreMenuOpen(false); }} className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'resumo' && !isMoreMenuOpen ? 'text-emerald-500 scale-110' : 'text-slate-500'}`}>
          <PieChart size={20} />
          <span className="text-[9px] font-bold uppercase">Resumo</span>
        </button>
        <button onClick={() => { setActiveTab('transacoes'); setIsMoreMenuOpen(false); }} className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'transacoes' && !isMoreMenuOpen ? 'text-emerald-500 scale-110' : 'text-slate-500'}`}>
          <List size={20} />
          <span className="text-[9px] font-bold uppercase">Lista</span>
        </button>
        
        {cargo === 'administrador' ? (
          <>
            <button onClick={() => { setActiveTab('equipe'); setIsMoreMenuOpen(false); }} className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'equipe' && !isMoreMenuOpen ? 'text-emerald-500 scale-110' : 'text-slate-500'}`}>
              <Users size={20} />
              <span className="text-[9px] font-bold uppercase">Equipe</span>
            </button>
            <button onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)} className={`flex flex-col items-center gap-1 transition-all flex-1 ${isMoreMenuOpen ? 'text-emerald-500 scale-110' : 'text-slate-500'}`}>
              <MoreVertical size={20} />
              <span className="text-[9px] font-bold uppercase">Mais</span>
            </button>
          </>
        ) : (
          <button onClick={() => { setActiveTab('itens'); setIsMoreMenuOpen(false); }} className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'itens' && !isMoreMenuOpen ? 'text-emerald-500 scale-110' : 'text-slate-500'}`}>
            <Scissors size={20} />
            <span className="text-[9px] font-bold uppercase">Itens</span>
          </button>
        )}
      </nav>

      {/* Menu "Mais" Mobile */}
      {isMoreMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-30 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMoreMenuOpen(false)} />
          <div className="bg-slate-900 border-t border-white/10 rounded-t-3xl p-6 pb-28 animate-in slide-in-from-bottom-8 duration-300 relative z-40 space-y-2 shadow-2xl">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 px-2">Gerenciamento</h3>
            
            <button onClick={() => { setActiveTab('agenda'); setIsMoreMenuOpen(false); }} className="w-full flex items-center gap-4 bg-white/5 hover:bg-white/10 p-4 rounded-2xl transition-all">
              <div className="bg-slate-800 p-2 rounded-xl text-emerald-400"><Calendar size={20} /></div>
              <span className="font-bold text-sm">Agenda de Clientes</span>
            </button>
            <button onClick={() => { setActiveTab('itens'); setIsMoreMenuOpen(false); }} className="w-full flex items-center gap-4 bg-white/5 hover:bg-white/10 p-4 rounded-2xl transition-all">
              <div className="bg-slate-800 p-2 rounded-xl text-emerald-500"><Scissors size={20} /></div>
              <span className="font-bold text-sm">Serviços e Produtos</span>
            </button>
            <button onClick={() => { setActiveTab('relatorios'); setIsMoreMenuOpen(false); }} className="w-full flex items-center gap-4 bg-white/5 hover:bg-white/10 p-4 rounded-2xl transition-all">
              <div className="bg-slate-800 p-2 rounded-xl text-indigo-500"><PieChart size={20} /></div>
              <span className="font-bold text-sm">Relatórios de Produção</span>
            </button>
            <button onClick={() => { setActiveTab('auditoria'); setIsMoreMenuOpen(false); }} className="w-full flex items-center gap-4 bg-white/5 hover:bg-white/10 p-4 rounded-2xl transition-all">
              <div className="bg-slate-800 p-2 rounded-xl text-amber-500"><ShieldAlert size={20} /></div>
              <span className="font-bold text-sm">Auditoria</span>
            </button>
            <button onClick={() => { setActiveTab('config'); setIsMoreMenuOpen(false); }} className="w-full flex items-center gap-4 bg-white/5 hover:bg-white/10 p-4 rounded-2xl transition-all">
              <div className="bg-slate-800 p-2 rounded-xl text-slate-400"><Settings size={20} /></div>
              <span className="font-bold text-sm">Configurações do App</span>
            </button>
          </div>
        </div>
      )}

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
