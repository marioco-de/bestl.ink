create table if not exists db_chat_threads (
  tenant_id text not null,
  resource_id text not null,
  visitor_key text not null default '',
  priority text not null default 'none',
  assigned_to text,
  status text not null default 'open',
  tags jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (resource_id, visitor_key)
);
