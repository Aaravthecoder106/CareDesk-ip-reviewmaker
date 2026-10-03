-- =============================================================================
-- 0005 — Preview tokens (guest "try before you sign up" flow)
--
-- Stores AI analysis results for unauthenticated users who upload a report
-- from the landing page. Each row maps a random token to the full analysis,
-- allowing a public preview page to display a teaser without auth.
--
-- Tokens expire after 24 hours; old rows can be cleaned up by a cron job.
-- =============================================================================

CREATE TABLE public.preview_tokens (
  token        TEXT PRIMARY KEY,
  file_path    TEXT NOT NULL,
  mime_type    TEXT NOT NULL DEFAULT 'application/pdf',
  file_name    TEXT NOT NULL,
  summary      TEXT,
  lab_results  JSONB NOT NULL DEFAULT '[]'::jsonb,
  medications  JSONB NOT NULL DEFAULT '[]'::jsonb,
  conditions   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No RLS — this table is service-role only (public API uses admin client).
-- Anonymous users read via the preview page API, not direct Supabase queries.
ALTER TABLE public.preview_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX preview_tokens_created_idx ON public.preview_tokens(created_at);
