begin;

create table public.kansai_suggestions (
  id uuid primary key,
  name text not null,
  japanese text not null default '',
  city text not null check (city in ('京都', '大阪')),
  category text not null check (category in ('景點', '美食', '購物', '室內', '角色商店')),
  reason text not null,
  station text not null default '',
  booking text not null default '',
  official_url text not null default '',
  map_url text not null default '',
  submitted_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid,
  draft_id text references public.kansai_place_drafts(id),
  check (status <> 'accepted' or draft_id is not null)
);
create index kansai_suggestions_queue on public.kansai_suggestions (status, submitted_at desc);
create index kansai_suggestions_created on public.kansai_suggestions (submitted_at desc);

alter table public.kansai_suggestions enable row level security;
revoke all on public.kansai_suggestions from public, anon, authenticated;
grant select on public.kansai_suggestions to authenticated;
create policy kansai_editor_read_suggestions on public.kansai_suggestions
  for select to authenticated using ((select kansai_private.is_editor()));

grant usage on schema kansai_private to anon;

create function kansai_private.submit_suggestion(receipt uuid, payload jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  name_value text := pg_catalog.btrim(coalesce(payload->>'name', ''));
  jp_value text := pg_catalog.btrim(coalesce(payload->>'japanese', ''));
  city_value text := pg_catalog.btrim(coalesce(payload->>'city', ''));
  category_value text := pg_catalog.btrim(coalesce(payload->>'category', ''));
  reason_value text := pg_catalog.btrim(coalesce(payload->>'reason', ''));
  station_value text := pg_catalog.btrim(coalesce(payload->>'station', ''));
  booking_value text := pg_catalog.btrim(coalesce(payload->>'booking', ''));
  official_value text := pg_catalog.btrim(coalesce(payload->>'official_url', ''));
  map_value text := pg_catalog.btrim(coalesce(payload->>'map_url', ''));
begin
  if receipt is null or pg_catalog.jsonb_typeof(payload) is distinct from 'object'
    or pg_catalog.octet_length(payload::text) > 12000
    or pg_catalog.char_length(name_value) not between 2 and 120
    or pg_catalog.char_length(reason_value) not between 5 and 600
    or pg_catalog.char_length(jp_value) > 120 or pg_catalog.char_length(station_value) > 120
    or pg_catalog.char_length(booking_value) > 200
    or city_value not in ('京都', '大阪')
    or category_value not in ('景點', '美食', '購物', '室內', '角色商店')
    or (official_value = '' and map_value = '')
    or (official_value <> '' and (pg_catalog.char_length(official_value) > 350 or official_value !~ '^https://[^[:space:]]+$'))
    or (map_value <> '' and (pg_catalog.char_length(map_value) > 350 or map_value !~ '^https://[^[:space:]]+$'))
  then raise exception 'Invalid suggestion' using errcode = '22023'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('kansai_suggestions_submit')::bigint);
  if exists (select 1 from public.kansai_suggestions s where s.id = receipt) then return; end if;
  if exists (
    select 1 from public.kansai_suggestions s where s.submitted_at >= now() - interval '1 day'
      and s.city = city_value and pg_catalog.lower(s.name) = pg_catalog.lower(name_value)
      and pg_catalog.lower(s.reason) = pg_catalog.lower(reason_value)
  ) then return; end if;
  if (select count(*) from public.kansai_suggestions s where s.submitted_at >= now() - interval '1 minute') >= 60 then
    raise exception 'Submission queue is busy' using errcode = 'PT429';
  end if;

  insert into public.kansai_suggestions (id, name, japanese, city, category, reason, station, booking, official_url, map_url)
  values (receipt, name_value, jp_value, city_value, category_value, reason_value, station_value, booking_value, official_value, map_value);
end;
$$;
revoke all on function kansai_private.submit_suggestion(uuid,jsonb) from public;
grant execute on function kansai_private.submit_suggestion(uuid,jsonb) to anon, authenticated;

create function public.kansai_submit_suggestion(receipt uuid, payload jsonb) returns void
language sql security invoker set search_path = ''
as $$ select kansai_private.submit_suggestion(receipt, payload); $$;
revoke all on function public.kansai_submit_suggestion(uuid,jsonb) from public;
grant execute on function public.kansai_submit_suggestion(uuid,jsonb) to anon, authenticated;

create function kansai_private.review_suggestion(receipt uuid, decision text)
returns public.kansai_suggestions
language plpgsql security definer set search_path = ''
as $$
declare
  suggestion public.kansai_suggestions;
  destination text;
  draft public.kansai_place_drafts;
  content jsonb;
begin
  if not kansai_private.is_editor() then raise exception 'Editor access required' using errcode = '42501'; end if;
  if decision is null or decision not in ('accept', 'reject') then raise exception 'Invalid review decision' using errcode = '22023'; end if;
  select * into suggestion from public.kansai_suggestions where id = receipt for update;
  if suggestion.id is null then raise exception 'Suggestion not found' using errcode = '22023'; end if;
  if suggestion.status <> 'pending' then return suggestion; end if;

  if decision = 'accept' then
    destination := 'suggestion' || pg_catalog.translate(receipt::text, '-0123456789abcdef', 'zabcdefghijklmnop');
    content := jsonb_build_object(
      'fields', jsonb_build_array(suggestion.name, suggestion.japanese, suggestion.name, suggestion.station, '',
        suggestion.booking, suggestion.category, suggestion.official_url),
      'city', suggestion.city,
      'day', case when suggestion.city = '京都' then 1 else 3 end,
      'suggestion_note', suggestion.reason,
      'suggestion_map', suggestion.map_url
    );
    select * into draft from kansai_private.edit_place(destination, 'save', content, 0);
  end if;

  update public.kansai_suggestions
  set status = case when decision = 'accept' then 'accepted' else 'rejected' end,
      draft_id = draft.id, reviewed_at = now(), reviewed_by = (select auth.uid())
  where id = receipt returning * into suggestion;
  return suggestion;
end;
$$;
revoke all on function kansai_private.review_suggestion(uuid,text) from public;
grant execute on function kansai_private.review_suggestion(uuid,text) to authenticated;

create function public.kansai_review_suggestion(receipt uuid, decision text) returns public.kansai_suggestions
language sql security invoker set search_path = ''
as $$ select kansai_private.review_suggestion(receipt, decision); $$;
revoke all on function public.kansai_review_suggestion(uuid,text) from public, anon;
grant execute on function public.kansai_review_suggestion(uuid,text) to authenticated;

create function kansai_private.strip_moderation_fields() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  new.content := new.content - array['suggestion_note', 'suggestion_map'];
  return new;
end;
$$;
revoke all on function kansai_private.strip_moderation_fields() from public;
create trigger kansai_strip_moderation_fields
  before insert or update of content on public.kansai_places
  for each row execute function kansai_private.strip_moderation_fields();

commit;
