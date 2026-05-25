-- 20260526_add_trial_fields.sql
-- Adiciona campos de período de teste para estabelecimentos

ALTER TABLE estabelecimentos
  ADD COLUMN IF NOT EXISTS trial_start DATE,
  ADD COLUMN IF NOT EXISTS trial_end DATE,
  ADD COLUMN IF NOT EXISTS trial_active BOOLEAN DEFAULT true;

-- Opcional: definir período padrão de 14 dias para novos estabelecimentos (não no schema, será na aplicação)
