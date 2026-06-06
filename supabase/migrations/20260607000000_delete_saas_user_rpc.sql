-- =========================================================
-- Migration: Add delete_saas_user RPC for SaaS Admin
-- Description: Permite que um SaaS Admin exclua um usuário do auth.users.
-- O CASCADE cuidará de excluir o estabelecimento e todos os seus dados.
-- =========================================================

CREATE OR REPLACE FUNCTION public.delete_saas_user(target_user_id uuid)
RETURNS void AS $$
BEGIN
  -- 1. Verificar se quem está chamando a função é um SaaS Admin
  IF NOT EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores do SaaS podem excluir usuários.';
  END IF;

  -- 2. Deletar o usuário da tabela auth.users
  -- Como owner_id em estabelecimentos tem ON DELETE CASCADE para auth.users(id),
  -- o estabelecimento também será excluído em cascata.
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
