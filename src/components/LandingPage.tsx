import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CheckCircle2, Scissors, CalendarCheck, TrendingUp, Users, Shield, ArrowRight, Mail, Phone, Instagram, Star, Clock, ChevronLeft, ChevronRight } from 'lucide-react'

interface SaasConfig {
  titulo_hero: string
  subtitulo_hero: string
  email_contato: string
  whatsapp_contato: string
  instagram_url: string
}

const DEFAULT_CONFIG: SaasConfig = {
  titulo_hero: 'Gerencie seu salão e seus agendamentos num só lugar',
  subtitulo_hero: 'Sistema SaaS para gestão financeira e marcação de horários para barbearias, salões de beleza, cabeleireiros e negócios similares.',
  email_contato: '',
  whatsapp_contato: '',
  instagram_url: '',
}

function SkeletonText({ className }: { className?: string }) {
  return <div className={`bg-slate-800 rounded-lg animate-pulse ${className}`} />
}

export function LandingPage() {
  const [config, setConfig] = useState<SaasConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('saas_configuracoes')
      .select('titulo_hero,subtitulo_hero,email_contato,whatsapp_contato,instagram_url')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setConfig({
            titulo_hero: data.titulo_hero || DEFAULT_CONFIG.titulo_hero,
            subtitulo_hero: data.subtitulo_hero || DEFAULT_CONFIG.subtitulo_hero,
            email_contato: data.email_contato || '',
            whatsapp_contato: data.whatsapp_contato || '',
            instagram_url: data.instagram_url || '',
          })
        }
        setLoading(false)
      })
  }, [])

  const [marketplace, setMarketplace] = useState<any[]>([])
  const [marketplaceLoading, setMarketplaceLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('marketplace_destaques')
      .select(`
        id, imagem_url, premium, ordem, dados,
        estabelecimento:estabelecimentos!inner (nome, slug, configuracoes)
      `)
      .eq('ativo', true)
      .order('ordem', { ascending: true, nullsFirst: true })
      .then(({ data }) => {
        const parsed = (data || []).map((item: any) => ({
          ...item,
          dados: typeof item.dados === 'string' ? JSON.parse(item.dados) : (item.dados || {}),
        }))
        console.log('Marketplace data:', parsed)
        setMarketplace(parsed)
        setMarketplaceLoading(false)
      })
  }, [])

  const whatsappLink = config.whatsapp_contato
    ? `https://wa.me/${config.whatsapp_contato.replace(/\D/g, '')}`
    : null

  const scrollMarketplace = (dir: 'left' | 'right') => {
    const el = document.getElementById('marketplace-scroll')
    if (el) {
      const scrollAmount = 340
      el.scrollBy({ left: dir === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' })
    }
  }

  const getFallbackImage = (destaque: any) => {
    if (destaque.imagem_url) return destaque.imagem_url
    const logoUrl = destaque.estabelecimento?.configuracoes?.logo_url
    if (logoUrl) return logoUrl
    return null
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-emerald-500/30">
      
      {/* HEADER / NAVBAR */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Scissors size={20} className="text-white" />
            </div>
            <span className="text-xl md:text-2xl font-black tracking-tighter">GFin <span className="text-emerald-500">SaaS</span></span>
          </div>
          <div className="flex items-center gap-3 md:gap-6">
            <Link to="/login" className="text-sm md:text-base font-medium text-slate-300 hover:text-white transition-colors hidden sm:block">
              Entrar
            </Link>
            <Link to="/register" className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs md:text-sm font-bold py-2 md:py-2.5 px-4 md:px-5 rounded-lg shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
              Testar Grátis
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-24 md:pt-32 pb-16">

        {/* MARKETPLACE */}
        <section className="py-8 md:py-12 bg-slate-900/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-end mb-6 md:mb-8 gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">Assinantes Pro</h2>
                <p className="text-slate-400 text-xs md:text-sm">Experiências de alto nível, potencializadas pela gfin.</p>
              </div>
              {marketplace.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => scrollMarketplace('left')}
                    className="p-2.5 border border-white/10 rounded-full hover:bg-white/5 transition-colors text-slate-400 hover:text-white"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={() => scrollMarketplace('right')}
                    className="p-2.5 border border-white/10 rounded-full hover:bg-white/5 transition-colors text-slate-400 hover:text-white"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </div>

            {marketplaceLoading ? (
              <div className="flex gap-6 overflow-hidden">
                {[1, 2, 3].map(i => (
                  <div key={i} className="min-w-[75vw] sm:min-w-[280px] bg-slate-900 border border-white/5 rounded-xl overflow-hidden animate-pulse flex-shrink-0">
                    <div className="h-36 sm:h-52 bg-slate-800" />
                    <div className="p-6 space-y-3">
                      <div className="h-6 bg-slate-800 rounded w-3/4" />
                      <div className="h-4 bg-slate-800 rounded w-1/2" />
                      <div className="flex gap-2">
                        <div className="h-6 bg-slate-800 rounded w-16" />
                        <div className="h-6 bg-slate-800 rounded w-16" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : marketplace.length === 0 ? null : (
              <div
                id="marketplace-scroll"
                className="flex gap-6 overflow-x-auto hide-scrollbar pb-4"
              >
                  {marketplace.map(item => {
                  const img = getFallbackImage(item)
                  return (
                    <Link
                      key={item.id}
                      to={`/${item.estabelecimento.slug}/agendar`}
                      className="min-w-[75vw] sm:min-w-[280px] sm:max-w-[320px] bg-slate-900 border border-white/5 rounded-xl overflow-hidden flex-shrink-0 hover:border-emerald-500/30 hover:shadow-[0_4px_30px_rgba(0,0,0,0.3)] hover:-translate-y-1 transition-all duration-300 group block"
                    >
                      <div className="h-36 sm:h-52 w-full relative overflow-hidden">
                        {img ? (
                          <img
                            alt={item.estabelecimento.nome}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            src={img}
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                            <span className="text-4xl font-black text-slate-700">
                              {item.estabelecimento.nome.charAt(0)}
                            </span>
                          </div>
                        )}
                        {item.premium && (
                          <div className="absolute top-4 left-4 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
                            Premium
                          </div>
                        )}
                      </div>
                      <div className="p-4 sm:p-6">
                        <div className="flex justify-between items-start mb-2 sm:mb-3">
                          <h3 className="text-base sm:text-lg font-bold text-white">{item.estabelecimento.nome}</h3>
                          <div className="flex items-center gap-1 text-emerald-400">
                            <Star size={14} className="fill-current" />
                            <span className="text-xs font-bold">{item.dados?.rating ?? 5}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 text-slate-500 mb-3 sm:mb-4">
                          <Clock size={14} />
                          <span className="text-xs sm:text-sm">{item.dados?.horario || 'Horário não informado'}</span>
                        </div>
                        {Array.isArray(item.dados?.tags) && item.dados.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {item.dados.tags.map((tag: string) => (
                              <span
                                key={tag}
                                className="px-2 sm:px-3 py-0.5 sm:py-1 bg-slate-800 text-slate-300 text-[10px] sm:text-[11px] font-bold rounded-md uppercase tracking-wide"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* HERO SECTION */}
        <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 md:pt-14 pb-14 md:pb-24 text-center">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-emerald-500/20 blur-[120px] rounded-full pointer-events-none" />
          
          {loading ? (
            <div className="space-y-4 mb-8 relative z-10">
              <SkeletonText className="h-12 md:h-16 w-3/4 mx-auto" />
              <SkeletonText className="h-12 md:h-16 w-1/2 mx-auto" />
              <SkeletonText className="h-6 w-2/3 mx-auto mt-6" />
            </div>
          ) : (
            <>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-6 md:mb-8 relative z-10">
                {config.titulo_hero.split(' ').map((word, i, arr) => {
                  // Últimas 3 palavras em destaque
                  const isHighlight = i >= arr.length - 3
                  return isHighlight
                    ? <span key={i} className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">{word} </span>
                    : <span key={i}>{word} </span>
                })}
              </h1>
              <p className="text-base md:text-xl text-slate-400 max-w-2xl mx-auto mb-8 md:mb-12 leading-relaxed relative z-10 px-2">
                {config.subtitulo_hero}
              </p>
            </>
          )}
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            <Link to="/register" className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-4 px-8 rounded-xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all text-lg flex items-center justify-center gap-2">
              Comece agora <ArrowRight size={20} />
            </Link>
          </div>
        </section>

        {/* SOBRE O SISTEMA */}
        <section className="py-12 md:py-16 bg-slate-900/50 border-y border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 md:mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Tudo que seu negócio precisa</h2>
              <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto">Uma plataforma completa desenvolvida especificamente para as necessidades do mercado da beleza.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {[
                { icon: <TrendingUp size={24}/>, title: 'Controle Financeiro', desc: 'Gestão completa de receitas, despesas e comissões da equipe.' },
                { icon: <CalendarCheck size={24}/>, title: 'Agendamentos Online', desc: 'Link exclusivo para seus clientes marcarem horários 24h por dia.' },
                { icon: <Users size={24}/>, title: 'Organização de Clientes', desc: 'Histórico, WhatsApp e preferências de cada cliente salvos.' },
                { icon: <Shield size={24}/>, title: 'Segurança Total', desc: 'Controle de acesso por PIN. Sua equipe só vê o que deve ver.' },
                { icon: <Scissors size={24}/>, title: 'Gestão de Serviços', desc: 'Catálogo flexível de serviços e produtos com durações customizadas.' },
                { icon: <CheckCircle2 size={24}/>, title: 'Gestão Centralizada', desc: 'O seu negócio inteiro na palma da sua mão, acessível de qualquer lugar.' },
              ].map((feature, i) => (
                <div key={i} className="bg-slate-900 border border-white/5 p-6 md:p-8 rounded-2xl hover:border-emerald-500/50 transition-colors group">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg md:text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-slate-400 text-sm md:text-base leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section className="py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 md:mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Como Funciona</h2>
              <p className="text-slate-400 text-sm md:text-base">Três passos simples para modernizar seu atendimento.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 relative">
              <div className="hidden md:block absolute top-1/2 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent -translate-y-1/2 z-0" />
              
              {[
                { step: '1', title: 'Crie sua conta', desc: 'Cadastro rápido em menos de 2 minutos. Teste grátis liberado na hora.' },
                { step: '2', title: 'Configure seu negócio', desc: 'Adicione seus serviços, equipe e horários de funcionamento.' },
                { step: '3', title: 'Receba agendamentos', desc: 'Compartilhe seu link e deixe os clientes marcarem sozinhos.' }
              ].map((item, i) => (
                <div key={i} className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-slate-900 border-4 border-slate-950 rounded-full flex items-center justify-center text-2xl font-black text-emerald-500 mb-6 shadow-xl">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-slate-400 text-sm md:text-base px-4">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BENEFÍCIOS */}
        <section className="py-12 md:py-16 bg-emerald-950/20 border-y border-emerald-500/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">Por que escolher o GFin?</h2>
                <ul className="space-y-4 md:space-y-6">
                  {[
                    'Organize melhor seu negócio',
                    'Reduza falhas e furos de marcação',
                    'Centralize todas as informações',
                    'Automatize processos financeiros',
                    'Economize tempo no dia a dia'
                  ].map((benefit, i) => (
                    <li key={i} className="flex items-center gap-4 text-base md:text-lg">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                        <CheckCircle2 size={16} />
                      </div>
                      <span className="text-slate-200">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-transparent rounded-3xl blur-2xl" />
                <div className="bg-slate-900 border border-white/10 p-6 md:p-8 rounded-3xl relative z-10 shadow-2xl">
                  <h3 className="text-xl font-bold mb-6 pb-4 border-b border-white/5">Para quem é o sistema?</h3>
                  <div className="flex flex-wrap gap-3">
                    {['Barbearias', 'Salões de Beleza', 'Cabeleireiros', 'Estúdios de Estética', 'Manicures', 'Negócios baseados em horário'].map((tag, i) => (
                      <span key={i} className="bg-slate-800 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium border border-white/5">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="py-16 md:py-24 text-center px-4">
          <h2 className="text-4xl md:text-5xl font-black mb-6">Pronto para evoluir?</h2>
          <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">Junte-se a dezenas de profissionais que já modernizaram a gestão de seus salões.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register" className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-4 px-10 rounded-xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all text-lg">
              Comece gratuitamente hoje
            </Link>
            {whatsappLink && (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
                className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 px-10 rounded-xl border border-white/5 active:scale-95 transition-all text-lg flex items-center justify-center gap-2">
                <Phone size={18} /> Falar no WhatsApp
              </a>
            )}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-950 border-t border-white/5 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 mb-12">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <Scissors size={16} className="text-white" />
                </div>
                <span className="text-xl font-black">GFin</span>
              </div>
              <p className="text-slate-400 text-sm max-w-xs mb-4">
                A plataforma definitiva para gestão de barbearias e salões de beleza.
              </p>
              {/* Contatos dinâmicos */}
              <div className="flex flex-col gap-2">
                {config.email_contato && (
                  <a href={`mailto:${config.email_contato}`} className="flex items-center gap-2 text-slate-500 hover:text-emerald-400 text-sm transition-colors">
                    <Mail size={14} /> {config.email_contato}
                  </a>
                )}
                {whatsappLink && (
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-slate-500 hover:text-emerald-400 text-sm transition-colors">
                    <Phone size={14} /> WhatsApp
                  </a>
                )}
                {config.instagram_url && (
                  <a href={config.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-slate-500 hover:text-emerald-400 text-sm transition-colors">
                    <Instagram size={14} /> Instagram
                  </a>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Produto</h4>
              <ul className="space-y-3">
                <li><Link to="/register" className="text-slate-400 hover:text-emerald-400 text-sm transition-colors">Criar Conta</Link></li>
                <li><Link to="/login" className="text-slate-400 hover:text-emerald-400 text-sm transition-colors">Fazer Login</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Informações</h4>
              <ul className="space-y-3 text-slate-400 text-sm">
                <li>Sistema SaaS Seguro</li>
                <li>Hospedado na Nuvem</li>
                <li>Mobile First UX</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 text-center text-slate-500 text-xs flex flex-col md:flex-row justify-between items-center gap-4">
            <p>© 2026 GFin SaaS. Todos os direitos reservados.</p>
            <p>Desenvolvido para profissionais da beleza.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
