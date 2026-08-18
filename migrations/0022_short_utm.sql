alter table db_short_links add column if not exists utm_term text;
alter table db_short_links add column if not exists utm_content text;
alter table db_short_links add column if not exists utm_extra text not null default '{}';
