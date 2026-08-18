create table if not exists db_activity (
  id text primary key,
  tenant_id text not null,
  short_id text,
  link_id text,
  event text not null,
  email text not null default '',
  country text not null default '',
  ip text not null default '',
  user_agent text not null default '',
  meta text not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists db_activity_short on db_activity (short_id, created_at desc);
create index if not exists db_activity_link on db_activity (link_id, created_at desc);
create index if not exists db_activity_tenant on db_activity (tenant_id, created_at desc);

create table if not exists db_presence (
  id text primary key,
  tenant_id text not null,
  short_id text,
  link_id text,
  email text not null default '',
  country text not null default '',
  open boolean not null default true,
  last_seen timestamptz not null default now(),
  unique (tenant_id, short_id, link_id, email)
);
create index if not exists db_presence_tenant on db_presence (tenant_id, last_seen desc);
