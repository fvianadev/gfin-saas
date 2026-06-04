import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/**
 * AuthCallback – destino do link de confirmação de e-mail enviado pelo Supabase.
 *
 * O estabelecimento já foi criado no momento do registro (RegisterPage).
 * Aqui só precisamos confirmar a sessão e redirecionar o usuário para o login.
 */
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // O Supabase lê o token_hash da URL e dispara SIGNED_IN automaticamente.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Sessão criada após confirmação – vai direto para o login
        // (o LoginPage fará o lookup do estabelecimento normalmente)
        navigate('/login');
      }
    });

    // Caso a sessão já exista ao abrir o callback (ex: clicou no link 2x)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-white flex-col gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-2 border-white border-t-transparent" />
      <p className="text-lg font-medium">Confirmando seu e-mail…</p>
      <p className="text-slate-500 text-sm">Você será redirecionado em instantes</p>
    </div>
  );
}
