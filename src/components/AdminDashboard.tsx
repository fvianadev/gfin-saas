import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ArrowLeft, ArrowRight, TrendingUp, TrendingDown, Lock, Shield, Calendar, Filter, ArrowUpRight, ArrowDownLeft, Trash2, Edit2, Plus, Users, DollarSign, LayoutDashboard, MoreVertical, PieChart, List, Settings, Copy, Link2, CheckCircle, MessageCircle, ShieldAlert, History, User, Scissors, Search, X, Download, Printer, CheckSquare, Square, RefreshCw, Clock, Award, ShoppingBag, Percent, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { TransactionModal } from './TransactionModal'
import { formatCurrency, formatDateTime } from '../lib/format'
import { extractPathFromSupabaseUrl } from '../lib/storage'

interface AdminDashboardProps {
  onBack: () => void
  estabelecimentoId: string
  membroId: string
  cargo: 'administrador' | 'usuario'
  isOwner: boolean
}

type Periodo = 'hoje' | '7dias' | '30dias' | 'todos'
type Tab = 'resumo' | 'transacoes' | 'equipe' | 'config' | 'auditoria' | 'itens' | 'relatorios' | 'agenda'

export function AdminDashboard({ onBack, estabelecimentoId, membroId, cargo, isOwner }: AdminDashboardProps) {
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
  const [filtroMembro, setFiltroMembro] = useState<string>('todos')
  const [agendamentos, setAgendamentos] = useState<any[]>([])
  const [carregandoAgendamentos, setCarregandoAgendamentos] = useState(false)

  const { filteredTransactions, stats } = useMemo(() => {
    let filtered = transactions;

    if (tipoFiltro !== 'todos') {
      filtered = filtered.filter(t => t.tipo === tipoFiltro);
    }

    if (searchTx.trim()) {
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

    return {
      filteredTransactions: filtered,
      stats: calcStats
    }
  }, [transactions, tipoFiltro, searchTx, cargo])

  const dashboardMetrics = useMemo(() => {
    let filteredTxs = transactions;

    if (isOwner && filtroMembro !== 'todos') {
      filteredTxs = transactions.filter(t => t.membro_id === filtroMembro);
    }

    const receitas = filteredTxs.filter(t => t.tipo === 'receita');
    const despesas = filteredTxs.filter(t => t.tipo === 'despesa');

    const totalReceitas = receitas.reduce((acc, t) => acc + Number(t.valor), 0);
    const totalDespesas = despesas.reduce((acc, t) => acc + Number(t.valor), 0);
    const lucroLiquido = totalReceitas - totalDespesas;
    const ticketMedio = receitas.length > 0 ? totalReceitas / receitas.length : 0;

    let comissoesTotais = 0;
    let comissaoPessoal = 0;

    const profissionalMap: { [key: string]: { nome: string; faturamento: number; comissao: number; quantidade: number } } = {};
    const servicosMap: { [key: string]: { nome: string; quantidade: number; total: number } } = {};

    transactions.forEach(t => {
      if (t.tipo === 'receita') {
        const mPct = Number(t.membros_equipe?.percentual_comissao) || 0;
        const vComissao = Number(t.valor) * (mPct / 100);

        comissoesTotais += vComissao;
        if (t.membro_id === membroId) {
          comissaoPessoal += vComissao;
        }

        const mId = t.membro_id;
        const mNome = t.membros_equipe?.nome || 'Profissional';
        if (!profissionalMap[mId]) {
          profissionalMap[mId] = { nome: mNome, faturamento: 0, comissao: 0, quantidade: 0 };
        }
        profissionalMap[mId].faturamento += Number(t.valor);
        profissionalMap[mId].comissao += vComissao;
        profissionalMap[mId].quantidade += 1;
      }
    });

    receitas.forEach(t => {
      const desc = t.descricao || 'Geral';
      if (!servicosMap[desc]) {
        servicosMap[desc] = { nome: desc, quantidade: 0, total: 0 };
      }
      servicosMap[desc].quantidade += 1;
      servicosMap[desc].total += Number(t.valor);
    });

    const rankingProfissionais = Object.entries(profissionalMap).map(([id, info]) => ({
      id,
      ...info
    })).sort((a, b) => b.faturamento - a.faturamento);

    const rankingServicos = Object.values(servicosMap).sort((a, b) => b.quantidade - a.quantidade);

    let filteredAgendamentos = agendamentos;
    if (cargo === 'usuario') {
      filteredAgendamentos = agendamentos.filter(a => a.membro_id === membroId);
    } else if (filtroMembro !== 'todos') {
      filteredAgendamentos = agendamentos.filter(a => a.membro_id === filtroMembro);
    }

    const totalAgendamentos = filteredAgendamentos.length;
    const agendamentosConcluidos = filteredAgendamentos.filter(a => a.status === 'concluido').length;
    const agendamentosCancelados = filteredAgendamentos.filter(a => a.status === 'cancelado').length;
    const agendamentosPendentes = filteredAgendamentos.filter(a => a.status === 'pendente' || a.status === 'confirmado').length;

    const grouped = filteredTxs.reduce((acc: any, t) => {
      const date = t.data_competencia ? t.data_competencia.split('-').reverse().slice(0, 2).join('/') : new Date(t.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (!acc[date]) acc[date] = { name: date, receita: 0, despesa: 0 };
      if (t.tipo === 'receita') acc[date].receita += Number(t.valor);
      else acc[date].despesa += Number(t.valor);
      return acc;
    }, {});

    const chartData = Object.values(grouped).reverse();

    return {
      totalReceitas,
      totalDespesas,
      lucroLiquido,
      ticketMedio,
      comissoesTotais,
      comissaoPessoal,
      rankingProfissionais,
      rankingServicos,
      totalAgendamentos,
      agendamentosConcluidos,
      agendamentosCancelados,
      agendamentosPendentes,
      chartData
    };
  }, [transactions, agendamentos, cargo, filtroMembro, membroId])
  const [loading, setLoading] = useState(true)
  const [auditData, setAuditData] = useState<any[]>([])
  const [auditFilterAcao, setAuditFilterAcao] = useState<string>('todos')
  const [auditFilterMembro, setAuditFilterMembro] = useState<string>('todos')
  const [auditSearch, setAuditSearch] = useState<string>('')
  const [agendaFilterProf, setAgendaFilterProf] = useState<string>(cargo === 'usuario' ? membroId : 'todos')
  const [agendaFilterStatus, setAgendaFilterStatus] = useState<string>('todos')
  const [agendaFilterDataIni, setAgendaFilterDataIni] = useState<string>('')
  const [agendaFilterDataFim, setAgendaFilterDataFim] = useState<string>('')
  const [agendaSearch, setAgendaSearch] = useState('')

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

  const filteredAgendamentos = useMemo(() => {
    const term = agendaSearch.toLowerCase().trim()
    return agendamentos.filter(ag => {
      const matchProf = agendaFilterProf === 'todos' || ag.membro_id === agendaFilterProf;
      const matchStatus = agendaFilterStatus === 'todos' || ag.status === agendaFilterStatus;
      const dataAg = new Date(ag.data_hora_inicio).toISOString().split('T')[0];
      const matchDataIni = !agendaFilterDataIni || dataAg >= agendaFilterDataIni;
      const matchDataFim = !agendaFilterDataFim || dataAg <= agendaFilterDataFim;
      const servico = Array.isArray(ag.servicos_produtos) ? ag.servicos_produtos[0] : ag.servicos_produtos;
      const servicoNome = servico?.nome || '';
      const matchSearch = !term ||
        ag.cliente_nome.toLowerCase().includes(term) ||
        ag.cliente_whatsapp?.toLowerCase().includes(term) ||
        servicoNome.toLowerCase().includes(term) ||
        (ag.membros_equipe?.nome || '').toLowerCase().includes(term) ||
        ag.status.toLowerCase().includes(term);
      return matchProf && matchStatus && matchDataIni && matchDataFim && matchSearch;
    });
  }, [agendamentos, agendaFilterProf, agendaFilterStatus, agendaFilterDataIni, agendaFilterDataFim, agendaSearch]);

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
  const [servicoSearch, setServicoSearch] = useState('')
  const [novoItem, setNovoItem] = useState({ nome: '', preco: '', tipo: 'receita' as 'receita' | 'despesa', categoria: 'Geral', duracao: '30', imagem_url: '' })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [itemParaEditar, setItemParaEditar] = useState<string | null>(null)
  const [itemSaving, setItemSaving] = useState(false)
  const filteredItens = useMemo(() => {
    const term = servicoSearch.toLowerCase()
    return itens.filter(item =>
      item.nome.toLowerCase().includes(term) ||
      item.categoria?.toLowerCase().includes(term)
    )
  }, [itens, servicoSearch])

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

  const [whatsappPrompt, setWhatsappPrompt] = useState<{
    isOpen: boolean;
    mensagem: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null)
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    variant: 'success' | 'error' | 'confirm';
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
  } | null>(null)
  const [isDevMode, setIsDevMode] = useState(false)

  const closeFeedbackModal = () => setFeedbackModal(null)

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
      const defaultTrialDias = saasConfig?.trial_dias || 7
      if (!trialEnd) return { status: 'active', daysLeft: defaultTrialDias, showWarning: false }

      const diffTime = new Date(trialEnd).getTime() - new Date(todayStr).getTime()
      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (daysLeft < 0) {
        return { status: 'blocked', daysLeft: 0, showWarning: false, reason: 'trial_expired' }
      }

      // Aviso se faltar os dias de aviso configurados ou menos
      const avisoDias = saasConfig?.aviso_trial_dias || 3
      if (daysLeft <= avisoDias) {
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

      // Carência automática configurada no banco (grace_period_dias) após vencimento
      const gracePeriod = saasConfig?.grace_period_dias || 5
      if (daysLeft < -gracePeriod) {
        return { status: 'blocked', daysLeft: 0, showWarning: false, reason: 'expired' }
      }

      // Dentro da carência automática
      if (daysLeft < 0) {
        const graceDaysLeft = gracePeriod + daysLeft
        return { status: 'warning', daysLeft: graceDaysLeft, showWarning: true, reason: 'grace_period', dueDate }
      }

      return { status: 'active', daysLeft, showWarning: false }
    }

    return { status: 'active', daysLeft: 0, showWarning: false }
  }, [estab, saasConfig])

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

  const abrirRelatorioPDF = () => {
    if (relatorioDados.length === 0) return
    const nomeEstab = estab?.nome || 'GFin'
    const dataIni = relatorioFiltro.dataInicio.split('-').reverse().join('/')
    const dataFim = relatorioFiltro.dataFim.split('-').reverse().join('/')
    const dataEmissao = new Date().toLocaleDateString('pt-BR')

    const linhas = relatorioDados.map(row => `
      <tr>
        <td>${row.nome}</td>
        <td style="text-align:center">${row.qtd_servicos}</td>
        <td style="text-align:right">${formatCurrency(row.total_receita)}</td>
        <td style="text-align:center">${row.comissao_pct}%</td>
        <td style="text-align:right">${formatCurrency(row.total_comissao)}</td>
      </tr>
    `).join('')

    const totalServicos = relatorioDados.reduce((a, b) => a + b.qtd_servicos, 0)
    const totalReceita = relatorioDados.reduce((a, b) => a + b.total_receita, 0)
    const totalComissao = relatorioDados.reduce((a, b) => a + b.total_comissao, 0)

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Relatório - ${nomeEstab}</title>
<style>
  @page { margin: 1.5cm 1.8cm; size: A4 portrait; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Outfit', Arial, Helvetica, sans-serif;
    font-size: 10pt;
    line-height: 1.5;
    color: #111827;
    background: white;
    padding: 0 1.8cm;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin: 1.2cm 0 0.6cm;
    padding-bottom: 0.5cm;
    border-bottom: 3px solid #059669;
  }
  .header h1 { font-size: 20pt; font-weight: 900; color: #065f46; letter-spacing: -0.02em; }
  .header .sub { font-size: 10pt; color: #6b7280; margin-top: 2px; }
  .header .meta { text-align: right; font-size: 8pt; color: #6b7280; line-height: 1.6; }
  .header .meta strong { color: #374151; }
  .periodo {
    text-align: center;
    margin: 0 0 0.6cm;
    padding: 8pt 16pt;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 4pt;
    font-weight: 700;
    font-size: 10pt;
    color: #166534;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 0.5cm;
  }
  thead th {
    background: #ecfdf5;
    color: #065f46;
    font-weight: 800;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 10pt 12pt;
    text-align: left;
    border-bottom: 2px solid #059669;
  }
  thead th:nth-child(2) { text-align: center; }
  thead th:nth-child(3) { text-align: right; }
  thead th:nth-child(4) { text-align: center; }
  thead th:nth-child(5) { text-align: right; }
  tbody td {
    padding: 8pt 12pt;
    border-bottom: 1px solid #e5e7eb;
    font-size: 9.5pt;
    color: #1f2937;
  }
  tbody tr:nth-child(even) { background: #f9fafb; }
  .total-row td {
    font-weight: 800;
    font-size: 10pt;
    border-top: 2px solid #059669;
    border-bottom: 2px solid #059669;
    background: #ecfdf5;
    color: #065f46;
  }
  .footer {
    margin-top: 0.8cm;
    padding-top: 0.4cm;
    border-top: 1px solid #d1d5db;
    display: flex;
    justify-content: space-between;
    font-size: 7.5pt;
    color: #9ca3af;
  }
  .assinatura {
    margin-top: 1cm;
    padding-top: 4pt;
    border-top: 1px solid #9ca3af;
    display: inline-block;
    min-width: 180pt;
    text-align: center;
    font-size: 8pt;
    color: #6b7280;
  }
  .btn-group {
    display: flex;
    gap: 8pt;
    margin: 0.5cm 0;
  }
  .btn {
    flex: 1;
    padding: 12pt;
    border: none;
    border-radius: 8pt;
    font-size: 11pt;
    font-weight: 700;
    cursor: pointer;
    text-align: center;
    text-decoration: none;
  }
  .btn-print { background: #059669; color: white; }
  .btn-print:hover { background: #047857; }
  .btn-close { background: #e5e7eb; color: #374151; }
  .btn-close:hover { background: #d1d5db; }
  @media print {
    .btn-group { display: none; }
    body { padding: 0; }
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${nomeEstab}</h1>
      <p class="sub">Relatório de Produção e Comissões</p>
    </div>
    <div class="meta">
      <div><strong>Emissão:</strong> ${dataEmissao}</div>
      <div><strong>Período:</strong> ${dataIni} a ${dataFim}</div>
    </div>
  </div>

  <div class="periodo">Período: ${dataIni} — ${dataFim}</div>

  <table>
    <thead>
      <tr>
        <th>Profissional</th>
        <th>Serviços</th>
        <th>Total Produzido</th>
        <th>Comissão (%)</th>
        <th>Comissão Devida</th>
      </tr>
    </thead>
    <tbody>
      ${linhas}
      <tr class="total-row">
        <td>TOTAL</td>
        <td style="text-align:center">${totalServicos}</td>
        <td style="text-align:right">${formatCurrency(totalReceita)}</td>
        <td style="text-align:center">-</td>
        <td style="text-align:right">${formatCurrency(totalComissao)}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <div>GFin — Sistema de Gestão Financeira</div>
    <div class="assinatura">Assinatura do Responsável</div>
  </div>

  <div class="btn-group">
    <button class="btn btn-print" onclick="window.print()">Imprimir / Salvar PDF</button>
    <button class="btn btn-close" onclick="window.close()">Fechar</button>
  </div>
</body>
</html>`

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
    }
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
      fetchAdminData()
      setFeedbackModal({
        isOpen: true,
        variant: 'success',
        title: 'Dados demo gerados',
        message: 'Lançamentos fictícios criados com sucesso. Eles estão marcados com a tag [DEMO].',
        onConfirm: closeFeedbackModal,
      })
    } else {
      setFeedbackModal({
        isOpen: true,
        variant: 'error',
        title: 'Erro ao gerar',
        message: 'Não foi possível gerar os dados demo: ' + error.message,
        onConfirm: closeFeedbackModal,
      })
    }
  }

  const removeDemoData = () => {
    setFeedbackModal({
      isOpen: true,
      variant: 'confirm',
      title: 'Limpar dados demo',
      message: 'Isso apagará TODAS as transações com [DEMO] no nome neste estabelecimento. Deseja continuar?',
      onCancel: closeFeedbackModal,
      onConfirm: async () => {
        closeFeedbackModal()
        setConfigSaving(true)
        const { error } = await supabase
          .from('transacoes')
          .delete()
          .eq('estabelecimento_id', estabelecimentoId)
          .like('descricao', '%[DEMO]%')

        setConfigSaving(false)
        if (!error) {
          fetchAdminData()
          setFeedbackModal({
            isOpen: true,
            variant: 'success',
            title: 'Dados demo removidos',
            message: 'Todos os lançamentos com a tag [DEMO] foram excluídos com sucesso.',
            onConfirm: closeFeedbackModal,
          })
        } else {
          setFeedbackModal({
            isOpen: true,
            variant: 'error',
            title: 'Erro ao limpar',
            message: 'Não foi possível remover os dados demo: ' + error.message,
            onConfirm: closeFeedbackModal,
          })
        }
      },
    })
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
    fetchAgendamentos()
    if (activeTab === 'auditoria') fetchAuditData()
    if (activeTab === 'itens' || activeTab === 'agenda') fetchItens()
    if (activeTab === 'config') fetchHorarios()
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

        // Verifica se já existe transação para este agendamento
        const { data: txExist, error: errCheck } = await supabase
          .from('transacoes')
          .select('id')
          .eq('agendamento_id', ag.id)
          .single();

        if (errCheck && errCheck.code !== 'PGRST116') { // ignore not-found error
          console.error('Erro ao checar transação existente:', errCheck);
          alert('Não foi possível verificar transação existente.');
          return;
        }

        if (txExist) {
          alert('Esta agenda já foi finalizada e a transação já foi lançada.');
          fetchAgendamentos();
          return;
        }

        const { error: errorTx } = await supabase.from('transacoes').insert({
          estabelecimento_id: estabelecimentoId,
          membro_id: ag.membro_id || membroId,
          tipo: 'receita',
          valor: preco,
          descricao: `Agendamento: ${ag.cliente_nome} (${ag.servicos_produtos?.nome || 'Serviço'})`,
          categoria: ag.servicos_produtos?.categoria || 'Geral',
          data_competencia: new Date().toISOString().split('T')[0],
          agendamento_id: ag.id
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
        const msgTexto = novoStatus === 'confirmado'
          ? `Agendamento confirmado! Deseja enviar o WhatsApp de confirmação para ${ag.cliente_nome}?`
          : `Agendamento cancelado. Deseja enviar o aviso de indisponibilidade para ${ag.cliente_nome}?`;

        setWhatsappPrompt({
          isOpen: true,
          mensagem: msgTexto,
          onConfirm: () => {
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
            setWhatsappPrompt(null)
          },
          onCancel: () => {
            setWhatsappPrompt(null)
          }
        })
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

  // Lista de categorias únicas (case-insensitive) derivada dos itens
  const availableCategories = useMemo<string[]>(() => {
    const map = new Map<string, string>();
    (itens || []).forEach((it: any) => {
      const c = (it.categoria || '').toString().trim()
      if (!c) return
      const key = c.toLowerCase()
      if (!map.has(key)) map.set(key, c.toUpperCase())
    })
    return Array.from(map.values())
  }, [itens])

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoItem.nome.trim()) return
    setItemSaving(true)

    let finalImageUrl = itemParaEditar ? novoItem.imagem_url : ''

    if (imageFile) {
      try {
        const fileExt = imageFile.name.split('.').pop()
        const randomId = typeof crypto !== 'undefined' && crypto.randomUUID 
          ? crypto.randomUUID() 
          : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
        const fileName = `${estabelecimentoId}/${randomId}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('servicos')
          .upload(fileName, imageFile, {
            cacheControl: '3600',
            upsert: true
          })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('servicos')
          .getPublicUrl(fileName)

        finalImageUrl = publicUrl

      } catch (err: any) {
        console.error('Erro no upload da imagem:', err)
        alert('Erro ao subir imagem (salvaremos os outros dados): ' + err.message)
      }
    }

    // Se estiver editando, deleta a imagem antiga se foi alterada ou removida por completo
    if (itemParaEditar) {
      const itemAntigo = itens.find(it => it.id === itemParaEditar)
      const urlAntiga = itemAntigo?.imagem_url
      const urlNova = finalImageUrl || ''
      if (urlAntiga && urlAntiga !== urlNova) {
        const pathAntigo = extractPathFromSupabaseUrl(urlAntiga, 'servicos')
        if (pathAntigo) {
          supabase.storage.from('servicos').remove([pathAntigo]).then(({ error }) => {
            if (error) console.error('Erro ao deletar imagem antiga do Storage:', error)
          })
        }
      }
    }

    const payload = {
      estabelecimento_id: estabelecimentoId,
      nome: (novoItem.nome || '').toString().trim().toUpperCase(),
      preco_sugerido: novoItem.preco ? parseFloat(novoItem.preco.toString().replace(',', '.')) : null,
      tipo: novoItem.tipo,
      categoria: (novoItem.categoria || '').toString().trim().toUpperCase(),
      duracao_minutos: parseInt(novoItem.duracao) || 30,
      imagem_url: finalImageUrl || null
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
      setNovoItem({ nome: '', preco: '', tipo: 'receita', categoria: 'Geral', duracao: '30', imagem_url: '' })
      setImageFile(null)
      setItemParaEditar(null)
      setIsItemModalOpen(false)
      fetchItens()
    } else alert('Erro ao salvar item: ' + error.message)
  }

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return
    
    const itemDeletado = itens.find(it => it.id === id)
    const urlImagemAntiga = itemDeletado?.imagem_url

    const { error } = await supabase.from('servicos_produtos').delete().eq('id', id)
    if (!error) {
      fetchItens()

      if (urlImagemAntiga) {
        const pathAntigo = extractPathFromSupabaseUrl(urlImagemAntiga, 'servicos')
        if (pathAntigo) {
          supabase.storage.from('servicos').remove([pathAntigo]).then(({ error: deleteErr }) => {
            if (deleteErr) console.error('Erro ao deletar imagem do serviço removido:', deleteErr)
          })
        }
      }
    } else {
      // Tratamento amigável quando há dependências (ex.: agendamentos usando o serviço)
      const msg = (error && error.message) || ''
      const isForeignKey = typeof msg === 'string' && (msg.toLowerCase().includes('violates foreign key') || msg.toLowerCase().includes('foreign key'))

      if (isForeignKey) {
        // Mostrar modal amigável para o usuário final
        setFeedbackModal({
          isOpen: true,
          variant: 'error',
          title: 'Não foi possível excluir este serviço',
          message: `${itemDeletado?.nome || 'Este serviço'} não pode ser excluído porque já foi usado em agendamentos. Cancele ou reatribua os agendamentos que usam este serviço e tente novamente. Precisa de ajuda? Fale com o suporte pelo canal habitual.`,
          onConfirm: closeFeedbackModal
        })
        // Log para depuração
        console.error('Erro ao excluir serviço - dependências existentes:', error)
      } else {
        alert('Erro ao excluir item: ' + error.message)
      }
    }
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
        .select('*, membros_equipe!transacoes_membro_id_fkey(nome, percentual_comissao)')
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

  const isEmailLogin = !!localStorage.getItem('gfin_admin');
  const loggedMembro = membros.find(m => m.id === membroId);
  const nomeExibicao = loggedMembro ? loggedMembro.nome : (isEmailLogin ? (estab?.nome || 'Dono') : 'Staff');
  const sufixo = isEmailLogin ? ' (CEO)' : (cargo === 'administrador' ? ' (Adm)' : ' (Usu)');
  const textoUsuario = `${nomeExibicao}${sufixo}`;

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
            <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">
              {textoUsuario}
            </span>
          </div>
        </div>
        <nav className="space-y-2 flex-1">
          <button onClick={() => setActiveTab('resumo')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'resumo' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}><PieChart size={18} /> Resumo</button>
          <button onClick={() => setActiveTab('transacoes')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'transacoes' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}><List size={18} /> Lançamentos</button>
          <button onClick={() => setActiveTab('itens')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'itens' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}><Scissors size={18} /> Serviços/Produtos</button>
          <button onClick={() => setActiveTab('agenda')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'agenda' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}><Calendar size={18} /> Agenda</button>

          {isOwner && cargo === 'administrador' && (
            <>
              <button onClick={() => setActiveTab('equipe')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'equipe' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}>
                <Users size={18} /> Equipe
              </button>
              <button onClick={() => setActiveTab('auditoria')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'auditoria' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}>
                <ShieldAlert size={18} /> Auditoria
              </button>
              <button onClick={() => setActiveTab('relatorios')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'relatorios' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}>
                <PieChart size={18} /> Relatórios
              </button>
              <button onClick={() => setActiveTab('config')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'config' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}>
                <Settings size={18} /> Configurações
              </button>
            </>
          )}

        </nav>
        <button onClick={onBack} className="flex items-center gap-3 px-4 py-3 text-rose-400 hover:bg-rose-500/10 rounded-xl mt-auto font-bold"><ArrowLeft size={18} /> Sair</button>
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
              <p className="text-[10px] text-slate-400 font-bold uppercase">{textoUsuario}</p>
            </div>
          </div>
          <button onClick={onBack} className="p-2 glass-card rounded-full text-rose-400"><ArrowLeft size={18} /></button>
        </header>

        {subscriptionStatus.showWarning && (
          <div className={`mb-6 p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-top-4 duration-500 ${subscriptionStatus.reason === 'trial_warning'
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
          <div className="space-y-4 mb-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
                <div className="flex gap-1 bg-slate-900/50 p-1 rounded-full border border-white/5 overflow-x-auto scrollbar-hide">
                  {(['hoje', '7dias', '30dias', 'todos'] as Periodo[]).map(p => (
                    <button key={p} onClick={() => setPeriodo(p)} className={`px-4 py-2 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${periodo === p ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500'}`}>
                      {p === 'hoje' ? 'HOJE' : p === '7dias' ? '7 DIAS' : p === '30dias' ? '30 DIAS' : 'TUDO'}
                    </button>
                  ))}
                </div>

                {/* Filtro por Profissional (Apenas Dono) */}
                {(isOwner && activeTab === 'resumo') && (
                  <div className="flex items-center gap-2 bg-slate-900/50 border border-white/5 rounded-full px-4 py-1.5 h-[34px]">
                    <User size={12} className="text-emerald-500" />
                    <select
                      value={filtroMembro}
                      onChange={(e) => setFiltroMembro(e.target.value)}
                      className="bg-transparent border-0 text-[10px] font-bold text-slate-300 focus:ring-0 focus:outline-none cursor-pointer pr-8"
                    >
                      <option value="todos" className="bg-slate-950 text-slate-300">TODOS OS PROFISSIONAIS</option>
                      {membros.map(m => (
                        <option key={m.id} value={m.id} className="bg-slate-950 text-slate-300">{m.nome.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={() => { setModalType('receita'); setIsModalOpen(true) }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-emerald-500 text-white px-4 py-3 rounded-xl font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"><Plus size={14} /> Receita</button>
                <button onClick={() => { setModalType('despesa'); setIsModalOpen(true) }} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-rose-500 text-white px-4 py-3 rounded-xl font-bold text-xs shadow-lg shadow-rose-500/20 active:scale-95 transition-all"><Plus size={14} /> Despesa</button>
              </div>
            </div>

            {/* Filtros e Busca específicos para a aba Lançamentos */}
            {activeTab === 'transacoes' && (
              <div className="flex flex-col md:flex-row gap-4 animate-in fade-in duration-300">
                <div className="flex gap-1 bg-slate-900/50 p-1 rounded-xl border border-white/5 w-full md:w-auto">
                  {(['todos', 'receita', 'despesa'] as const).map(t => (
                    <button key={t} onClick={() => setTipoFiltro(t)} className={`flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all uppercase ${tipoFiltro === t ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="relative flex-1 group">
                  <input type="text" placeholder="Buscar por usuário, descrição ou categoria..." value={searchTx} onChange={e => setSearchTx(e.target.value)} className="w-full bg-slate-900 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-emerald-500 transition-colors" size={16} />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'resumo' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* ROW 1: CARDS PRINCIPAIS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {/* Card 1: Lucro Líquido (Dono) ou Comissão (PIN) */}
              {isOwner ? (
                <div className="glass-card p-6 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/20 relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:scale-150 transition-all" />
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Lucro Líquido Global</p>
                  <h3 className="text-3xl sm:text-4xl font-black text-white">{formatCurrency(dashboardMetrics.lucroLiquido)}</h3>
                  <div className="flex items-center gap-2 text-emerald-400 text-[9px] font-bold mt-2 bg-emerald-400/10 w-fit px-2 py-0.5 rounded-full"><TrendingUp size={10} /> Saudável</div>
                </div>
              ) : (
                <div className="glass-card p-6 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/20 relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:scale-150 transition-all" />
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Minhas Comissões</p>
                  <h3 className="text-3xl sm:text-4xl font-black text-white">{formatCurrency(dashboardMetrics.comissaoPessoal)}</h3>
                  <div className="flex items-center gap-2 text-emerald-400 text-[9px] font-bold mt-2 bg-emerald-400/10 w-fit px-2 py-0.5 rounded-full"><Percent size={10} /> Meu Ganho</div>
                </div>
              )}

              {/* Card 2: Receitas (Dono) ou Ticket Médio Pessoal (PIN) */}
              {isOwner ? (
                <div className="glass-card p-6 border-white/5 relative overflow-hidden group">
                  <p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Receitas Operacionais</p>
                  <h3 className="text-2xl font-black text-emerald-400">{formatCurrency(dashboardMetrics.totalReceitas)}</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-2">Ticket Médio: {formatCurrency(dashboardMetrics.ticketMedio)}</p>
                </div>
              ) : (
                <div className="glass-card p-6 border-white/5 relative overflow-hidden group">
                  <p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Meu Ticket Médio</p>
                  <h3 className="text-2xl font-black text-emerald-400">{formatCurrency(dashboardMetrics.ticketMedio)}</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-2">Por atendimento realizado</p>
                </div>
              )}

              {/* Card 3: Despesas (Dono) ou Total de Atendimentos (PIN) */}
              {isOwner ? (
                <div className="glass-card p-6 border-white/5 relative overflow-hidden group">
                  <p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Despesas Operacionais</p>
                  <h3 className="text-2xl font-black text-rose-500">{formatCurrency(dashboardMetrics.totalDespesas)}</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-2">Comissões Totais: {formatCurrency(dashboardMetrics.comissoesTotais)}</p>
                </div>
              ) : (
                <div className="glass-card p-6 border-white/5 relative overflow-hidden group">
                  <p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Meus Atendimentos</p>
                  <h3 className="text-2xl font-black text-blue-400">{dashboardMetrics.totalAgendamentos}</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase mt-2">
                    Concluídos: <span className="text-emerald-400">{dashboardMetrics.agendamentosConcluidos}</span> • Canc: <span className="text-rose-400">{dashboardMetrics.agendamentosCancelados}</span>
                  </p>
                </div>
              )}
            </div>

            {/* ROW 2: DETALHES DE AGENDAMENTOS OPERACIONAIS (Apenas Dono) */}
            {isOwner && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card p-4 border-white/5 text-center">
                  <p className="text-slate-500 text-[9px] font-bold uppercase">Total Agendados</p>
                  <h4 className="text-xl font-bold text-white mt-1">{dashboardMetrics.totalAgendamentos}</h4>
                </div>
                <div className="glass-card p-4 border-white/5 text-center">
                  <p className="text-slate-500 text-[9px] font-bold uppercase text-emerald-500">Concluídos</p>
                  <h4 className="text-xl font-bold text-emerald-400 mt-1">{dashboardMetrics.agendamentosConcluidos}</h4>
                </div>
                <div className="glass-card p-4 border-white/5 text-center">
                  <p className="text-slate-500 text-[9px] font-bold uppercase text-amber-500">Pendentes / Conf.</p>
                  <h4 className="text-xl font-bold text-amber-400 mt-1">{dashboardMetrics.agendamentosPendentes}</h4>
                </div>
                <div className="glass-card p-4 border-white/5 text-center">
                  <p className="text-slate-500 text-[9px] font-bold uppercase text-rose-500">Cancelados</p>
                  <h4 className="text-xl font-bold text-rose-400 mt-1">{dashboardMetrics.agendamentosCancelados}</h4>
                </div>
              </div>
            )}

            {/* ROW 3: GRÁFICO DE FLUXO DE CAIXA (Ocultado para PIN Usuário comum) */}
            {isOwner && (
              <section className="glass-card p-4 sm:p-8 border-white/5 overflow-hidden">
                <h3 className="font-bold mb-8 text-sm flex items-center gap-2 uppercase tracking-widest"><TrendingUp size={16} className="text-emerald-500" /> Fluxo de Caixa</h3>
                <div className="h-64 sm:h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboardMetrics.chartData}>
                      <defs>
                        <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                        <linearGradient id="colorDes" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} /><stop offset="95%" stopColor="#f43f5e" stopOpacity={0} /></linearGradient>
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
            )}

            {/* ROW 4: RANKINGS E TABELAS (CONFORME NÍVEL DE ACESSO) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Coluna A: Desempenho da Equipe (Dono) ou Meus Serviços Campeões (PIN) */}
              {isOwner ? (
                <section className="glass-card p-6 border-white/5">
                  <h3 className="font-bold mb-4 text-xs flex items-center gap-2 uppercase tracking-widest text-slate-300">
                    <Award size={16} className="text-emerald-500" /> Desempenho da Equipe
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/5 text-slate-500 uppercase font-black">
                          <th className="py-2">Profissional</th>
                          <th className="py-2 text-right">Qtd</th>
                          <th className="py-2 text-right">Faturamento</th>
                          <th className="py-2 text-right">Comissão</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {dashboardMetrics.rankingProfissionais.map((prof) => (
                          <tr key={prof.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 font-bold text-white">{prof.nome}</td>
                            <td className="py-3 text-right text-slate-400 font-bold">{prof.quantidade}</td>
                            <td className="py-3 text-right text-emerald-400 font-bold">{formatCurrency(prof.faturamento)}</td>
                            <td className="py-3 text-right text-amber-500 font-bold">{formatCurrency(prof.comissao)}</td>
                          </tr>
                        ))}
                        {dashboardMetrics.rankingProfissionais.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-slate-500">Nenhum faturamento registrado no período.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : (
                <section className="glass-card p-6 border-white/5">
                  <h3 className="font-bold mb-4 text-xs flex items-center gap-2 uppercase tracking-widest text-slate-300">
                    <Award size={16} className="text-emerald-500" /> Meus Serviços Campeões
                  </h3>
                  <div className="space-y-4">
                    {dashboardMetrics.rankingServicos.slice(0, 5).map((serv, index) => (
                      <div key={serv.nome} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-emerald-500">{index + 1}</span>
                          <span className="font-bold text-white text-xs">{serv.nome}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-xs text-slate-300">{serv.quantidade} atendimentos</p>
                          <p className="text-[10px] font-bold text-emerald-500">{formatCurrency(serv.total)}</p>
                        </div>
                      </div>
                    ))}
                    {dashboardMetrics.rankingServicos.length === 0 && (
                      <p className="text-xs text-center text-slate-500 py-4">Nenhum serviço realizado no período.</p>
                    )}
                  </div>
                </section>
              )}

              {/* Coluna B: Serviços Mais Agendados (Dono) ou Detalhamento de Comissões Pessoais (PIN) */}
              {isOwner ? (
                <section className="glass-card p-6 border-white/5">
                  <h3 className="font-bold mb-4 text-xs flex items-center gap-2 uppercase tracking-widest text-slate-300">
                    <ShoppingBag size={16} className="text-emerald-500" /> Serviços Mais Procurados
                  </h3>
                  <div className="space-y-4">
                    {dashboardMetrics.rankingServicos.slice(0, 5).map((serv, index) => (
                      <div key={serv.nome} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-emerald-500">{index + 1}</span>
                          <span className="font-bold text-white text-xs">{serv.nome}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-xs text-slate-300">{serv.quantidade} vendas</p>
                          <p className="text-[10px] font-bold text-emerald-500">{formatCurrency(serv.total)}</p>
                        </div>
                      </div>
                    ))}
                    {dashboardMetrics.rankingServicos.length === 0 && (
                      <p className="text-xs text-center text-slate-500 py-4">Nenhum serviço vendido no período.</p>
                    )}
                  </div>
                </section>
              ) : (
                <section className="glass-card p-6 border-white/5">
                  <h3 className="font-bold mb-4 text-xs flex items-center gap-2 uppercase tracking-widest text-slate-300">
                    <Percent size={16} className="text-emerald-500" /> Minhas Comissões Detalhadas
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
                      <span className="text-xs text-slate-400 font-bold">Total Faturado por Mim</span>
                      <span className="text-sm font-black text-white">{formatCurrency(dashboardMetrics.totalReceitas)}</span>
                    </div>
                    <div className="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                      <span className="text-xs text-emerald-400 font-bold">Total Comissão Acumulada</span>
                      <span className="text-sm font-black text-emerald-400">{formatCurrency(dashboardMetrics.comissaoPessoal)}</span>
                    </div>
                    <p className="text-[9px] text-slate-500 font-bold leading-relaxed uppercase mt-4">
                      * O percentual de comissão é cadastrado pelo administrador e aplicado diretamente sobre cada serviço concluído no período.
                    </p>
                  </div>
                </section>
              )}
            </div>
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
                setNovoItem({ nome: '', preco: '', tipo: 'receita', categoria: 'Geral', duracao: '30', imagem_url: '' })
                setImageFile(null)
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
                          <input required className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" value={novoItem.nome} onChange={e => setNovoItem(prev => ({ ...prev, nome: e.target.value.toUpperCase() }))} onBlur={() => setNovoItem(prev => ({ ...prev, nome: (prev.nome || '').toString().trim().toUpperCase() }))} placeholder="Ex: CORTE DEGRADE" />
                        </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Imagem do Serviço</label>
                        <div className="flex items-center gap-4">
                          <label className="flex-1 flex flex-col items-center justify-center h-24 border border-dashed border-white/10 rounded-xl bg-slate-900/50 hover:bg-slate-900 hover:border-emerald-500/50 transition-all cursor-pointer">
                            <Plus size={20} className="text-slate-500 mb-1" />
                            <span className="text-xs text-slate-400 font-bold">Upload de Imagem</span>
                            <span className="text-[9px] text-slate-600 uppercase mt-0.5">JPG, PNG ou WebP</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={e => {
                                const file = e.target.files?.[0]
                                if (file) setImageFile(file)
                              }} 
                            />
                          </label>
                          
                          {(imageFile || novoItem.imagem_url) && (
                            <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-white/10 bg-slate-900 flex-shrink-0">
                              <img 
                                src={imageFile ? URL.createObjectURL(imageFile) : novoItem.imagem_url} 
                                alt="Preview" 
                                className="w-full h-full object-cover" 
                              />
                              <button 
                                type="button" 
                                onClick={() => {
                                  setImageFile(null)
                                  setNovoItem(prev => ({ ...prev, imagem_url: '' }))
                                }}
                                className="absolute top-1 right-1 p-1 bg-black/60 rounded-full hover:bg-rose-600 transition-all"
                              >
                                <X size={12} className="text-white" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Categoria</label>
                          <input list="categoria-list" className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" value={novoItem.categoria} onChange={e => setNovoItem(prev => ({ ...prev, categoria: e.target.value.toUpperCase() }))} onBlur={() => setNovoItem(prev => ({ ...prev, categoria: (prev.categoria || '').toString().trim().toUpperCase() }))} placeholder="Ex: CABELO" />
                          <datalist id="categoria-list">
                            {(availableCategories || []).map((c: string) => (
                              <option key={c} value={c} />
                            ))}
                          </datalist>
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

            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={servicoSearch}
                onChange={e => setServicoSearch(e.target.value)}
                placeholder="Buscar serviço ou categoria..."
                className="w-full bg-slate-900 border border-white/5 rounded-xl pl-11 pr-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItens.map(item => (
                <div key={item.id} className="glass-card p-4 border-white/5 flex justify-between items-center group">
                  <div className="flex items-center gap-3 min-w-0">
                    {item.imagem_url ? (
                      <img src={item.imagem_url} alt={item.nome} className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-slate-500 shrink-0">
                        <Scissors size={18} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{item.nome}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${item.tipo === 'receita' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{item.tipo}</span>
                        {item.preco_sugerido && <span className="text-[10px] font-mono text-slate-400">{formatCurrency(item.preco_sugerido)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setItemParaEditar(item.id)
                        setNovoItem({
                          nome: (item.nome || '').toString().trim().toUpperCase(),
                          preco: item.preco_sugerido ? item.preco_sugerido.toString().replace('.', ',') : '',
                          tipo: item.tipo || 'receita',
                          categoria: (item.categoria || 'Geral').toString().trim().toUpperCase(),
                          duracao: item.duracao_minutos?.toString() || '30',
                          imagem_url: item.imagem_url || ''
                        })
                        setImageFile(null)
                        setIsItemModalOpen(true)
                      }}
                      className="p-2 text-slate-500 hover:text-emerald-500 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-slate-500 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={14} /></button>
                  </div>
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
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Status</label>
                    <select
                      className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-emerald-500 transition-all appearance-none"
                      value={novoAgendamento.status}
                      onChange={e => setNovoAgendamento(prev => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="pendente">⏳ Pendente</option>
                      <option value="confirmado">✅ Confirmado</option>
                      <option value="concluido">🏁 Concluído</option>
                      <option value="cancelado">❌ Cancelado</option>
                    </select>
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
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    placeholder="Senha de liberação"
                    className="w-full min-w-0 sm:flex-1 bg-slate-900 border border-white/5 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    value={devPassword}
                    onChange={e => setDevPassword(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { if (devPassword === import.meta.env.VITE_DEV_PASSWORD) setIsDevMode(true); else alert('Senha incorreta') } }}
                  />
                  <button
                    onClick={() => { if (devPassword === import.meta.env.VITE_DEV_PASSWORD) setIsDevMode(true); else alert('Senha incorreta') }}
                    className="w-full sm:w-auto sm:shrink-0 bg-slate-800 text-slate-300 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-700 transition-all"
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

            <div className="glass-card p-4 border-white/5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Profissional</label>
                  <select value={agendaFilterProf} onChange={e => setAgendaFilterProf(e.target.value)} className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 transition-all">
                    <option value="todos">Todos</option>
                    {membros.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</label>
                  <select value={agendaFilterStatus} onChange={e => setAgendaFilterStatus(e.target.value)} className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 transition-all">
                    <option value="todos">Todos</option>
                    <option value="pendente">Pendente</option>
                    <option value="confirmado">Confirmado</option>
                    <option value="concluido">Concluído</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">De</label>
                  <input type="date" value={agendaFilterDataIni} onChange={e => setAgendaFilterDataIni(e.target.value)} className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Até</label>
                  <input type="date" value={agendaFilterDataFim} onChange={e => setAgendaFilterDataFim(e.target.value)} className="w-full bg-slate-900 border border-white/5 rounded-xl p-3 text-sm font-bold outline-none focus:border-emerald-500 transition-all" />
                </div>
              </div>
            </div>

            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={agendaSearch}
                onChange={e => setAgendaSearch(e.target.value)}
                placeholder="Buscar por cliente, profissional, serviço, status..."
                className="w-full bg-slate-900 border border-white/5 rounded-xl pl-11 pr-4 py-3 text-sm font-bold outline-none focus:border-emerald-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              {agendamentos.length === 0 ? (
                <div className="text-center p-12 glass-card border-dashed border-white/5 text-slate-600 font-bold">
                  Nenhum agendamento encontrado.
                </div>
              ) : (
                filteredAgendamentos.map(ag => {
                  const data = new Date(ag.data_hora_inicio);
                  const servico = Array.isArray(ag.servicos_produtos) ? ag.servicos_produtos[0] : ag.servicos_produtos;
                  const servicoNome = servico?.nome || '';
                  const preco = servico?.preco_sugerido || 0;
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
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${ag.status === 'pendente' ? 'bg-amber-500/10 text-amber-500' :
                                ag.status === 'confirmado' ? 'bg-emerald-500/10 text-emerald-500' :
                                  ag.status === 'concluido' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800 text-slate-500'
                              }`}>
                              {ag.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
                            <Clock size={10} /> {data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {servicoNome} • {formatCurrency(preco)}
                          </p>
                          <p className="text-[10px] text-emerald-500/60 font-bold uppercase tracking-widest mt-0.5">Profissional: {ag.membros_equipe?.nome || 'Qualquer'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 border-t border-white/5 sm:border-0 pt-3 sm:pt-0 flex-wrap">
                        {/* 1. Confirmar */}
                        {ag.status !== 'concluido' && ag.status !== 'cancelado' && (
                          <button
                            onClick={() => handleAgendamentoAction(ag, 'confirmado')}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${ag.status === 'confirmado'
                                ? 'bg-emerald-500/20 text-emerald-500 cursor-default'
                                : 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 active:scale-95'
                              }`}
                            title="Confirmar"
                          >
                            {ag.status === 'confirmado' ? '✅ Confirmado' : '✅ Confirmar'}
                          </button>
                        )}

                        {/* 2. Finalizar */}
                        {ag.status !== 'concluido' && ag.status !== 'cancelado' && (
                          <button
                            onClick={() => {
                              const servico = Array.isArray(ag.servicos_produtos) ? ag.servicos_produtos[0] : ag.servicos_produtos;
                              const preco = servico?.preco_sugerido || 0;
                              if (confirm(`Deseja finalizar o serviço de ${ag.cliente_nome} e lançar o valor de ${formatCurrency(preco)} no caixa?`)) {
                                handleAgendamentoAction(ag, 'concluido')
                              }
                            }}
                            className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                            title="Finalizar e Cobrar"
                          >
                            <DollarSign size={14} /> Finalizar
                          </button>
                        )}

                        {/* 3. Editar */}
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

                        {/* 4. Cancelar */}
                        {ag.status !== 'concluido' && ag.status !== 'cancelado' && (
                          <button
                            onClick={() => handleAgendamentoAction(ag, 'cancelado')}
                            className="p-2 rounded-xl border border-white/5 transition-all bg-slate-900 text-slate-400 hover:text-rose-500"
                            title="Cancelar"
                          >
                            <X size={16} />
                          </button>
                        )}

                        {/* 5. Excluir */}
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
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-black uppercase text-[8px] tracking-wider ${isExc ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
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
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-bold uppercase text-[9px] tracking-wider ${isExc ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
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

                <div className="p-4 bg-slate-900/50 border-t border-white/5 print:hidden">
                  <button onClick={abrirRelatorioPDF} className="w-full py-3 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex justify-center items-center gap-2">
                    <Printer size={16} /> Imprimir / Salvar PDF
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

        <button onClick={() => { setActiveTab('agenda'); setIsMoreMenuOpen(false); }} className={`flex flex-col items-center gap-1 transition-all flex-1 ${activeTab === 'agenda' && !isMoreMenuOpen ? 'text-emerald-500 scale-110' : 'text-slate-500'}`}>
          <Calendar size={20} />
          <span className="text-[9px] font-bold uppercase">Agenda</span>
        </button>
        {isOwner && cargo === 'administrador' ? (
          <button onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)} className={`flex flex-col items-center gap-1 transition-all flex-1 ${isMoreMenuOpen || ['equipe', 'itens', 'relatorios', 'auditoria', 'config'].includes(activeTab) ? 'text-emerald-500 scale-110' : 'text-slate-500'}`}>
            <MoreVertical size={20} />
            <span className="text-[9px] font-bold uppercase">Mais</span>
          </button>
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

            <button onClick={() => { setActiveTab('itens'); setIsMoreMenuOpen(false); }} className="w-full flex items-center gap-4 bg-white/5 hover:bg-white/10 p-4 rounded-2xl transition-all">
              <div className="bg-slate-800 p-2 rounded-xl text-emerald-500"><Scissors size={20} /></div>
              <span className="font-bold text-sm">Serviços e Produtos</span>
            </button>
            {isOwner && cargo === 'administrador' && (
              <>
                <button onClick={() => { setActiveTab('equipe'); setIsMoreMenuOpen(false); }} className="w-full flex items-center gap-4 bg-white/5 hover:bg-white/10 p-4 rounded-2xl transition-all">
                  <div className="bg-slate-800 p-2 rounded-xl text-emerald-400"><Users size={20} /></div>
                  <span className="font-bold text-sm">Equipe</span>
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
              </>
            )}
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

      {/* MODAL DE FEEDBACK (sucesso, erro, confirmação) */}
      {feedbackModal && feedbackModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200 text-center relative overflow-hidden border backdrop-blur-xl ${feedbackModal.variant === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : feedbackModal.variant === 'error'
                ? 'bg-rose-500/10 border-rose-500/20'
                : 'bg-amber-500/10 border-amber-500/20'
            }`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 border shadow-lg ${feedbackModal.variant === 'success'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-emerald-500/5'
                : feedbackModal.variant === 'error'
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-rose-500/5'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-amber-500/5'
              }`}>
              {feedbackModal.variant === 'success' && <CheckCircle size={26} />}
              {feedbackModal.variant === 'error' && <XCircle size={26} />}
              {feedbackModal.variant === 'confirm' && <ShieldAlert size={26} />}
            </div>

            <h4 className={`font-black text-base uppercase tracking-widest mb-2 ${feedbackModal.variant === 'success'
                ? 'text-emerald-400'
                : feedbackModal.variant === 'error'
                  ? 'text-rose-400'
                  : 'text-amber-400'
              }`}>
              {feedbackModal.title}
            </h4>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed font-semibold">
              {feedbackModal.message}
            </p>

            {feedbackModal.variant === 'confirm' ? (
              <div className="flex gap-3 justify-center">
                <button
                  onClick={feedbackModal.onCancel}
                  className="flex-1 bg-slate-900 border border-white/5 hover:bg-slate-800 hover:text-white text-slate-400 font-bold py-3.5 rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest"
                >
                  Cancelar
                </button>
                <button
                  onClick={feedbackModal.onConfirm}
                  disabled={configSaving}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black py-3.5 rounded-2xl shadow-xl shadow-amber-500/20 transition-all active:scale-95 text-xs uppercase tracking-widest"
                >
                  {configSaving ? 'Aguarde...' : 'Confirmar'}
                </button>
              </div>
            ) : (
              <button
                onClick={feedbackModal.onConfirm}
                className={`w-full font-black py-3.5 rounded-2xl shadow-xl transition-all active:scale-95 text-xs uppercase tracking-widest ${feedbackModal.variant === 'success'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/20'
                    : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
                  }`}
              >
                Entendi
              </button>
            )}
          </div>
        </div>
      )}

      {/* MODAL CUSTOMIZADO WHATSAPP PROMPT */}
      {whatsappPrompt && whatsappPrompt.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-amber-500/10 border border-amber-500/20 backdrop-blur-xl w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200 text-center relative overflow-hidden">
            {/* Elemento de iluminação decorativa para a sofisticação do design */}
            <div className="absolute -top-12 -left-12 w-24 h-24 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

            <div className="w-14 h-14 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-amber-500/30 shadow-lg shadow-amber-500/5">
              <MessageCircle size={26} />
            </div>

            <h4 className="font-black text-amber-400 text-base uppercase tracking-widest mb-2">Enviar WhatsApp</h4>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed font-semibold">
              {whatsappPrompt.mensagem}
            </p>

            <div className="flex gap-3 justify-center">
              <button
                onClick={whatsappPrompt.onCancel}
                className="flex-1 bg-slate-900 border border-white/5 hover:bg-slate-800 hover:text-white text-slate-400 font-bold py-3.5 rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest"
              >
                Não
              </button>
              <button
                onClick={whatsappPrompt.onConfirm}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3.5 rounded-2xl shadow-xl shadow-amber-500/20 transition-all active:scale-95 text-xs uppercase tracking-widest"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
