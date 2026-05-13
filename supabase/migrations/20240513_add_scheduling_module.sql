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
