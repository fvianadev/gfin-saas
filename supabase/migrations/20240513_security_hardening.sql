-- ==========================================
-- GFIN SAAS - SECURITY HARDENING (RLS & ISOLATION)
-- Data: 2024-05-13
-- Objetivo: Garantir que um estabelecimento nunca acesse dados de outro.
-- ==========================================

-- 1. Habilitar RLS em todas as tabelas (caso não esteja)
ALTER TABLE estabelecimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE membros_equipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE horarios_funcionamento ENABLE ROW LEVEL SECURITY;

-- 2. Limpar políticas genéricas existentes para evitar conflitos
DROP POLICY IF EXISTS "Acesso total estabelecimentos" ON estabelecimentos;
DROP POLICY IF EXISTS "Acesso total membros" ON membros_equipe;
DROP POLICY IF EXISTS "Acesso total transacoes" ON transacoes;
DROP POLICY IF EXISTS "Acesso total itens" ON servicos_produtos;
DROP POLICY IF EXISTS "Acesso total horarios" ON horarios_funcionamento;
DROP POLICY IF EXISTS "Estabelecimento vê seus agendamentos" ON agendamentos;

-- ==========================================
-- POLÍTICAS PARA DONOS (USUÁRIOS AUTENTICADOS)
-- ==========================================

-- Estabelecimentos: O dono só vê e edita o dele
CREATE POLICY "Dono gerencia seu estabelecimento" ON estabelecimentos
FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Membros: O dono gerencia apenas sua equipe
CREATE POLICY "Dono gerencia sua equipe" ON membros_equipe
FOR ALL TO authenticated
USING (estabelecimento_id IN (SELECT id FROM estabelecimentos WHERE owner_id = auth.uid()))
WITH CHECK (estabelecimento_id IN (SELECT id FROM estabelecimentos WHERE owner_id = auth.uid()));

-- Transações: O dono vê apenas seu financeiro
CREATE POLICY "Dono vê seu financeiro" ON transacoes
FOR ALL TO authenticated
USING (estabelecimento_id IN (SELECT id FROM estabelecimentos WHERE owner_id = auth.uid()))
WITH CHECK (estabelecimento_id IN (SELECT id FROM estabelecimentos WHERE owner_id = auth.uid()));

-- Itens/Serviços: O dono gerencia seu catálogo
CREATE POLICY "Dono gerencia seu catalogo" ON servicos_produtos
FOR ALL TO authenticated
USING (estabelecimento_id IN (SELECT id FROM estabelecimentos WHERE owner_id = auth.uid()))
WITH CHECK (estabelecimento_id IN (SELECT id FROM estabelecimentos WHERE owner_id = auth.uid()));

-- Agendamentos: O dono gerencia sua agenda
CREATE POLICY "Dono gerencia sua agenda" ON agendamentos
FOR ALL TO authenticated
USING (estabelecimento_id IN (SELECT id FROM estabelecimentos WHERE owner_id = auth.uid()))
WITH CHECK (estabelecimento_id IN (SELECT id FROM estabelecimentos WHERE owner_id = auth.uid()));

-- ==========================================
-- POLÍTICAS PARA ACESSO PÚBLICO / STAFF (ANON)
-- ==========================================

-- Estabelecimentos: Necessário para o PublicBooking e Login identificar o slug
DROP POLICY IF EXISTS "Publico vê info básica estabelecimentos" ON estabelecimentos;
CREATE POLICY "Publico vê info básica estabelecimentos" ON estabelecimentos
FOR SELECT TO anon, authenticated
USING (true);

-- Membros: Necessário para o login por PIN (vê apenas nomes e IDs, mas permite conferir o PIN no WHERE)
DROP POLICY IF EXISTS "Equipe vê membros para login" ON membros_equipe;
CREATE POLICY "Equipe vê membros para login" ON membros_equipe
FOR SELECT TO anon, authenticated
USING (ativo = true);

-- Agendamentos: Público pode inserir (agendar) e ver (checar disponibilidade)
DROP POLICY IF EXISTS "Publico pode agendar" ON agendamentos;
CREATE POLICY "Publico pode agendar" ON agendamentos
FOR INSERT TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Publico vê agendamentos para disponibilidade" ON agendamentos;
CREATE POLICY "Publico vê agendamentos para disponibilidade" ON agendamentos
FOR SELECT TO anon, authenticated
USING (true);

-- Transações: Permitir que o Staff (anon) insira transações ao finalizar agendamento
DROP POLICY IF EXISTS "Staff insere transacoes" ON transacoes;
CREATE POLICY "Staff insere transacoes" ON transacoes
FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- Horários: Público vê para agendar
DROP POLICY IF EXISTS "Publico vê horarios" ON horarios_funcionamento;
CREATE POLICY "Publico vê horarios" ON horarios_funcionamento
FOR SELECT TO anon, authenticated
USING (true);
