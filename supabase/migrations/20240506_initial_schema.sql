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
    
    -- Campos de Auditoria de Exclusão
    excluido BOOLEAN DEFAULT false,
    excluido_em TIMESTAMP WITH TIME ZONE,
    excluido_por UUID REFERENCES membros_equipe(id),
    motivo_exclusao TEXT,
    
    -- Campos de Auditoria de Alteração (Última)
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

-- ==========================================
-- SEGURANÇA (RLS)
-- ==========================================
ALTER TABLE estabelecimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE membros_equipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_transacoes ENABLE ROW LEVEL SECURITY;

-- Políticas simplificadas para MVP/Dev
DROP POLICY IF EXISTS "Acesso total estabelecimentos" ON estabelecimentos;
DROP POLICY IF EXISTS "Acesso total membros" ON membros_equipe;
DROP POLICY IF EXISTS "Acesso total transacoes" ON transacoes;
DROP POLICY IF EXISTS "Acesso total auditoria" ON auditoria_transacoes;

CREATE POLICY "Acesso total estabelecimentos" ON estabelecimentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total membros" ON membros_equipe FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total transacoes" ON transacoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total auditoria" ON auditoria_transacoes FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- ÍNDICES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_trans_excluido ON transacoes(estabelecimento_id, excluido);
CREATE INDEX IF NOT EXISTS idx_audit_trans ON auditoria_transacoes(transacao_id);

-- 5. TABELA DE SERVIÇOS E PRODUTOS (CATÁLOGO)
CREATE TABLE IF NOT EXISTS servicos_produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estabelecimento_id UUID REFERENCES estabelecimentos(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    preco_sugerido DECIMAL(10,2),
    tipo TEXT CHECK (tipo IN ('receita', 'despesa')) DEFAULT 'receita',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(estabelecimento_id, nome, tipo)
);

ALTER TABLE servicos_produtos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total itens" ON servicos_produtos;
CREATE POLICY "Acesso total itens" ON servicos_produtos FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
