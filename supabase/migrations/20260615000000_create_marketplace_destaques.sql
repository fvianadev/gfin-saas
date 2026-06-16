-- =======================================================
-- Migration: Create marketplace_destaques for the carousel
-- Also cleans up unused 'premium' plan value
-- Created on 2026-06-15
-- =======================================================

-- ==========================================
-- PART 1: Clean up unused 'premium' plan
-- ==========================================
UPDATE public.estabelecimentos
SET plano = 'pro'
WHERE plano = 'premium';

ALTER TABLE public.estabelecimentos
DROP CONSTRAINT IF EXISTS estabelecimentos_plano_check;

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

-- ==========================================
-- PART 2: Create marketplace_destaques table
-- ==========================================
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

-- ==========================================
-- PART 3: Trigger for updated_at
-- ==========================================
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

-- ==========================================
-- PART 4: RLS Policies
-- ==========================================
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

-- ==========================================
-- PART 5: Storage bucket for marketplace images
-- ==========================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'buckets') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'marketplace',
            'marketplace',
            true,
            5242880,
            ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        )
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
        DROP POLICY IF EXISTS "marketplace_public_read" ON storage.objects;
        DROP POLICY IF EXISTS "marketplace_authenticated_insert" ON storage.objects;
        DROP POLICY IF EXISTS "marketplace_authenticated_update" ON storage.objects;
        DROP POLICY IF EXISTS "marketplace_authenticated_delete" ON storage.objects;

        CREATE POLICY "marketplace_public_read"
            ON storage.objects FOR SELECT
            TO public
            USING (bucket_id = 'marketplace');

        CREATE POLICY "marketplace_authenticated_insert"
            ON storage.objects FOR INSERT
            TO authenticated
            WITH CHECK (bucket_id = 'marketplace');

        CREATE POLICY "marketplace_authenticated_update"
            ON storage.objects FOR UPDATE
            TO authenticated
            USING (bucket_id = 'marketplace');

        CREATE POLICY "marketplace_authenticated_delete"
            ON storage.objects FOR DELETE
            TO authenticated
            USING (bucket_id = 'marketplace');
    END IF;
END $$;

-- ==========================================
-- PART 6: Indexes
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_marketplace_ordem ON public.marketplace_destaques(ordem);
CREATE INDEX IF NOT EXISTS idx_marketplace_ativo ON public.marketplace_destaques(ativo);
CREATE INDEX IF NOT EXISTS idx_marketplace_estabelecimento ON public.marketplace_destaques(estabelecimento_id);
