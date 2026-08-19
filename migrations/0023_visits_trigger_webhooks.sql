alter table db_short_visits add column if not exists trigger text not null default 'link';
alter table db_clicks add column if not exists trigger text not null default 'link';

create table if not exists db_webhook_deliveries (
  id text primary key,
  webhook_id text not null references db_webhooks(id) on delete cascade,
  tenant_id text not null,
  event text not null,
  payload text not null default '{}',
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text not null default '',
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index if not exists idx_wh_deliveries_hook
  on db_webhook_deliveries(webhook_id, created_at desc);
create index if not exists idx_wh_deliveries_retry
  on db_webhook_deliveries(tenant_id, next_retry_at)
  where status <> 'ok';
