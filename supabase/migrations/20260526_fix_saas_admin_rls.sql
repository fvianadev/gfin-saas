-- 1. Remove a política antiga que causava recursão infinita
DROP POLICY IF EXISTS "Admins gerenciam a si mesmos" ON public.saas_admins;

-- 2. Permite que todos os usuários autenticados possam ler a tabela saas_admins.
-- Como esta tabela não tem dados sensíveis, isso é seguro e evita qualquer problema de recursão
-- ao validar outras políticas que usam "EXISTS (SELECT 1 FROM saas_admins)".
CREATE POLICY "Leitura permitida para autenticados" ON public.saas_admins
FOR SELECT TO authenticated
USING (true);

-- 3. Mantém a edição restrita apenas para o próprio admin
CREATE POLICY "Admins gerenciam a si mesmos (Insert/Update/Delete)" ON public.saas_admins
FOR ALL TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
