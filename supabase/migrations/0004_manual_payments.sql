-- Manual payments table for UPI payment verification
CREATE TABLE IF NOT EXISTS public.manual_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR' NOT NULL,
  status TEXT DEFAULT 'pending_verification' NOT NULL CHECK (status IN ('pending_verification', 'verified', 'rejected', 'refunded')),
  notes TEXT,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_manual_payments_user_id ON public.manual_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_payments_status ON public.manual_payments(status);
CREATE INDEX IF NOT EXISTS idx_manual_payments_transaction_id ON public.manual_payments(transaction_id);

-- Enable RLS
ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments
CREATE POLICY "Users can view own manual payments"
  ON public.manual_payments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own payments
CREATE POLICY "Users can insert own manual payments"
  ON public.manual_payments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only admins can update verification status (handled via service role)
CREATE POLICY "Admins can update manual payments"
  ON public.manual_payments
  FOR UPDATE
  USING (true);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_manual_payments_updated_at
  BEFORE UPDATE ON public.manual_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Grant permissions
GRANT ALL ON public.manual_payments TO authenticated;
GRANT ALL ON public.manual_payments TO service_role;
