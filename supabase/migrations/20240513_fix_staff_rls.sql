-- Restore access for Staff Dashboard (anon users)
-- These policies are necessary because the app uses PIN login (anon) for daily operations.

-- 1. Catalog (servicos_produtos)
DROP POLICY IF EXISTS "Staff gerencia catalogo" ON servicos_produtos;
CREATE POLICY "Staff gerencia catalogo" ON servicos_produtos
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 2. Transactions (transacoes)
-- Allow staff to select, update and delete (hardening only allowed insert)
DROP POLICY IF EXISTS "Staff gerencia financeiro" ON transacoes;
CREATE POLICY "Staff gerencia financeiro" ON transacoes
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 3. Team Members (membros_equipe)
-- Allow admins logged via PIN to manage the team
DROP POLICY IF EXISTS "Staff gerencia equipe" ON membros_equipe;
CREATE POLICY "Staff gerencia equipe" ON membros_equipe
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 4. Opening Hours (horarios_funcionamento)
DROP POLICY IF EXISTS "Staff gerencia horarios" ON horarios_funcionamento;
CREATE POLICY "Staff gerencia horarios" ON horarios_funcionamento
FOR ALL TO anon, authenticated
USING (true)
WITH CHECK (true);
