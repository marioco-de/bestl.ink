alter table db_links add column if not exists assigned_email text;
alter table db_links add column if not exists assigned_name text;
alter table db_links add column if not exists allow_identity_edit boolean not null default true;
alter table db_nda_acceptances add column if not exists name text;
