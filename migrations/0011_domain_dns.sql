alter table db_tenant_domains
  add column if not exists dns_ok boolean not null default false;
