alter table db_nda_acceptances add column if not exists ip text not null default '';
alter table db_nda_acceptances add column if not exists user_agent text not null default '';
