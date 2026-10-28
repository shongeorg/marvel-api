create extension if not exists pg_trgm;

create table if not exists entities (
  kind        text        not null,
  id          bigint      not null,
  slug        text        not null,
  name        text        not null,
  description text,
  thumbnail   jsonb,
  modified    timestamptz,
  source_url  text        not null,
  data        jsonb       not null,
  updated_at  timestamptz not null default now(),
  primary key (kind, id)
);

create index if not exists entities_kind_name_idx on entities (kind, lower(name), id);
create index if not exists entities_name_trgm_idx on entities using gin (lower(name) gin_trgm_ops);
