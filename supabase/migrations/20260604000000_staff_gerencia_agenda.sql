-- Migration: Staff gerencia agenda
-- Created on 2026-06-04
-- Permite que usuários logados com PIN (anon) e usuários autenticados (authenticated) possam gerenciar (update/delete) agendamentos.

DROP POLICY IF EXISTS "Staff gerencia agenda" ON public.agendamentos;
CREATE POLICY "Staff gerencia agenda" ON public.agendamentos
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);
