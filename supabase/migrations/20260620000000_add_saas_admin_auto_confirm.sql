-- Migration: Update add_saas_admin to auto-confirm email
-- Quando um admin adiciona outro, o email é confirmado automaticamente
-- Created on 2026-06-20

CREATE OR REPLACE FUNCTION public.add_saas_admin(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _user_id uuid;
  _result jsonb;
BEGIN
  -- Apenas admins existentes podem adicionar novos admins
  IF NOT EXISTS (SELECT 1 FROM public.saas_admins WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem adicionar novos admins.';
  END IF;

  -- Verificar se já é admin
  IF EXISTS (SELECT 1 FROM public.saas_admins WHERE email = p_email) THEN
    RAISE EXCEPTION 'Este e-mail já é um administrador.';
  END IF;

  -- Buscar o usuário no auth.users
  SELECT id INTO _user_id FROM auth.users WHERE email = p_email;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário com este e-mail não encontrado no auth.users. Crie o usuário primeiro ou use um e-mail já cadastrado.';
  END IF;

  -- Auto-confirmar o email (admin está convidando, não precisa confirmação)
  UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = _user_id AND email_confirmed_at IS NULL;

  -- Inserir em saas_admins
  INSERT INTO public.saas_admins (id, email)
  VALUES (_user_id, p_email)
  ON CONFLICT (id) DO NOTHING;

  -- Retornar o admin criado
  SELECT jsonb_build_object('id', id, 'email', email, 'created_at', created_at)
  INTO _result FROM public.saas_admins WHERE id = _user_id;

  RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_saas_admin TO authenticated;
