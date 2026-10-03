-- =============================================================================
-- 0001 — user provisioning safety net
--
-- Task 2 ("every new user automatically gets the correct patient profile") is
-- primarily satisfied in application code (the Clerk webhook + self-heal both
-- call provisionUser, which upserts the patients row). This trigger is a
-- defence-in-depth guarantee at the data layer: ANY insert into public.users
-- — webhook, self-heal, admin backfill, or manual SQL — auto-creates the
-- matching patients row. Idempotent via ON CONFLICT DO NOTHING.
--
-- The app-side upsert is kept (not replaced): it lets provisioning report
-- failures synchronously and works even if this trigger is ever dropped. The
-- two layers converge on the same row without conflict.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tg_provision_patient()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.patients (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_users_provision_patient
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.tg_provision_patient();
