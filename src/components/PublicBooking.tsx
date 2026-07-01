import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Calendar, Clock, User, Scissors, CheckCircle, ArrowLeft, MessageCircle, Instagram, Facebook, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency } from '../lib/format'

export function PublicBooking() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [estab, setEstab] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1)

  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  const formatDateLabel = (d: Date) => {
    const today = new Date()
    const amanha = new Date(today); amanha.setDate(amanha.getDate() + 1)
    if (d.toDateString() === today.toDateString()) return 'Hoje'
    if (d.toDateString() === amanha.toDateString()) return 'Amanhã'
    return `${diasSemana[d.getDay()]} ${d.getDate()}`
  }

  const getNextDays = (n = 14) => {
    const days: Date[] = []
    const today = new Date()
    for (let i = 0; i < n; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i)
      days.push(d)
    }
    return days
  }

  const formatDateKey = (d: Date) => d.toISOString().split('T')[0]

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

  const [categorias, setCategorias] = useState<any[]>([])
  const [categoriaAtiva, setCategoriaAtiva] = useState('')
  const [profissionais, setProfissionais] = useState<any[]>([])
  const [agendamentosExistentes, setAgendamentosExistentes] = useState<any[]>([])
  const [carregandoHorarios, setCarregandoHorarios] = useState(false)

  const [selecionado, setSelecionado] = useState({
    servico: null as any,
    profissional: null as any,
    data: formatDateKey(new Date()),
    hora: '',
    clienteNome: '',
    clienteWhatsapp: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [isFinishing, setIsFinishing] = useState(false)

  useEffect(() => {
    fetchEstab()
  }, [slug])

  useEffect(() => {
    if (selecionado.data && estab?.id) {
      fetchAgendamentosDoDia()
    }
  }, [selecionado.data, estab?.id])

  useEffect(() => {
    if (step === 2 && profissionais.length === 1) {
      setSelecionado(prev => ({ ...prev, profissional: profissionais[0] }))
      setStep(3)
    }
  }, [step, profissionais])

  const fetchAgendamentosDoDia = async () => {
    try {
      setCarregandoHorarios(true)
      setError(null)

      const startOfDay = `${selecionado.data}T00:00:00`
      const endOfDay = `${selecionado.data}T23:59:59`

      const { data, error: fetchError } = await supabase
        .from('agendamentos')
        .select('hora:data_hora_inicio, membro_id')
        .eq('estabelecimento_id', estab.id)
        .gte('data_hora_inicio', startOfDay)
        .lte('data_hora_inicio', endOfDay)
        .neq('status', 'cancelado')

      if (fetchError) throw fetchError

      const formatados = (data || []).map(a => ({
        hora: new Date(a.hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        membro_id: a.membro_id
      }))

      setAgendamentosExistentes(formatados)
    } catch (err: any) {
      console.error('Erro ao buscar agendamentos:', err)
    } finally {
      setCarregandoHorarios(false)
    }
  }

  const fetchEstab = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('estabelecimentos')
        .select('*')
        .eq('slug', slug)
        .single()

      if (fetchError) throw fetchError
      if (!data) throw new Error('Estabelecimento não encontrado.')

      setEstab(data)
      await fetchDados(data.id)

      const manifest = {
        short_name: data.nome.split(' ')[0],
        name: data.nome,
        description: `Agendamento online da ${data.nome}`,
        icons: [
          { src: data.configuracoes?.logo_url || "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: data.configuracoes?.logo_url || "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ],
        start_url: window.location.pathname,
        display: "standalone",
        background_color: "#020617",
        theme_color: "#020617"
      };
      const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'manifest';
        document.head.appendChild(link);
      }
      link.setAttribute('href', url);

      let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
      if (appleIcon && data.configuracoes?.logo_url) {
        appleIcon.setAttribute('href', data.configuracoes.logo_url);
      }
    } catch (err: any) {
      console.error('Erro ao carregar estabelecimento:', err)
      setError(err.message || 'Erro ao carregar dados do salão.')
    } finally {
      setLoading(false)
    }
  }

  const fetchDados = async (id: string) => {
    try {
      const [servRes, profRes] = await Promise.all([
        supabase.from('servicos_produtos').select('*').eq('estabelecimento_id', id).eq('tipo', 'receita').order('categoria'),
        supabase.from('membros_equipe').select('*').eq('estabelecimento_id', id).eq('ativo', true)
      ])

      if (servRes.error) throw servRes.error
      if (profRes.error) throw profRes.error

      if (servRes.data) {
        const grouped = servRes.data.reduce((acc: any, item: any) => {
          const cat = item.categoria || 'Geral'
          if (!acc[cat]) acc[cat] = []
          acc[cat].push(item)
          return acc
        }, {})
        const entries = Object.entries(grouped) as any[]
        setCategorias(entries)
        setCategoriaAtiva('')
      }
      setProfissionais(profRes.data || [])
    } catch (err: any) {
      console.error('Erro ao buscar dados complementares:', err)
      setError('Erro ao carregar serviços ou profissionais.')
    }
  }

  const handleFinish = async () => {
    if (!selecionado.clienteNome || !selecionado.clienteWhatsapp) return

    try {
      setIsFinishing(true)
      const [ano, mes, dia] = selecionado.data.split('-').map(Number)
      const [h, m] = selecionado.hora.split(':').map(Number)

      const dataInicio = new Date(ano, mes - 1, dia, h, m)
      const dataFim = new Date(dataInicio)
      dataFim.setMinutes(dataFim.getMinutes() + (selecionado.servico.duracao_minutos || 30))

      const profissionalId = selecionado.profissional?.id;

      const { error: insertError } = await supabase.from('agendamentos').insert({
        estabelecimento_id: estab.id,
        membro_id: profissionalId,
        servico_id: selecionado.servico.id,
        cliente_nome: selecionado.clienteNome,
        cliente_whatsapp: selecionado.clienteWhatsapp,
        data_hora_inicio: dataInicio.toISOString(),
        data_hora_fim: dataFim.toISOString(),
        status: 'pendente'
      })

      if (insertError) throw insertError
      setStep(5)
    } catch (err: any) {
      console.error('Erro ao finalizar agendamento:', err)
      alert('Erro ao agendar: ' + (err.message || 'Tente novamente.'))
    } finally {
      setIsFinishing(false)
    }
  }

  const todosServicos = categorias
    .flatMap(([_, items]) => items as any[])
    .sort((a, b) => a.nome?.localeCompare(b.nome) || 0)

  const servicosDaCategoria = categoriaAtiva
    ? (categorias.find(([cat]) => cat === categoriaAtiva)?.[1] || [])
    : todosServicos

  const resumoItems = []
  if (selecionado.servico) resumoItems.push({ icon: Scissors, label: selecionado.servico.nome, complemento: formatCurrency(selecionado.servico.preco_sugerido || 0) })
  if (selecionado.profissional) resumoItems.push({ icon: User, label: selecionado.profissional.nome })
  if (selecionado.data) resumoItems.push({
    icon: Calendar,
    label: `${new Date(selecionado.data).toLocaleDateString('pt-BR')}${selecionado.hora ? ` às ${selecionado.hora}` : ''}`
  })

  if (loading) return (
    <div className="min-h-screen bg-slate-950 p-6 space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-slate-800 animate-pulse" />
        <div className="space-y-2">
          <div className="w-32 h-3 bg-slate-800 rounded animate-pulse" />
          <div className="w-24 h-2 bg-slate-800 rounded animate-pulse" />
        </div>
      </div>
      <div className="w-48 h-6 bg-slate-800 rounded animate-pulse" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(i => <div key={i} className="w-20 h-10 bg-slate-800 rounded-xl animate-pulse" />)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-slate-900/80 rounded-2xl overflow-hidden">
            <div className="aspect-[3/4] bg-slate-800 animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="w-full h-3 bg-slate-800 rounded animate-pulse" />
              <div className="w-2/3 h-3 bg-slate-800 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  if (error || !estab) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-4">
        <Scissors size={32} />
      </div>
      <h2 className="text-white font-bold text-xl">{error || 'Ops! Salão não encontrado.'}</h2>
      <p className="text-slate-400 mt-2 max-w-xs">Não conseguimos carregar as informações necessárias para o agendamento.</p>
      <button onClick={() => window.location.reload()} className="mt-6 bg-white/5 px-6 py-3 rounded-xl font-bold text-sm">Tentar Novamente</button>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-20">
      {/* HEADER */}
      <header className="p-6 bg-slate-900/50 border-b border-white/5 flex items-center gap-4 sticky top-0 z-10 backdrop-blur-md">
        {step > 1 && step < 5 && (
          <button onClick={() => setStep(step - 1)} className="p-2 bg-white/5 rounded-xl text-slate-400 hover:bg-white/10 transition-all">
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {estab.configuracoes?.logo_url ? (
            <img src={estab.configuracoes.logo_url} alt="Logo" className="w-10 h-10 rounded-xl object-cover border border-white/10" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center font-black">{estab.nome.charAt(0)}</div>
          )}
          <div>
            <h1 className="font-black text-sm uppercase tracking-widest">{estab.nome}</h1>
            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-tighter">Agendamento Online</p>
          </div>
        </div>
        <Link
          to="/"
          className="shrink-0 text-[10px] font-bold text-slate-500 hover:text-emerald-400 transition-colors uppercase tracking-widest flex items-center gap-1"
        >
          <ArrowLeft size={12} /> Marketplace
        </Link>
      </header>

      {/* PROGRESSO + RESUMO */}
      {step < 5 && (
        <div className="sticky top-[76px] z-10 px-6 py-2.5 bg-slate-900/80 backdrop-blur-md border-b border-white/5">
          <div className="max-w-full sm:max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4].map(s => (
                <div key={s} className="flex items-center">
                  <div className={`w-2.5 h-2.5 rounded-full border-2 transition-all shrink-0 ${
                    s < step
                      ? 'bg-emerald-500 border-emerald-500'
                      : s === step
                        ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/30'
                        : 'bg-transparent border-slate-600'
                  }`} />
                  {s < 4 && <div className={`w-5 h-[2px] mx-0.5 ${s < step ? 'bg-emerald-500/60' : 'bg-slate-700'}`} />}
                </div>
              ))}
            </div>
            {resumoItems.length > 0 && (
              <div className="flex items-center gap-2 min-w-0">
                {resumoItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 shrink-0">
                    {i > 0 && <div className="w-[3px] h-[3px] rounded-full bg-emerald-500/50" />}
                    <item.icon size={10} className="text-emerald-500 shrink-0" />
                    <span className="text-[9px] font-bold text-slate-400 truncate max-w-[80px]">{item.label}</span>
                    {item.complemento && <span className="text-[9px] font-black text-emerald-500">{item.complemento}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

       <main className="p-6 max-w-full sm:max-w-3xl mx-auto">
        {/* STEP 1: SERVIÇOS */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-black text-white leading-tight">O que vamos <span className="text-emerald-500">fazer hoje?</span></h2>

            {/* Barra de Categorias */}
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setCategoriaAtiva('')}
                className={`shrink-0 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  !categoriaAtiva
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                Todos
              </button>
              {categorias.map(([cat]) => (
                <button
                  key={cat}
                  onClick={() => setCategoriaAtiva(cat)}
                  className={`shrink-0 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    categoriaAtiva === cat
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Cards de Serviços */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {servicosDaCategoria.map((item: any) => (
                <button
                  key={item.id}
                  onClick={() => { setSelecionado(prev => ({ ...prev, servico: item })); setStep(2); }}
                  className="group bg-slate-900/80 border border-white/5 rounded-2xl overflow-hidden active:scale-[0.97] transition-all hover:border-emerald-500/40 text-left"
                >
                  <div className="aspect-[3/4] overflow-hidden bg-slate-950">
                    {item.imagem_url ? (
                      <img src={item.imagem_url} alt={item.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-700">
                        <Scissors size={28} />
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-1.5">
                    <p className="text-xs font-bold text-slate-200 leading-tight line-clamp-2 group-hover:text-emerald-400 transition-colors">
                      {item.nome}
                    </p>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Clock size={9} /> {item.duracao_minutos || 30}min
                      </span>
                      <span className="text-[11px] font-black text-emerald-500">
                        {formatCurrency(item.preco_sugerido || 0)}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: PROFISSIONAL */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-black text-white leading-tight">Com <span className="text-emerald-500">quem?</span></h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {profissionais.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelecionado(prev => ({ ...prev, profissional: p })); setStep(3); }}
                  className="group bg-slate-900/80 border border-white/5 rounded-2xl overflow-hidden active:scale-[0.97] transition-all hover:border-emerald-500/40 text-left"
                >
                  <div className="aspect-[1/1] overflow-hidden bg-slate-950">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-700 bg-gradient-to-b from-emerald-500/5 to-slate-950">
                        <User size={36} className="text-emerald-500/40" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 transition-colors truncate">{p.nome}</p>
                    <p className="text-[9px] text-emerald-500/60 font-bold uppercase tracking-widest mt-0.5">Profissional</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: DATA E HORA */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-xl font-black text-white leading-tight">Escolha o <span className="text-emerald-500">horário</span></h2>

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Selecione o Dia</label>
              <div className="relative group">
                <button
                  onClick={() => { const el = document.getElementById('date-scroll'); if (el) el.scrollBy({ left: -200, behavior: 'smooth' }) }}
                  className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-xl bg-slate-900/90 border border-white/10 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-emerald-400"
                >
                  <ChevronLeft size={16} />
                </button>
                <div
                  id="date-scroll"
                  className="flex gap-2 overflow-x-auto scrollbar-none pb-1"
                >
                  {getNextDays(14).map(d => {
                    const key = formatDateKey(d)
                    const isSelected = selecionado.data === key
                    return (
                      <button
                        key={key}
                        onClick={() => setSelecionado(prev => ({ ...prev, data: key, hora: '' }))}
                        className={`shrink-0 flex flex-col items-center gap-1 py-3 rounded-2xl border transition-all w-[80px] ${
                          isSelected
                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                            : 'bg-slate-900 border-white/5 text-slate-400 hover:border-emerald-500/40 hover:text-emerald-400'
                        }`}
                      >
                        <span className="text-[9px] font-bold uppercase tracking-wider">{formatDateLabel(d).split(' ')[0]}</span>
                        <span className="text-lg font-black">{d.getDate()}</span>
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => { const el = document.getElementById('date-scroll'); if (el) el.scrollBy({ left: 200, behavior: 'smooth' }) }}
                  className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-xl bg-slate-900/90 border border-white/10 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-emerald-400"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {selecionado.data && (
              <div className="space-y-3">
                {selecionado.profissional && (
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    Agenda de <span className="text-emerald-500/80">{selecionado.profissional.nome}</span>
                  </p>
                )}

                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Horários
                </label>

                {carregandoHorarios ? (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-[42px] rounded-xl bg-slate-800/50 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <>
                    {(() => {
                      const agora = new Date()
                      const isHoje = selecionado.data === formatDateKey(agora)
                      const horaAtual = isHoje
                        ? `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`
                        : ''
                      const todosSlotsBase = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30']
                      const todosSlots = isHoje ? todosSlotsBase.filter(h => h >= horaAtual) : todosSlotsBase
                      const slotsDisponiveis = todosSlots.filter(h => {
                        const ocupadosNesseHorario = agendamentosExistentes.filter(a => a.hora === h)
                        const jaTemAgendamento = selecionado.profissional && ocupadosNesseHorario.some(a => a.membro_id === selecionado.profissional.id)
                        return !jaTemAgendamento
                      })

                      if (slotsDisponiveis.length === 0 && agendamentosExistentes.length > 0) {
                        return (
                          <div className="text-center py-8 space-y-3">
                            <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto">
                              <Clock size={20} className="text-slate-600" />
                            </div>
                            <p className="text-sm font-bold text-slate-400">Todos os horários reservados</p>
                            <p className="text-[10px] text-slate-600">Tente outra data ou profissional.</p>
                          </div>
                        )
                      }

                      return (
                        <>
                          <div className="grid grid-cols-3 gap-2">
                            {todosSlots.map(h => {
                              const ocupadosNesseHorario = agendamentosExistentes.filter(a => a.hora === h)
                              const jaTemAgendamento = selecionado.profissional && ocupadosNesseHorario.some(a => a.membro_id === selecionado.profissional.id)
                              const disponivel = !jaTemAgendamento

                              return (
                                <button
                                  key={h}
                                  disabled={!disponivel}
                                  onClick={() => { if (disponivel) { setSelecionado(prev => ({ ...prev, hora: h })); setStep(4); } }}
                                  className={`h-[42px] rounded-xl text-xs font-black transition-all flex items-center justify-center ${
                                    !disponivel
                                      ? 'bg-slate-900/30 text-slate-700 border border-white/5 cursor-not-allowed line-through decoration-slate-700'
                                      : selecionado.hora === h
                                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-105'
                                        : 'bg-slate-900 text-slate-400 border border-white/5 hover:border-emerald-500/40 hover:text-emerald-400'
                                  }`}
                                >
                                  {!disponivel ? (
                                    <span className="flex flex-col items-center gap-0.5 leading-none">
                                      <span>{h}</span>
                                      <span className="text-[7px] text-rose-500/50 uppercase tracking-[0.15em] font-bold">Reservado</span>
                                    </span>
                                  ) : h}
                                </button>
                              )
                            })}
                          </div>

                          {agendamentosExistentes.length > 0 && (
                            <div className="flex items-center gap-4 text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-sm bg-emerald-500/60" />
                                Disponível
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-sm bg-slate-700" />
                                Reservado
                              </span>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: DADOS FINAIS */}
        {step === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-xl font-black text-white leading-tight">Para <span className="text-emerald-500">finalizar...</span></h2>

            {/* Card Resumo Compacto */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 px-1">Resumo do Agendamento</p>
              <div className="flex items-center gap-4 mt-3">
                <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-slate-900 border border-white/5 flex items-center justify-center">
                  {selecionado.servico?.imagem_url ? (
                    <img src={selecionado.servico.imagem_url} alt={selecionado.servico.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600 bg-slate-950">
                      <Scissors size={20} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-bold text-slate-200 truncate">{selecionado.servico.nome} <span className="text-emerald-400 font-black ml-2">{formatCurrency(selecionado.servico.preco_sugerido || 0)}</span></p>
                  <p className="text-sm font-bold text-slate-300 flex items-center gap-2"><User size={14} className="text-emerald-500 shrink-0" /> {selecionado.profissional?.nome || '—'}</p>
                  <p className="text-sm font-bold text-slate-300 flex items-center gap-2"><Calendar size={14} className="text-emerald-500 shrink-0" /> {new Date(selecionado.data).toLocaleDateString('pt-BR')} às {selecionado.hora}</p>
                </div>
              </div>
            </div>

            {/* Formulário */}
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Seu Nome</label>
                <input autoFocus className="w-full bg-slate-900 border border-white/5 rounded-2xl p-5 text-sm font-bold outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700" value={selecionado.clienteNome} onChange={e => setSelecionado(prev => ({ ...prev, clienteNome: e.target.value }))} placeholder="Como quer ser chamado?" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Seu WhatsApp</label>
                <input
                  type="tel"
                  className="w-full bg-slate-900 border border-white/5 rounded-2xl p-5 text-sm font-bold outline-none focus:border-emerald-500 transition-all placeholder:text-slate-700"
                  value={applyPhoneMask(selecionado.clienteWhatsapp)}
                  onChange={e => setSelecionado(prev => ({ ...prev, clienteWhatsapp: e.target.value.replace(/\D/g, '') }))}
                  placeholder="(99) 9 9999-9999"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: SUCESSO */}
        {step === 5 && (
          <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/40">
              <CheckCircle size={40} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Quase tudo pronto!</h2>
              <p className="text-slate-400 mt-2 text-sm">Seu agendamento foi enviado e está <b>pendente de confirmação</b> pela equipe.</p>
            </div>
            <button
              onClick={() => {
                const dataObj = new Date(selecionado.data + 'T12:00:00');
                const diaSemana = dataObj.toLocaleDateString('pt-BR', { weekday: 'long' });
                const dataFormatada = dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

                const whatsappDestino = selecionado.profissional?.whatsapp || estab.configuracoes?.whatsapp || '';

                const msg = encodeURIComponent(
                  `Olá! Gostaria de confirmar minha reserva\n` +
                  `💈 ${estab.nome.toUpperCase()} 💈\n` +
                  `👤 CLIENTE: ${selecionado.clienteNome}\n` +
                  `✂️ SERVIÇO: ${selecionado.servico.nome}\n` +
                  `🗓️ DATA: ${dataFormatada} (${diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)})\n` +
                  `⏰ HORA: ${selecionado.hora}\n` +
                  `✅ Status: Aguardando confirmação\n\n` +
                  `Pode confirmar para mim? 🙏`
                );
                window.open(`https://wa.me/${whatsappDestino.replace(/\D/g, '')}?text=${msg}`, '_blank');
              }}
              className="w-full bg-slate-900 border border-white/10 py-5 rounded-2xl font-black text-sm flex items-center justify-center gap-3 active:scale-95 transition-all hover:bg-slate-800"
            >
              <MessageCircle size={20} className="text-emerald-500" /> Avisar via WhatsApp
            </button>
            <button onClick={() => window.location.reload()} className="text-slate-600 text-xs font-bold uppercase tracking-widest hover:text-emerald-500 transition-colors">Voltar ao início</button>
          </div>
        )}
      </main>

      {/* FOOTER BAR */}
      {step < 5 && (
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-slate-950/80 backdrop-blur-lg border-t border-white/5 flex items-center justify-center gap-4">
          {step === 4 ? (
            <button
              onClick={handleFinish}
              disabled={isFinishing || !selecionado.clienteNome || !selecionado.clienteWhatsapp}
              className="w-full bg-emerald-500 py-4 rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isFinishing ? 'Agendando...' : 'Confirmar Agendamento'}
            </button>
          ) : (
            <>
              {(estab.configuracoes?.instagram || estab.configuracoes?.facebook) && (
                <div className="flex items-center gap-4 mr-6">
                  {estab.configuracoes?.instagram && (
                    <a
                      href={`https://instagram.com/${estab.configuracoes.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 hover:text-pink-400 transition-colors p-1"
                    >
                      <Instagram size={20} />
                    </a>
                  )}
                  {estab.configuracoes?.facebook && (
                    <a
                      href={estab.configuracoes.facebook.startsWith('http') ? estab.configuracoes.facebook : `https://facebook.com/${estab.configuracoes.facebook}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 hover:text-blue-400 transition-colors p-1"
                    >
                      <Facebook size={20} />
                    </a>
                  )}
                </div>
              )}
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">GFin • Agendamento Seguro</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
