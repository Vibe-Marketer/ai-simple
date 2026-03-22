-- Cabo speaking engagement lead capture
create table if not exists cabo_leads (
  id uuid default gen_random_uuid() primary key,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  source text default 'cabo-speaking',
  page_url text,
  user_agent text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table cabo_leads enable row level security;

-- Service role can do everything (API routes use service key)
create policy "Service role full access on cabo_leads"
  on cabo_leads
  for all
  using (true)
  with check (true);
