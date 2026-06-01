-- =======================================================
-- INITIAL CONSOLIDATED SCHEMA DUMP (GFIN SAAS)
-- Generated on 2026-06-01 - Dependency Resolved Version
-- =======================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- PHASE 1: TABLE CREATIONS
-- ==========================================

-- 1. TABELA DE ESTABELECIMENTOS (TENANTS)
CREATE TABLE IF NOT EXISTS public.estabelecimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    nome TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL, 
    email_dono TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plano TEXT DEFAULT 'gratis' CHECK (plano IN ('gratis', 'pro', 'premium')),
    status_assinatura TEXT DEFAULT 'trial' CHECK (status_assinatura IN ('ativo', 'inativo', 'pendente', 'trial')),
    configuracoes JSONB DEFAULT '{}'::jsonb,
    trial_start DATE,
    trial_end DATE,
    trial_active BOOLEAN DEFAULT true,
    dias_inadimplencia INTEGER DEFAULT 0,
    data_ultimo_pagamento DATE,
    data_proxima_cobranca DATE,
    CONSTRAINT slug_min_length CHECK (char_length(slug) >= 3)
);

-- 2. TABELA DE MEMBROS DA EQUIPE (STAFF)
CREATE TABLE IF NOT EXISTS public.membros_equipe (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    estabelecimento_id UUID REFERENCES public.estabelecimentos(id) ON DELETE CASCADE NOT NULL,
    nome TEXT NOT NULL,
    pin_hash TEXT NOT NULL, 
    cargo TEXT DEFAULT 'usuario' CHECK (cargo IN ('administrador', 'usuario')),
    whatsapp TEXT,
    ativo BOOLEAN DEFAULT true,
    percentual_comissao NUMERIC DEFAULT 0,
    CONSTRAINT unique_staff_per_establishment UNIQUE (estabelecimento_id, nome),
    CONSTRAINT unique_pin_per_establishment UNIQUE (estabelecimento_id, pin_hash),
    CONSTRAINT pin_format CHECK (pin_hash ~ '^[0-9]{4}$')
);

-- 3. TABELA DE TRANSAÇÕES (FINANCEIRO)
CREATE TABLE IF NOT EXISTS public.transacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    estabelecimento_id UUID REFERENCES public.estabelecimentos(id) ON DELETE CASCADE NOT NULL,
    membro_id UUID REFERENCES public.membros_equipe(id) ON DELETE CASCADE NOT NULL,
    tipo TEXT CHECK (tipo IN ('receita', 'despesa')) NOT NULL,
    valor DECIMAL(12,2) NOT NULL DEFAULT 0,
    descricao TEXT NOT NULL,
    categoria TEXT DEFAULT 'Geral',
    data_competencia DATE DEFAULT CURRENT_DATE,
    excluido BOOLEAN DEFAULT false,
    excluido_em TIMESTAMP WITH TIME ZONE,
    excluido_por UUID REFERENCES public.membros_equipe(id),
    motivo_exclusao TEXT,
    alterado_por UUID REFERENCES public.membros_equipe(id),
    motivo_alteracao TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 4. TABELA DE AUDITORIA DE EDIÇÕES
CREATE TABLE IF NOT EXISTS public.auditoria_transacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    transacao_id UUID REFERENCES public.transacoes(id) ON DELETE CASCADE NOT NULL,
    membro_id UUID REFERENCES public.membros_equipe(id) NOT NULL,
    acao TEXT NOT NULL, -- 'edicao' ou 'exclusao'
    dados_anteriores JSONB,
    dados_novos JSONB,
    motivo TEXT,
    estabelecimento_id UUID REFERENCES public.estabelecimentos(id) ON DELETE CASCADE
);

-- 5. TABELA DE SERVIÇOS E PRODUTOS (CATÁLOGO)
CREATE TABLE IF NOT EXISTS public.servicos_produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estabelecimento_id UUID REFERENCES public.estabelecimentos(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    preco_sugerido DECIMAL(10,2),
    tipo TEXT CHECK (tipo IN ('receita', 'despesa')) DEFAULT 'receita',
    categoria TEXT DEFAULT 'Geral',
    duracao_minutos INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(estabelecimento_id, nome, tipo)
);

-- 6. TABELA DE HORÁRIOS DE FUNCIONAMENTO
CREATE TABLE IF NOT EXISTS public.horarios_funcionamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estabelecimento_id UUID REFERENCES public.estabelecimentos(id) ON DELETE CASCADE NOT NULL,
    dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    hora_inicio TIME NOT NULL DEFAULT '08:00',
    hora_fim TIME NOT NULL DEFAULT '18:00',
    ativo BOOLEAN DEFAULT true,
    UNIQUE(estabelecimento_id, dia_semana)
);

-- 7. TABELA DE AGENDAMENTOS
CREATE TABLE IF NOT EXISTS public.agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    estabelecimento_id UUID REFERENCES public.estabelecimentos(id) ON DELETE CASCADE NOT NULL,
    membro_id UUID REFERENCES public.membros_equipe(id) ON DELETE CASCADE,
    servico_id UUID REFERENCES public.servicos_produtos(id) ON DELETE CASCADE,
    cliente_nome TEXT NOT NULL,
    cliente_whatsapp TEXT NOT NULL,
    data_hora_inicio TIMESTAMPTZ NOT NULL,
    data_hora_fim TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'concluido', 'cancelado')),
    observacao TEXT
);

-- 8. TABELA DE SUPER ADMINS DO SAAS
CREATE TABLE IF NOT EXISTS public.saas_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. TABELA DE CONFIGURAÇÕES GLOBAIS DO SAAS (SINGLETON)
CREATE TABLE IF NOT EXISTS public.saas_configuracoes (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    saas_nome TEXT DEFAULT 'GFin SaaS'::text,
    titulo_hero TEXT,
    subtitulo_hero TEXT,
    email_contato TEXT,
    whatsapp_contato TEXT,
    instagram_url TEXT,
    trial_dias INTEGER DEFAULT 14,
    grace_period_dias INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. TABELA DE PAGAMENTOS E FATURAMENTO DO SAAS
CREATE TABLE IF NOT EXISTS public.saas_pagamentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    estabelecimento_id UUID NOT NULL REFERENCES public.estabelecimentos(id) ON DELETE CASCADE,
    valor NUMERIC(10,2) NOT NULL,
    referencia TEXT NOT NULL, -- ex: "Maio/2026", "Junho/2026"
    metodo_pagamento TEXT DEFAULT 'manual' CHECK (metodo_pagamento IN ('manual', 'pix', 'dinheiro', 'cartao')),
    status TEXT DEFAULT 'pago' CHECK (status IN ('pago', 'pendente', 'cancelado')),
    observacoes TEXT,
    pago_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- PHASE 2: SECURITY (RLS & POLICIES)
-- ==========================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.estabelecimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros_equipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicos_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_funcionamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_pagamentos ENABLE ROW LEVEL SECURITY;

-- 1. Políticas para estabelecimentos
DROP POLICY IF EXISTS "Dono gerencia seu estabelecimento" ON public.estabelecimentos;
CREATE POLICY "Dono gerencia seu estabelecimento" ON public.estabelecimentos
    FOR ALL TO authenticated
    USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()))
    WITH CHECK (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Onboarding cria estabelecimento" ON public.estabelecimentos;
CREATE POLICY "Onboarding cria estabelecimento" ON public.estabelecimentos
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Publico vê info básica estabelecimentos" ON public.estabelecimentos;
CREATE POLICY "Publico vê info básica estabelecimentos" ON public.estabelecimentos
    FOR SELECT TO anon, authenticated
    USING (true);

-- 2. Políticas para membros_equipe
DROP POLICY IF EXISTS "Dono gerencia sua equipe" ON public.membros_equipe;
CREATE POLICY "Dono gerencia sua equipe" ON public.membros_equipe
    FOR ALL TO authenticated
    USING (estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()))
    WITH CHECK (estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Equipe vê membros para login" ON public.membros_equipe;
CREATE POLICY "Equipe vê membros para login" ON public.membros_equipe
    FOR SELECT TO anon, authenticated
    USING (ativo = true);

DROP POLICY IF EXISTS "Onboarding cria membro admin" ON public.membros_equipe;
CREATE POLICY "Onboarding cria membro admin" ON public.membros_equipe
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Staff gerencia equipe" ON public.membros_equipe;
CREATE POLICY "Staff gerencia equipe" ON public.membros_equipe
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 3. Políticas para transacoes
DROP POLICY IF EXISTS "Dono vê seu financeiro" ON public.transacoes;
CREATE POLICY "Dono vê seu financeiro" ON public.transacoes
    FOR ALL TO authenticated
    USING (estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()))
    WITH CHECK (estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Staff gerencia financeiro" ON public.transacoes;
CREATE POLICY "Staff gerencia financeiro" ON public.transacoes
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Staff insere transacoes" ON public.transacoes;
CREATE POLICY "Staff insere transacoes" ON public.transacoes
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- 4. Políticas para auditoria_transacoes
DROP POLICY IF EXISTS "Dono vê apenas auditoria do seu estabelecimento" ON public.auditoria_transacoes;
CREATE POLICY "Dono vê apenas auditoria do seu estabelecimento" ON public.auditoria_transacoes
    FOR ALL USING (estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Membros podem inserir auditoria" ON public.auditoria_transacoes;
CREATE POLICY "Membros podem inserir auditoria" ON public.auditoria_transacoes
    FOR INSERT WITH CHECK (estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE id = estabelecimento_id));

-- 5. Políticas para servicos_produtos
DROP POLICY IF EXISTS "Dono gerencia seu catalogo" ON public.servicos_produtos;
CREATE POLICY "Dono gerencia seu catalogo" ON public.servicos_produtos
    FOR ALL TO authenticated
    USING (estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()))
    WITH CHECK (estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Staff gerencia catalogo" ON public.servicos_produtos;
CREATE POLICY "Staff gerencia catalogo" ON public.servicos_produtos
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 6. Políticas para horarios_funcionamento
DROP POLICY IF EXISTS "Publico vê horarios" ON public.horarios_funcionamento;
CREATE POLICY "Publico vê horarios" ON public.horarios_funcionamento
    FOR SELECT TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Staff gerencia horarios" ON public.horarios_funcionamento;
CREATE POLICY "Staff gerencia horarios" ON public.horarios_funcionamento
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 7. Políticas para agendamentos
DROP POLICY IF EXISTS "Dono gerencia sua agenda" ON public.agendamentos;
CREATE POLICY "Dono gerencia sua agenda" ON public.agendamentos
    FOR ALL TO authenticated
    USING (estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()))
    WITH CHECK (estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Publico pode agendar" ON public.agendamentos;
CREATE POLICY "Publico pode agendar" ON public.agendamentos
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Publico vê agendamentos para disponibilidade" ON public.agendamentos;
CREATE POLICY "Publico vê agendamentos para disponibilidade" ON public.agendamentos
    FOR SELECT TO anon, authenticated
    USING (true);

-- 8. Políticas para saas_admins
DROP POLICY IF EXISTS "Leitura permitida para autenticados" ON public.saas_admins;
CREATE POLICY "Leitura permitida para autenticados" ON public.saas_admins
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins gerenciam a si mesmos (Insert/Update/Delete)" ON public.saas_admins;
CREATE POLICY "Admins gerenciam a si mesmos (Insert/Update/Delete)" ON public.saas_admins
    FOR ALL TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- 9. Políticas para saas_configuracoes
DROP POLICY IF EXISTS "Publico le configuracoes saas" ON public.saas_configuracoes;
CREATE POLICY "Publico le configuracoes saas" ON public.saas_configuracoes
    FOR SELECT TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "saas_admins_all_configuracoes" ON public.saas_configuracoes;
CREATE POLICY "saas_admins_all_configuracoes" ON public.saas_configuracoes
    FOR ALL USING (EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()));

DROP POLICY IF EXISTS "authenticated_read_configuracoes" ON public.saas_configuracoes;
CREATE POLICY "authenticated_read_configuracoes" ON public.saas_configuracoes
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- 10. Políticas para saas_pagamentos
DROP POLICY IF EXISTS "saas_admins_all_pagamentos" ON public.saas_pagamentos;
CREATE POLICY "saas_admins_all_pagamentos" ON public.saas_pagamentos
    FOR ALL USING (EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()));

-- ==========================================
-- PHASE 3: GRANTS & PERMISSIONS
-- ==========================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role, authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated, anon;

-- ==========================================
-- PHASE 4: FUNCTIONS & TRIGGERS
-- ==========================================

-- Função que insere os horários padrão para um novo estabelecimento
CREATE OR REPLACE FUNCTION public.initialize_opening_hours()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.horarios_funcionamento (estabelecimento_id, dia_semana, hora_inicio, hora_fim, ativo)
  VALUES 
    (NEW.id, 0, '08:00', '18:00', false), -- Domingo
    (NEW.id, 1, '08:00', '18:00', true),  -- Segunda
    (NEW.id, 2, '08:00', '18:00', true),  -- Terça
    (NEW.id, 3, '08:00', '18:00', true),  -- Quarta
    (NEW.id, 4, '08:00', '18:00', true),  -- Quinta
    (NEW.id, 5, '08:00', '18:00', true),  -- Sexta
    (NEW.id, 6, '08:00', '18:00', true);  -- Sábado
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gatilho que dispara automaticamente após a criação de um estabelecimento
DROP TRIGGER IF EXISTS on_establishment_created ON public.estabelecimentos;
CREATE TRIGGER on_establishment_created
  AFTER INSERT ON public.estabelecimentos
  FOR EACH ROW EXECUTE FUNCTION public.initialize_opening_hours();

-- Garantir que todos os estabelecimentos já existentes tenham todos os horários criados
INSERT INTO public.horarios_funcionamento (estabelecimento_id, dia_semana, hora_inicio, hora_fim, ativo)
SELECT e.id, d.dia, '08:00', '18:00', (d.dia != 0)
FROM public.estabelecimentos e
CROSS JOIN (SELECT unnest(ARRAY[0,1,2,3,4,5,6]) as dia) d
LEFT JOIN public.horarios_funcionamento h ON h.estabelecimento_id = e.id AND h.dia_semana = d.dia
WHERE h.id IS NULL;

-- ==========================================
-- PHASE 5: INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_trans_excluido ON public.transacoes(estabelecimento_id, excluido);
CREATE INDEX IF NOT EXISTS idx_audit_trans ON public.auditoria_transacoes(transacao_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON public.agendamentos(data_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_agendamentos_estabelecimento ON public.agendamentos(estabelecimento_id);
CREATE INDEX IF NOT EXISTS idx_saas_pagamentos_estab ON public.saas_pagamentos(estabelecimento_id);
CREATE INDEX IF NOT EXISTS idx_saas_pagamentos_status ON public.saas_pagamentos(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_configuracoes_singleton ON public.saas_configuracoes ((TRUE));

-- ==========================================
-- PHASE 6: DEFAULT SEED DATA
-- ==========================================

INSERT INTO public.saas_configuracoes (id, whatsapp_contato, email_contato, trial_dias, grace_period_dias, saas_nome)
SELECT 1, '5511999999999', 'suporte@gfin.com.br', 14, 5, 'GFin SaaS'
WHERE NOT EXISTS (SELECT 1 FROM public.saas_configuracoes);
