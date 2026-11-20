begin;

create or replace function kansai_private.submit_suggestion(receipt uuid, payload jsonb) returns void
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
  publish_choice boolean := (payload->'consent_to_publish') is not distinct from 'true'::jsonb;
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
      and s.consent_to_publish = publish_choice
      and s.city = city_value and pg_catalog.lower(s.name) = pg_catalog.lower(name_value)
      and pg_catalog.lower(s.reason) = pg_catalog.lower(reason_value)
  ) then return; end if;
  if (select count(*) from public.kansai_suggestions s where s.submitted_at >= now() - interval '1 minute') >= 60 then
    raise exception 'Submission queue is busy' using errcode = 'PT429';
  end if;

  insert into public.kansai_suggestions (id, name, japanese, city, category, reason, station, booking, official_url, map_url, consent_to_publish)
  values (receipt, name_value, jp_value, city_value, category_value, reason_value, station_value, booking_value, official_value, map_value, publish_choice);
end;
$$;
commit;
