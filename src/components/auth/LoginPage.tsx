import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { LayoutDashboard, ArrowLeft } from 'lucide-react'
import type { UserSession } from '../../types/auth'

export function LoginPage({ onLogin }: { onLogin: (session: UserSession) => void }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // 1. Autenticar no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (authError) throw authError
      if (!authData.user) throw new Error('Usuário não encontrado.')

      // 2. Verificar se é Super Admin do SaaS (ANTES de buscar estabelecimentos)
      const { data: saasAdmin, error: saasError } = await supabase
        .from('saas_admins')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle()

      if (saasError) {
        console.error('Erro ao verificar saas_admins:', saasError)
      }

      if (saasAdmin) {
        // É Super Admin! Cria sessão com role especial e redireciona
        const session: UserSession = {
          id: authData.user.id,
          membro_id: null,
          nome: saasAdmin.email,
          estabelecimento_id: '',
          role: 'super_admin'
        }
        onLogin(session)
        navigate('/super-admin')
        return
      }

      // 3. É um dono de estabelecimento comum — fluxo original
      const { data: estabs, error: estabError } = await supabase
        .from('estabelecimentos')
        .select('*')
        .eq('owner_id', authData.user.id)

      if (estabError || !estabs || estabs.length === 0) throw new Error('Nenhum estabelecimento encontrado.')

      const estab = estabs[0]
      const { data: membroAdmin } = await supabase
        .from('membros_equipe')
        .select('id, nome')
        .eq('estabelecimento_id', estab.id)
        .eq('cargo', 'administrador')
        .single()

      const session: UserSession = {
        id: authData.user.id,
        membro_id: membroAdmin?.id ?? null,
        nome: membroAdmin?.nome ?? estab.nome,
        estabelecimento_id: estab.id,
        estabelecimento_slug: estab.slug,
        role: 'administrador'
      }

      onLogin(session)
      navigate('/admin')
    } catch (err: any) {
      alert('Erro no login: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 md:p-6 text-white relative">
      {/* Botão de voltar */}
      <div className="absolute top-4 left-4 md:top-8 md:left-8">
        <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium bg-slate-900/50 p-2 md:px-4 md:py-2 rounded-lg border border-white/5 backdrop-blur-sm">
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Voltar para Home</span>
        </Link>
      </div>

      <div className="glass-card w-full max-w-md p-6 md:p-8 border-white/5 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center">
          <div className="w-14 h-14 md:w-16 md:h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
            <LayoutDashboard size={28} className="md:w-8 md:h-8" />
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Bem-vindo de volta</h1>
          <p className="text-slate-500 text-xs md:text-sm mt-2 uppercase tracking-widest font-bold">Login do Administrador</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase px-1 tracking-wider">E-mail</label>
            <input 
              required 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 md:p-4 text-sm md:text-base text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" 
              placeholder="seu@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase px-1 tracking-wider">Senha</label>
            <input 
              required 
              type="password" 
              value={senha} 
              onChange={e => setSenha(e.target.value)} 
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 md:p-4 text-sm md:text-base text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" 
              placeholder="••••••••"
            />
          </div>
          
          <div className="pt-2">
            <button disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-bold py-3.5 md:py-4 px-4 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all text-sm md:text-base flex justify-center items-center">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : 'Acessar Painel'}
            </button>
          </div>
        </form>

        <div className="text-center pt-2">
          <Link to="/register" className="text-slate-400 hover:text-white text-sm transition-colors group flex items-center justify-center gap-1">
            Não possui conta? <span className="text-emerald-500 font-bold group-hover:underline">Criar conta grátis</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
