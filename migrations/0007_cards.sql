-- Events (.ics) and contacts (.vcf) as first-class resources

alter table db_resources drop constraint if exists db_resources_type_check;

alter table db_resources
  add constraint db_resources_type_check
  check (type in ('document', 'page', 'event', 'contact'));

alter table db_resources
  add column if not exists payload text not null default '{}';
