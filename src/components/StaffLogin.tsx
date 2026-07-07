import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { User, Lock, X } from 'lucide-react'

export function StaffLogin() {
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
    const validatePin = async () => {
      if (pin.length === 4 && selectedMembro) {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('membros_equipe')
            .select('*')
            .eq('id', selectedMembro.id)
            .eq('pin_hash', pin)
            .single();

          setLoading(false);
          if (error || !data) {
            alert('PIN inválido');
            setPin('');
          } else {
            sessionStorage.setItem('gfin_staff', JSON.stringify({ ...data, role: data.cargo || 'usuario', slug }));
            navigate(`/${slug}/dashboard`);
          }
        } catch (e) {
          console.error('Erro ao validar PIN:', e);
          setLoading(false);
          alert('Erro ao validar PIN. Tente novamente.');
          setPin('');
        }
      }
    };
    validatePin();
  }, [pin, selectedMembro, slug, navigate])

  if (!estab) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500 font-bold">Carregando...</div>

  const filteredMembros = membros.filter(m => m.nome.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col items-center justify-center sm:justify-start sm:pt-6 p-6 text-white">
      <div className="w-full max-w-sm space-y-6 sm:space-y-4">
        <div className="text-center">
          {estab.configuracoes?.logo_url && (
            <img 
              src={estab.configuracoes.logo_url} 
              alt="Logo" 
              className="w-24 h-24 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-2 rounded-2xl object-cover shadow-lg border border-white/10" 
            />
          )}
          <h1 className="text-3xl sm:text-2xl font-black mb-1 tracking-tighter">{estab.nome}</h1>
          <div className="flex items-center justify-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
            <Lock size={10} className="text-emerald-500" /> Acesso Seguro
          </div>
        </div>
        <div className="space-y-4 sm:space-y-3">
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
                className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 sm:p-3 pl-12 sm:pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" 
              />
              <User className="absolute left-4 sm:left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
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
                    {m.avatar_url
                        ? <img src={m.avatar_url} alt={m.nome} className="w-8 h-8 rounded-full object-cover" />
                        : <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs text-emerald-500">{m.nome.charAt(0)}</div>
                      }
                    {m.nome}
                  </button>
                )) : (
                  <div className="p-4 text-center text-xs text-slate-500 font-bold">Nenhum membro encontrado.</div>
                )}
              </div>
            )}
          </div>

          <div className={`space-y-4 sm:space-y-3 transition-all duration-500 ${selectedMembro ? 'opacity-100' : 'opacity-30 pointer-events-none grayscale'}`}>
            <div className="text-center">
               <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{selectedMembro ? 'Digite seu PIN' : 'Selecione um perfil primeiro'}</p>
            </div>
            <div className="flex justify-center gap-4">
              {[0,1,2,3].map(i => (
                <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${pin.length > i ? 'bg-emerald-500 border-emerald-500 scale-125' : 'border-slate-800'}`} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 w-full max-w-[280px] sm:max-w-[240px] mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0, '', '<'].map((b, idx) => (
                <button 
                  key={idx} 
                  disabled={loading || b === '' || !selectedMembro} 
                  onClick={() => b === '<' ? setPin(p => p.slice(0, -1)) : b !== '' && pin.length < 4 && setPin(p => p + b)} 
                  className={`h-14 sm:h-11 glass-card rounded-2xl sm:rounded-xl text-2xl sm:text-lg font-bold active:scale-90 transition-all ${b === '' ? 'opacity-0 pointer-events-none border-none' : 'hover:bg-white/5 border-white/5 shadow-md'}`}
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
