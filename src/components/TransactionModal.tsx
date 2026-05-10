import { useState, useEffect } from 'react'
import { X, DollarSign, FileText, Check, Users, AlertCircle, MessageSquare } from 'lucide-react'
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
  const [motivo, setMotivo] = useState('')
  const [selectedMembroId, setSelectedMembroId] = useState(membroId)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const [catalogItems, setCatalogItems] = useState<any[]>([])
  const [filteredCatalog, setFilteredCatalog] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  const isEditing = !!editingTransaction

  useEffect(() => {
    if (isOpen) {
      if (editingTransaction) {
        setValor(editingTransaction.valor.toString().replace('.', ','))
        setDescricao(editingTransaction.descricao)
        setSelectedMembroId(editingTransaction.membro_id)
        setMotivo('')
      } else {
        setValor('')
        setDescricao('')
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
    if (isEditing && !motivo.trim()) {
      alert('Por favor, informe o motivo da alteração.')
      return
    }

    setLoading(true)
    const valorFloat = parseFloat(valor.replace(',', '.'))

    try {
      if (isEditing) {
        // Lógica de Edição com Auditoria
        const { error: updateError } = await supabase
          .from('transacoes')
          .update({
            valor: valorFloat,
            descricao,
            membro_id: selectedMembroId,
            updated_at: new Date().toISOString(),
            alterado_por: membroId,
            motivo_alteracao: motivo
          })
          .eq('id', editingTransaction.id)

        if (updateError) throw updateError

        // Registrar Auditoria
        await supabase.from('auditoria_transacoes').insert({
          transacao_id: editingTransaction.id,
          membro_id: membroId,
          acao: 'edicao',
          motivo: motivo,
          dados_anteriores: {
            valor: editingTransaction.valor,
            descricao: editingTransaction.descricao,
            membro_id: editingTransaction.membro_id
          },
          dados_novos: {
            valor: valorFloat,
            descricao,
            membro_id: selectedMembroId
          }
        })

      } else {
        // Novo Lançamento
        const { error } = await supabase
          .from('transacoes')
          .insert({
            valor: valorFloat,
            descricao,
            tipo,
            membro_id: selectedMembroId,
            estabelecimento_id: estabelecimentoId,
            categoria: tipo === 'receita' ? 'Serviço' : 'Geral'
          })

        if (error) throw error
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
            </div>

            {/* Campo de Motivo (Apenas se estiver editando) */}
            {isEditing && (
               <div className="space-y-2 animate-in slide-in-from-top duration-300">
                  <label className="text-sm font-medium text-amber-400 flex items-center gap-2">
                    <MessageSquare size={16} /> Motivo da Alteração *
                  </label>
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Explique por que está alterando este registro..."
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
