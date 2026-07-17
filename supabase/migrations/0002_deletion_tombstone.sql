-- =============================================================================
-- 0002 — deletion tombstone (webhook ordering guard)
--
-- Problem (H2): the Clerk webhook handler is stateless and idempotency rests
-- solely on upsert-by-id. Clerk retries with backoff, so a `user.updated` that
-- was delayed can land AFTER `user.deleted` for the same id and re-create the
-- row (and, via migration 0001's trigger, the patients row) — resurrecting a
-- deleted account.
--
-- This table records every deleted Clerk id. provisionUser() consults it and
-- refuses to re-create a tombstoned id, so late `user.created/updated` events
-- are acknowledged (200) but write nothing. Clerk never reuses ids and re-signup
-- mints a fresh id, so a tombstone is safe to keep permanently.
--
-- Service-role only: there are no `authenticated` grants or policies, so clients
-- can neither read nor write the tombstone. RLS is enabled to deny by default.
-- =============================================================================
CREATE TABLE public.deleted_users (
  id         TEXT PRIMARY KEY,           -- Clerk user id that was deleted
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.deleted_users TO service_role;
ALTER TABLE public.deleted_users ENABLE ROW LEVEL SECURITY;
