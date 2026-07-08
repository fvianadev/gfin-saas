import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Mail, Eye, EyeOff } from 'lucide-react'
import type { UserSession } from '../../types/auth'

export function RegisterPage({ onLogin }: { onLogin: (session: UserSession) => void }) {
  const [empresa, setEmpresa] = useState('')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [registrationSuccess, setRegistrationSuccess] = useState(false)
  const navigate = useNavigate()

  const [errorMessage, setErrorMessage] = useState('');

  const validateForm = () => {
    if (empresa.trim().length < 3) {
      setErrorMessage('Nome do estabelecimento deve ter ao menos 3 caracteres.');
      return false;
    }
    // Permitir letras (incluindo acentos e cedilha), números, espaços, hifens e underlines
    if (!/^[A-Za-z0-9À-ÖØ-öø-ÿ\s_-]+$/.test(empresa)) {
      setErrorMessage('Nome do estabelecimento contém caracteres inválidos.');
      return false;
    }
    if (!email.includes('@')) {
      setErrorMessage('Informe um e‑mail válido.');
      return false;
    }
    if (senha.length < 6) {
      setErrorMessage('A senha deve ter no mínimo 6 caracteres.');
      return false;
    }
    setErrorMessage('');
    return true;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      // 1. Converter acentos e caracteres especiais para gerar um slug limpo (ex: "Salão Viana" -> "salao-viana")
      const slug = empresa
        .normalize('NFD') // Decompõe caracteres acentuados (ex: ã -> a + ~)
        .replace(/[\u0300-\u036f]/g, '') // Remove os acentos
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-') // Substitui espaços por hifens
        .replace(/[^\w-]/g, '') // Remove caracteres que não sejam letras, números ou hifens
        .replace(/-+/g, '-'); // Evita múltiplos hifens seguidos

      // Verificar se o slug gerado é válido/não ficou vazio
      if (!slug || slug.length < 3) {
        setErrorMessage('O nome do estabelecimento gerou um slug inválido. Tente outro nome.');
        setLoading(false);
        return;
      }

      // 2. Verificar se o slug já existe na tabela de estabelecimentos
      const { data: existingEstab, error: checkError } = await supabase
        .from('estabelecimentos')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (checkError) {
        console.error('Erro ao verificar slug:', checkError);
      }

      if (existingEstab) {
        setErrorMessage('Este nome de estabelecimento já está em uso (slug duplicado). Por favor, escolha outro nome.');
        setLoading(false);
        return;
      }

      // ---- Email validation (basic) ----
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setErrorMessage('Por favor, insira um e‑mail válido.');
        setLoading(false);
        return;
      }

      // 3. Criar usuário no Supabase Auth
      // OBS: signUp SEMPRE retorna authData.user com um ID, mesmo quando e-mail
      // de confirmação está habilitado e authData.session ainda é null.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (authError) {
        const lowerAuthMsg = authError.message?.toLowerCase() || '';
        if (lowerAuthMsg.includes('already') || lowerAuthMsg.includes('cadastrado')) {
          setErrorMessage('Já existe uma conta com este e‑mail. Faça login ou recupere sua senha.');
          setLoading(false);
          return;
        }
        if (lowerAuthMsg.includes('confirmation') || lowerAuthMsg.includes('smtp') || lowerAuthMsg.includes('failed to send')) {
          setErrorMessage('Erro ao enviar e‑mail de confirmação. Verifique as configurações de Auth (SMTP) no painel do Supabase ou desative a confirmação de e‑mail para testes.');
          setLoading(false);
          return;
        }
        setErrorMessage(authError.message);
        setLoading(false);
        return;
      }
      if (!authData.user) throw new Error('Falha ao criar usuário. Tente novamente.');

      // userId está disponível independentemente de o e-mail já estar confirmado
      const userId = authData.user.id;

      // 4. Buscar trial dias (fallback 7)
      let trialDias = 7;
      try {
        const { data: configData } = await supabase.from('saas_configuracoes').select('trial_dias').limit(1).maybeSingle();
        if (configData && configData.trial_dias) trialDias = configData.trial_dias;
      } catch (e) {
        console.warn('Erro ao buscar config trial, usando 7 dias', e);
      }

      // 5. Criar estabelecimento (já disponível mesmo antes da confirmação de e-mail)
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
        .single();

      if (estabError) {
        if (estabError.code === '23505') {
          throw new Error('Este nome de estabelecimento já está em uso. Por favor, escolha outro nome.');
        }
        throw estabError;
      }

      // 6. Criar membro administrador
      const { data: membroData, error: membroError } = await supabase
        .from('membros_equipe')
        .insert({
          estabelecimento_id: estabData.id,
          nome: nome || empresa.split(' ')[0],
          pin_hash: '0000',
          cargo: 'administrador',
        })
        .select()
        .single();
      if (membroError) throw membroError;

      // 7. Se o Supabase criou sessão imediata (confirmação desativada),
      //    faz autologin direto. Caso contrário, exibe tela "confirme seu e-mail".
      if (authData.session) {
        const session: UserSession = {
          id: userId,
          membro_id: membroData?.id ?? null,
          nome: nome || empresa,
          estabelecimento_id: estabData.id,
          estabelecimento_slug: estabData.slug,
          role: 'administrador',
        };
        onLogin(session);
        alert(`✅ Bem‑vindo ao GFin, ${nome}!\n\nSeu PIN inicial é: 0000`);
        navigate('/admin');
      } else {
        // Estabelecimento já criado! Usuário só precisa confirmar o e-mail e fazer login.
        setRegistrationSuccess(true);
      }
      } catch (err) {
        console.error('Register error:', err);
        // Helper to map Supabase/PostgREST errors to user-friendly messages
        const getFriendlyMessage = (error: any): string => {
          // Auth errors
          if (error?.message) {
            const msg = error.message.toString().toLowerCase();
            if (msg.includes('already') || msg.includes('cadastrado')) {
              return 'Já existe uma conta com este e‑mail. Faça login ou recupere sua senha.';
            }
            if (msg.includes('invalid email') || msg.includes('must be a valid')) {
              return 'Por favor, insira um e‑mail válido.';
            }
            if (msg.includes('rate limit') || msg.includes('limit exceeded')) {
              return 'Muitas tentativas de cadastro seguidas. Aguarde alguns minutos antes de tentar novamente.';
            }

          }
          // PostgREST errors (from table inserts)
          if (error?.code) {
            switch (error.code) {
              case '23505': // unique violation
                if (error.message?.includes('slug')) {
                  return `O slug escolhido já está em uso. Tente outro nome para o estabelecimento.`;
                }
                return 'Já existe um estabelecimento com este e‑mail ou nome. Por favor, verifique os dados.';
              case '23503': // foreign key violation
                return 'Este e‑mail já está cadastrado no sistema (ou o usuário correspondente é um administrador). Por favor, use outro e‑mail ou faça login.';
              default:
                break;
            }
          }
          // Fallback generic message
          return error?.message?.toString() || 'Erro ao criar conta. Por favor, tente novamente.';
        };
        const friendlyMsg = getFriendlyMessage(err);
        setErrorMessage(friendlyMsg);
      } finally {
        setLoading(false);
      }
  };

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
    <div className="min-h-dvh bg-slate-950 flex flex-col items-center justify-center sm:justify-start sm:pt-8 p-4 md:p-6 text-white relative animate-in fade-in duration-500">
      {/* Botão de voltar */}
      <div className="absolute top-4 left-4 md:top-8 md:left-8">
        <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium bg-slate-900/50 p-2 md:px-4 md:py-2 rounded-lg border border-white/5 backdrop-blur-sm">
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Voltar para Home</span>
        </Link>
      </div>

      <div className="glass-card w-full max-w-md p-5 md:p-5 border-white/5 space-y-5 sm:space-y-4 shadow-2xl">
        <div className="text-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-emerald-500/20">
            <Mail size={20} className="sm:w-6 sm:h-6" />
          </div>
          <h1 className="text-lg sm:text-xl font-black tracking-tight">Criar Conta</h1>
          <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 uppercase tracking-widest font-bold">Gestão financeira para seu negócio</p>
        </div>
        
        <form onSubmit={handleRegister} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase px-1 tracking-wider">Nome do Estabelecimento</label>
            <input 
              required 
              value={empresa} 
              onChange={e => setEmpresa(e.target.value)} 
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 md:p-3 text-sm md:text-base text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" 
              placeholder="Ex: Barbearia Viana" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase px-1 tracking-wider">Seu Nome</label>
            <input 
              required 
              value={nome} 
              onChange={e => setNome(e.target.value)} 
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 md:p-3 text-sm md:text-base text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" 
              placeholder="Ex: Lucas Sousa" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase px-1 tracking-wider">Seu Melhor E-mail</label>
            <input 
              required 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 md:p-3 text-sm md:text-base text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" 
              placeholder="seu@email.com" 
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] md:text-xs font-bold text-slate-400 uppercase px-1 tracking-wider">Senha de Acesso</label>
            <div className="relative">
              <input 
                required 
                type={showSenha ? 'text' : 'password'} 
                value={senha} 
                onChange={e => setSenha(e.target.value)} 
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-2.5 pr-11 md:p-3 md:pr-11 text-sm md:text-base text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all" 
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
          
          <button disabled={loading} className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-bold py-2.5 md:py-3 px-4 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all text-sm md:text-base flex justify-center items-center">
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : 'Criar Conta'}
          </button>

          {errorMessage && (
            <div className="bg-red-600/20 border border-red-600 text-red-200 rounded-md p-2.5 mb-2 text-xs md:text-sm">
              {errorMessage}
            </div>
          )}

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
