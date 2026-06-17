import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import type { UserSession } from '../../types/auth'

export function FirstAdminSetup({ onLogin }: { onLogin: (session: UserSession) => void }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [registrationSuccess, setRegistrationSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const navigate = useNavigate()

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
    setErrorMessage('')

    try {
      const { data: existingEstab } = await supabase
        .from('estabelecimentos')
        .select('id')
        .eq('email_dono', email)
        .maybeSingle()

      if (existingEstab) {
        setErrorMessage('Este e‑mail já está cadastrado no sistema. Por favor, use outro e‑mail.')
        setLoading(false)
        return
      }

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

      if (authError) throw authError
      if (!authData.user) throw new Error('Falha ao criar usuário. Tente novamente.')

      const userId = authData.user.id

      if (authData.session) {
        const session: UserSession = {
          id: userId,
          membro_id: null,
          nome: email,
          estabelecimento_id: '',
          role: 'super_admin',
        }
        onLogin(session)
        navigate('/super-admin')
      } else {
        setRegistrationSuccess(true)
      }
    } catch (err: any) {
      console.error('Erro ao cadastrar admin:', err)

      const getFriendlyMessage = (error: any): string => {
        if (error?.message) {
          const msg = error.message.toString().toLowerCase()
          if (msg.includes('já existe')) {
            return 'Já existe um administrador principal. Faça login ou peça convite para outro admin.'
          }
          if (msg.includes('already') || msg.includes('cadastrado')) {
            return 'Já existe uma conta com este e‑mail. Faça login ou recupere sua senha.'
          }
          if (msg.includes('invalid email')) {
            return 'Por favor, insira um e‑mail válido.'
          }
          if (msg.includes('rate limit')) {
            return 'Muitas tentativas seguidas. Aguarde alguns minutos.'
          }
        }
        return error?.message?.toString() || 'Erro ao criar conta. Tente novamente.'
      }

      setErrorMessage(getFriendlyMessage(err))
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
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Confirme seu e-mail</h1>
            <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
              Enviamos um link de confirmação para:
            </p>
            <p className="text-emerald-400 font-bold break-all bg-emerald-500/5 py-2 px-3 rounded-lg border border-emerald-500/10 text-sm md:text-base">
              {email}
            </p>
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

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 md:p-6 text-white relative">
      <div className="glass-card w-full max-w-md p-6 md:p-8 border-white/5 space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg border border-emerald-500/10">
            <Mail size={32} />
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter">
            Configuração <span className="text-emerald-500">Inicial</span>
          </h1>
          <p className="text-slate-400 text-xs md:text-sm">
            Crie o administrador principal do sistema.
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4 md:space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase px-1 tracking-wider">E-mail</label>
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
            <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase px-1 tracking-wider">Senha</label>
            <div className="relative">
              <input
                required
                type={showSenha ? 'text' : 'password'}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 pr-11 md:p-4 md:pr-11 text-sm md:text-base text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                placeholder="mínimo 6 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowSenha(!showSenha)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors cursor-pointer"
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
                placeholder="repita a senha"
              />
              <button
                type="button"
                onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors cursor-pointer"
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

          <button
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-bold py-3.5 md:py-4 px-4 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all text-sm md:text-base flex justify-center items-center"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : 'Criar Acesso Principal'}
          </button>
        </form>
      </div>
    </div>
  )
}


