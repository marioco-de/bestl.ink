-- Branded short links (Dub / Kutt / Shlink / YOURLS style)

create table if not exists db_short_links (
  id text primary key,
  tenant_id text not null references db_tenants(id) on delete cascade,
  slug text not null,
  destination text not null,
  title text not null default '',
  note text not null default '',
  tags text not null default '[]',
  password_hash text,
  expires_at timestamptz,
  max_clicks integer,
  disabled boolean not null default false,
  cloak boolean not null default false,
  ios_url text,
  android_url text,
  geo_rules text not null default '{}',
  og_title text,
  og_description text,
  og_image text,
  button_id text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  click_count integer not null default 0,
  human_click_count integer not null default 0,
  last_clicked_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create index if not exists idx_shorts_tenant on db_short_links(tenant_id, created_at desc);
create index if not exists idx_shorts_slug on db_short_links(slug);

create table if not exists db_short_visits (
  id text primary key,
  short_id text not null references db_short_links(id) on delete cascade,
  tenant_id text not null,
  is_bot boolean not null default false,
  device text not null default '',
  os text not null default '',
  browser text not null default '',
  country text not null default '',
  referrer text not null default '',
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_short_visits_short on db_short_visits(short_id, created_at desc);

create table if not exists db_api_keys (
  id text primary key,
  tenant_id text not null references db_tenants(id) on delete cascade,
  name text not null,
  prefix text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);
