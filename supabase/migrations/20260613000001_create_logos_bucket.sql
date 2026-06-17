-- Cria o bucket 'logos' para armazenar as logos dos estabelecimentos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Política: leitura pública (anon pode ler)
DROP POLICY IF EXISTS "logos_public_read" ON storage.objects;
CREATE POLICY "logos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

-- Política: apenas usuários autenticados podem fazer upload
DROP POLICY IF EXISTS "logos_authenticated_upload" ON storage.objects;
CREATE POLICY "logos_authenticated_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'logos');

-- Política: apenas usuários autenticados podem deletar
DROP POLICY IF EXISTS "logos_authenticated_delete" ON storage.objects;
CREATE POLICY "logos_authenticated_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'logos');
