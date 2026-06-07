import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { LayoutDashboard, ArrowLeft, Mail, Lock, Eye, EyeOff } from 'lucide-react'
import type { UserSession } from '../../types/auth'

export function LoginPage({ onLogin }: { onLogin: (session: UserSession) => void }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
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
      if (err.message === 'Email not confirmed' || (err.status === 400 && err.message.toLowerCase().includes('confirm'))) {
        alert('Por favor, confirme seu e-mail para ativar sua conta. Verifique sua caixa de entrada e a pasta de spam pelo link enviado.')
      } else {
        alert('Erro no login: ' + err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      if (error) throw error
      setForgotSuccess(true)
    } catch (err: any) {
      alert('Erro ao enviar e-mail de recuperação: ' + err.message)
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 md:p-6 text-white relative animate-in fade-in duration-500">
      {/* Botão de voltar */}
      <div className="absolute top-4 left-4 md:top-8 md:left-8">
        <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium bg-slate-900/50 p-2 md:px-4 md:py-2 rounded-lg border border-white/5 backdrop-blur-sm">
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Voltar para Home</span>
        </Link>
      </div>

      <div className="glass-card w-full max-w-md p-6 md:p-8 border-white/5 space-y-8 shadow-2xl">
        {mode === 'login' ? (
          <>
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
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">Senha</label>
                  <button 
                    type="button" 
                onClick={() => { setMode('forgot'); setForgotSuccess(false); setForgotEmail(''); }}
                    className="text-[10px] md:text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-wider hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <input 
                    required 
                    type={showSenha ? 'text' : 'password'} 
                    value={senha} 
                    onChange={e => setSenha(e.target.value)} 
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 pr-11 md:p-4 md:pr-11 text-sm md:text-base text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" 
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha(!showSenha)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors cursor-pointer animate-in fade-in"
                  >
                    {showSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              
              <div className="pt-2">
                <button disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-bold py-3.5 md:py-4 px-4 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all text-sm md:text-base flex justify-center items-center">
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : 'Acessar Painel'}
                </button>
              </div>
            </form>

            <div className="text-center pt-2 border-t border-white/5">
              <Link to="/register" className="text-slate-400 hover:text-white text-sm transition-colors group flex items-center justify-center gap-1 mt-4">
                Não possui conta? <span className="text-emerald-500 font-bold group-hover:underline">Criar conta grátis</span>
              </Link>
            </div>
          </>
        ) : (
          <>
            {forgotSuccess ? (
              <div className="text-center space-y-6 animate-in fade-in duration-300">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-emerald-500/5 border border-emerald-500/10">
                  <Mail size={32} />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-black tracking-tight">E-mail Enviado! 📬</h1>
                  <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
                    Enviamos as instruções de recuperação de senha para:
                  </p>
                  <p className="text-emerald-400 font-bold break-all bg-emerald-500/5 py-2 px-3 rounded-lg border border-emerald-500/10 text-sm">
                    {forgotEmail}
                  </p>
                </div>
                <div className="bg-slate-900/50 border border-white/5 p-4 rounded-xl text-left text-xs text-slate-400 space-y-2">
                  <p className="font-bold text-white uppercase tracking-wider text-[10px]">Próximos passos:</p>
                  <p>1. Verifique seu e-mail e clique no link de recuperação de senha.</p>
                  <p>2. Se não receber em alguns minutos, verifique sua pasta de Spam.</p>
                </div>
                <button 
                  onClick={() => setMode('login')}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all text-sm md:text-base text-center"
                >
                  Voltar para o Login
                </button>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="text-center">
                  <div className="w-14 h-14 md:w-16 md:h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/5 border border-emerald-500/10">
                    <Lock size={28} className="md:w-8 md:h-8" />
                  </div>
                  <h1 className="text-2xl font-black tracking-tight">Recuperar Senha</h1>
                  <p className="text-slate-400 text-xs md:text-sm mt-2">
                    Insira seu e-mail cadastrado e enviaremos um link para criar uma nova senha.
                  </p>
                </div>

                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase px-1 tracking-wider">E-mail</label>
                    <input 
                      required 
                      type="email" 
                      value={forgotEmail} 
                      onChange={e => setForgotEmail(e.target.value)} 
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 md:p-4 text-sm md:text-base text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" 
                      placeholder="seu@email.com"
                    />
                  </div>
                  
                  <div className="pt-2 flex flex-col gap-3">
                    <button 
                      disabled={forgotLoading} 
                      type="submit"
                      className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-bold py-3.5 md:py-4 px-4 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all text-sm md:text-base flex justify-center items-center"
                    >
                      {forgotLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : 'Enviar Link de Recuperação'}
                    </button>
                    
                    <button 
                      type="button"
                      onClick={() => setMode('login')}
                      className="w-full bg-slate-900 hover:bg-slate-800 border border-white/10 text-white font-bold py-3 px-4 rounded-xl active:scale-[0.98] transition-all text-sm md:text-base text-center"
                    >
                      Voltar para o Login
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
