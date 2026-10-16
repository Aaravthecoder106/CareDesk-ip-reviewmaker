-- CareDesk 2.0 pilot: caregiver-managed recipient tracking.
-- Additive migration; does not alter existing family-sharing or report tables.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.care_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (length(trim(full_name)) BETWEEN 1 AND 120),
  date_of_birth date,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.care_recipients(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  scope text[] NOT NULL DEFAULT ARRAY['vitals','medications','weekly_summary']::text[],
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE TABLE IF NOT EXISTS public.care_vitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.care_recipients(id) ON DELETE CASCADE,
  recorded_by text NOT NULL,
  vital_type text NOT NULL CHECK (vital_type IN ('blood_pressure','glucose','weight')),
  systolic integer,
  diastolic integer,
  glucose_mg_dl numeric(7,2),
  weight_kg numeric(7,2),
  note text CHECK (note IS NULL OR length(note) <= 1000),
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_vitals_value_check CHECK (
    (vital_type = 'blood_pressure' AND systolic BETWEEN 40 AND 300 AND diastolic BETWEEN 20 AND 200 AND glucose_mg_dl IS NULL AND weight_kg IS NULL)
    OR (vital_type = 'glucose' AND glucose_mg_dl BETWEEN 1 AND 2000 AND systolic IS NULL AND diastolic IS NULL AND weight_kg IS NULL)
    OR (vital_type = 'weight' AND weight_kg BETWEEN 1 AND 1000 AND systolic IS NULL AND diastolic IS NULL AND glucose_mg_dl IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.care_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.care_recipients(id) ON DELETE CASCADE,
  vital_type text NOT NULL CHECK (vital_type IN ('blood_pressure_systolic','blood_pressure_diastolic','glucose','weight')),
  min_value numeric(10,2),
  max_value numeric(10,2),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipient_id, vital_type),
  CHECK (min_value IS NULL OR max_value IS NULL OR min_value <= max_value)
);

CREATE TABLE IF NOT EXISTS public.care_medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.care_recipients(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
  dosage text,
  schedule text NOT NULL DEFAULT 'Daily',
  instructions text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_medication_doses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid NOT NULL REFERENCES public.care_medications(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.care_recipients(id) ON DELETE CASCADE,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('taken','missed','skipped')),
  logged_by text NOT NULL,
  note text CHECK (note IS NULL OR length(note) <= 500),
  logged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (medication_id, scheduled_for)
);

CREATE TABLE IF NOT EXISTS public.care_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.care_recipients(id) ON DELETE CASCADE,
  vital_id uuid NOT NULL REFERENCES public.care_vitals(id) ON DELETE CASCADE,
  vital_type text NOT NULL,
  message text NOT NULL,
  value numeric(10,2),
  threshold_min numeric(10,2),
  threshold_max numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  UNIQUE (vital_id, vital_type)
);

CREATE TABLE IF NOT EXISTS public.care_audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id text,
  recipient_id uuid REFERENCES public.care_recipients(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('READ','CREATE','UPDATE','DELETE','CONSENT_ACCEPT','CONSENT_REVOKE')),
  resource text NOT NULL,
  record_id text,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_recipients_caregiver_idx ON public.care_recipients(caregiver_id);
CREATE INDEX IF NOT EXISTS care_vitals_recipient_measured_idx ON public.care_vitals(recipient_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS care_doses_recipient_scheduled_idx ON public.care_medication_doses(recipient_id, scheduled_for DESC);
CREATE INDEX IF NOT EXISTS care_alerts_recipient_created_idx ON public.care_alerts(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS care_audit_recipient_created_idx ON public.care_audit_logs(recipient_id, created_at DESC);

-- These tables are accessed through authorized server routes using the
-- service-role client. Do not grant direct client access to health data.
ALTER TABLE public.care_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_medication_doses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.care_recipients, public.care_consents, public.care_vitals,
  public.care_thresholds, public.care_medications, public.care_medication_doses,
  public.care_alerts, public.care_audit_logs FROM anon, authenticated;
GRANT ALL ON public.care_recipients, public.care_consents, public.care_vitals,
  public.care_thresholds, public.care_medications, public.care_medication_doses,
  public.care_alerts, public.care_audit_logs TO service_role;

CREATE OR REPLACE FUNCTION public.care_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS care_recipients_updated_at ON public.care_recipients;
CREATE TRIGGER care_recipients_updated_at BEFORE UPDATE ON public.care_recipients
FOR EACH ROW EXECUTE FUNCTION public.care_set_updated_at();
DROP TRIGGER IF EXISTS care_thresholds_updated_at ON public.care_thresholds;
CREATE TRIGGER care_thresholds_updated_at BEFORE UPDATE ON public.care_thresholds
FOR EACH ROW EXECUTE FUNCTION public.care_set_updated_at();
