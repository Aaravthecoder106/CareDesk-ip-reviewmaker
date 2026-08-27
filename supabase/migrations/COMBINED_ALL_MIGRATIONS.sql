-- =============================================================================
-- CareDesk — initial schema (Clerk auth + Supabase Postgres + pgvector)
--
-- Auth model: users are authenticated by Clerk. Clerk issues a JWT whose `sub`
-- claim is the Clerk user id (TEXT). Supabase injects that JWT into
-- `request.jwt.claims`, so RLS reads the caller id via public.clerk_user_id().
--
-- IMPORTANT: RLS only restricts what a role *may* do; a role must still be
-- GRANTed base table privileges or every statement fails. Every table below is
-- granted to `authenticated` (the Clerk-backed role) and `service_role`
-- (server-side / webhooks / AI pipeline, which bypasses RLS entirely).
-- =============================================================================

-- Extensions ------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA public;

-- Enums -----------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('patient', 'doctor', 'admin');
CREATE TYPE report_status AS ENUM ('pending', 'processing', 'ready', 'failed');

-- Caller identity -------------------------------------------------------------
-- Hosted Supabase locks the `auth` schema, so this lives in `public`.
-- Returns the Clerk user id (JWT `sub`) or NULL when unauthenticated.
CREATE OR REPLACE FUNCTION public.clerk_user_id()
RETURNS TEXT
LANGUAGE SQL STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::text;
$$;

-- updated_at helper -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- Core identity tables
-- =============================================================================

-- Users (synced from Clerk via webhook using service_role).
CREATE TABLE public.users (
  id         TEXT PRIMARY KEY,             -- Clerk user id
  email      TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name  TEXT,
  role       user_role NOT NULL DEFAULT 'patient',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Row creation/deletion is owned by the Clerk sync webhook (service_role).
-- Clients may read their own row and update profile fields ONLY. `role` is
-- intentionally excluded from the column grant so a user cannot self-promote.
GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE (email, first_name, last_name, updated_at) ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own" ON public.users
  FOR SELECT TO authenticated USING (public.clerk_user_id() = id);
CREATE POLICY "users update own" ON public.users
  FOR UPDATE TO authenticated
  USING (public.clerk_user_id() = id)
  WITH CHECK (public.clerk_user_id() = id);
CREATE TRIGGER tg_users_updated BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Doctor profiles (portal deferred; table kept inert but well-formed).
CREATE TABLE public.doctors (
  id          TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  clinic_name TEXT,
  specialty   TEXT,
  npi_number  TEXT UNIQUE,
  is_verified BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.doctors TO authenticated;
GRANT ALL ON public.doctors TO service_role;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doctors read own" ON public.doctors
  FOR SELECT TO authenticated USING (public.clerk_user_id() = id);
CREATE POLICY "doctors update own" ON public.doctors
  FOR UPDATE TO authenticated
  USING (public.clerk_user_id() = id)
  WITH CHECK (public.clerk_user_id() = id);
CREATE TRIGGER tg_doctors_updated BEFORE UPDATE ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Patient profiles.
CREATE TABLE public.patients (
  id            TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  date_of_birth DATE,
  gender        TEXT,
  blood_type    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patients read own" ON public.patients
  FOR SELECT TO authenticated USING (public.clerk_user_id() = id);
CREATE POLICY "patients update own" ON public.patients
  FOR UPDATE TO authenticated
  USING (public.clerk_user_id() = id)
  WITH CHECK (public.clerk_user_id() = id);
CREATE TRIGGER tg_patients_updated BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Patient <-> Doctor relations (doctor portal deferred; consent edges only).
CREATE TABLE public.patient_doctor_relations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id  TEXT NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending', -- pending, active, revoked
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_id, doctor_id)
);
GRANT SELECT ON public.patient_doctor_relations TO authenticated;
GRANT ALL ON public.patient_doctor_relations TO service_role;
ALTER TABLE public.patient_doctor_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "relations read own" ON public.patient_doctor_relations
  FOR SELECT TO authenticated
  USING (public.clerk_user_id() = patient_id OR public.clerk_user_id() = doctor_id);
CREATE INDEX pdr_doctor_idx  ON public.patient_doctor_relations(doctor_id, status);
CREATE INDEX pdr_patient_idx ON public.patient_doctor_relations(patient_id, status);
CREATE TRIGGER tg_pdr_updated BEFORE UPDATE ON public.patient_doctor_relations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =============================================================================
-- Reports + AI-derived data
-- =============================================================================

CREATE TABLE public.reports (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  file_path  TEXT NOT NULL,
  mime_type  TEXT,
  ai_summary TEXT,
  status     report_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
-- Patient owns their reports (full CRUD). Doctors read via an ACTIVE relation.
CREATE POLICY "reports patient all" ON public.reports
  FOR ALL TO authenticated
  USING (public.clerk_user_id() = patient_id)
  WITH CHECK (public.clerk_user_id() = patient_id);
CREATE POLICY "reports doctor read" ON public.reports
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.patient_doctor_relations pdr
    WHERE pdr.doctor_id = public.clerk_user_id()
      AND pdr.patient_id = reports.patient_id
      AND pdr.status = 'active'
  ));
CREATE INDEX reports_patient_created_idx ON public.reports(patient_id, created_at DESC);
CREATE TRIGGER tg_reports_updated BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- RAG embeddings. Written by the AI pipeline (service_role) only; clients read.
CREATE TABLE public.report_embeddings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  embedding  vector(768), -- Gemini text-embedding-004 = 768 dims
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.report_embeddings TO authenticated;
GRANT ALL ON public.report_embeddings TO service_role;
ALTER TABLE public.report_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "embeddings read own" ON public.report_embeddings
  FOR SELECT TO authenticated USING (public.clerk_user_id() = patient_id);
CREATE INDEX report_embeddings_report_idx ON public.report_embeddings(report_id);
-- HNSW cosine index for approximate nearest-neighbour RAG retrieval.
CREATE INDEX report_embeddings_hnsw_idx ON public.report_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- Normalized medical data (populated by the AI pipeline via service_role).
CREATE TABLE public.lab_results (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  test_name  TEXT NOT NULL,
  value      NUMERIC,
  unit       TEXT,
  flag       TEXT,
  test_date  TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lab_results TO authenticated;
GRANT ALL ON public.lab_results TO service_role;
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "labs patient read" ON public.lab_results
  FOR SELECT TO authenticated USING (public.clerk_user_id() = patient_id);
CREATE POLICY "labs doctor read" ON public.lab_results
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.patient_doctor_relations pdr
    WHERE pdr.doctor_id = public.clerk_user_id()
      AND pdr.patient_id = lab_results.patient_id
      AND pdr.status = 'active'
  ));
CREATE INDEX lab_results_patient_idx ON public.lab_results(patient_id, test_date DESC);

CREATE TABLE public.medications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  dose       TEXT,
  frequency  TEXT,
  status     TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.medications TO authenticated;
GRANT ALL ON public.medications TO service_role;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meds patient read" ON public.medications
  FOR SELECT TO authenticated USING (public.clerk_user_id() = patient_id);
CREATE POLICY "meds doctor read" ON public.medications
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.patient_doctor_relations pdr
    WHERE pdr.doctor_id = public.clerk_user_id()
      AND pdr.patient_id = medications.patient_id
      AND pdr.status = 'active'
  ));
CREATE INDEX medications_patient_idx ON public.medications(patient_id);
CREATE TRIGGER tg_medications_updated BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.conditions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   TEXT NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  status       TEXT DEFAULT 'active',
  diagnosed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.conditions TO authenticated;
GRANT ALL ON public.conditions TO service_role;
ALTER TABLE public.conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conditions patient read" ON public.conditions
  FOR SELECT TO authenticated USING (public.clerk_user_id() = patient_id);
CREATE POLICY "conditions doctor read" ON public.conditions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.patient_doctor_relations pdr
    WHERE pdr.doctor_id = public.clerk_user_id()
      AND pdr.patient_id = conditions.patient_id
      AND pdr.status = 'active'
  ));
CREATE INDEX conditions_patient_idx ON public.conditions(patient_id);
CREATE TRIGGER tg_conditions_updated BEFORE UPDATE ON public.conditions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =============================================================================
-- Chat (AI report explanation) — restored from legacy schema
-- =============================================================================
CREATE TABLE public.chat_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,            -- 'user' | 'assistant'
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat own" ON public.chat_messages
  FOR ALL TO authenticated
  USING (public.clerk_user_id() = user_id)
  WITH CHECK (public.clerk_user_id() = user_id);
CREATE INDEX chat_messages_user_created_idx ON public.chat_messages(user_id, created_at ASC);

-- =============================================================================
-- Family sharing. Mutual-permission workflow.
--   invite -> invitee accepts (status 'pending_owner') -> owner confirms
--   ('accepted'). Only then does shared-analytics read unlock.
-- MUST be created before analytics_snapshots (which references family_members).
-- =============================================================================
CREATE TABLE public.family_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  member_id  TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  relation   TEXT,
  status     TEXT NOT NULL DEFAULT 'pending_owner', -- pending_owner | accepted
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, member_id)
);
GRANT SELECT, DELETE ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family read own links" ON public.family_members
  FOR SELECT TO authenticated
  USING (public.clerk_user_id() = owner_id OR public.clerk_user_id() = member_id);
CREATE POLICY "family delete own links" ON public.family_members
  FOR DELETE TO authenticated
  USING (public.clerk_user_id() = owner_id OR public.clerk_user_id() = member_id);
CREATE INDEX family_members_member_idx ON public.family_members(member_id, status);
CREATE INDEX family_members_owner_idx  ON public.family_members(owner_id, status);

-- Show family member display names (users rows) for accepted links.
CREATE POLICY "family read linked user" ON public.users
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.family_members fm
    WHERE fm.status = 'accepted'
      AND (
        (fm.owner_id  = users.id AND fm.member_id = public.clerk_user_id())
        OR (fm.member_id = users.id AND fm.owner_id  = public.clerk_user_id())
      )
  ));

CREATE TABLE public.family_invites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  relation   TEXT,
  token      TEXT NOT NULL UNIQUE,
  status     TEXT NOT NULL DEFAULT 'pending', -- pending | accepted
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.family_invites TO authenticated;
GRANT ALL ON public.family_invites TO service_role;
ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invites read own" ON public.family_invites
  FOR SELECT TO authenticated USING (public.clerk_user_id() = owner_id);
CREATE POLICY "invites insert own" ON public.family_invites
  FOR INSERT TO authenticated WITH CHECK (public.clerk_user_id() = owner_id);
CREATE POLICY "invites delete own" ON public.family_invites
  FOR DELETE TO authenticated USING (public.clerk_user_id() = owner_id);
CREATE INDEX family_invites_owner_idx ON public.family_invites(owner_id, status);

-- =============================================================================
-- Analytics snapshots (JSONB) — source for the analytics dashboard
-- Created AFTER family_members so the family-sharing policy can reference it.
-- =============================================================================
CREATE TABLE public.analytics_snapshots (
  user_id    TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analytics_snapshots TO authenticated;
GRANT ALL ON public.analytics_snapshots TO service_role;
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;
-- Family sharing is ANALYTICS-ONLY and requires a mutually-accepted link.
CREATE POLICY "analytics own or family read" ON public.analytics_snapshots
  FOR SELECT TO authenticated
  USING (
    public.clerk_user_id() = user_id
    OR EXISTS (
      SELECT 1 FROM public.family_members fm
      WHERE fm.status = 'accepted'
        AND (
          (fm.owner_id  = analytics_snapshots.user_id AND fm.member_id = public.clerk_user_id())
          OR (fm.member_id = analytics_snapshots.user_id AND fm.owner_id  = public.clerk_user_id())
        )
    )
  );
CREATE POLICY "analytics own insert" ON public.analytics_snapshots
  FOR INSERT TO authenticated WITH CHECK (public.clerk_user_id() = user_id);
CREATE POLICY "analytics own update" ON public.analytics_snapshots
  FOR UPDATE TO authenticated
  USING (public.clerk_user_id() = user_id)
  WITH CHECK (public.clerk_user_id() = user_id);

-- =============================================================================
-- Notifications — restored from legacy schema
-- =============================================================================
CREATE TABLE public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications own" ON public.notifications
  FOR ALL TO authenticated
  USING (public.clerk_user_id() = user_id)
  WITH CHECK (public.clerk_user_id() = user_id);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);

-- =============================================================================
-- Library password lock — restored from legacy schema
-- (scrypt hash + salt stored server-side; verification is app-side)
-- =============================================================================
CREATE TABLE public.library_settings (
  user_id       TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_settings TO authenticated;
GRANT ALL ON public.library_settings TO service_role;
ALTER TABLE public.library_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "library own" ON public.library_settings
  FOR ALL TO authenticated
  USING (public.clerk_user_id() = user_id)
  WITH CHECK (public.clerk_user_id() = user_id);
CREATE TRIGGER tg_library_updated BEFORE UPDATE ON public.library_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =============================================================================
-- Audit logs (HIPAA). Append-only; written by server-side code (service_role).
-- NOTE: not yet wired to application actions — see Remaining Issues.
-- =============================================================================
CREATE TABLE public.audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   TEXT NOT NULL,
  action     TEXT NOT NULL,             -- SELECT | INSERT | UPDATE | DELETE
  table_name TEXT NOT NULL,
  record_id  TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
-- No authenticated grants/policies: audit trail is service-role only.
CREATE INDEX audit_logs_actor_idx ON public.audit_logs(actor_id, created_at DESC);

-- =============================================================================
-- Family-sharing RPCs (SECURITY DEFINER) — ported from legacy, Clerk-adapted.
-- These are the only path that writes family_members, enforcing mutual consent.
-- =============================================================================

-- Invitee accepts an invite: creates a link in 'pending_owner' state.
CREATE OR REPLACE FUNCTION public.accept_family_invite(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite public.family_invites%ROWTYPE;
  v_uid TEXT := public.clerk_user_id();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_invite FROM public.family_invites WHERE token = _token AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid or used invite'; END IF;
  IF v_invite.owner_id = v_uid THEN RAISE EXCEPTION 'cannot accept own invite'; END IF;
  INSERT INTO public.family_members (owner_id, member_id, relation, status)
  VALUES (v_invite.owner_id, v_uid, v_invite.relation, 'pending_owner')
  ON CONFLICT (owner_id, member_id) DO UPDATE SET status = 'pending_owner';
  UPDATE public.family_invites SET status = 'accepted' WHERE id = v_invite.id;
  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (v_invite.owner_id, 'family_pending', 'Confirm family member',
          v_invite.email || ' accepted your invite — confirm to unlock shared analytics');
  RETURN jsonb_build_object('ok', true, 'owner_id', v_invite.owner_id, 'status', 'pending_owner');
END;
$$;

-- Owner confirms a pending member: flips the link to 'accepted' (mutual consent).
CREATE OR REPLACE FUNCTION public.confirm_family_member(_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid TEXT := public.clerk_user_id();
  v_row public.family_members%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO v_row FROM public.family_members
    WHERE id = _member_id AND owner_id = v_uid AND status = 'pending_owner';
  IF NOT FOUND THEN RAISE EXCEPTION 'no pending link to confirm'; END IF;
  UPDATE public.family_members SET status = 'accepted' WHERE id = _member_id;
  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (v_row.member_id, 'family_confirmed', 'Family link confirmed',
          'Shared analytics are now available.');
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Lock down RPC execution to authenticated callers only.
REVOKE EXECUTE ON FUNCTION public.accept_family_invite(TEXT)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.confirm_family_member(UUID)  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.accept_family_invite(TEXT)   TO authenticated;
GRANT  EXECUTE ON FUNCTION public.confirm_family_member(UUID)  TO authenticated;

-- =============================================================================
-- Storage: private `reports` bucket. Object key convention: <clerk_user_id>/...
-- Policies key off the first path segment so users only touch their own files.
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "reports storage read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'reports' AND public.clerk_user_id() = (storage.foldername(name))[1]);
CREATE POLICY "reports storage upload own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reports' AND public.clerk_user_id() = (storage.foldername(name))[1]);
CREATE POLICY "reports storage delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'reports' AND public.clerk_user_id() = (storage.foldername(name))[1]);


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
