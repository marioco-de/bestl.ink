create table if not exists db_nda_templates (
  id text primary key,
  tenant_id text not null,
  title text not null,
  body text not null default '',
  content_url text,
  file_name text,
  mime_type text,
  created_at timestamptz not null default now()
);
create index if not exists db_nda_templates_tenant on db_nda_templates (tenant_id);

alter table db_links add column if not exists nda_template_id text;
