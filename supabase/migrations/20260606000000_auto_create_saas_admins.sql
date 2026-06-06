-- Migration: Auto create saas admins from user metadata
-- Created on 2026-06-06

CREATE OR REPLACE FUNCTION public.handle_new_saas_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'is_saas_admin' = 'true' THEN
    INSERT INTO public.saas_admins (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS on_auth_user_created_saas_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_saas_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_saas_admin();
