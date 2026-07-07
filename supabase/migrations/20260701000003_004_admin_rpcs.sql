-- =======================================================
-- CONSOLIDATED: Funções admin (todas em um único arquivo)
-- Absorve: #1 functions (handle_new_saas_admin, delete_saas_user),
--          #4, #5, #11, #12
-- Apenas a VERSÃO FINAL de cada função é mantida
-- =======================================================

-- ==========================================
-- handle_new_saas_admin (versão final: singleton)
-- Trigger: bloqueia duplicação, NÃO insere
-- A inserção é feita via confirm_saas_admin() RPC
-- ==========================================

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

-- ==========================================
-- is_first_saas_admin
-- Verifica se é o primeiro admin (onboarding)
-- ==========================================

CREATE OR REPLACE FUNCTION public.is_first_saas_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.saas_admins)
$$;

GRANT EXECUTE ON FUNCTION public.is_first_saas_admin TO anon;

-- ==========================================
-- confirm_saas_admin
-- Insere admin apenas se email confirmado + singleton
-- ==========================================

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

-- ==========================================
-- reset_saas_admins
-- Recovery: apaga todos admins (executar via SQL Editor apenas)
-- ==========================================

CREATE OR REPLACE FUNCTION public.reset_saas_admins()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.saas_admins;
$$;

REVOKE ALL ON FUNCTION public.reset_saas_admins FROM public;

-- ==========================================
-- delete_saas_user
-- Super admin exclui usuário + cascade em estabelecimento
-- ==========================================

CREATE OR REPLACE FUNCTION public.delete_saas_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores do SaaS podem excluir usuários.';
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- ==========================================
-- confirm_saas_admin_by_email
-- Fallback: promove admin sem metadata is_saas_admin
-- ==========================================

CREATE OR REPLACE FUNCTION public.confirm_saas_admin_by_email(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _confirmed_at timestamptz;
BEGIN
  IF EXISTS (SELECT 1 FROM public.saas_admins) THEN
    RETURN false;
  END IF;

  SELECT id, email_confirmed_at INTO _user_id, _confirmed_at
  FROM auth.users WHERE email = p_email;

  IF _user_id IS NULL OR _confirmed_at IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.saas_admins (id, email)
  VALUES (_user_id, p_email)
  ON CONFLICT (id) DO NOTHING;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_saas_admin_by_email TO authenticated;

-- ==========================================
-- add_saas_admin
-- Super admin adiciona novo admin (auto-confirma email)
-- ==========================================

CREATE OR REPLACE FUNCTION public.add_saas_admin(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem adicionar novos admins.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.saas_admins WHERE email = p_email) THEN
    RAISE EXCEPTION 'Este e-mail já é um administrador.';
  END IF;

  SELECT id INTO _user_id FROM auth.users WHERE email = p_email;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário com este e-mail não encontrado. Crie o usuário primeiro no auth.users.';
  END IF;

  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = _user_id AND email_confirmed_at IS NULL;

  INSERT INTO public.saas_admins (id, email)
  VALUES (_user_id, p_email)
  ON CONFLICT (id) DO NOTHING;

  SELECT jsonb_build_object('id', id, 'email', email, 'created_at', created_at)
  INTO _result FROM public.saas_admins WHERE id = _user_id;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_saas_admin TO authenticated;
