alter table db_tenants
  add column if not exists bio jsonb not null default '{}'::jsonb;
