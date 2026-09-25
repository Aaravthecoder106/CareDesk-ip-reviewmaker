CREATE TABLE public.guest_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  report_storage_path TEXT,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  analysis JSONB,
  analysis_status TEXT NOT NULL DEFAULT 'pending',
  health_score INTEGER,
  insights JSONB NOT NULL DEFAULT '[]'::jsonb,
  ip_hash TEXT NOT NULL,
  upload_count INTEGER NOT NULL DEFAULT 0,
  last_upload_at TIMESTAMPTZ,
  migrated_user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT guest_sessions_session_id_format CHECK (session_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  CONSTRAINT guest_sessions_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT guest_sessions_upload_count_nonnegative CHECK (upload_count >= 0),
  CONSTRAINT guest_sessions_health_score_range CHECK (health_score IS NULL OR (health_score BETWEEN 0 AND 100)),
  CONSTRAINT guest_sessions_analysis_status_valid CHECK (analysis_status IN ('pending', 'processing', 'ready', 'failed'))
);

CREATE INDEX guest_sessions_ip_upload_idx
  ON public.guest_sessions(ip_hash, last_upload_at DESC);

CREATE INDEX guest_sessions_expires_idx
  ON public.guest_sessions(expires_at);

CREATE TRIGGER tg_guest_sessions_updated
  BEFORE UPDATE ON public.guest_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_sessions TO service_role;

CREATE OR REPLACE FUNCTION public.claim_guest_session(
  p_session_id TEXT,
  p_token_hash TEXT,
  p_ip_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.guest_sessions%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_expires_at TIMESTAMPTZ := now() + INTERVAL '24 hours';
BEGIN
  IF p_session_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_session');
  END IF;

  IF p_token_hash !~ '^[0-9a-f]{64}$' OR length(p_ip_hash) < 32 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_session');
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('guest-ip:' || p_ip_hash, 0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('guest-session:' || p_session_id, 0));

  SELECT * INTO v_session
  FROM public.guest_sessions
  WHERE session_id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1
      FROM public.guest_sessions
      WHERE ip_hash = p_ip_hash
        AND last_upload_at > v_now - INTERVAL '24 hours'
    ) THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'ip_limit');
    END IF;

    INSERT INTO public.guest_sessions (
      session_id,
      token_hash,
      ip_hash,
      upload_count,
      last_upload_at,
      expires_at,
      analysis_status
    ) VALUES (
      p_session_id,
      p_token_hash,
      p_ip_hash,
      1,
      v_now,
      v_expires_at,
      'processing'
    );

    RETURN jsonb_build_object(
      'allowed', true,
      'sessionId', p_session_id,
      'expiresAt', v_expires_at
    );
  END IF;

  IF v_session.expires_at <= v_now THEN
    IF EXISTS (
      SELECT 1
      FROM public.guest_sessions
      WHERE ip_hash = p_ip_hash
        AND id <> v_session.id
        AND last_upload_at > v_now - INTERVAL '24 hours'
    ) THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'ip_limit');
    END IF;

    UPDATE public.guest_sessions
    SET token_hash = p_token_hash,
        report_storage_path = NULL,
        report = '{}'::jsonb,
        analysis = NULL,
        analysis_status = 'processing',
        health_score = NULL,
        insights = '[]'::jsonb,
        upload_count = 1,
        last_upload_at = v_now,
        migrated_user_id = NULL,
        expires_at = v_expires_at
    WHERE id = v_session.id;

    RETURN jsonb_build_object(
      'allowed', true,
      'sessionId', p_session_id,
      'expiresAt', v_expires_at
    );
  END IF;

  IF v_session.token_hash <> p_token_hash THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_session');
  END IF;

  IF v_session.upload_count >= 1 OR v_session.analysis IS NOT NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'session_limit');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.guest_sessions
    WHERE ip_hash = p_ip_hash
      AND id <> v_session.id
      AND last_upload_at > v_now - INTERVAL '24 hours'
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'ip_limit');
  END IF;

  UPDATE public.guest_sessions
  SET analysis_status = 'processing',
      upload_count = upload_count + 1,
      last_upload_at = v_now
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'allowed', true,
    'sessionId', p_session_id,
    'expiresAt', v_session.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_guest_session(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_guest_session(TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.claim_guest_session(TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_guest_session(TEXT, TEXT, TEXT) TO service_role;
