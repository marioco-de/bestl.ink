alter table db_tenants
  add column if not exists splash jsonb not null default '{}'::jsonb;
