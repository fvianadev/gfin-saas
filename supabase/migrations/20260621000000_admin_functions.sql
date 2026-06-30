-- ============================================================================
-- Migration: Admin Management RPCs
-- Description: Centraliza as RPCs auxiliares para gestão de admins do SaaS.
--
-- Funcionalidades:
--   1. confirm_saas_admin_by_email  → Promove primeiro admin sem metadata
--   2. add_saas_admin               → Adiciona novo admin (com auto-confirmação)
-- ============================================================================

-- ============================================================================
-- 1. confirm_saas_admin_by_email
-- ────────────────────────────────────────────────────────────────────────────
-- Fallback executado no LoginPage quando o primeiro admin foi criado no
-- Supabase Dashboard sem o metadata `is_saas_admin`. Exige que o email
-- já esteja confirmado e que nenhum admin exista (singleton).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.confirm_saas_admin_by_email(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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

-- ============================================================================
-- 2. add_saas_admin
-- ────────────────────────────────────────────────────────────────────────────
-- Chamada pelo super admin logado via modal no painel. Cria o vínculo do
-- usuário com a tabela saas_admins e auto-confirma o email, já que o
-- convite do admin existente substitui a necessidade de verificação.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.add_saas_admin(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
