create table if not exists db_doc_actions (
  id text primary key,
  tenant_id text not null,
  resource_id text not null,
  link_id text,
  kind text not null,
  visitor text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists db_doc_actions_res on db_doc_actions (resource_id, created_at desc);
