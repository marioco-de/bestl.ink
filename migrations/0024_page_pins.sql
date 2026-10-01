create table if not exists db_page_pin_visitors (
  resource_id text not null,
  email text not null,
  name text not null default '',
  color text not null,
  created_at timestamptz not null default now(),
  primary key (resource_id, email, name)
);

create table if not exists db_page_pins (
  id text primary key,
  tenant_id text not null,
  resource_id text not null,
  link_id text,
  email text not null,
  name text not null default '',
  color text not null,
  selector text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_page_pins_resource on db_page_pins(resource_id, created_at);
