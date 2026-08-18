alter table db_dash_widgets
  add column if not exists click_mode text not null default 'copy';
