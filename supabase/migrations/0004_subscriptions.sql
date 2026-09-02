-- =============================================================================
-- 0004 — billing tables
--
-- Adds the two tables the payment flow writes to. Both were previously missing
-- from the migration set (the subscriptions table only existed in hand-written
-- TS types), so a fresh deploy could not run /api/razorpay/*.
--
-- subscriptions : one row per user — the effective plan tier and period.
-- razorpay_orders : server-side record of every order we create. The verify
--   endpoint reads the plan/amount from here instead of trusting the client,
--   and flips status to 'completed' exactly once (replay protection).
--
-- Service-role only: no authenticated grants or policies. All reads/writes go
-- through the admin client in trusted server code. RLS is enabled so the
-- default-deny applies to any accidental RLS-scoped access.
-- =============================================================================

CREATE TABLE public.subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT NOT NULL UNIQUE,
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  plan                TEXT NOT NULL DEFAULT 'free',
  status              TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_user_idx ON public.subscriptions(user_id, status);
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER tg_subscriptions_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.razorpay_orders (
  order_id    TEXT PRIMARY KEY,           -- Razorpay order id (order_...)
  user_id     TEXT NOT NULL,
  plan        TEXT NOT NULL,
  amount      INTEGER NOT NULL,           -- paise, as sent to Razorpay
  status      TEXT NOT NULL DEFAULT 'created', -- created | completed
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX razorpay_orders_user_idx ON public.razorpay_orders(user_id, created_at DESC);
GRANT ALL ON public.razorpay_orders TO service_role;
ALTER TABLE public.razorpay_orders ENABLE ROW LEVEL SECURITY;
