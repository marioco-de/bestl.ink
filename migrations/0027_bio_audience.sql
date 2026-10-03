create table if not exists db_bio_leads (
  id text primary key,
  tenant_id text not null,
  card_slug text not null default '',
  kind text not null,
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  message text not null default '',
  when_text text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists db_bio_leads_tenant_idx on db_bio_leads (tenant_id, created_at desc);

create table if not exists db_bio_hits (
  id text primary key,
  tenant_id text not null,
  card_slug text not null default '',
  link_id text not null default '',
  event text not null,
  country text not null default '',
  device text not null default '',
  referrer text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists db_bio_hits_tenant_idx on db_bio_hits (tenant_id, created_at desc);
