begin;

create schema if not exists kansai_private;
revoke all on schema kansai_private from public;
grant usage on schema kansai_private to authenticated;

create table kansai_private.editor_emails (
  email text primary key check (email = lower(btrim(email)))
);

create table public.kansai_place_drafts (
  id text primary key check (id ~ '^[a-z]{1,80}$'),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  status text not null check (status in ('draft', 'published', 'archived')),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

create table public.kansai_editor_log (
  id bigint generated always as identity primary key,
  place_id text not null references public.kansai_place_drafts(id),
  actor uuid not null,
  kind text not null check (kind in ('save', 'publish', 'archive', 'review')),
  changed_fields text[] not null default '{}',
  occurred_at timestamptz not null default now()
);
create index kansai_editor_log_place_idx on public.kansai_editor_log (place_id, id desc);

create function kansai_private.is_editor() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    join kansai_private.editor_emails e on e.email = pg_catalog.lower(u.email)
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
  );
$$;
revoke all on function kansai_private.is_editor() from public;
grant execute on function kansai_private.is_editor() to authenticated;

alter table public.kansai_place_drafts enable row level security;
alter table public.kansai_editor_log enable row level security;
revoke all on public.kansai_place_drafts, public.kansai_editor_log from public, anon, authenticated;
grant select on public.kansai_place_drafts, public.kansai_editor_log to authenticated;

create policy kansai_editor_read_drafts on public.kansai_place_drafts
  for select to authenticated using ((select kansai_private.is_editor()));
create policy kansai_editor_read_log on public.kansai_editor_log
  for select to authenticated using ((select kansai_private.is_editor()));

update public.kansai_places p
set content = p.content || jsonb_build_object(
  'lat', pin.lat, 'lng', pin.lng, 'checked_at', '2026-11-20',
  'day', pin.day, 'notice', pin.notice
)
from (values
  ('mogumogu', 34.9677, 135.7707, 1, 'https://www.chiikawamogumogu.jp/stores/fushimi/'),
  ('chikyoto', 35.004841, 135.769115, 2, 'https://www.kiddyland.co.jp/shoplist/kyoto_kawaramachi/'),
  ('chishinsaibashi', 34.673904, 135.500946, 3, 'https://shinsaibashi.parco.jp/shop/detail/?cd=028877'),
  ('chiumeda', 34.705586, 135.498367, 4, 'https://www.kiddyland.co.jp/etc/chiikawa_to_umeda/')
) as pin(id, lat, lng, day, notice)
where p.id = pin.id;

update public.kansai_places
set content = jsonb_set(content, '{fields,4}', to_jsonb('由心齋橋站前往 PARCO 6 樓。'::text))
where id = 'chishinsaibashi';

insert into public.kansai_place_drafts (id, content, status)
select id, content, 'published' from public.kansai_places;

create function public.kansai_editor_access() returns boolean
language sql stable security invoker set search_path = ''
as $$ select kansai_private.is_editor(); $$;
revoke all on function public.kansai_editor_access() from public, anon;
grant execute on function public.kansai_editor_access() to authenticated;

create function kansai_private.edit_place(place_key text, operation text, payload jsonb, expected_version integer)
returns public.kansai_place_drafts
language plpgsql security definer set search_path = ''
as $$
declare
  previous public.kansai_place_drafts;
  saved public.kansai_place_drafts;
  next_content jsonb;
  next_status text;
  changes text[];
begin
  if not kansai_private.is_editor() then raise exception 'Editor access required' using errcode = '42501'; end if;
  if place_key is null or place_key !~ '^[a-z]{1,80}$' or operation is null or operation not in ('save','publish','archive','review') then
    raise exception 'Invalid editor operation' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('kansai_place:' || place_key)::bigint);
  select * into previous from public.kansai_place_drafts where id = place_key;
  if expected_version is distinct from coalesce(previous.version, 0) then
    raise exception 'Version changed; reload the place' using errcode = '40001';
  end if;
  if previous.id is null and operation in ('archive','review') then
    raise exception 'Save this place first' using errcode = '22023';
  end if;

  next_content := case
    when operation = 'review' then pg_catalog.jsonb_set(previous.content, '{checked_at}', pg_catalog.to_jsonb((pg_catalog.timezone('Asia/Taipei', now()))::date::text))
    when operation = 'archive' then previous.content
    else payload
  end;
  if next_content is null or pg_catalog.jsonb_typeof(next_content) <> 'object' then
    raise exception 'Invalid place document' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(next_content->'fields') is distinct from 'array' then
    raise exception 'Invalid place fields' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(next_content->'fields') <> 8 then
    raise exception 'Invalid place fields' using errcode = '22023';
  end if;

  if operation = 'publish' and (
    exists (select 1 from pg_catalog.jsonb_array_elements(next_content->'fields') f where pg_catalog.jsonb_typeof(f) <> 'string')
    or nullif(btrim(next_content->'fields'->>0), '') is null
    or nullif(btrim(next_content->'fields'->>1), '') is null
    or nullif(btrim(next_content->'fields'->>2), '') is null
    or coalesce(next_content->'fields'->>7, '') !~ '^https://'
    or coalesce(next_content->>'day', '') !~ '^[1-4]$'
    or coalesce(next_content->'fields'->>6, '') not in ('景點','美食','購物','室內','角色商店')
  ) then raise exception 'Missing required publication fields' using errcode = '22023'; end if;

  next_status := case operation
    when 'publish' then 'published'
    when 'archive' then 'archived'
    when 'review' then case when previous.status = 'published' then 'published' else previous.status end
    else 'draft'
  end;

  insert into public.kansai_place_drafts (id, content, status)
  values (place_key, next_content, next_status)
  on conflict (id) do update
    set content = excluded.content, status = excluded.status,
      version = public.kansai_place_drafts.version + 1, updated_at = now()
  returning * into saved;

  if operation = 'publish' or (operation = 'review' and previous.status = 'published') then
    insert into public.kansai_places (id, content) values (place_key, next_content)
      on conflict (id) do update set content = excluded.content;
  elsif operation = 'archive' then
    delete from public.kansai_places where id = place_key;
  end if;

  select coalesce(array_agg(key order by key), array[]::text[]) into changes
  from (
    select key from pg_catalog.jsonb_object_keys(coalesce(previous.content, '{}'::jsonb) || next_content) as keys(key)
    where key <> 'fields' and (previous.content -> key) is distinct from (next_content -> key)
    union
    select label
    from unnest(array['name','japanese','map','station','access','booking','category','source']) with ordinality as f(label, n)
    where (previous.content->'fields'->((n-1)::integer)) is distinct from (next_content->'fields'->((n-1)::integer))
  ) as changes_found(key);

  insert into public.kansai_editor_log (place_id, actor, kind, changed_fields)
  values (place_key, (select auth.uid()), operation, changes);
  return saved;
end;
$$;
revoke all on function kansai_private.edit_place(text,text,jsonb,integer) from public;
grant execute on function kansai_private.edit_place(text,text,jsonb,integer) to authenticated;

create function public.kansai_edit_place(place_key text, operation text, payload jsonb, expected_version integer)
returns public.kansai_place_drafts
language sql security invoker set search_path = ''
as $$ select kansai_private.edit_place(place_key, operation, payload, expected_version); $$;
revoke all on function public.kansai_edit_place(text,text,jsonb,integer) from public, anon;
grant execute on function public.kansai_edit_place(text,text,jsonb,integer) to authenticated;

commit;
