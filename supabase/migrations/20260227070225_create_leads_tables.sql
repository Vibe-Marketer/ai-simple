-- Create leads table (for MBA, employee-setup, and other general lead forms)
CREATE TABLE IF NOT EXISTS leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  business text,
  website text,
  revenue text,
  channel text,
  help_wanted text,
  source text DEFAULT 'lead-magnet-page',
  page_url text,
  user_agent text,
  investment_readiness text,
  qualified boolean,
  submitted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create cre_leads table (for CRE partnership form)
CREATE TABLE IF NOT EXISTS cre_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  mobile text,
  workshop boolean DEFAULT false,
  resources boolean DEFAULT false,
  microtraining boolean DEFAULT false,
  intro_to_andrew boolean DEFAULT false,
  source text DEFAULT 'cre-partnership',
  page_url text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS but allow service_role to bypass
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE cre_leads ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (API uses service_role key)
CREATE POLICY "Service role full access on leads"
  ON leads FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on cre_leads"
  ON cre_leads FOR ALL
  USING (true)
  WITH CHECK (true);
