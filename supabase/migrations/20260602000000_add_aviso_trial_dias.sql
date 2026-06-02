-- Adiciona a coluna aviso_trial_dias à tabela de saas_configuracoes
ALTER TABLE public.saas_configuracoes ADD COLUMN IF NOT EXISTS aviso_trial_dias INTEGER DEFAULT 3;
UPDATE public.saas_configuracoes SET aviso_trial_dias = 3 WHERE aviso_trial_dias IS NULL;
