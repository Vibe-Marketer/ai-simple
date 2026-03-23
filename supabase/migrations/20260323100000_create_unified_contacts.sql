-- Unified contacts table — single source of truth for all leads
create table if not exists contacts (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Identity
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,

  -- Business info
  business text,
  website text,
  revenue text,

  -- Source tracking
  source text not null default 'unknown',        -- cabo-speaking, cre-partnership, mba-lead-magnet, manual-enrichment, etc.
  source_detail text,                              -- page_url or additional context
  channel text,                                    -- organic-social, paid, referral, etc.

  -- Stage & qualification
  stage text not null default 'new' check (stage in ('new', 'enriched', 'contacted', 'qualified', 'booked', 'client', 'lost')),
  qualified boolean default false,
  investment_readiness text,
  help_wanted text,

  -- Enrichment data (denormalized from lead_enrichments for quick access)
  confidence_score integer check (confidence_score >= 0 and confidence_score <= 100),
  email_valid boolean,
  email_provider text,
  phone_valid boolean,
  phone_type text,
  domain text,
  domain_has_website boolean,

  -- Calendly / booking
  calendly_booked boolean default false,
  calendly_booked_at timestamptz,

  -- Purchase
  has_purchased boolean default false,
  purchase_amount integer,

  -- CRE-specific flags
  cre_workshop boolean default false,
  cre_resources boolean default false,
  cre_microtraining boolean default false,
  cre_intro_to_andrew boolean default false,

  -- Metadata
  user_agent text,
  original_table text,                             -- which table this was migrated from
  original_id uuid,                                -- original row ID for reference
  notes text,
  tags text[] default '{}',

  -- Dedupe
  unique(email, source)
);

-- Indexes
create index idx_contacts_email on contacts(email);
create index idx_contacts_stage on contacts(stage);
create index idx_contacts_source on contacts(source);
create index idx_contacts_confidence on contacts(confidence_score desc nulls last);
create index idx_contacts_created on contacts(created_at desc);

-- Enable RLS
alter table contacts enable row level security;
create policy "Service role full access on contacts"
  on contacts for all using (true) with check (true);

-- Auto-update updated_at
create or replace function update_contacts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger contacts_updated_at
  before update on contacts
  for each row execute function update_contacts_updated_at();

-- ─── MIGRATE EXISTING DATA ───────────────────────────────────────────────────

-- Import from leads table
insert into contacts (
  first_name, last_name, email, phone, business, website, revenue,
  source, channel, help_wanted, investment_readiness, qualified,
  calendly_booked, calendly_booked_at, user_agent, source_detail,
  original_table, original_id, created_at
)
select
  split_part(name, ' ', 1) as first_name,
  case
    when position(' ' in name) > 0 then substring(name from position(' ' in name) + 1)
    else ''
  end as last_name,
  email, phone, business, website, revenue,
  coalesce(source, 'mba-lead-magnet'), channel, help_wanted, investment_readiness, qualified,
  calendly_booked, calendly_booked_at, user_agent, page_url,
  'leads', id, created_at
from leads
where email != 'keytest-lead@example.com'
on conflict (email, source) do nothing;

-- Import from cabo_leads
insert into contacts (
  first_name, last_name, email, phone,
  source, user_agent, source_detail,
  original_table, original_id, created_at
)
select
  first_name, last_name, email, phone,
  'cabo-speaking', user_agent, page_url,
  'cabo_leads', id, created_at
from cabo_leads
on conflict (email, source) do nothing;

-- Import from cre_leads
insert into contacts (
  first_name, last_name, email, phone,
  source, user_agent, source_detail,
  cre_workshop, cre_resources, cre_microtraining, cre_intro_to_andrew,
  original_table, original_id, created_at
)
select
  first_name, last_name, email, mobile,
  'cre-partnership', user_agent, page_url,
  workshop, resources, microtraining, intro_to_andrew,
  'cre_leads', id, created_at
from cre_leads
on conflict (email, source) do nothing;

-- Backfill enrichment data from lead_enrichments
update contacts c
set
  confidence_score = e.confidence_score,
  email_valid = e.email_valid,
  email_provider = e.email_mx_provider,
  phone_valid = e.phone_valid,
  phone_type = e.phone_type,
  domain = e.domain,
  domain_has_website = e.domain_has_website,
  stage = case when e.confidence_score is not null then 'enriched' else c.stage end
from lead_enrichments e
where c.original_table = e.lead_table
  and c.original_id = e.lead_id;
