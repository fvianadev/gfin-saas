import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Lock, ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react'

export function ResetPasswordPage() {
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()

    if (senha.length < 6) {
      alert('A senha deve ter no mínimo 6 caracteres.')
      return
    }

    if (senha !== confirmarSenha) {
      alert('As senhas não coincidem.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (error) throw error
      setSuccess(true)
    } catch (err: any) {
      alert('Erro ao atualizar a senha: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 md:p-6 text-white relative">
      {/* Botão de voltar */}
      <div className="absolute top-4 left-4 md:top-8 md:left-8">
        <Link to="/login" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium bg-slate-900/50 p-2 md:px-4 md:py-2 rounded-lg border border-white/5 backdrop-blur-sm">
          <ArrowLeft size={16} />
          <span>Voltar para Login</span>
        </Link>
      </div>

      <div className="glass-card w-full max-w-md p-6 md:p-8 border-white/5 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-2xl">
        {success ? (
          <div className="text-center space-y-6 animate-in scale-in duration-300">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-emerald-500/5 border border-emerald-500/10">
              <CheckCircle size={32} />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black tracking-tight">Senha Atualizada! 🎉</h1>
              <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
                Sua senha foi redefinida com sucesso. Agora você já pode acessar o sistema utilizando sua nova credencial.
              </p>
            </div>
            <button 
              onClick={() => navigate('/login')}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all text-sm md:text-base text-center"
            >
              Ir para Tela de Login
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/5 border border-emerald-500/10">
                <Lock size={28} className="md:w-8 md:h-8" />
              </div>
              <h1 className="text-2xl font-black tracking-tight">Nova Senha</h1>
              <p className="text-slate-400 text-xs md:text-sm mt-2">
                Defina sua nova senha de acesso abaixo.
              </p>
            </div>

            <form onSubmit={handleReset} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase px-1 tracking-wider">Nova Senha</label>
                <div className="relative">
                  <input 
                    required 
                    type={showSenha ? 'text' : 'password'} 
                    value={senha} 
                    onChange={e => setSenha(e.target.value)} 
                    className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 pr-11 md:p-4 md:pr-11 text-sm md:text-base text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" 
                    placeholder="•••••••• (mínimo 6 caracteres)"
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
                <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase px-1 tracking-wider">Confirmar Nova Senha</label>
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
              
              <div className="pt-2">
                <button 
                  disabled={loading} 
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-bold py-3.5 md:py-4 px-4 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all text-sm md:text-base flex justify-center items-center"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : 'Atualizar Minha Senha'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
