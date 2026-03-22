-- Lead enrichment & verification results
create table if not exists lead_enrichments (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid not null,
  lead_table text not null check (lead_table in ('leads', 'cabo_leads', 'cre_leads')),
  email text not null,

  -- Email signals
  email_valid boolean,
  email_mx_provider text,
  email_is_disposable boolean,
  email_is_catchall boolean,
  email_smtp_verified boolean,

  -- Phone signals
  phone_valid boolean,
  phone_type text,
  phone_country text,
  phone_formatted text,

  -- Domain signals
  domain text,
  domain_has_website boolean,
  domain_tech_stack jsonb default '{}',
  domain_schema_org jsonb default '{}',
  domain_social_links jsonb default '{}',
  domain_mx_provider text,
  domain_hosting_provider text,

  -- Social signals
  gravatar_exists boolean,
  gravatar_url text,
  platforms_found jsonb default '[]',

  -- Confidence scoring
  confidence_score integer check (confidence_score >= 0 and confidence_score <= 100),
  confidence_breakdown jsonb default '{}',

  -- Metadata
  enriched_at timestamptz default now(),
  enrichment_duration_ms integer,
  errors jsonb default '[]',

  unique(lead_table, lead_id)
);

-- Indexes
create index idx_lead_enrichments_lookup on lead_enrichments(lead_table, lead_id);
create index idx_lead_enrichments_score on lead_enrichments(confidence_score desc);

-- Enable RLS
alter table lead_enrichments enable row level security;

-- Service role can do everything
create policy "Service role full access on lead_enrichments"
  on lead_enrichments
  for all
  using (true)
  with check (true);
