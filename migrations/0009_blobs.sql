-- Durable file blobs so uploads survive serverless instances

create table if not exists db_blobs (
  key text primary key,
  mime text not null default 'application/octet-stream',
  body text not null,
  byte_size integer not null default 0,
  created_at timestamptz not null default now()
);
