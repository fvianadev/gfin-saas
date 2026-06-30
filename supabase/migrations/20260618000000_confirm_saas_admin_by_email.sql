-- Migration: RPC confirm_saas_admin_by_email
-- Fallback para promover o primeiro admin mesmo sem metadata is_saas_admin
-- Created on 2026-06-18

CREATE OR REPLACE FUNCTION public.confirm_saas_admin_by_email(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _user_id uuid;
  _confirmed_at timestamptz;
BEGIN
  -- Só permite se nenhum admin existir ainda
  IF EXISTS (SELECT 1 FROM public.saas_admins) THEN
    RETURN false;
  END IF;

  -- Buscar o usuário pelo email
  SELECT id, email_confirmed_at INTO _user_id, _confirmed_at
  FROM auth.users WHERE email = p_email;

  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  IF _confirmed_at IS NULL THEN
    RETURN false;
  END IF;

  -- Inserir em saas_admins
  INSERT INTO public.saas_admins (id, email)
  VALUES (_user_id, p_email)
  ON CONFLICT (id) DO NOTHING;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_saas_admin_by_email TO authenticated;
