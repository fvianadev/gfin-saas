-- =======================================================
-- CONSOLIDATED: Buckets de storage + políticas
-- Absorve: #6 bucket, #7 logos, #8 bucket, #9 bucket
-- Padrão consistente: DO $$, ON CONFLICT, file_size_limit,
-- allowed_mime_types, políticas em inglês com UPDATE incluso
-- =======================================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'buckets') THEN
        -- servicos (sem limite de MIME por ser upload do admin)
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('servicos', 'servicos', true)
        ON CONFLICT (id) DO NOTHING;

        -- logos (5 MB, imagem)
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
          'logos', 'logos', true,
          5242880,
          ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        )
        ON CONFLICT (id) DO NOTHING;

        -- avatars (5 MB, imagem)
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
          'avatars', 'avatars', true,
          5242880,
          ARRAY['image/jpeg', 'image/png', 'image/webp']
        )
        ON CONFLICT (id) DO NOTHING;

        -- marketplace (5 MB, imagem)
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
          'marketplace', 'marketplace', true,
          5242880,
          ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        )
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
        -- servicos
        DROP POLICY IF EXISTS "servicos_public_select" ON storage.objects;
        DROP POLICY IF EXISTS "servicos_auth_insert" ON storage.objects;
        DROP POLICY IF EXISTS "servicos_auth_update" ON storage.objects;
        DROP POLICY IF EXISTS "servicos_auth_delete" ON storage.objects;

        CREATE POLICY "servicos_public_select" ON storage.objects FOR SELECT TO public USING (bucket_id = 'servicos');
        CREATE POLICY "servicos_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'servicos');
        CREATE POLICY "servicos_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'servicos');
        CREATE POLICY "servicos_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'servicos');

        -- logos
        DROP POLICY IF EXISTS "logos_public_read" ON storage.objects;
        DROP POLICY IF EXISTS "logos_authenticated_upload" ON storage.objects;
        DROP POLICY IF EXISTS "logos_authenticated_update" ON storage.objects;
        DROP POLICY IF EXISTS "logos_authenticated_delete" ON storage.objects;

        CREATE POLICY "logos_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
        CREATE POLICY "logos_authenticated_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'logos');
        CREATE POLICY "logos_authenticated_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'logos');
        CREATE POLICY "logos_authenticated_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'logos');

        -- avatars
        DROP POLICY IF EXISTS "avatars_public_select" ON storage.objects;
        DROP POLICY IF EXISTS "avatars_auth_insert" ON storage.objects;
        DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
        DROP POLICY IF EXISTS "avatars_auth_delete" ON storage.objects;

        CREATE POLICY "avatars_public_select" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
        CREATE POLICY "avatars_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
        CREATE POLICY "avatars_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
        CREATE POLICY "avatars_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars');

        -- marketplace
        DROP POLICY IF EXISTS "marketplace_public_read" ON storage.objects;
        DROP POLICY IF EXISTS "marketplace_authenticated_insert" ON storage.objects;
        DROP POLICY IF EXISTS "marketplace_authenticated_update" ON storage.objects;
        DROP POLICY IF EXISTS "marketplace_authenticated_delete" ON storage.objects;

        CREATE POLICY "marketplace_public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'marketplace');
        CREATE POLICY "marketplace_authenticated_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'marketplace');
        CREATE POLICY "marketplace_authenticated_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'marketplace');
        CREATE POLICY "marketplace_authenticated_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'marketplace');
    END IF;
END $$;
