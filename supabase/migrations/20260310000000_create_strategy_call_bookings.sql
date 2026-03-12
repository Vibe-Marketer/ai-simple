-- Strategy call bookings from Calendly webhooks
CREATE TABLE IF NOT EXISTS strategy_call_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL, -- 'invitee.created' or 'invitee.canceled'
  invitee_name TEXT,
  invitee_email TEXT,
  event_start_time TIMESTAMPTZ,
  event_end_time TIMESTAMPTZ,
  calendly_event_uri TEXT,
  calendly_invitee_uri TEXT UNIQUE,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  cancel_reason TEXT,
  status TEXT DEFAULT 'booked',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add calendly tracking columns to leads table if they don't exist
ALTER TABLE leads ADD COLUMN IF NOT EXISTS calendly_booked BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS calendly_booked_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualified BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS investment_readiness TEXT;

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_strategy_call_bookings_email ON strategy_call_bookings(invitee_email);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_qualified ON leads(qualified);

-- Row Level Security
ALTER TABLE strategy_call_bookings ENABLE ROW LEVEL SECURITY;
-- Only service role can access
CREATE POLICY "Service role only" ON strategy_call_bookings
  USING (false)
  WITH CHECK (false);
