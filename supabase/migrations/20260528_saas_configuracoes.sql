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
