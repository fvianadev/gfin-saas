import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let redirected = false;

    const redirect = (path: string) => {
      if (redirected) return;
      redirected = true;
      if (timeoutId) clearTimeout(timeoutId);
      navigate(path);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        redirect('/login');
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        redirect('/login');
      }
    });

    timeoutId = setTimeout(() => {
      if (!redirected) {
        subscription.unsubscribe();
        setError('O link de confirmação expirou ou já foi utilizado.');
      }
    }, 15000);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white flex-col gap-4 text-center px-4">
        <div className="rounded-full h-12 w-12 bg-red-500/20 flex items-center justify-center">
          <span className="text-red-400 text-2xl">!</span>
        </div>
        <p className="text-lg font-medium text-red-400">Falha na confirmação</p>
        <p className="text-slate-400 text-sm max-w-md">{error}</p>
        <Link
          to="/login"
          className="mt-4 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-medium transition-colors"
        >
          Ir para o Login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-white flex-col gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-2 border-white border-t-transparent" />
      <p className="text-lg font-medium">Confirmando seu e-mail…</p>
      <p className="text-slate-500 text-sm">Você será redirecionado em instantes</p>
    </div>
  );
}
