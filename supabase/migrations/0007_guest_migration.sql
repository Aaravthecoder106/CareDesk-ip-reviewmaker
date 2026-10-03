-- =============================================================================
-- 0007 — Guest-to-authenticated migration support
--
-- Adds columns to preview_tokens so migrated sessions are tracked and
-- cannot be migrated twice. The migrate API endpoint sets these after
-- successfully copying the guest data into reports/lab_results/etc.
-- =============================================================================

ALTER TABLE public.preview_tokens
  ADD COLUMN IF NOT EXISTS migrated_user_id TEXT,
  ADD COLUMN IF NOT EXISTS migrated_at      TIMESTAMPTZ;

-- Index to quickly check if a token has already been migrated
CREATE INDEX IF NOT EXISTS preview_tokens_migrated_idx
  ON public.preview_tokens(migrated_user_id)
  WHERE migrated_user_id IS NOT NULL;
