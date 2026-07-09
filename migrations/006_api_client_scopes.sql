alter table api_client
  add column if not exists scopes text[] not null default array['read:public'];
