import fs from 'fs'

const file = 'd:/VIANA-DEV/gfin/src/components/AdminDashboard.tsx'
let src = fs.readFileSync(file, 'utf8')

// ── 1. Imports: add Settings, Copy, Link2, CheckCircle ───────────────────────
src = src.replace(
  `import { ArrowLeft, TrendingUp, TrendingDown, Calendar, Filter, ArrowUpRight, ArrowDownLeft, Trash2, Edit2, Plus, Users, DollarSign, LayoutDashboard, MoreVertical, PieChart, List } from 'lucide-react'`,
  `import { ArrowLeft, TrendingUp, TrendingDown, Calendar, Filter, ArrowUpRight, ArrowDownLeft, Trash2, Edit2, Plus, Users, DollarSign, LayoutDashboard, MoreVertical, PieChart, List, Settings, Copy, Link2, CheckCircle } from 'lucide-react'`
)

// ── 2. Tab type: add 'config' ─────────────────────────────────────────────────
src = src.replace(
  `type Tab = 'resumo' | 'transacoes' | 'equipe'`,
  `type Tab = 'resumo' | 'transacoes' | 'equipe' | 'config'`
)

// ── 3. State: add estabelecimento + config state after novoMembro block ────────
src = src.replace(
  `  const [isModalOpen, setIsModalOpen] = useState(false)`,
  `  const [estab, setEstab] = useState<any>(null)
  const [configForm, setConfigForm] = useState({ nome: '', logo_url: '' })
  const [configSaving, setConfigSaving] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)
  const [urlCopied, setUrlCopied] = useState(false)

  const fetchEstab = async () => {
    const { data } = await supabase.from('estabelecimentos').select('*').eq('id', estabelecimentoId).single()
    if (data) {
      setEstab(data)
      setConfigForm({ nome: data.nome, logo_url: data.configuracoes?.logo_url ?? '' })
    }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setConfigSaving(true)
    const { error } = await supabase.from('estabelecimentos').update({
      nome: configForm.nome.trim(),
      configuracoes: { ...(estab?.configuracoes ?? {}), logo_url: configForm.logo_url.trim() }
    }).eq('id', estabelecimentoId)
    setConfigSaving(false)
    if (!error) { setConfigSaved(true); fetchEstab(); setTimeout(() => setConfigSaved(false), 2500) }
    else alert('Erro ao salvar: ' + error.message)
  }

  const copyUrl = () => {
    const url = \`\${window.location.origin}/\${estab?.slug}/login\`
    navigator.clipboard.writeText(url)
    setUrlCopied(true)
    setTimeout(() => setUrlCopied(false), 2000)
  }

  const [isModalOpen, setIsModalOpen] = useState(false)`
)

// ── 4. Fetch estab on mount ───────────────────────────────────────────────────
src = src.replace(
  `  useEffect(() => {
    fetchAdminData()
    fetchMembros()
  }, [periodo, activeTab])`,
  `  useEffect(() => {
    fetchAdminData()
    fetchMembros()
    fetchEstab()
  }, [periodo, activeTab])`
)

// ── 5. Sidebar nav: add Configurações button ──────────────────────────────────
src = src.replace(
  `          <button onClick={() => setActiveTab('equipe')} className={\`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all \${activeTab === 'equipe' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}\`}><Users size={18} /> Equipe</button>`,
  `          <button onClick={() => setActiveTab('equipe')} className={\`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all \${activeTab === 'equipe' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}\`}><Users size={18} /> Equipe</button>
          <button onClick={() => setActiveTab('config')} className={\`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all \${activeTab === 'config' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}\`}><Settings size={18} /> Configurações</button>`
)

// ── 6. Mobile nav: add Configurações button ───────────────────────────────────
src = src.replace(
  `        <button onClick={() => setActiveTab('equipe')} className={\`flex flex-col items-center gap-1 transition-all \${activeTab === 'equipe' ? 'text-emerald-500' : 'text-slate-500'}\`}>
           <Users size={24} />
           <span className="text-[10px] font-bold uppercase">Equipe</span>
         </button>`,
  `        <button onClick={() => setActiveTab('equipe')} className={\`flex flex-col items-center gap-1 transition-all \${activeTab === 'equipe' ? 'text-emerald-500' : 'text-slate-500'}\`}>
           <Users size={24} />
           <span className="text-[10px] font-bold uppercase">Equipe</span>
         </button>
        <button onClick={() => setActiveTab('config')} className={\`flex flex-col items-center gap-1 transition-all \${activeTab === 'config' ? 'text-emerald-500' : 'text-slate-500'}\`}>
           <Settings size={24} />
           <span className="text-[10px] font-bold uppercase">Config</span>
         </button>`
)

// ── 7. Config tab panel: inject before </main> ────────────────────────────────
src = src.replace(
  `      </main>`,
  `
        {activeTab === 'config' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300 max-w-xl">
            <h2 className="font-black text-lg uppercase tracking-widest text-slate-400">Configurações do Estabelecimento</h2>

            {/* URL Card */}
            <div className="glass-card p-6 border-emerald-500/20 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-1">
                <Link2 size={14} /> URL do Staff
              </div>
              <div className="flex items-center gap-3 bg-slate-900 border border-white/5 rounded-xl px-4 py-3">
                <p className="text-sm text-slate-300 font-mono flex-1 break-all">
                  {window.location.origin}/{estab?.slug}/login
                </p>
                <button
                  onClick={copyUrl}
                  className={\`p-2 rounded-lg transition-all \${urlCopied ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 hover:text-white hover:bg-white/5'}\`}
                >
                  {urlCopied ? <CheckCircle size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <p className="text-[10px] text-slate-600 px-1">Compartilhe essa URL com seus funcionários para que eles façam login via PIN.</p>
            </div>

            {/* Config Form */}
            <form onSubmit={handleSaveConfig} className="glass-card p-6 border-white/5 space-y-4">
              <h3 className="font-bold text-base mb-1">Dados da Empresa</h3>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase px-1">Nome da Empresa</label>
                <input
                  required
                  className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  value={configForm.nome}
                  onChange={e => setConfigForm(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome da empresa"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase px-1">URL da Logo</label>
                <input
                  className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  value={configForm.logo_url}
                  onChange={e => setConfigForm(prev => ({ ...prev, logo_url: e.target.value }))}
                  placeholder="https://... (link da imagem)"
                />
              </div>

              {configForm.logo_url && (
                <div className="flex items-center gap-4 bg-slate-900 rounded-xl p-4 border border-white/5">
                  <img src={configForm.logo_url} alt="Logo preview" className="w-14 h-14 rounded-xl object-cover border border-white/10" onError={e => (e.currentTarget.style.display = 'none')} />
                  <p className="text-xs text-slate-400">Preview da logo</p>
                </div>
              )}

              <button
                type="submit"
                disabled={configSaving}
                className={\`w-full py-4 rounded-xl font-bold shadow-lg active:scale-95 transition-all disabled:opacity-50 \${configSaved ? 'bg-teal-500 shadow-teal-500/20' : 'bg-emerald-500 shadow-emerald-500/20'}\`}
              >
                {configSaved ? '✓ Salvo!' : configSaving ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </form>
          </div>
        )}
      </main>`
)

fs.writeFileSync(file, src, 'utf8')
console.log('Done.')
