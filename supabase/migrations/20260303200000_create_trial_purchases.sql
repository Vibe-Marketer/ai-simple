-- Trial purchases table for tracking Stripe payment transactions
CREATE TABLE IF NOT EXISTS trial_purchases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text,
  name text,
  stripe_session_id text,
  stripe_customer_id text,
  stripe_payment_intent text,
  amount integer,
  currency text DEFAULT 'usd',
  status text,
  source text DEFAULT 'trial-page',
  crm_contact_id uuid REFERENCES crm_contacts(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE trial_purchases ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access
CREATE POLICY "Service role full access on trial_purchases"
  ON trial_purchases FOR ALL
  USING (true)
  WITH CHECK (true);
