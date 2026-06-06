import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Mail, Lock, ShieldAlert, KeyRound, UserCheck, Eye, EyeOff } from 'lucide-react'
import type { UserSession } from '../../types/auth'

export function RegisterSaasAdminPage({ onLogin }: { onLogin: (session: UserSession) => void }) {
  const [devPassword, setDevPassword] = useState('')
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [showDevPassword, setShowDevPassword] = useState(false)

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [registrationSuccess, setRegistrationSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const navigate = useNavigate()

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault()
    const envPassword = import.meta.env.VITE_DEV_PASSWORD
    
    if (devPassword === envPassword) {
      setIsUnlocked(true)
      setPasswordError('')
    } else {
      setPasswordError('Senha de ambiente incorreta. Acesso negado.')
    }
  }

  const validateForm = () => {
    if (!email.includes('@')) {
      setErrorMessage('Informe um e-mail válido.')
      return false
    }
    if (senha.length < 6) {
      setErrorMessage('A senha deve ter no mínimo 6 caracteres.')
      return false
    }
    if (senha !== confirmarSenha) {
      setErrorMessage('As senhas não coincidem.')
      return false
    }
    setErrorMessage('')
    return true
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setLoading(true)

    try {
      // 1. Criar usuário no Supabase Auth com o metadado is_saas_admin
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { 
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            is_saas_admin: true
          }
        },
      })

      if (authError) {
        throw authError
      }

      if (!authData.user) {
        throw new Error('Falha ao criar usuário. Tente novamente.')
      }

      const userId = authData.user.id

      // 2. Se o Supabase gerou a sessão imediatamente (confirmação desativada),
      // realiza login direto. Caso contrário, exibe tela de confirmação de e-mail.
      if (authData.session) {
        const session: UserSession = {
          id: userId,
          membro_id: null,
          nome: email,
          estabelecimento_id: '',
          role: 'super_admin',
        }
        onLogin(session)
        alert(`✅ Administrador do SaaS cadastrado com sucesso!`)
        navigate('/super-admin')
      } else {
        setRegistrationSuccess(true)
      }
    } catch (err: any) {
      console.error('Erro ao cadastrar SaaS Admin:', err)
      setErrorMessage(err.message || 'Erro ao criar conta de Administrador.')
    } finally {
      setLoading(false)
    }
  }

  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 md:p-6 text-white relative animate-in fade-in duration-500">
        <div className="glass-card w-full max-w-md p-6 md:p-8 border-white/5 space-y-6 text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-emerald-500/5 border border-emerald-500/10">
            <Mail size={32} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Confirme seu e-mail 📬</h1>
            <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
              Enviamos um link de confirmação e ativação da conta para o endereço:
            </p>
            <p className="text-emerald-400 font-bold break-all bg-emerald-500/5 py-2 px-3 rounded-lg border border-emerald-500/10 text-sm md:text-base">
              {email}
            </p>
          </div>
          <div className="bg-slate-900/50 border border-white/5 p-4 rounded-xl text-left text-xs text-slate-400 space-y-2">
            <p className="font-bold text-white uppercase tracking-wider text-[10px]">Passos importantes:</p>
            <p>1. Acesse seu e-mail e clique no link de ativação.</p>
            <p>2. Após ativar, faça o login normalmente para acessar o painel de Super Admin.</p>
          </div>
          <div className="pt-2">
            <Link 
              to="/login" 
              className="w-full inline-block bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all text-sm md:text-base text-center"
            >
              Ir para Tela de Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // --- ESTADO 1: TELA DE PORTAL/SENHA DE AMBIENTE ---
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 md:p-6 text-white relative">
        <div className="absolute top-4 left-4 md:top-8 md:left-8">
          <Link to="/login" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium bg-slate-900/50 p-2 md:px-4 md:py-2 rounded-lg border border-white/5 backdrop-blur-sm">
            <ArrowLeft size={16} />
            <span>Voltar para Login</span>
          </Link>
        </div>

        <div className="glass-card w-full max-w-md p-6 md:p-8 border-white/5 space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg border border-rose-500/10 animate-pulse">
              <ShieldAlert size={32} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter">Área Restrita</h1>
            <p className="text-slate-400 text-xs md:text-sm">
              Esta rota é restrita a desenvolvedores e administradores do SaaS. Insira a senha de ambiente para continuar.
            </p>
          </div>

          <form onSubmit={handleVerifyPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase px-1 tracking-wider">Senha do Desenvolvedor</label>
              <div className="relative">
                <input 
                  required 
                  type={showDevPassword ? 'text' : 'password'} 
                  value={devPassword} 
                  onChange={e => setDevPassword(e.target.value)} 
                  className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 pl-11 pr-11 text-sm md:text-base text-white outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all" 
                  placeholder="••••••••" 
                />
                <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <button
                  type="button"
                  onClick={() => setShowDevPassword(!showDevPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors cursor-pointer animate-in fade-in"
                >
                  {showDevPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {passwordError && (
              <div className="bg-rose-600/20 border border-rose-600 text-rose-200 rounded-xl p-3 text-xs md:text-sm">
                {passwordError}
              </div>
            )}

            <button type="submit" className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3.5 md:py-4 px-4 rounded-xl shadow-lg shadow-rose-600/20 active:scale-[0.98] transition-all text-sm md:text-base flex justify-center items-center">
              Desbloquear Acesso
            </button>
          </form>
        </div>
      </div>
    )
  }

  // --- ESTADO 2: FORMULÁRIO DE CADASTRO DE SAAS ADMIN ---
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 md:p-6 text-white relative">
      <div className="absolute top-4 left-4 md:top-8 md:left-8">
        <button 
          onClick={() => setIsUnlocked(false)} 
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium bg-slate-900/50 p-2 md:px-4 md:py-2 rounded-lg border border-white/5 backdrop-blur-sm"
        >
          <ArrowLeft size={16} />
          <span>Bloquear Tela</span>
        </button>
      </div>

      <div className="glass-card w-full max-w-md p-6 md:p-8 border-white/5 space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg border border-emerald-500/10">
            <UserCheck size={32} />
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter">Novo <span className="text-emerald-500">SaaS Admin</span></h1>
          <p className="text-slate-400 text-xs md:text-sm">Criação de conta com privilégios de Super Administrador.</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4 md:space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase px-1 tracking-wider">E-mail do Administrador</label>
            <input 
              required 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 md:p-4 text-sm md:text-base text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" 
              placeholder="admin@exemplo.com" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase px-1 tracking-wider">Senha de Acesso</label>
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

          <div className="space-y-1.5">
            <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase px-1 tracking-wider">Confirmar Senha</label>
            <div className="relative">
              <input 
                required 
                type={showConfirmarSenha ? 'text' : 'password'} 
                value={confirmarSenha} 
                onChange={e => setConfirmarSenha(e.target.value)} 
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 pr-11 md:p-4 md:pr-11 text-sm md:text-base text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" 
                placeholder="••••••••" 
              />
              <button
                type="button"
                onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors cursor-pointer animate-in fade-in"
              >
                {showConfirmarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="bg-rose-600/20 border border-rose-600 text-rose-200 rounded-xl p-3 text-xs md:text-sm">
              {errorMessage}
            </div>
          )}

          <button disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-bold py-3.5 md:py-4 px-4 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all text-sm md:text-base flex justify-center items-center">
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : 'Cadastrar Admin'}
          </button>
        </form>
      </div>
    </div>
  )
}
