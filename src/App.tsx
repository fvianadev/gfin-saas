import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { AdminDashboard } from './components/AdminDashboard'
import { PublicBooking } from './components/PublicBooking'
import { TransactionModal } from './components/TransactionModal'
import { SuperAdminDashboard } from './components/SuperAdminDashboard'
import { LayoutDashboard, LogOut, Scissors, TrendingUp, TrendingDown, Edit2, Trash2, ArrowLeft, History, ArrowUpRight, ArrowDownLeft, User, Lock, Star, Shield, Smartphone, Zap, ArrowRight, ShieldCheck, PieChart, Users, Settings, List, X } from 'lucide-react'
import { formatCurrency } from './lib/format'

import type { UserSession } from './types/auth'
import { LandingPage } from './components/LandingPage'
import { LoginPage } from './components/auth/LoginPage'
import { RegisterPage } from './components/auth/RegisterPage'

// --- COMPONENTE: STAFF LOGIN ---
function StaffLogin() {
  const { slug } = useParams()
  const [pin, setPin] = useState('')
  const [estab, setEstab] = useState<any>(null)
  const [membros, setMembros] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMembro, setSelectedMembro] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.from('estabelecimentos').select('*').eq('slug', slug).single().then(({ data }) => {
      setEstab(data)
      if (data) {
        supabase.from('membros_equipe').select('*').eq('estabelecimento_id', data.id).eq('ativo', true).order('nome').then(({ data: m }) => setMembros(m || []))
        
        // Gerar Manifesto PWA Dinâmico para esta barbearia
        const manifest = {
          short_name: data.nome.split(' ')[0],
          name: data.nome,
          description: `Painel de acesso da ${data.nome}`,
          icons: [
            {
              src: data.configuracoes?.logo_url || "/pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable"
            },
            {
              src: data.configuracoes?.logo_url || "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable"
            }
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

        // Atualizar ícone do iOS
        let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
        if (appleIcon && data.configuracoes?.logo_url) {
          appleIcon.setAttribute('href', data.configuracoes.logo_url);
        }
      }
    })
  }, [slug])

  useEffect(() => {
    if (pin.length === 4 && selectedMembro) {
      setLoading(true)
      supabase.from('membros_equipe').select('*').eq('id', selectedMembro.id).eq('pin_hash', pin).single().then(({ data }) => {
        setLoading(false)
        if (data) {
          localStorage.setItem('gfin_staff', JSON.stringify({ ...data, role: 'usuario', slug }))
          navigate(`/${slug}/dashboard`)
        } else { alert('PIN inválido'); setPin('') }
      })
    }
  }, [pin, selectedMembro, slug, navigate])

  if (!estab) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 font-bold">Carregando...</div>

  const filteredMembros = membros.filter(m => m.nome.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          {estab.configuracoes?.logo_url && (
            <img 
              src={estab.configuracoes.logo_url} 
              alt="Logo" 
              className="w-24 h-24 mx-auto mb-4 rounded-2xl object-cover shadow-lg border border-white/10" 
            />
          )}
          <h1 className="text-3xl font-black mb-2 tracking-tighter">{estab.nome}</h1>
          <div className="flex items-center justify-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-widest">
            <Lock size={12} className="text-emerald-500" /> Acesso Seguro
          </div>
        </div>
        <div className="space-y-6">
          <div className="relative">
            <div className="relative group">
              <input 
                type="text" 
                placeholder="Busque seu nome..." 
                value={selectedMembro ? selectedMembro.nome : searchTerm} 
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setSelectedMembro(null);
                  setPin('');
                }}
                onFocus={() => {
                  if (!selectedMembro) setSearchTerm(searchTerm);
                }}
                className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 pl-12 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" 
              />
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              {selectedMembro && (
                <button onClick={() => { setSelectedMembro(null); setSearchTerm(''); setPin('') }} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-rose-500 transition-all">
                  <X size={16} />
                </button>
              )}
            </div>
            
            {!selectedMembro && searchTerm.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-white/5 rounded-xl overflow-hidden z-50 shadow-2xl max-h-48 overflow-y-auto">
                {filteredMembros.length > 0 ? filteredMembros.map(m => (
                  <button key={m.id} onClick={() => { setSelectedMembro(m); setSearchTerm('') }} className="w-full text-left px-4 py-3 hover:bg-emerald-500/10 hover:text-emerald-500 transition-all font-bold text-sm border-b border-white/5 last:border-0 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs text-emerald-500">{m.nome.charAt(0)}</div>
                    {m.nome}
                  </button>
                )) : (
                  <div className="p-4 text-center text-xs text-slate-500 font-bold">Nenhum membro encontrado.</div>
                )}
              </div>
            )}
          </div>

          <div className={`space-y-6 transition-all duration-500 ${selectedMembro ? 'opacity-100' : 'opacity-30 pointer-events-none grayscale'}`}>
            <div className="text-center">
               <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{selectedMembro ? 'Digite seu PIN' : 'Selecione um perfil primeiro'}</p>
            </div>
            <div className="flex justify-center gap-4">
              {[0,1,2,3].map(i => (
                <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${pin.length > i ? 'bg-emerald-500 border-emerald-500 scale-125' : 'border-slate-800'}`} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 w-full max-w-[280px] mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0, '', '<'].map((b, idx) => (
                <button 
                  key={idx} 
                  disabled={loading || b === '' || !selectedMembro} 
                  onClick={() => b === '<' ? setPin(p => p.slice(0, -1)) : b !== '' && pin.length < 4 && setPin(p => p + b)} 
                  className={`h-14 sm:h-16 glass-card rounded-2xl text-2xl font-bold active:scale-90 transition-all ${b === '' ? 'opacity-0 pointer-events-none border-none' : 'hover:bg-white/5 border-white/5 shadow-md'}`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- STAFF DASHBOARD (省略 para brevidade, mas mantido) ---
function StaffDashboard() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(() => {
    const stored = localStorage.getItem('gfin_staff')
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

  const generateDemoData = async () => {
    const demoData = [
      { tipo: 'receita', valor: 250, descricao: 'Corte e Barba', created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
      { tipo: 'receita', valor: 180, descricao: 'Degradê Navalhado', created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
      { tipo: 'despesa', valor: 45, descricao: 'Café e Insumos', created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
      { tipo: 'receita', valor: 140, descricao: 'Corte Infantil', created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString() },
    ]

    const toInsert = demoData.map(d => ({
      ...d,
      estabelecimento_id: user.estabelecimento_id,
      membro_id: user.id
    }))

    const { error } = await supabase.from('transacoes').insert(toInsert)
    if (!error) {
      alert('Dados de teste gerados para ' + user.nome)
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

  const logout = () => { localStorage.removeItem('gfin_staff'); navigate(`/${slug}/login`) }

  if (!user) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 font-bold italic tracking-widest animate-pulse">CARREGANDO...</div>

  if (user.cargo === 'administrador' || user.cargo === 'usuario') {
    return (
      <AdminDashboard 
        estabelecimentoId={user.estabelecimento_id} 
        membroId={user.id}
        cargo={user.cargo}
        onBack={() => { localStorage.removeItem('gfin_staff'); navigate(`/${slug}/login`) }} 
      />
    )
  }

  return null
}
export default function App() {
  const [admin, setAdmin] = useState<UserSession | null>(() => {
    const stored = localStorage.getItem('gfin_admin')
    return stored ? JSON.parse(stored) : null
  })

  const handleLoginState = (session: UserSession) => {
    localStorage.setItem('gfin_admin', JSON.stringify(session))
    setAdmin(session)
  }

  const logoutAdmin = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('gfin_admin')
    setAdmin(null)
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage onLogin={handleLoginState} />} />
      <Route path="/register" element={<RegisterPage onLogin={handleLoginState} />} />
      <Route path="/signup" element={<Navigate to="/register" replace />} />
      <Route path="/create-account" element={<Navigate to="/register" replace />} />
      <Route path="/admin" element={admin && admin.role !== 'super_admin' ? <AdminDashboard onBack={logoutAdmin} estabelecimentoId={admin.estabelecimento_id} membroId={admin.membro_id || ''} cargo={admin.role} /> : <Navigate to="/login" />} />
      <Route path="/super-admin" element={admin?.role === 'super_admin' ? <SuperAdminDashboard onLogout={logoutAdmin} /> : <Navigate to="/login" />} />
      <Route path="/:slug" element={<Navigate to="login" replace />} />
      <Route path="/:slug/login" element={<StaffLogin />} />
      <Route path="/:slug/dashboard" element={<StaffDashboard />} />
      <Route path="/:slug/agendar" element={<PublicBooking />} />
    </Routes>
  )
}
