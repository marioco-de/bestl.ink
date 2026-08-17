-- Permission groups (AppSumo tiers, monthly packages) + tenant admin fields

create table if not exists db_plans (
  id text primary key,
  name text not null,
  slug text not null unique,
  kind text not null default 'custom',
  description text not null default '',
  features text not null default '{}',
  created_at timestamptz not null default now()
);

alter table db_tenants add column if not exists plan_id text;
alter table db_tenants add column if not exists suspended boolean not null default false;
alter table db_tenants add column if not exists notes text not null default '';

create index if not exists idx_db_tenants_plan on db_tenants(plan_id);
