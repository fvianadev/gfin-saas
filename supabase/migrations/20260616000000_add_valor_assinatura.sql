-- Add valor_assinatura column to saas_configuracoes
ALTER TABLE public.saas_configuracoes
ADD COLUMN IF NOT EXISTS valor_assinatura NUMERIC(10,2) DEFAULT 49.90;
