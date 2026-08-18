alter table db_tenants
  add column if not exists dash_user_buttons text not null default 'anywhere';

create table if not exists db_teams (
  id text primary key,
  tenant_id text not null references db_tenants(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists db_teams_tenant on db_teams (tenant_id);

create table if not exists db_team_members (
  id text primary key,
  team_id text not null references db_teams(id) on delete cascade,
  user_id text not null,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create table if not exists db_dash_sections (
  id text primary key,
  tenant_id text not null references db_tenants(id) on delete cascade,
  team_id text references db_teams(id) on delete cascade,
  user_id text,
  kind text not null,
  zone text not null,
  title text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists db_dash_sections_tenant on db_dash_sections (tenant_id);

create table if not exists db_dash_groups (
  id text primary key,
  section_id text not null references db_dash_sections(id) on delete cascade,
  title text not null default '',
  color text not null default '#64748b',
  x int not null default 0,
  y int not null default 0,
  w int not null default 4,
  h int not null default 3,
  created_at timestamptz not null default now()
);

create table if not exists db_dash_widgets (
  id text primary key,
  section_id text not null references db_dash_sections(id) on delete cascade,
  group_id text references db_dash_groups(id) on delete set null,
  short_id text,
  resource_id text,
  label text not null default '',
  display text not null default 'text',
  icon text not null default 'link',
  image_url text,
  show_clicks boolean not null default true,
  show_last_click boolean not null default false,
  x int not null default 0,
  y int not null default 0,
  w int not null default 2,
  h int not null default 2,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists db_dash_widgets_section on db_dash_widgets (section_id);
