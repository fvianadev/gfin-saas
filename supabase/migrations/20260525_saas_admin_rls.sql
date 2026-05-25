-- ==========================================
-- GFIN SAAS - SUPER ADMIN RLS BYPASS
-- Data: 2026-05-25
-- Objetivo: Configurar RLS nas tabelas saas_admins/saas_configuracoes e
-- liberar acesso irrestrito para Super Admins em todas as tabelas de tenants.
-- ==========================================

-- 1. Habilitar RLS para saas_admins e saas_configuracoes
ALTER TABLE IF EXISTS public.saas_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.saas_configuracoes ENABLE ROW LEVEL SECURITY;

-- 2. Políticas para saas_admins
DROP POLICY IF EXISTS "Admins gerenciam a si mesmos" ON public.saas_admins;
CREATE POLICY "Admins gerenciam a si mesmos" ON public.saas_admins
FOR ALL TO authenticated
USING (id = auth.uid() OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()))
WITH CHECK (id = auth.uid() OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()));

-- 3. Políticas para saas_configuracoes
-- Qualquer um (incluindo usuários anônimos na Landing Page) pode ler as configurações
DROP POLICY IF EXISTS "Publico le configuracoes saas" ON public.saas_configuracoes;
CREATE POLICY "Publico le configuracoes saas" ON public.saas_configuracoes
FOR SELECT TO anon, authenticated
USING (true);

-- Apenas Super Admins cadastrados na tabela saas_admins podem alterar as configurações
DROP POLICY IF EXISTS "Super Admin gerencia configuracoes saas" ON public.saas_configuracoes;
CREATE POLICY "Super Admin gerencia configuracoes saas" ON public.saas_configuracoes
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()));


-- 4. ATUALIZAR POLÍTICAS RLS DAS TABELAS EXISTENTES PARA PERMITIR BYPASS DE SUPER ADMIN

-- estabelecimentos: Dono gerencia seu estabelecimento OR usuário é Super Admin
DROP POLICY IF EXISTS "Dono gerencia seu estabelecimento" ON public.estabelecimentos;
CREATE POLICY "Dono gerencia seu estabelecimento" ON public.estabelecimentos
FOR ALL TO authenticated
USING (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()))
WITH CHECK (owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()));

-- membros_equipe: Dono gerencia sua equipe OR usuário é Super Admin
DROP POLICY IF EXISTS "Dono gerencia sua equipe" ON public.membros_equipe;
CREATE POLICY "Dono gerencia sua equipe" ON public.membros_equipe
FOR ALL TO authenticated
USING (
    estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid())
)
WITH CHECK (
    estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid())
);

-- transacoes: Dono gerencia seu financeiro OR usuário é Super Admin
DROP POLICY IF EXISTS "Dono vê seu financeiro" ON public.transacoes;
CREATE POLICY "Dono vê seu financeiro" ON public.transacoes
FOR ALL TO authenticated
USING (
    estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid())
)
WITH CHECK (
    estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid())
);

-- servicos_produtos: Dono gerencia seu catálogo OR usuário é Super Admin
DROP POLICY IF EXISTS "Dono gerencia seu catalogo" ON public.servicos_produtos;
CREATE POLICY "Dono gerencia seu catalogo" ON public.servicos_produtos
FOR ALL TO authenticated
USING (
    estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid())
)
WITH CHECK (
    estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid())
);

-- agendamentos: Dono gerencia sua agenda OR usuário é Super Admin
DROP POLICY IF EXISTS "Dono gerencia sua agenda" ON public.agendamentos;
CREATE POLICY "Dono gerencia sua agenda" ON public.agendamentos
FOR ALL TO authenticated
USING (
    estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid())
)
WITH CHECK (
    estabelecimento_id IN (SELECT id FROM public.estabelecimentos WHERE owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid())
);
