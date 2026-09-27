create extension if not exists pgcrypto;

create table if not exists public.operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.operators enable row level security;
drop policy if exists "Read own operator membership" on public.operators;
create policy "Read own operator membership" on public.operators for select to authenticated using (user_id = auth.uid());
create or replace function public.sentinel_is_operator() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.operators where user_id = auth.uid());
$$;
revoke all on function public.sentinel_is_operator() from public;
grant execute on function public.sentinel_is_operator() to authenticated;

create table if not exists public.registered_vehicles (
  vehicle_id uuid primary key default gen_random_uuid(),
  plate_number text not null unique check (plate_number ~ '^[A-Z0-9]{5,12}$' and plate_number ~ '[A-Z]' and plate_number ~ '[0-9]'),
  owner_name text not null check (length(trim(owner_name)) between 2 and 100),
  vehicle_type text not null check (vehicle_type in ('Car','Motorcycle','Truck','Bus','Other')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','BLOCKED','EXPIRED')),
  created_at timestamptz not null default now()
);
create index if not exists vehicles_status_idx on public.registered_vehicles(status);
alter table public.registered_vehicles enable row level security;
drop policy if exists "Operators manage registry" on public.registered_vehicles;
create policy "Operators manage registry" on public.registered_vehicles for all to authenticated using (public.sentinel_is_operator()) with check (public.sentinel_is_operator());

create table if not exists public.system_settings (
  id boolean primary key default true check(id),
  similarity_threshold integer not null default 60 check (similarity_threshold between 1 and 100),
  ocr_confidence_threshold integer not null default 80 check (ocr_confidence_threshold between 1 and 100),
  updated_at timestamptz not null default now()
);
insert into public.system_settings(id) values(true) on conflict(id) do nothing;
alter table public.system_settings enable row level security;
drop policy if exists "Operators read settings" on public.system_settings;
drop policy if exists "Operators change settings" on public.system_settings;
create policy "Operators read settings" on public.system_settings for select to authenticated using (public.sentinel_is_operator());
create policy "Operators change settings" on public.system_settings for update to authenticated using (public.sentinel_is_operator()) with check (public.sentinel_is_operator());

create table if not exists public.incident_log (
  log_id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  operator_id uuid references auth.users(id) on delete set null,
  detected_text text not null check (length(detected_text) <= 4000),
  detected_plate text not null,
  matched_plate text,
  vehicle_status text check (vehicle_status in ('ACTIVE','BLOCKED','EXPIRED')),
  similarity_score double precision not null check (similarity_score between 0 and 100),
  edit_distance integer,
  threshold integer not null check (threshold between 1 and 100),
  risk_level text not null check (risk_level in ('LOW','MEDIUM','HIGH')),
  risk_reasons jsonb not null default '[]',
  decision text not null check (decision in ('GRANTED','DENIED')),
  reason text not null,
  source text not null check (source in ('MANUAL','TESSERACT','GEMINI_VISION')),
  ocr_confidence double precision check (ocr_confidence between 0 and 100),
  previous_incident_count integer not null default 0,
  previous_denied_count integer not null default 0,
  image_path text,
  image_format text,
  ai_summary text,
  ai_status text not null default 'pending' check (ai_status in ('pending','complete','unavailable')),
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists incidents_created_idx on public.incident_log(created_at desc);
create index if not exists incidents_plate_recent_idx on public.incident_log(detected_plate, created_at desc);
create index if not exists incidents_decision_idx on public.incident_log(decision);
create index if not exists incidents_risk_idx on public.incident_log(risk_level);
alter table public.incident_log enable row level security;
drop policy if exists "Operators read incidents" on public.incident_log;
create policy "Operators read incidents" on public.incident_log for select to authenticated using (public.sentinel_is_operator());
-- No client INSERT/UPDATE policy: only authenticated Edge Functions using the service role log decisions.

create table if not exists public.request_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  requests integer not null,
  primary key(user_id, action, window_start)
);
alter table public.request_limits enable row level security;
create or replace function public.sentinel_consume_request(p_user uuid, p_action text, p_limit integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.request_limits where window_start < now() - interval '1 day';
  insert into public.request_limits(user_id,action,window_start,requests)
    values(p_user,p_action,date_trunc('minute',now()),1)
    on conflict(user_id,action,window_start) do update set requests=public.request_limits.requests+1
    returning requests into n;
  return n <= p_limit;
end; $$;
revoke all on function public.sentinel_consume_request(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.sentinel_consume_request(uuid,text,integer) to service_role;

create or replace function public.sentinel_dashboard_stats() returns jsonb language sql stable security invoker set search_path = '' as $$
select jsonb_build_object(
  'vehicles', (select count(*) from public.registered_vehicles),
  'scans', count(*), 'granted', count(*) filter(where decision='GRANTED'),
  'denied', count(*) filter(where decision='DENIED'),
  'high', count(*) filter(where risk_level='HIGH'),
  'medium', count(*) filter(where risk_level='MEDIUM'),
  'low', count(*) filter(where risk_level='LOW'),
  'average', coalesce(avg(similarity_score),0),
  'samples', count(*) filter(where is_sample)
) from public.incident_log;
$$;
revoke all on function public.sentinel_dashboard_stats() from public;
grant execute on function public.sentinel_dashboard_stats() to authenticated;
create or replace function public.sentinel_daily_scans() returns table(day date, scans bigint, granted bigint, denied bigint)
language sql stable security invoker set search_path = '' as $$
  select d.day::date, count(i.log_id), count(i.log_id) filter(where i.decision='GRANTED'), count(i.log_id) filter(where i.decision='DENIED')
  from generate_series((now() at time zone 'UTC')::date - 6, (now() at time zone 'UTC')::date, interval '1 day') d(day)
  left join public.incident_log i on (i.created_at at time zone 'UTC')::date=d.day::date
  group by d.day order by d.day;
$$;
revoke all on function public.sentinel_daily_scans() from public;
grant execute on function public.sentinel_daily_scans() to authenticated;

-- Images use Cloudinary authenticated assets; only public IDs/formats are stored here.

-- Explicit grants, in addition to RLS, keep access predictable across projects.
revoke all on public.operators, public.registered_vehicles, public.system_settings, public.incident_log, public.request_limits from anon;
revoke all on public.operators, public.registered_vehicles, public.system_settings, public.incident_log, public.request_limits from authenticated;
grant select on public.operators, public.incident_log to authenticated;
grant select, insert, update, delete on public.registered_vehicles to authenticated;
grant select, update on public.system_settings to authenticated;
grant all on public.operators, public.registered_vehicles, public.system_settings, public.incident_log, public.request_limits to service_role;
