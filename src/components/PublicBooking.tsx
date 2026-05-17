import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Calendar, Clock, User, Users, Scissors, CheckCircle, ArrowLeft, MessageCircle, ChevronRight } from 'lucide-react'
import { formatCurrency } from '../lib/format'

export function PublicBooking() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [estab, setEstab] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1) // 1: Servico, 2: Profissional, 3: Data/Hora, 4: Cadastro, 5: Sucesso

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
  const [profissionais, setProfissionais] = useState<any[]>([])
  const [horariosFunc, setHorariosFunc] = useState<any[]>([])
  const [agendamentosExistentes, setAgendamentosExistentes] = useState<any[]>([])
  const [carregandoHorarios, setCarregandoHorarios] = useState(false)

  const [selecionado, setSelecionado] = useState({
    servico: null as any,
    profissional: null as any,
    data: '',
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

  const fetchAgendamentosDoDia = async () => {
    try {
      setCarregandoHorarios(true)
      setError(null)
      
      // Criar range de data local para evitar problemas de timezone
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

      // Extrair apenas o HH:mm das strings ISO para facilitar a comparação
      const formatados = (data || []).map(a => ({
        hora: new Date(a.hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        membro_id: a.membro_id
      }))
      
      setAgendamentosExistentes(formatados)
    } catch (err: any) {
      console.error('Erro ao buscar agendamentos:', err)
      // Não bloqueia o usuário, mas avisa no console
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
    } catch (err: any) {
      console.error('Erro ao carregar estabelecimento:', err)
      setError(err.message || 'Erro ao carregar dados do salão.')
    } finally {
      setLoading(false)
    }
  }

  const fetchDados = async (id: string) => {
    try {
      const [servRes, profRes, horRes] = await Promise.all([
        supabase.from('servicos_produtos').select('*').eq('estabelecimento_id', id).eq('tipo', 'receita').order('categoria'),
        supabase.from('membros_equipe').select('*').eq('estabelecimento_id', id).eq('ativo', true),
        supabase.from('horarios_funcionamento').select('*').eq('estabelecimento_id', id).eq('ativo', true)
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
        setCategorias(Object.entries(grouped))
      }
      setProfissionais(profRes.data || [])
      setHorariosFunc(horRes.data || [])
    } catch (err: any) {
      console.error('Erro ao buscar dados complementares:', err)
      setError('Erro ao carregar serviços ou profissionais.')
    }
  }

  const handleFinish = async () => {
    if (!selecionado.clienteNome || !selecionado.clienteWhatsapp) return
    
    try {
      setIsFinishing(true)
      const pad = (n: number) => n.toString().padStart(2, '0')
      const [ano, mes, dia] = selecionado.data.split('-').map(Number)
      const [h, m] = selecionado.hora.split(':').map(Number)
      
      // Criar data local e converter para ISO
      const dataInicio = new Date(ano, mes - 1, dia, h, m)
      
      const dataFim = new Date(dataInicio)
      dataFim.setMinutes(dataFim.getMinutes() + (selecionado.servico.duracao_minutos || 30))

      let profissionalId = selecionado.profissional?.id || null;

      // Se escolheu "Qualquer", vamos atribuir automaticamente a um que esteja livre
      if (!profissionalId && profissionais.length > 0) {
        const ocupadosNesseHorario = agendamentosExistentes.filter(a => a.hora === selecionado.hora);
        const idsOcupados = ocupadosNesseHorario.map(a => a.membro_id);
        const disponiveis = profissionais.filter(p => !idsOcupados.includes(p.id));
        
        if (disponiveis.length > 0) {
          profissionalId = disponiveis[0].id;
        } else {
          profissionalId = profissionais[0].id; // Fallback se algo deu errado na filtragem
        }
      }

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

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-emerald-500"></div>
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
          <button onClick={() => setStep(step - 1)} className="p-2 bg-white/5 rounded-xl text-slate-400">
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="flex items-center gap-3">
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
      </header>

      <main className="p-6 max-w-md mx-auto">
        {/* STEP 1: SERVIÇOS */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-black text-white leading-tight">O que vamos <span className="text-emerald-500">fazer hoje?</span></h2>
            {categorias.map(([cat, items]) => (
              <div key={cat} className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">{cat}</h3>
                <div className="grid grid-cols-1 gap-3">
                  {items.map((item: any) => (
                    <button 
                      key={item.id} 
                      onClick={() => { setSelecionado(prev => ({ ...prev, servico: item })); setStep(2); }}
                      className="glass-card p-5 border-white/5 text-left flex justify-between items-center group active:scale-95 transition-all"
                    >
                      <div>
                        <p className="font-bold text-sm text-slate-200 group-hover:text-emerald-400 transition-colors">{item.nome}</p>
                        <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-slate-500 uppercase">
                          <span className="flex items-center gap-1"><Clock size={10} /> {item.duracao_minutos || 30} min</span>
                          <span className="text-emerald-500/80">{formatCurrency(item.preco_sugerido || 0)}</span>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-slate-700 group-hover:text-emerald-500 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STEP 2: PROFISSIONAL */}
        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-xl font-black text-white leading-tight">Com <span className="text-emerald-500">quem?</span></h2>
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => { setSelecionado(prev => ({ ...prev, profissional: null })); setStep(3); }}
                className="glass-card p-5 border-white/5 text-left flex items-center gap-4 active:scale-95 transition-all"
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-emerald-500">
                  <Users size={24} />
                </div>
                <div>
                  <p className="font-bold text-sm">Qualquer um</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">O que estiver disponível mais cedo</p>
                </div>
              </button>
              {profissionais.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => { setSelecionado(prev => ({ ...prev, profissional: p })); setStep(3); }}
                  className="glass-card p-5 border-white/5 text-left flex items-center gap-4 active:scale-95 transition-all"
                >
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-emerald-500 font-black uppercase text-xl">
                    {p.nome.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{p.nome}</p>
                    <p className="text-[10px] text-emerald-500/60 font-bold uppercase tracking-widest">Profissional</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: DATA E HORA */}
        {step === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-xl font-black text-white leading-tight">Escolha o <span className="text-emerald-500">horário</span></h2>
            
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Selecione o Dia</label>
              <input 
                type="date" 
                min={new Date().toISOString().split('T')[0]}
                className="w-full bg-slate-900 border border-white/5 rounded-2xl p-5 text-sm font-bold text-white outline-none focus:border-emerald-500 transition-all"
                value={selecionado.data}
                onChange={e => setSelecionado(prev => ({ ...prev, data: e.target.value }))}
              />
            </div>

            {selecionado.data && (
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase px-1">
                  {carregandoHorarios ? 'Verificando disponibilidade...' : 'Horários Disponíveis'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'].map(h => {
                    // Lógica de Bloqueio
                    const ocupadosNesseHorario = agendamentosExistentes.filter(a => a.hora === h)
                    let disponivel = true

                    if (selecionado.profissional) {
                      // Se escolheu um barbeiro, ele está livre?
                      const jaTemAgendamentoComEle = ocupadosNesseHorario.some(a => a.membro_id === selecionado.profissional.id)
                      if (jaTemAgendamentoComEle) disponivel = false
                    } else {
                      // Se "Qualquer", ainda tem barbeiro livre?
                      if (ocupadosNesseHorario.length >= profissionais.length) disponivel = false
                    }

                    if (!disponivel) return null

                    return (
                      <button 
                        key={h}
                        onClick={() => { setSelecionado(prev => ({ ...prev, hora: h })); setStep(4); }}
                        className={`py-3 rounded-xl text-xs font-black transition-all ${selecionado.hora === h ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-900 text-slate-400 border border-white/5'}`}
                      >
                        {h}
                      </button>
                    )
                  })}
                </div>
                {agendamentosExistentes.length > 0 && (
                   <p className="text-[10px] text-slate-600 italic mt-2">* Horários ocupados não são exibidos.</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: DADOS FINAIS */}
        {step === 4 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <h2 className="text-xl font-black text-white leading-tight">Para <span className="text-emerald-500">finalizar...</span></h2>
            
            <div className="glass-card p-6 border-emerald-500/20 bg-emerald-500/5 mb-6">
               <p className="text-[10px] text-emerald-500 font-bold uppercase mb-3">Resumo do Agendamento</p>
               <div className="space-y-2">
                 <p className="text-sm font-bold flex items-center gap-2"><Scissors size={14} className="text-emerald-500" /> {selecionado.servico.nome}</p>
                 <p className="text-sm font-bold flex items-center gap-2"><User size={14} className="text-emerald-500" /> {selecionado.profissional?.nome || 'Qualquer Profissional'}</p>
                 <p className="text-sm font-bold flex items-center gap-2"><Calendar size={14} className="text-emerald-500" /> {new Date(selecionado.data).toLocaleDateString('pt-BR')} às {selecionado.hora}</p>
               </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Seu Nome</label>
                <input required className="w-full bg-slate-900 border border-white/5 rounded-2xl p-5 text-sm font-bold outline-none focus:border-emerald-500 transition-all" value={selecionado.clienteNome} onChange={e => setSelecionado(prev => ({ ...prev, clienteNome: e.target.value }))} placeholder="Como quer ser chamado?" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Seu WhatsApp</label>
                <input 
                  required 
                  type="tel" 
                  className="w-full bg-slate-900 border border-white/5 rounded-2xl p-5 text-sm font-bold outline-none focus:border-emerald-500 transition-all" 
                  value={applyPhoneMask(selecionado.clienteWhatsapp)} 
                  onChange={e => setSelecionado(prev => ({ ...prev, clienteWhatsapp: e.target.value.replace(/\D/g, '') }))} 
                  placeholder="(99) 9 9999-9999" 
                />
              </div>
              <button onClick={handleFinish} className="w-full bg-emerald-500 py-5 rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/20 active:scale-95 transition-all mt-6 uppercase tracking-widest">
                Confirmar Agendamento
              </button>
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
                
                // WhatsApp Dinâmico: Se tiver profissional, manda pra ele. Senão, manda pro estabelecimento.
                const whatsappDestino = selecionado.profissional?.whatsapp || estab.configuracoes?.whatsapp || '';

                const msg = encodeURIComponent(
                  `Olá! Gostaria de confirmar minha reserva\n` +
                  `\uD83D\uDC88 ${estab.nome.toUpperCase()} \uD83D\uDC88\n` +
                  `\uD83D\uDC64 CLIENTE: ${selecionado.clienteNome}\n` +
                  `\u2702\uFE0F SERVIÇO: ${selecionado.servico.nome}\n` +
                  `\uD83D\uDDD3\uFE0F DATA: ${dataFormatada} (${diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1)})\n` +
                  `\u23F0 HORA: ${selecionado.hora}\n` +
                  `\u2705 Status: Aguardando confirmação\n\n` +
                  `Pode confirmar para mim? \uD83D\uDE4F`
                );
                window.open(`https://wa.me/${whatsappDestino.replace(/\D/g, '')}?text=${msg}`, '_blank');
              }}
              className="w-full bg-slate-900 border border-white/10 py-5 rounded-2xl font-black text-sm flex items-center justify-center gap-3 active:scale-95 transition-all"
            >
              <MessageCircle size={20} className="text-emerald-500" /> Avisar via WhatsApp
            </button>
            <button onClick={() => window.location.reload()} className="text-slate-600 text-xs font-bold uppercase tracking-widest hover:text-emerald-500 transition-colors">Voltar ao início</button>
          </div>
        )}
      </main>

      {/* FOOTER BAR */}
      {step < 5 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-950/80 backdrop-blur-lg border-t border-white/5 flex justify-center">
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em]">GFin • Agendamento Seguro</p>
        </div>
      )}
    </div>
  )
}
