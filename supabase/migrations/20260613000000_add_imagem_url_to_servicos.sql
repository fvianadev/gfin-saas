-- Migration: Add imagem_url to servicos_produtos and configure storage bucket
-- Created on 2026-06-13

-- 1. Adicionar coluna no banco de dados se não existir
ALTER TABLE public.servicos_produtos ADD COLUMN IF NOT EXISTS imagem_url TEXT;

-- 2. Criar o bucket "servicos" se a tabela storage.buckets existir
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'buckets') THEN
        INSERT INTO storage.buckets (id, name, public)
        VALUES ('servicos', 'servicos', true)
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- 3. Criar políticas no storage.objects se a tabela existir
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
        -- Remover políticas antigas se existirem para evitar conflitos de nomes
        DROP POLICY IF EXISTS "Permitir leitura pública de imagens" ON storage.objects;
        DROP POLICY IF EXISTS "Permitir upload de imagens por autenticados" ON storage.objects;
        DROP POLICY IF EXISTS "Permitir update de imagens por autenticados" ON storage.objects;
        DROP POLICY IF EXISTS "Permitir exclusão de imagens por autenticados" ON storage.objects;

        -- Criar política de leitura pública
        CREATE POLICY "Permitir leitura pública de imagens"
        ON storage.objects FOR SELECT
        TO public
        USING (bucket_id = 'servicos');

        -- Criar política para permitir upload (inserção)
        CREATE POLICY "Permitir upload de imagens por autenticados"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'servicos');

        -- Criar política para permitir alteração (update)
        CREATE POLICY "Permitir update de imagens por autenticados"
        ON storage.objects FOR UPDATE
        TO authenticated
        USING (bucket_id = 'servicos');

        -- Criar política para permitir exclusão (delete)
        CREATE POLICY "Permitir exclusão de imagens por autenticados"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (bucket_id = 'servicos');
    END IF;
END $$;
