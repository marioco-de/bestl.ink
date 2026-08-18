alter table db_dash_widgets
  add column if not exists color text not null default '';
