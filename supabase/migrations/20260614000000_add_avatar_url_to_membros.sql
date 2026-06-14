-- Migration: Add avatar_url to membros_equipe and create avatars storage bucket
-- Created on 2026-06-14

-- 1. Adicionar coluna no banco de dados se não existir
ALTER TABLE public.membros_equipe ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Criar o bucket "avatars" se a tabela storage.buckets existir
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'buckets') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
          'avatars',
          'avatars',
          true,
          5242880, -- 5 MB
          ARRAY['image/jpeg', 'image/png', 'image/webp']
        )
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- 3. Criar políticas no storage.objects
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
        DROP POLICY IF EXISTS "avatars_public_select" ON storage.objects;
        DROP POLICY IF EXISTS "avatars_auth_insert" ON storage.objects;
        DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
        DROP POLICY IF EXISTS "avatars_auth_delete" ON storage.objects;

        CREATE POLICY "avatars_public_select"
            ON storage.objects FOR SELECT
            USING (bucket_id = 'avatars');

        CREATE POLICY "avatars_auth_insert"
            ON storage.objects FOR INSERT
            TO authenticated
            WITH CHECK (bucket_id = 'avatars');

        CREATE POLICY "avatars_auth_update"
            ON storage.objects FOR UPDATE
            TO authenticated
            USING (bucket_id = 'avatars');

        CREATE POLICY "avatars_auth_delete"
            ON storage.objects FOR DELETE
            TO authenticated
            USING (bucket_id = 'avatars');
    END IF;
END $$;
