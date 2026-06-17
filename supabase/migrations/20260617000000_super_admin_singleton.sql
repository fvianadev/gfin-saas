-- Migration: Super admin singleton validation + setup RPCs
-- Created on 2026-06-17

-- 1. RPC para consultar se é o primeiro super admin
CREATE OR REPLACE FUNCTION public.is_first_saas_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.saas_admins)
$$;

GRANT EXECUTE ON FUNCTION public.is_first_saas_admin TO anon;

-- 2. Trigger — apenas bloqueia se já existir admin, NÃO insere
-- A inserção em saas_admins acontece só após confirmação de email via RPC confirm_saas_admin()
CREATE OR REPLACE FUNCTION public.handle_new_saas_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'is_saas_admin' = 'true' THEN
    IF EXISTS (SELECT 1 FROM public.saas_admins) THEN
      RAISE EXCEPTION 'Já existe um administrador principal. Crie novos admins pelo painel.'
        USING HINT = 'Acesse /super-admin/admins para gerenciar administradores.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_saas_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_saas_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_saas_admin();

-- 3. RPC confirm_saas_admin — insere apenas se email confirmado e singleton
CREATE OR REPLACE FUNCTION public.confirm_saas_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _email text;
  _confirmed_at timestamptz;
BEGIN
  SELECT email, email_confirmed_at INTO _email, _confirmed_at
  FROM auth.users WHERE id = _user_id;

  IF _confirmed_at IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM public.saas_admins) THEN
    RETURN false;
  END IF;

  INSERT INTO public.saas_admins (id, email)
  VALUES (_user_id, _email)
  ON CONFLICT (id) DO NOTHING;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_saas_admin TO authenticated;

-- 4. RPC reset_saas_admins — recovery, executar apenas via SQL Editor
CREATE OR REPLACE FUNCTION public.reset_saas_admins()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.saas_admins;
$$;

REVOKE ALL ON FUNCTION public.reset_saas_admins FROM public;