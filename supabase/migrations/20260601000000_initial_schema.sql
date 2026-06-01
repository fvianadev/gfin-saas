-- =======================================================
-- INITIAL CONSOLIDATED SCHEMA DUMP (FROM GIT)
-- Generated on 2026-06-01T20:35:24.476Z
-- Consolidating 10 migration files
-- =======================================================

-- -------------------------------------------------------
-- Source Migration: 20240506_initial_schema.sql
-- -------------------------------------------------------

-- ==========================================
-- ESTRUTURA PROFISSIONAL GFIN SAAS (PRODUÇÃO V2 - AUDITORIA)
-- ==========================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABELA DE ESTABELECIMENTOS (TENANTS)
CREATE TABLE IF NOT EXISTS estabelecimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    nome TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL, 
    email_dono TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plano TEXT DEFAULT 'gratis' CHECK (plano IN ('gratis', 'pro', 'premium')),
    status_assinatura TEXT DEFAULT 'ativo' CHECK (status_assinatura IN ('ativo', 'inativo', 'pendente')),
    configuracoes JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT slug_min_length CHECK (char_length(slug) >= 3)
);

-- 2. TABELA DE MEMBROS DA EQUIPE (STAFF)
CREATE TABLE IF NOT EXISTS membros_equipe (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    estabelecimento_id UUID REFERENCES estabelecimentos(id) ON DELETE CASCADE NOT NULL,
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

-- 3. TABELA DE TRANSAÇÕES (FINANCEIRO) com Soft Delete
CREATE TABLE IF NOT EXISTS transacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    estabelecimento_id UUID REFERENCES estabelecimentos(id) ON DELETE CASCADE NOT NULL,
    membro_id UUID REFERENCES membros_equipe(id) ON DELETE CASCADE NOT NULL,
    tipo TEXT CHECK (tipo IN ('receita', 'despesa')) NOT NULL,
    valor DECIMAL(12,2) NOT NULL DEFAULT 0,
    descricao TEXT NOT NULL,
    categoria TEXT DEFAULT 'Geral',
    data_competencia DATE DEFAULT CURRENT_DATE,
    excluido BOOLEAN DEFAULT false,
    excluido_em TIMESTAMP WITH TIME ZONE,
    excluido_por UUID REFERENCES membros_equipe(id),
    motivo_exclusao TEXT,
    alterado_por UUID REFERENCES membros_equipe(id),
    motivo_alteracao TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 4. TABELA DE AUDITORIA DE EDIÇÕES
CREATE TABLE IF NOT EXISTS auditoria_transacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    transacao_id UUID REFERENCES transacoes(id) ON DELETE CASCADE NOT NULL,
    membro_id UUID REFERENCES membros_equipe(id) NOT NULL,
    acao TEXT NOT NULL, -- 'edicao' ou 'exclusao'
    dados_anteriores JSONB,
    dados_novos JSONB,
    motivo TEXT
);

-- 5. TABELA DE SERVIÇOS E PRODUTOS (CATÁLOGO)
CREATE TABLE IF NOT EXISTS servicos_produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estabelecimento_id UUID REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    preco_sugerido DECIMAL(10,2),
    tipo TEXT CHECK (tipo IN ('receita', 'despesa')) DEFAULT 'receita',
    categoria TEXT DEFAULT 'Geral',
    duracao_minutos INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(estabelecimento_id, nome, tipo)
);

-- 6. TABELA DE HORÁRIOS DE FUNCIONAMENTO
CREATE TABLE IF NOT EXISTS horarios_funcionamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estabelecimento_id UUID REFERENCES estabelecimentos(id) ON DELETE CASCADE NOT NULL,
    dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    hora_inicio TIME NOT NULL DEFAULT '08:00',
    hora_fim TIME NOT NULL DEFAULT '18:00',
    ativo BOOLEAN DEFAULT true,
    UNIQUE(estabelecimento_id, dia_semana)
);

-- 7. TABELA DE AGENDAMENTOS
CREATE TABLE IF NOT EXISTS agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    estabelecimento_id UUID REFERENCES estabelecimentos(id) ON DELETE CASCADE NOT NULL,
    membro_id UUID REFERENCES membros_equipe(id) ON DELETE CASCADE,
    servico_id UUID REFERENCES servicos_produtos(id) ON DELETE CASCADE,
    cliente_nome TEXT NOT NULL,
    cliente_whatsapp TEXT NOT NULL,
    data_hora_inicio TIMESTAMPTZ NOT NULL,
    data_hora_fim TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'concluido', 'cancelado')),
    observacao TEXT
);

-- ==========================================
-- SEGURANÇA (RLS)
-- ==========================================
ALTER TABLE estabelecimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE membros_equipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_funcionamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
DROP POLICY IF EXISTS "Acesso total estabelecimentos" ON estabelecimentos;
CREATE POLICY "Acesso total estabelecimentos" ON estabelecimentos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total membros" ON membros_equipe;
CREATE POLICY "Acesso total membros" ON membros_equipe FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total transacoes" ON transacoes;
CREATE POLICY "Acesso total transacoes" ON transacoes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total auditoria" ON auditoria_transacoes;
CREATE POLICY "Acesso total auditoria" ON auditoria_transacoes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total itens" ON servicos_produtos;
CREATE POLICY "Acesso total itens" ON servicos_produtos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso total horarios" ON horarios_funcionamento;
CREATE POLICY "Acesso total horarios" ON horarios_funcionamento FOR ALL USING (true) WITH CHECK (true);

-- Políticas Específicas para Agendamento Público
DROP POLICY IF EXISTS "Publico vê horarios" ON horarios_funcionamento;
CREATE POLICY "Publico vê horarios" ON horarios_funcionamento FOR SELECT USING (true);

DROP POLICY IF EXISTS "Publico pode agendar" ON agendamentos;
CREATE POLICY "Publico pode agendar" ON agendamentos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Estabelecimento vê seus agendamentos" ON agendamentos;
CREATE POLICY "Estabelecimento vê seus agendamentos" ON agendamentos FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- PERMISSÕES (GRANTS)
-- ==========================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role, authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated, anon;

-- ==========================================
-- ÍNDICES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_trans_excluido ON transacoes(estabelecimento_id, excluido);
CREATE INDEX IF NOT EXISTS idx_audit_trans ON auditoria_transacoes(transacao_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data_hora_inicio);


-- -------------------------------------------------------
-- Source Migration: 20240513_add_scheduling_module.sql
-- -------------------------------------------------------

-- ==========================================
-- GFIN SAAS - MIGRATION v1.1.0 (MODULO AGENDAMENTOS)
-- Data: 2024-05-13
-- ==========================================

-- 1. Atualizar Tabela de Itens (Serviços)
ALTER TABLE servicos_produtos ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'Geral';
ALTER TABLE servicos_produtos ADD COLUMN IF NOT EXISTS duracao_minutos INTEGER DEFAULT 30;

-- 2. Tabela de Horários de Funcionamento
CREATE TABLE IF NOT EXISTS horarios_funcionamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estabelecimento_id UUID REFERENCES estabelecimentos(id) ON DELETE CASCADE NOT NULL,
    dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    hora_inicio TIME NOT NULL DEFAULT '08:00',
    hora_fim TIME NOT NULL DEFAULT '18:00',
    ativo BOOLEAN DEFAULT true,
    UNIQUE(estabelecimento_id, dia_semana)
);

-- 3. Tabela de Agendamentos
CREATE TABLE IF NOT EXISTS agendamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    estabelecimento_id UUID REFERENCES estabelecimentos(id) ON DELETE CASCADE NOT NULL,
    membro_id UUID REFERENCES membros_equipe(id) ON DELETE CASCADE,
    servico_id UUID REFERENCES servicos_produtos(id) ON DELETE CASCADE,
    cliente_nome TEXT NOT NULL,
    cliente_whatsapp TEXT NOT NULL,
    data_hora_inicio TIMESTAMPTZ NOT NULL,
    data_hora_fim TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'concluido', 'cancelado')),
    observacao TEXT
);

-- 4. Segurança (RLS)
ALTER TABLE horarios_funcionamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Publico vê horarios" ON horarios_funcionamento;
CREATE POLICY "Publico vê horarios" ON horarios_funcionamento FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Publico pode agendar" ON agendamentos;
CREATE POLICY "Publico pode agendar" ON agendamentos FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Estabelecimento vê seus agendamentos" ON agendamentos;
CREATE POLICY "Estabelecimento vê seus agendamentos" ON agendamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Permissões de Tabela (Grants)
GRANT ALL ON TABLE agendamentos TO postgres, service_role;
GRANT INSERT, SELECT ON TABLE agendamentos TO anon, authenticated;
      
GRANT ALL ON TABLE horarios_funcionamento TO postgres, service_role;
GRANT SELECT ON TABLE horarios_funcionamento TO anon, authenticated;
GRANT ALL ON TABLE horarios_funcionamento TO authenticated;

-- 6. Índices para Performance
CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos(data_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_agendamentos_estabelecimento ON agendamentos(estabelecimento_id);


-- -------------------------------------------------------
-- Source Migration: 20240513_fix_staff_rls.sql
-- -------------------------------------------------------

-- Restore access for Staff Dashboard (anon users)
-- These policies are necessary because the app uses PIN login (anon) for daily operations.

-- 1. Catalog (servicos_produtos)
DROP POLICY IF EXISTS "Staff gerencia catalogo" ON servicos_produtos;
CREATE POLICY "Staff gerencia catalogo" ON servicos_produtos
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 2. Transactions (transacoes)
-- Allow staff to select, update and delete (hardening only allowed insert)
DROP POLICY IF EXISTS "Staff gerencia financeiro" ON transacoes;
CREATE POLICY "Staff gerencia financeiro" ON transacoes
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 3. Team Members (membros_equipe)
-- Allow admins logged via PIN to manage the team
DROP POLICY IF EXISTS "Staff gerencia equipe" ON membros_equipe;
CREATE POLICY "Staff gerencia equipe" ON membros_equipe
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 4. Opening Hours (horarios_funcionamento)
DROP POLICY IF EXISTS "Staff gerencia horarios" ON horarios_funcionamento;
CREATE POLICY "Staff gerencia horarios" ON horarios_funcionamento
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);


-- -------------------------------------------------------
-- Source Migration: 20240513_initialize_opening_hours.sql
-- -------------------------------------------------------

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

-- Garantir que o estabelecimento atual também tenha todos os dias (caso falte algum)
INSERT INTO public.horarios_funcionamento (estabelecimento_id, dia_semana, hora_inicio, hora_fim, ativo)
SELECT e.id, d.dia, '08:00', '18:00', (d.dia != 0)
FROM public.estabelecimentos e
CROSS JOIN (SELECT unnest(ARRAY[0,1,2,3,4,5,6]) as dia) d
LEFT JOIN public.horarios_funcionamento h ON h.estabelecimento_id = e.id AND h.dia_semana = d.dia
WHERE h.id IS NULL;


-- -------------------------------------------------------
-- Source Migration: 20240513_security_hardening.sql
-- -------------------------------------------------------

-- ==========================================
-- GFIN SAAS - SECURITY HARDENING (RLS & ISOLATION)
-- Data: 2024-05-13
-- Objetivo: Garantir que um estabelecimento nunca acesse dados de outro.
-- ==========================================

-- 1. Habilitar RLS em todas as tabelas (caso não esteja)
ALTER TABLE estabelecimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE membros_equipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_funcionamento ENABLE ROW LEVEL SECURITY;

-- 2. Limpar políticas genéricas existentes para evitar conflitos
DROP POLICY IF EXISTS "Acesso total estabelecimentos" ON estabelecimentos;
DROP POLICY IF EXISTS "Acesso total membros" ON membros_equipe;
DROP POLICY IF EXISTS "Acesso total transacoes" ON transacoes;
DROP POLICY IF EXISTS "Acesso total itens" ON servicos_produtos;
DROP POLICY IF EXISTS "Acesso total horarios" ON horarios_funcionamento;
DROP POLICY IF EXISTS "Estabelecimento vê seus agendamentos" ON agendamentos;

-- ==========================================
-- POLÍTICAS PARA DONOS (USUÁRIOS AUTENTICADOS)
-- ==========================================

-- Estabelecimentos: O dono só vê e edita o dele
CREATE POLICY "Dono gerencia seu estabelecimento" ON estabelecimentos
FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Membros: O dono gerencia apenas sua equipe
CREATE POLICY "Dono gerencia sua equipe" ON membros_equipe
FOR ALL TO authenticated
USING (estabelecimento_id IN (SELECT id FROM estabelecimentos WHERE owner_id = auth.uid()))
WITH CHECK (estabelecimento_id IN (SELECT id FROM estabelecimentos WHERE owner_id = auth.uid()));

-- Transações: O dono vê apenas seu financeiro
CREATE POLICY "Dono vê seu financeiro" ON transacoes
FOR ALL TO authenticated
USING (estabelecimento_id IN (SELECT id FROM estabelecimentos WHERE owner_id = auth.uid()))
WITH CHECK (estabelecimento_id IN (SELECT id FROM estabelecimentos WHERE owner_id = auth.uid()));

-- Itens/Serviços: O dono gerencia seu catálogo
CREATE POLICY "Dono gerencia seu catalogo" ON servicos_produtos
FOR ALL TO authenticated
USING (estabelecimento_id IN (SELECT id FROM estabelecimentos WHERE owner_id = auth.uid()))
WITH CHECK (estabelecimento_id IN (SELECT id FROM estabelecimentos WHERE owner_id = auth.uid()));

-- Agendamentos: O dono gerencia sua agenda
CREATE POLICY "Dono gerencia sua agenda" ON agendamentos
FOR ALL TO authenticated
USING (estabelecimento_id IN (SELECT id FROM estabelecimentos WHERE owner_id = auth.uid()))
WITH CHECK (estabelecimento_id IN (SELECT id FROM estabelecimentos WHERE owner_id = auth.uid()));

-- ==========================================
-- POLÍTICAS PARA ACESSO PÚBLICO / STAFF (ANON)
-- ==========================================

-- Estabelecimentos: Necessário para o PublicBooking e Login identificar o slug
DROP POLICY IF EXISTS "Publico vê info básica estabelecimentos" ON estabelecimentos;
CREATE POLICY "Publico vê info básica estabelecimentos" ON estabelecimentos
FOR SELECT TO anon, authenticated
USING (true);

-- Membros: Necessário para o login por PIN (vê apenas nomes e IDs, mas permite conferir o PIN no WHERE)
DROP POLICY IF EXISTS "Equipe vê membros para login" ON membros_equipe;
CREATE POLICY "Equipe vê membros para login" ON membros_equipe
FOR SELECT TO anon, authenticated
USING (ativo = true);

-- Agendamentos: Público pode inserir (agendar) e ver (checar disponibilidade)
DROP POLICY IF EXISTS "Publico pode agendar" ON agendamentos;
CREATE POLICY "Publico pode agendar" ON agendamentos
FOR INSERT TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Publico vê agendamentos para disponibilidade" ON agendamentos;
CREATE POLICY "Publico vê agendamentos para disponibilidade" ON agendamentos
FOR SELECT TO anon, authenticated
USING (true);

-- Transações: Permitir que o Staff (anon) insira transações ao finalizar agendamento
DROP POLICY IF EXISTS "Staff insere transacoes" ON transacoes;
CREATE POLICY "Staff insere transacoes" ON transacoes
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- Horários: Público vê para agendar
DROP POLICY IF EXISTS "Publico vê horarios" ON horarios_funcionamento;
CREATE POLICY "Publico vê horarios" ON horarios_funcionamento
FOR SELECT TO anon, authenticated
USING (true);


-- -------------------------------------------------------
-- Source Migration: 20260525_saas_admin_rls.sql
-- -------------------------------------------------------

-- ==========================================
-- GFIN SAAS - SUPER ADMIN RLS BYPASS
-- Data: 2026-05-25
-- Objetivo: Configurar RLS nas tabelas saas_admins/saas_configuracoes e
-- liberar acesso irrestrito para Super Admins em todas as tabelas de tenants.
-- ==========================================

-- 1. Habilitar RLS para saas_admins e saas_configuracoes
ALTER TABLE IF EXISTS public.saas_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saas_configuracoes ENABLE ROW LEVEL SECURITY;

-- 2. Políticas para saas_admins
DROP POLICY IF EXISTS "Admins gerenciam a si mesmos" ON public.saas_admins;
CREATE POLICY "Admins gerenciam a si mesmos" ON public.saas_admins
FOR ALL TO authenticated
USING (id = auth.uid() OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()))
WITH CHECK (id = auth.uid() OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()));

-- 3. Políticas para saas_configuracoes
-- Qualquer um (incluindo usuários anônimos na Landing Page) pode ler as configurações
DROP POLICY IF EXISTS "Publico le configuracoes saas" ON public.saas_configuracoes;
CREATE POLICY "Publico le configuracoes saas" ON public.saas_configuracoes
FOR SELECT TO anon, authenticated
USING (true);

-- Apenas Super Admins cadastrados na tabela saas_admins podem alterar as configurações
DROP POLICY IF EXISTS "Super Admin gerencia configuracoes saas" ON public.saas_configuracoes;
CREATE POLICY "Super Admin gerencia configuracoes saas" ON public.saas_configuracoes
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()));


-- 4. ATUALIZAR POLÍTICAS RLS DAS TABELAS EXISTENTES PARA PERMITIR BYPASS DE SUPER ADMIN

-- estabelecimentos: Dono gerencia seu estabelecimento OR usuário é Super Admin
DROP POLICY IF EXISTS "Dono gerencia seu estabelecimento" ON public.estabelecimentos;
CREATE POLICY "Dono gerencia seu estabelecimento" ON public.estabelecimentos
FOR ALL TO authenticated
USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()))
WITH CHECK (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()));

-- membros_equipe: Dono gerencia sua equipe OR usuário é Super Admin
DROP POLICY IF EXISTS "Dono gerencia sua equipe" ON public.membros_equipe;
CREATE POLICY "Dono gerencia sua equipe" ON public.membros_equipe
FOR ALL TO authenticated
USING (
    estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid())
)
WITH CHECK (
    estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid())
);

-- transacoes: Dono gerencia seu financeiro OR usuário é Super Admin
DROP POLICY IF EXISTS "Dono vê seu financeiro" ON public.transacoes;
CREATE POLICY "Dono vê seu financeiro" ON public.transacoes
FOR ALL TO authenticated
USING (
    estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid())
)
WITH CHECK (
    estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid())
);

-- servicos_produtos: Dono gerencia seu catálogo OR usuário é Super Admin
DROP POLICY IF EXISTS "Dono gerencia seu catalogo" ON public.servicos_produtos;
CREATE POLICY "Dono gerencia seu catalogo" ON public.servicos_produtos
FOR ALL TO authenticated
USING (
    estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid())
)
WITH CHECK (
    estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid())
);

-- agendamentos: Dono gerencia sua agenda OR usuário é Super Admin
DROP POLICY IF EXISTS "Dono gerencia sua agenda" ON public.agendamentos;
CREATE POLICY "Dono gerencia sua agenda" ON public.agendamentos
FOR ALL TO authenticated
USING (
    estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid())
)
WITH CHECK (
    estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid())
);


-- -------------------------------------------------------
-- Source Migration: 20260525_saas_pagamentos.sql
-- -------------------------------------------------------

-- Tabela de pagamentos/faturamento do SaaS
CREATE TABLE IF NOT EXISTS saas_pagamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estabelecimento_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  valor NUMERIC(10,2) NOT NULL,
  referencia TEXT NOT NULL, -- ex: "Maio/2026", "Junho/2026"
  metodo_pagamento TEXT DEFAULT 'manual' CHECK (metodo_pagamento IN ('manual', 'pix', 'dinheiro', 'cartao')),
  status TEXT DEFAULT 'pago' CHECK (status IN ('pago', 'pendente', 'cancelado')),
  observacoes TEXT,
  pago_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS: apenas super admins podem ver/inserir/atualizar pagamentos
ALTER TABLE saas_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saas_admins_all_pagamentos" ON saas_pagamentos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM saas_admins WHERE id = auth.uid())
  );

-- Coluna de inadimplência em estabelecimentos (dias de atraso permitidos)
ALTER TABLE estabelecimentos
  ADD COLUMN IF NOT EXISTS dias_inadimplencia INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_ultimo_pagamento DATE,
  ADD COLUMN IF NOT EXISTS data_proxima_cobranca DATE;

-- Índice para busca por status
CREATE INDEX IF NOT EXISTS idx_saas_pagamentos_estab ON saas_pagamentos(estabelecimento_id);
CREATE INDEX IF NOT EXISTS idx_saas_pagamentos_status ON saas_pagamentos(status);


-- -------------------------------------------------------
-- Source Migration: 20260526_add_trial_fields.sql
-- -------------------------------------------------------

-- 20260526_add_trial_fields.sql
-- Adiciona campos de período de teste para estabelecimentos

ALTER TABLE estabelecimentos
  ADD COLUMN IF NOT EXISTS trial_start DATE,
  ADD COLUMN IF NOT EXISTS trial_end DATE,
  ADD COLUMN IF NOT EXISTS trial_active BOOLEAN DEFAULT true;

-- Opcional: definir período padrão de 14 dias para novos estabelecimentos (não no schema, será na aplicação)


-- -------------------------------------------------------
-- Source Migration: 20260526_fix_saas_admin_rls.sql
-- -------------------------------------------------------

-- 1. Remove a política antiga que causava recursão infinita
DROP POLICY IF EXISTS "Admins gerenciam a si mesmos" ON public.saas_admins;

-- 2. Permite que todos os usuários autenticados possam ler a tabela saas_admins.
-- Como esta tabela não tem dados sensíveis, isso é seguro e evita qualquer problema de recursão
-- ao validar outras políticas que usam "EXISTS (SELECT 1 FROM saas_admins)".
CREATE POLICY "Leitura permitida para autenticados" ON public.saas_admins
FOR SELECT TO authenticated
USING (true);

-- 3. Mantém a edição restrita apenas para o próprio admin
CREATE POLICY "Admins gerenciam a si mesmos (Insert/Update/Delete)" ON public.saas_admins
FOR ALL TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());


-- -------------------------------------------------------
-- Source Migration: 20260528_saas_configuracoes.sql
-- -------------------------------------------------------

-- 20260528_saas_configuracoes.sql
-- Tabela de configurações globais do SaaS (singleton - apenas 1 linha)
-- Contém contatos de suporte, configurações gerais do painel SuperAdmin

CREATE TABLE IF NOT EXISTS saas_configuracoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp_contato TEXT,
  email_contato TEXT DEFAULT 'suporte@gfin.com.br',
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adiciona colunas extras se a tabela já existia sem elas (idempotente)
ALTER TABLE saas_configuracoes
  ADD COLUMN IF NOT EXISTS trial_dias INTEGER DEFAULT 14,
  ADD COLUMN IF NOT EXISTS grace_period_dias INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS saas_nome TEXT DEFAULT 'GFin SaaS';

-- Garante que só exista 1 linha (singleton)
CREATE UNIQUE INDEX IF NOT EXISTS idx_saas_configuracoes_singleton
  ON saas_configuracoes ((TRUE));

-- RLS: super admins têm acesso total; tenants autenticados podem LER
ALTER TABLE saas_configuracoes ENABLE ROW LEVEL SECURITY;

-- Super admins podem fazer tudo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'saas_configuracoes'
    AND policyname = 'saas_admins_all_configuracoes'
  ) THEN
    CREATE POLICY "saas_admins_all_configuracoes" ON saas_configuracoes
      FOR ALL USING (
        EXISTS (SELECT 1 FROM saas_admins WHERE id = auth.uid())
      );
  END IF;
END $$;

-- Qualquer usuário autenticado pode LER (para exibir contato de suporte na tela de bloqueio)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'saas_configuracoes'
    AND policyname = 'authenticated_read_configuracoes'
  ) THEN
    CREATE POLICY "authenticated_read_configuracoes" ON saas_configuracoes
      FOR SELECT USING (
        auth.uid() IS NOT NULL
      );
  END IF;
END $$;

-- Inserir configuração padrão (apenas se a tabela estiver vazia)
INSERT INTO saas_configuracoes (whatsapp_contato, email_contato, trial_dias, grace_period_dias, saas_nome)
SELECT '5511999999999', 'suporte@gfin.com.br', 14, 5, 'GFin SaaS'
WHERE NOT EXISTS (SELECT 1 FROM saas_configuracoes);

-- -------------------------------------------------------
-- Garante campos de billing na tabela estabelecimentos
-- (idempotente - IF NOT EXISTS em cada coluna)
-- -------------------------------------------------------
ALTER TABLE estabelecimentos
  ADD COLUMN IF NOT EXISTS trial_start DATE,
  ADD COLUMN IF NOT EXISTS trial_end DATE,
  ADD COLUMN IF NOT EXISTS trial_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS dias_inadimplencia INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_ultimo_pagamento DATE,
  ADD COLUMN IF NOT EXISTS data_proxima_cobranca DATE;


