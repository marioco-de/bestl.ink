-- Multiple custom domains per workspace + tags on resources

create table if not exists db_tenant_domains (
  id text primary key,
  tenant_id text not null references db_tenants(id) on delete cascade,
  host text not null,
  connected boolean not null default false,
  tags text not null default '[]',
  created_at timestamptz not null default now()
);

create unique index if not exists idx_db_tenant_domains_host
  on db_tenant_domains (lower(host));

create index if not exists idx_db_tenant_domains_tenant
  on db_tenant_domains (tenant_id);

insert into db_tenant_domains (id, tenant_id, host, connected, tags)
select
  'tdom_' || replace(id, 'tenant_', ''),
  id,
  lower(custom_domain),
  coalesce(custom_domain_connected, false),
  '[]'
from db_tenants
where custom_domain is not null and trim(custom_domain) <> ''
on conflict do nothing;

alter table db_resources add column if not exists tags text not null default '[]';
alter table db_tags add column if not exists color text not null default '#64748b';
