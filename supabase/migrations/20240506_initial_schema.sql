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
