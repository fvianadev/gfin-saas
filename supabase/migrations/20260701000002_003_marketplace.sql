-- =======================================================
-- CONSOLIDATED: Marketplace destaques
-- Absorve: #9 (exceto bucket, que está em 002_storage)
-- =======================================================

-- Limpa plano 'premium' não utilizado
UPDATE public.estabelecimentos SET plano = 'pro' WHERE plano = 'premium';

ALTER TABLE public.estabelecimentos DROP CONSTRAINT IF EXISTS estabelecimentos_plano_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'estabelecimentos_plano_check'
    AND conrelid = 'public.estabelecimentos'::regclass
  ) THEN
    ALTER TABLE public.estabelecimentos
    ADD CONSTRAINT estabelecimentos_plano_check
    CHECK (plano IN ('gratis', 'pro'));
  END IF;
END $$;

-- Tabela marketplace_destaques
CREATE TABLE IF NOT EXISTS public.marketplace_destaques (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estabelecimento_id UUID NOT NULL REFERENCES public.estabelecimentos(id) ON DELETE CASCADE,
    imagem_url        TEXT,
    premium           BOOLEAN DEFAULT false,
    ordem             INTEGER DEFAULT 0,
    ativo             BOOLEAN DEFAULT false,
    dados             JSONB DEFAULT '{}'::jsonb,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_estab_marketplace UNIQUE (estabelecimento_id)
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_marketplace_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_marketplace_updated_at ON public.marketplace_destaques;
CREATE TRIGGER set_marketplace_updated_at
    BEFORE UPDATE ON public.marketplace_destaques
    FOR EACH ROW EXECUTE FUNCTION public.update_marketplace_updated_at();

-- RLS
ALTER TABLE public.marketplace_destaques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "publico_le_marketplace" ON public.marketplace_destaques;
CREATE POLICY "publico_le_marketplace" ON public.marketplace_destaques
    FOR SELECT TO anon, authenticated
    USING (ativo = true);

DROP POLICY IF EXISTS "saas_admins_marketplace" ON public.marketplace_destaques;
CREATE POLICY "saas_admins_marketplace" ON public.marketplace_destaques
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()));

-- Índices
CREATE INDEX IF NOT EXISTS idx_marketplace_ordem ON public.marketplace_destaques(ordem);
CREATE INDEX IF NOT EXISTS idx_marketplace_ativo ON public.marketplace_destaques(ativo);
CREATE INDEX IF NOT EXISTS idx_marketplace_estabelecimento ON public.marketplace_destaques(estabelecimento_id);
