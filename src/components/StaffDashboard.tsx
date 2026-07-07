import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/format'
import { AdminDashboard } from './AdminDashboard'

export function StaffDashboard() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(() => {
    const stored = sessionStorage.getItem('gfin_staff')
    return stored ? JSON.parse(stored) : null
  })
  const [estab, setEstab] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'receita' | 'despesa'>('receita')
  const [transactions, setTransactions] = useState<any[]>([])
  const [membros, setMembros] = useState<any[]>([])
  const [transactionToEdit, setTransactionToEdit] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'resumo' | 'transacoes'>('resumo')
  const [periodo, setPeriodo] = useState<'hoje' | '7dias' | '30dias' | 'todos'>('30dias')

  const fetchTransactions = async (mId: string, eId: string, cargo: string, p: string) => {
    if (!eId) return;
    let query = supabase.from('transacoes').select('*').eq('estabelecimento_id', eId).eq('excluido', false)
    if (cargo !== 'administrador' && mId) query = query.eq('membro_id', mId)
    
    const now = new Date()
    if (p === 'hoje') query = query.gte('created_at', new Date(now.setHours(0,0,0,0)).toISOString())
    else if (p === '7dias') { const d = new Date(); d.setDate(d.getDate() - 7); query = query.gte('created_at', d.toISOString()) }
    else if (p === '30dias') { const d = new Date(); d.setDate(d.getDate() - 30); query = query.gte('created_at', d.toISOString()) }
    
    const { data, error } = await query.order('created_at', { ascending: false }).limit(100)
    if (!error) setTransactions(data || [])
  }

  const stats = {
    receita: transactions.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + Number(t.valor), 0),
    despesa: transactions.filter(t => t.tipo === 'despesa').reduce((acc, t) => acc + Number(t.valor), 0)
  }

  const fetchEstab = async (eId: string) => {
    const { data } = await supabase.from('estabelecimentos').select('*').eq('id', eId).single()
    if (data) setEstab(data)
  }

  const fetchMembros = async (eId: string) => {
    const { data } = await supabase.from('membros_equipe').select('*').eq('estabelecimento_id', eId).eq('ativo', true)
    setMembros(data || [])
  }

  const handleDelete = async (id: string) => {
    const motivo = prompt('Motivo da exclusão:')
    if (!motivo) return
    const { error } = await supabase.from('transacoes').update({ 
      excluido: true, 
      excluido_em: new Date().toISOString(),
      excluido_por: user.id,
      motivo_exclusao: motivo
    }).eq('id', id)

    if (!error) {
      await supabase.from('auditoria_transacoes').insert({ transacao_id: id, membro_id: user.id, acao: 'exclusao', motivo })
      fetchTransactions(user.id, user.estabelecimento_id, user.cargo, periodo)
    }
  }

  useEffect(() => {
    if (!user) navigate(`/${slug}/login`)
    else {
      fetchTransactions(user.id, user.estabelecimento_id, user.cargo, periodo)
      fetchMembros(user.estabelecimento_id)
      fetchEstab(user.estabelecimento_id)
    }
  }, [slug, navigate, periodo, user])

  const logout = () => { sessionStorage.removeItem('gfin_staff'); navigate(`/${slug}/login`) }

  if (!user) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 font-bold italic tracking-widest animate-pulse">CARREGANDO...</div>

  if (user.cargo === 'administrador' || user.cargo === 'usuario') {
    return (
      <AdminDashboard 
        estabelecimentoId={user.estabelecimento_id} 
        membroId={user.id}
        cargo={user.cargo}
        isOwner={false}
        onBack={() => { sessionStorage.removeItem('gfin_staff'); navigate(`/${slug}/login`) }} 
      />
    )
  }

  return null
}
