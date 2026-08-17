-- Per-workspace hostnames: platform subdomain + optional custom domain

alter table db_tenants add column if not exists subdomain text;
alter table db_tenants add column if not exists custom_domain text;
alter table db_tenants add column if not exists custom_domain_connected boolean not null default false;

-- Backfill subdomain from slug where empty
update db_tenants set subdomain = slug where subdomain is null or subdomain = '';

create unique index if not exists idx_db_tenants_subdomain
  on db_tenants (subdomain) where subdomain is not null and subdomain <> '';

create unique index if not exists idx_db_tenants_custom_domain
  on db_tenants (lower(custom_domain)) where custom_domain is not null and custom_domain <> '';
