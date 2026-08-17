-- docBAY multi-tenant SaaS schema

create table if not exists db_profiles (
  user_id text primary key,
  email text not null,
  name text not null default '',
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists db_tenants (
  id text primary key,
  name text not null,
  slug text not null unique,
  domain text not null default '',
  domain_connected boolean not null default false,
  is_demo boolean not null default false,
  demo_reset_at timestamptz,
  brand_logo_url text,
  brand_color text not null default '#1a5f4a',
  brand_company text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists db_tenant_members (
  id text primary key,
  tenant_id text not null references db_tenants(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('owner', 'admin', 'member')),
  param_button_id text,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists db_features (
  tenant_id text not null references db_tenants(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default false,
  primary key (tenant_id, feature_key)
);

create table if not exists db_resources (
  id text primary key,
  tenant_id text not null references db_tenants(id) on delete cascade,
  type text not null check (type in ('document', 'page')),
  title text not null,
  slug text not null,
  description text not null default '',
  content_url text,
  content_base64 text,
  mime_type text,
  file_name text,
  file_size integer,
  allow_download boolean not null default true,
  require_nda boolean not null default false,
  nda_text text not null default 'Ich akzeptiere die Vertraulichkeitsvereinbarung und werde den Inhalt nicht unbefugt weitergeben.',
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table if not exists db_param_nodes (
  id text primary key,
  tenant_id text not null references db_tenants(id) on delete cascade,
  parent_id text,
  name text not null,
  kind text not null check (kind in ('folder', 'button')),
  show_on_home boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists db_tags (
  id text primary key,
  tenant_id text not null references db_tenants(id) on delete cascade,
  name text not null,
  color text not null default '#64748b',
  unique (tenant_id, name)
);

create table if not exists db_utm_presets (
  id text primary key,
  tenant_id text not null references db_tenants(id) on delete cascade,
  name text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text
);

create table if not exists db_links (
  id text primary key,
  tenant_id text not null references db_tenants(id) on delete cascade,
  token text not null unique,
  resource_id text not null references db_resources(id) on delete cascade,
  button_id text not null,
  created_by text,
  note text not null default '',
  tags text not null default '[]',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  click_count integer not null default 0,
  human_click_count integer not null default 0,
  last_clicked_at timestamptz,
  revoked boolean not null default false,
  expires_at timestamptz,
  one_time boolean not null default false,
  used_at timestamptz,
  password_hash text,
  allow_download boolean,
  require_nda boolean,
  created_at timestamptz not null default now()
);

create table if not exists db_clicks (
  id text primary key,
  link_id text not null references db_links(id) on delete cascade,
  tenant_id text not null,
  is_bot boolean not null default false,
  user_agent text,
  ip_hash text,
  referer text,
  created_at timestamptz not null default now()
);

create table if not exists db_view_events (
  id text primary key,
  link_id text not null references db_links(id) on delete cascade,
  tenant_id text not null,
  page integer not null default 1,
  duration_ms integer not null default 0,
  scroll_pct integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists db_access_requests (
  id text primary key,
  tenant_id text not null references db_tenants(id) on delete cascade,
  resource_id text not null references db_resources(id) on delete cascade,
  email text not null,
  phone text,
  message text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists db_chat_messages (
  id text primary key,
  tenant_id text not null,
  resource_id text not null,
  link_id text,
  visitor_key text,
  sender_type text not null check (sender_type in ('visitor', 'staff')),
  sender_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists db_email_settings (
  tenant_id text primary key references db_tenants(id) on delete cascade,
  provider text not null default 'none' check (provider in ('none', 'emailit_platform', 'emailit_custom', 'smtp')),
  emailit_api_key text,
  smtp_host text,
  smtp_port integer,
  smtp_user text,
  smtp_pass text,
  smtp_secure boolean not null default true,
  from_email text,
  from_name text,
  updated_at timestamptz not null default now()
);

create table if not exists db_email_templates (
  id text primary key,
  tenant_id text not null references db_tenants(id) on delete cascade,
  kind text not null check (kind in ('access_approved', 'click_notify')),
  subject text not null,
  body_html text not null,
  unique (tenant_id, kind)
);

create table if not exists db_webhooks (
  id text primary key,
  tenant_id text not null references db_tenants(id) on delete cascade,
  url text not null,
  events text not null default '["click","access_request","access_approved"]',
  secret text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists db_audit_log (
  id text primary key,
  tenant_id text,
  user_id text,
  action text not null,
  meta text not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists db_notifications (
  id text primary key,
  tenant_id text not null,
  user_id text not null,
  title text not null,
  body text not null default '',
  href text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists db_nda_acceptances (
  id text primary key,
  link_id text not null,
  email text not null,
  accepted_at timestamptz not null default now()
);

create table if not exists db_offline_queue (
  id text primary key,
  tenant_id text not null,
  user_id text not null,
  payload text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_db_links_token on db_links(token);
create index if not exists idx_db_resources_tenant_slug on db_resources(tenant_id, slug);
create index if not exists idx_db_members_user on db_tenant_members(user_id);
create index if not exists idx_db_clicks_link on db_clicks(link_id);
create index if not exists idx_db_chat_resource on db_chat_messages(resource_id);
