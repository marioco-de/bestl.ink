alter table db_tenant_domains
  add column if not exists sort_order integer not null default 0;

update db_tenant_domains d
set sort_order = sub.n
from (
  select id, (row_number() over (partition by tenant_id order by created_at asc) - 1) as n
  from db_tenant_domains
) sub
where d.id = sub.id and d.sort_order = 0;
