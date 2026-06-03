import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Mail } from 'lucide-react'
import type { UserSession } from '../../types/auth'

export function RegisterPage({ onLogin }: { onLogin: (session: UserSession) => void }) {
  const [empresa, setEmpresa] = useState('')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [registrationSuccess, setRegistrationSuccess] = useState(false)
  const navigate = useNavigate()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const slug = empresa.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]/g, '')

      if (slug.length < 3) throw new Error('Nome do estabelecimento muito curto (mínimo 3 caracteres).')

      // 1. Criar usuário no Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password: senha })
      if (authError) throw authError
      if (!authData.user) throw new Error('Falha ao criar usuário. Tente novamente.')

      const userId = authData.user.id

      // 2. Buscar configurações do SAAS para pegar o número de dias do trial
      let trialDias = 7
      try {
        const { data: configData } = await supabase.from('saas_configuracoes').select('trial_dias').limit(1).maybeSingle()
        if (configData && configData.trial_dias) {
          trialDias = configData.trial_dias
        }
      } catch (e) {
        console.warn('Erro ao buscar saas_configuracoes, usando fallback de 7 dias', e)
      }

      // 3. Criar estabelecimento (política anon permite INSERT durante onboarding)
      const { data: estabData, error: estabError } = await supabase
        .from('estabelecimentos')
        .insert({
          nome: empresa,
          slug,
          email_dono: email,
          owner_id: userId,
          trial_start: new Date().toISOString().split('T')[0],
          trial_end: new Date(Date.now() + trialDias * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          trial_active: true,
        })
        .select()
        .single()

      if (estabError) {
        if (estabError.code === '23505') throw new Error(`O slug "${slug}" já está em uso. Escolha outro nome.`)
        throw estabError
      }

      // 3. Criar membro administrador inicial com PIN padrão 0000
      const { data: membroData, error: membroError } = await supabase
        .from('membros_equipe')
        .insert({
          estabelecimento_id: estabData.id,
          nome: nome || empresa.split(' ')[0],
          pin_hash: '0000',
          cargo: 'administrador'
        })
        .select()
        .single()

      if (membroError) throw membroError

      // 4. Montar sessão local se estiver autenticado (autologin), senão exigir confirmação
      if (authData.session) {
        const session: UserSession = {
          id: userId,
          membro_id: membroData?.id || null,
          nome: nome || empresa,
          estabelecimento_id: estabData.id,
          estabelecimento_slug: estabData.slug,
          role: 'administrador'
        }
        onLogin(session)
        alert(`✅ Bem-vindo ao GFin, ${nome}!\n\nSeu PIN inicial é: 0000\nAcesse: /${estabData.slug}/login`)
        navigate('/admin')
      } else {
        setRegistrationSuccess(true)
      }
    } catch (err: any) {
      alert('Erro ao criar conta: ' + err.message)
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
            <p>2. Se não receber em até 5 minutos, verifique sua pasta de **Spam** ou **Lixo Eletrônico**.</p>
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
      {/* Botão de voltar */}
      <div className="absolute top-4 left-4 md:top-8 md:left-8">
        <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium bg-slate-900/50 p-2 md:px-4 md:py-2 rounded-lg border border-white/5 backdrop-blur-sm">
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Voltar para Home</span>
        </Link>
      </div>

      <div className="glass-card w-full max-w-md p-6 md:p-8 border-white/5 space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-12 md:mt-0">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-black mb-2 tracking-tighter">GFin <span className="text-emerald-500">SaaS</span></h1>
          <p className="text-slate-400 text-xs md:text-sm">Gestão financeira para sua barbearia ou salão.</p>
        </div>
        
        <form onSubmit={handleRegister} className="space-y-4 md:space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase px-1 tracking-wider">Nome do Estabelecimento</label>
            <input 
              required 
              value={empresa} 
              onChange={e => setEmpresa(e.target.value)} 
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 md:p-4 text-sm md:text-base text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" 
              placeholder="Ex: Barbearia Viana" 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase px-1 tracking-wider">Seu Nome</label>
            <input 
              required 
              value={nome} 
              onChange={e => setNome(e.target.value)} 
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-3.5 md:p-4 text-sm md:text-base text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" 
              placeholder="Ex: Lucas Sousa" 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase px-1 tracking-wider">Seu Melhor E-mail</label>
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
            <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase px-1 tracking-wider">Senha de Acesso</label>
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
              ) : 'Criar minha Barbearia'}
            </button>
          </div>
        </form>

        <div className="text-center pt-2 border-t border-white/5">
          <Link to="/login" className="text-slate-400 hover:text-white text-sm transition-colors group flex items-center justify-center gap-1 mt-4">
            Já possui conta? <span className="text-emerald-500 font-bold group-hover:underline">Fazer Login</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
