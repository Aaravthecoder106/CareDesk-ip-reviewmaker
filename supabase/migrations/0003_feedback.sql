-- =============================================================================
-- 0003 — Feedback table
--
-- Stores user-submitted feedback directly in Supabase, bypassing email APIs
-- that have proven unreliable in cloud deployments (FormSubmit blocks Vercel,
-- Resend free tier can only send to verified addresses).
--
-- The app writes via service_role (admin client); the application owner reads
-- from the Supabase dashboard or a future admin panel.
-- =============================================================================

CREATE TABLE public.feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,                -- Clerk user id of the submitter
  email      TEXT,                          -- User's email at time of submission
  would_use  TEXT NOT NULL,                 -- 'Yes', 'No', or 'Maybe'
  liked      TEXT,                          -- What the user liked
  missing    TEXT,                          -- What the user feels is missing
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.feedback TO service_role;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
-- No authenticated grants: feedback is service-role write only.
-- The application reader (admin) uses the Supabase dashboard.