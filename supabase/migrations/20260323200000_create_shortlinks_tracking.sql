-- Shortlinks table
create table if not exists shortlinks (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  destination_url text not null,
  label text,
  campaign text,
  is_active boolean default true,
  created_at timestamptz default now(),
  total_clicks integer default 0
);

create index if not exists idx_shortlinks_slug on shortlinks(slug);
create index if not exists idx_shortlinks_active on shortlinks(is_active);

-- Link clicks table
create table if not exists link_clicks (
  id uuid primary key default gen_random_uuid(),
  shortlink_id uuid references shortlinks(id),
  slug text not null,
  clicked_at timestamptz default now(),
  email text,
  source text,
  campaign_id text,
  message_id text,
  content_type text,
  referrer_person text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  ip_address text,
  city text,
  region text,
  country text,
  user_agent text,
  device_type text,
  os text,
  browser text,
  referrer_url text,
  is_first_click boolean,
  contact_id uuid references contacts(id)
);

create index if not exists idx_link_clicks_slug on link_clicks(slug);
create index if not exists idx_link_clicks_email on link_clicks(email);
create index if not exists idx_link_clicks_clicked_at on link_clicks(clicked_at desc);
create index if not exists idx_link_clicks_shortlink on link_clicks(shortlink_id);

-- Enable RLS
alter table shortlinks enable row level security;
create policy "Service role full access on shortlinks"
  on shortlinks for all using (true) with check (true);

alter table link_clicks enable row level security;
create policy "Service role full access on link_clicks"
  on link_clicks for all using (true) with check (true);

-- Auto-increment total_clicks trigger
create or replace function increment_shortlink_clicks()
returns trigger as $$
begin
  update shortlinks set total_clicks = total_clicks + 1 where id = new.shortlink_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_link_click on link_clicks;
create trigger on_link_click
  after insert on link_clicks
  for each row execute function increment_shortlink_clicks();
