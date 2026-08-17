-- Hashport schema: gated docs/pages with attribution tokens

create table if not exists hp_settings (
  id text primary key default 'default',
  company_name text not null default 'Muster GmbH',
  domain text not null default 'docs.muster-gmbh.de',
  domain_connected boolean not null default true,
  brand_color text not null default '#1a5f4a',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hp_resources (
  id text primary key,
  type text not null check (type in ('document', 'page')),
  title text not null,
  slug text not null unique,
  description text not null default '',
  -- document: base64 content or external url; page: target url to iframe
  content_url text,
  content_base64 text,
  mime_type text,
  file_name text,
  file_size integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hp_param_nodes (
  id text primary key,
  parent_id text references hp_param_nodes(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('folder', 'button')),
  show_on_home boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists hp_tags (
  id text primary key,
  name text not null unique,
  color text not null default '#64748b',
  created_at timestamptz not null default now()
);

create table if not exists hp_utm_presets (
  id text primary key,
  name text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  created_at timestamptz not null default now()
);

create table if not exists hp_links (
  id text primary key,
  token text not null unique,
  resource_id text not null references hp_resources(id) on delete cascade,
  button_id text not null references hp_param_nodes(id) on delete cascade,
  note text not null default '',
  tags text not null default '[]',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  click_count integer not null default 0,
  last_clicked_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists hp_clicks (
  id text primary key,
  link_id text not null references hp_links(id) on delete cascade,
  user_agent text,
  referer text,
  created_at timestamptz not null default now()
);

create table if not exists hp_access_requests (
  id text primary key,
  resource_id text not null references hp_resources(id) on delete cascade,
  email text not null,
  phone text,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists idx_hp_resources_slug on hp_resources(slug);
create index if not exists idx_hp_links_token on hp_links(token);
create index if not exists idx_hp_links_button on hp_links(button_id);
create index if not exists idx_hp_param_parent on hp_param_nodes(parent_id);
