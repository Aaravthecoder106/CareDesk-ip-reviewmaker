-- =============================================================================
-- 0006 — Razorpay orders (server-side order tracking)
--
-- Persists every Razorpay order BEFORE returning it to the client, so the
-- verify endpoint can bind the payment to what was actually purchased instead
-- of trusting a client-supplied plan string.
-- =============================================================================

CREATE TABLE public.razorpay_orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    TEXT UNIQUE NOT NULL,   -- Razorpay order id (e.g. order_xxx)
  user_id     TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan        TEXT NOT NULL,          -- Plan tier at time of order
  amount      INTEGER NOT NULL,       -- Amount in paise
  status      TEXT NOT NULL DEFAULT 'created', -- created | completed | failed | refunded
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.razorpay_orders TO authenticated;
GRANT ALL ON public.razorpay_orders TO service_role;

ALTER TABLE public.razorpay_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders read own" ON public.razorpay_orders
  FOR SELECT TO authenticated
  USING (public.clerk_user_id() = user_id);

CREATE INDEX razorpay_orders_user_idx ON public.razorpay_orders(user_id);
CREATE INDEX razorpay_orders_order_idx ON public.razorpay_orders(order_id);
CREATE INDEX razorpay_orders_status_idx ON public.razorpay_orders(status);

CREATE TRIGGER tg_razorpay_orders_updated BEFORE UPDATE ON public.razorpay_orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
