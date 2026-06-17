import { useState, useEffect, useMemo } from 'react'
import { X, DollarSign, FileText, Check, Users, AlertCircle, MessageSquare, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface TransactionModalProps {
  isOpen: boolean
  onClose: () => void
  tipo: 'receita' | 'despesa'
  membroId: string
  membros: any[]
  estabelecimentoId: string
  onSuccess: () => void
  canSelectMember?: boolean
  editingTransaction?: any // Transação que está sendo editada
}

export function TransactionModal({ 
  isOpen, 
  onClose, 
  tipo, 
  membroId, 
  membros, 
  estabelecimentoId, 
  onSuccess,
  canSelectMember = true,
  editingTransaction = null
}: TransactionModalProps) {
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [dataCompetencia, setDataCompetencia] = useState(new Date().toLocaleDateString('en-CA'))
  const [motivo, setMotivo] = useState('')
  const [selectedMembroId, setSelectedMembroId] = useState(membroId)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const [categoria, setCategoria] = useState('')
  const [catalogItems, setCatalogItems] = useState<any[]>([])
  const [filteredCatalog, setFilteredCatalog] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  const isEditing = !!editingTransaction

  const availableCategories = useMemo(() => {
    const cats = new Set<string>()
    catalogItems.forEach((item: any) => {
      if (item.categoria) cats.add(item.categoria.toUpperCase())
    })
    return Array.from(cats).sort()
  }, [catalogItems])

  useEffect(() => {
    if (isOpen) {
      if (editingTransaction) {
        setValor(editingTransaction.valor.toString().replace('.', ','))
        setDescricao(editingTransaction.descricao)
        setCategoria(editingTransaction.categoria || '')
        setDataCompetencia(editingTransaction.data_competencia || new Date().toLocaleDateString('en-CA'))
        setSelectedMembroId(editingTransaction.membro_id)
        setMotivo('')
      } else {
        setValor('')
        setDescricao('')
        setCategoria('')
        setDataCompetencia(new Date().toLocaleDateString('en-CA'))
        setSelectedMembroId(membroId)
        setMotivo('')
      }
      setSuccess(false)
      
      // Buscar itens do catálogo
      supabase.from('servicos_produtos')
        .select('*')
        .eq('estabelecimento_id', estabelecimentoId)
        .eq('tipo', tipo)
        .then(({ data }) => setCatalogItems(data || []))
    }
  }, [isOpen, editingTransaction, membroId, estabelecimentoId, tipo])

  useEffect(() => {
    if (descricao.length > 0 && !isEditing) {
      const filtered = catalogItems.filter(item => 
        item.nome.toLowerCase().includes(descricao.toLowerCase()) &&
        item.nome.toLowerCase() !== descricao.toLowerCase()
      )
      setFilteredCatalog(filtered)
      setShowDropdown(filtered.length > 0)
    } else {
      setShowDropdown(false)
    }
  }, [descricao, catalogItems, isEditing])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMembroId) {
      alert('Por favor, selecione o membro da equipe.')
      return
    }
    const today = new Date().toLocaleDateString('en-CA')
    const isPastDate = dataCompetencia < today
    const isFutureDate = dataCompetencia > today
    const needsMotivo = isEditing || isPastDate

    if (isFutureDate) {
      alert('Não é permitido realizar lançamentos em datas futuras.')
      return
    }

    if (needsMotivo && !motivo.trim()) {
      alert(`Por favor, informe o motivo para este ${isEditing ? 'ajuste' : 'lançamento retroativo'}.`)
      return
    }

    if (!categoria.trim()) {
      alert('Informe a categoria do lançamento.')
      return
    }

    setLoading(true)
    const valorFloat = parseFloat(valor.replace(',', '.'))

    try {
      if (isEditing) {
        // 1. Atualizar a transação de verdade
        const { error: updateError } = await supabase
          .from('transacoes')
          .update({
            valor: valorFloat,
            descricao,
            categoria: categoria.toUpperCase(),
            data_competencia: dataCompetencia,
            membro_id: selectedMembroId,
            updated_at: new Date().toISOString(),
            alterado_por: membroId,
            motivo_alteracao: motivo
          })
          .eq('id', editingTransaction.id)

        if (updateError) throw updateError

        // 2. Registrar Auditoria DETALHADA
        await supabase.from('auditoria_transacoes').insert({
          transacao_id: editingTransaction.id,
          membro_id: membroId,
          estabelecimento_id: estabelecimentoId,
          acao: 'edicao',
          motivo: motivo,
          dados_anteriores: {
            valor: editingTransaction.valor,
            descricao: editingTransaction.descricao,
            data_competencia: editingTransaction.data_competencia,
            membro_id: editingTransaction.membro_id
          },
          dados_novos: {
            valor: valorFloat,
            descricao,
            data_competencia: dataCompetencia,
            membro_id: selectedMembroId
          }
        })

      } else {
        // Novo Lançamento
        const { data: newTx, error: insertError } = await supabase
          .from('transacoes')
          .insert({
            valor: valorFloat,
            descricao,
            tipo,
            membro_id: selectedMembroId,
            estabelecimento_id: estabelecimentoId,
            data_competencia: dataCompetencia,
            categoria: categoria.toUpperCase(),
            motivo_alteracao: isPastDate ? motivo : null
          })
          .select()
          .single()

        if (insertError) throw insertError

        // Se for retroativo, registrar na auditoria
        if (isPastDate && newTx) {
          await supabase.from('auditoria_transacoes').insert({
            transacao_id: newTx.id,
            membro_id: membroId,
            estabelecimento_id: estabelecimentoId,
            acao: 'criacao_retroativa',
            motivo: motivo,
            dados_novos: {
              valor: valorFloat,
              descricao,
              data_competencia: dataCompetencia,
              membro_id: selectedMembroId
            }
          })
        }
      }

      setSuccess(true)
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1500)
    } catch (err: any) {
      console.error('Erro:', err)
      alert(`Erro ao salvar: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const semMembros = membros.length === 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="glass-card w-full max-w-lg overflow-hidden animate-in slide-in-from-bottom duration-300">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h3 className="text-xl font-bold">
            {isEditing ? 'Editar' : 'Nova'} {tipo === 'receita' ? 'Receita' : 'Despesa'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {success ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-4 animate-bounce">
              <Check size={40} className="text-white" />
            </div>
            <h4 className="text-2xl font-bold text-white">Sucesso!</h4>
            <p className="text-slate-400">Dados registrados com êxito.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            
            {/* Seletor de Membro */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Users size={16} /> Responsável
              </label>
              <select
                disabled={!canSelectMember}
                value={selectedMembroId}
                onChange={(e) => setSelectedMembroId(e.target.value)}
                className={`w-full h-14 bg-white/5 border border-white/10 rounded-xl px-4 focus:border-emerald-500 outline-none transition-all appearance-none ${!canSelectMember ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                required
              >
                <option value="" className="bg-slate-900">Selecione o membro...</option>
                {membros.map(m => (
                  <option key={m.id} value={m.id} className="bg-slate-900">
                    {m.nome} ({m.cargo})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {/* Descrição Input com Autocomplete */}
               <div className="space-y-2 relative">
                 <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                   <FileText size={16} /> Descrição
                 </label>
                 <input
                   type="text"
                   value={descricao}
                   onChange={(e) => setDescricao(e.target.value)}
                   onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                   onFocus={() => descricao.length > 0 && setShowDropdown(filteredCatalog.length > 0)}
                   placeholder="Serviço ou Produto"
                   className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-4 focus:border-emerald-500 outline-none transition-all"
                   required
                 />
                 
                 {showDropdown && (
                   <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-h-48 overflow-y-auto scrollbar-hide animate-in fade-in slide-in-from-top-2">
                      {filteredCatalog.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setDescricao(item.nome)
                            if (item.preco_sugerido) setValor(item.preco_sugerido.toString().replace('.', ','))
                            setCategoria(item.categoria || '')
                            setShowDropdown(false)
                          }}
                          className="w-full p-4 text-left hover:bg-emerald-500/10 flex justify-between items-center group border-b border-white/5 last:border-0"
                        >
                          <span className="text-sm font-medium">{item.nome}</span>
                          {item.preco_sugerido && (
                            <span className="text-xs font-mono text-emerald-500 font-bold">R$ {item.preco_sugerido.toString().replace('.', ',')}</span>
                          )}
                        </button>
                      ))}
                   </div>
                 )}
               </div>

                {/* Valor Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <DollarSign size={16} /> Valor (R$)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={valor}
                    onChange={(e) => setValor(e.target.value.replace('.', ','))}
                    placeholder="0,00"
                    className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-4 text-xl font-bold focus:border-emerald-500 outline-none transition-all"
                    required
                  />
                </div>

                {/* Categoria Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <FileText size={16} /> Categoria
                  </label>
                  <input
                    list="tx-categoria-list"
                    type="text"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value.toUpperCase())}
                    placeholder={tipo === 'receita' ? 'Ex: CABELO, BARBA' : 'Ex: ÁGUA, ALUGUEL'}
                    className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-4 focus:border-emerald-500 outline-none transition-all"
                    required
                  />
                  <datalist id="tx-categoria-list">
                    {availableCategories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>

                {/* Data Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Calendar size={16} /> Data do Lançamento
                  </label>
                  <input
                    type="date"
                    value={dataCompetencia}
                    max={new Date().toLocaleDateString('en-CA')}
                    onChange={(e) => setDataCompetencia(e.target.value)}
                    className="w-full h-14 bg-white/5 border border-white/10 rounded-xl px-4 font-bold focus:border-emerald-500 outline-none transition-all color-scheme-dark"
                    required
                  />
                </div>
             </div>

            {/* Campo de Motivo (Se estiver editando ou for data retroativa) */}
            {(isEditing || dataCompetencia !== new Date().toLocaleDateString('en-CA')) && (
               <div className="space-y-2 animate-in slide-in-from-top duration-300">
                  <label className="text-sm font-medium text-amber-400 flex items-center gap-2">
                    <MessageSquare size={16} /> Motivo do Lançamento/Alteração *
                  </label>
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder={isEditing ? "Explique por que está alterando este registro..." : "Explique por que este lançamento está sendo feito com data retroativa..."}
                    className="w-full h-24 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-sm focus:border-amber-500 outline-none transition-all resize-none"
                    required
                  />
               </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full h-14 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all ${isEditing ? 'bg-amber-500 shadow-amber-500/20' : 'bg-emerald-500 shadow-emerald-500/20'}`}
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                isEditing ? 'Salvar Alterações' : 'Confirmar Lançamento'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
