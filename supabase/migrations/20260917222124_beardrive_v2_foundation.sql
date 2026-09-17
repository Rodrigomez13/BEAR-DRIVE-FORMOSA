-- BearDrive v2: isolated development foundation. Not a Base44 data import.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions;
create schema if not exists api;
create schema if not exists private;
create schema if not exists automation;
create schema if not exists migration;
revoke all on schema private, automation, migration from public, anon, authenticated;
revoke create on schema public from public, anon, authenticated;
grant usage on schema api to authenticated, service_role;
grant usage on schema private to service_role;
alter default privileges in schema api revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;

create table public.profiles (
 id uuid primary key references auth.users(id), display_name text not null default '', created_at timestamptz not null default now()
);
create table private.user_roles (
 user_id uuid references public.profiles(id), role text not null check(role in ('support','operations','finance','safety','analyst','admin')), primary key(user_id,role)
);
create table public.driver_profiles (
 user_id uuid primary key references public.profiles(id), status text not null default 'pending' check(status in ('pending','approved','suspended')), documents_valid_until timestamptz
);
create table public.vehicles (
 id uuid primary key default gen_random_uuid(), driver_id uuid not null references public.driver_profiles(user_id), category text not null check(category in ('basic','flash','premium')), status text not null default 'pending' check(status in ('pending','approved','suspended')), documents_valid_until timestamptz
);
create table public.driver_presence (
 driver_id uuid primary key references public.driver_profiles(user_id), vehicle_id uuid not null references public.vehicles(id), online boolean not null default false, updated_at timestamptz not null default now()
);
create table public.driver_location_current (
 driver_id uuid primary key references public.driver_profiles(user_id), position extensions.geography(point,4326) not null, sampled_at timestamptz not null, received_at timestamptz not null default now(), accuracy_m double precision not null check(accuracy_m>=0)
);
create index driver_location_position on public.driver_location_current using gist(position);
create table private.runtime_config (
 singleton boolean primary key default true check(singleton), environment text not null default 'development' check(environment='development'), requests_enabled boolean not null default false, payments_enabled boolean not null default false,
 matching_radius_m integer check(matching_radius_m>0), offer_ttl_seconds integer check(offer_ttl_seconds between 5 and 300), batch_size integer check(batch_size between 1 and 100), max_location_age_seconds integer not null default 30 check(max_location_age_seconds between 5 and 300), max_accuracy_m integer not null default 100 check(max_accuracy_m>0), daily_charge_minor bigint check(daily_charge_minor>=0), points_per_ride integer check(points_per_ride>=0), version integer not null default 1
);
insert into private.runtime_config(singleton) values(true);
create table public.fare_quotes (
 id uuid primary key default gen_random_uuid(), passenger_id uuid not null references public.profiles(id), category text not null check(category in ('basic','flash','premium')), origin extensions.geography(point,4326) not null, destination extensions.geography(point,4326) not null,
 amount_minor bigint not null check(amount_minor>=0), currency text not null check(currency='ARS'), distance_m integer not null check(distance_m>0), duration_s integer not null check(duration_s>0), provider text not null check(provider='google_routes'), pricing_version integer not null, expires_at timestamptz not null, consumed_at timestamptz
);
create table public.rides (
 id uuid primary key default gen_random_uuid(), passenger_id uuid not null references public.profiles(id), driver_id uuid references public.driver_profiles(user_id), vehicle_id uuid references public.vehicles(id), quote_id uuid not null unique references public.fare_quotes(id),
 status text not null default 'SEARCHING' check(status in ('SEARCHING','DRIVER_APPROACHING','DRIVER_ARRIVED','IN_PROGRESS','ARRIVED','PAYMENT_PENDING','COMPLETED','CANCELLED','NO_DRIVERS')),
 payment_method text not null check(payment_method in ('cash','mercadopago')), payment_status text not null default 'pending' check(payment_status in ('pending','approved')), amount_minor bigint not null check(amount_minor>=0), currency text not null check(currency='ARS'),
 correlation_id uuid not null, version bigint not null default 0, created_at timestamptz not null default now(), completed_at timestamptz, check(driver_id is null or driver_id<>passenger_id)
);
create unique index one_operational_ride_per_passenger on public.rides(passenger_id) where status in ('SEARCHING','DRIVER_APPROACHING','DRIVER_ARRIVED','IN_PROGRESS','ARRIVED');
create unique index one_operational_ride_per_driver on public.rides(driver_id) where status in ('DRIVER_APPROACHING','DRIVER_ARRIVED','IN_PROGRESS','ARRIVED');
create index rides_driver on public.rides(driver_id);
create table private.ride_access_codes (
 ride_id uuid primary key references public.rides(id), pin_hash text not null, attempts integer not null default 0, locked_until timestamptz
);
create table public.ride_events (
 id uuid primary key default gen_random_uuid(), ride_id uuid not null references public.rides(id), sequence_no bigint not null, event_type text not null, from_status text, to_status text not null, actor_user_id uuid, correlation_id uuid not null, created_at timestamptz not null default now(), unique(ride_id,sequence_no)
);
create table public.ride_offers (
 id uuid primary key default gen_random_uuid(), ride_id uuid not null references public.rides(id), driver_id uuid not null references public.driver_profiles(user_id), vehicle_id uuid not null references public.vehicles(id), status text not null default 'pending' check(status in ('pending','accepted','expired','lost','declined')), expires_at timestamptz not null, unique(ride_id,driver_id)
);
create unique index one_winning_offer on public.ride_offers(ride_id) where status='accepted';
create index offers_driver on public.ride_offers(driver_id);
create table private.idempotency_records (
 actor_id uuid not null, operation text not null, key uuid not null, request_hash text not null, resource_id uuid not null, created_at timestamptz not null default now(), primary key(actor_id,operation,key)
);
create table private.outbox_events (
 id uuid primary key default gen_random_uuid(), ride_id uuid not null references public.rides(id), event_type text not null, correlation_id uuid not null, created_at timestamptz not null default now(), processed_at timestamptz, attempts integer not null default 0, available_at timestamptz not null default now(), last_error_code text, unique(ride_id,event_type)
);
create table public.payment_accounts (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id), provider text not null check(provider='mercadopago'), provider_account_ref text not null, is_test boolean not null check(is_test), status text not null check(status in ('active','disabled')), unique(owner_id,provider)
);
create table private.payment_credentials (
 account_id uuid primary key references public.payment_accounts(id), secret_ref text not null
);
create table public.payment_intents (
 id uuid primary key default gen_random_uuid(), ride_id uuid not null unique references public.rides(id), account_id uuid not null references public.payment_accounts(id), payer_id uuid not null references public.profiles(id), amount_minor bigint not null check(amount_minor>=0), currency text not null check(currency='ARS'), status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')), provider_reference text not null unique, correlation_id uuid not null, created_at timestamptz not null default now()
);
create table private.webhook_inbox (
 provider text not null, event_id text not null, payload_sha256 text not null, received_at timestamptz not null default now(), primary key(provider,event_id)
);
create table public.payment_events (
 id uuid primary key default gen_random_uuid(), payment_intent_id uuid not null references public.payment_intents(id), provider text not null, provider_event_id text not null, normalized_status text not null, payload_sha256 text not null, created_at timestamptz not null default now(), unique(provider,provider_event_id)
);
create table public.driver_daily_charges (
 id uuid primary key default gen_random_uuid(), driver_id uuid not null references public.driver_profiles(user_id), business_day date not null, amount_minor bigint not null check(amount_minor>=0), currency text not null default 'ARS' check(currency='ARS'), trigger_ride_id uuid not null references public.rides(id), unique(driver_id,business_day)
);
create table public.bearpoints_ledger (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), ride_id uuid not null unique references public.rides(id), points integer not null, created_at timestamptz not null default now()
);
create table private.audit_log (
 id uuid primary key default gen_random_uuid(), actor_id uuid, action text not null, resource_id uuid, correlation_id uuid not null, created_at timestamptz not null default now()
);
create table private.security_events (
 id uuid primary key default gen_random_uuid(), event_type text not null, resource_id uuid, correlation_id uuid, created_at timestamptz not null default now()
);
create table automation.agent_definitions (
 id uuid primary key default gen_random_uuid(), name text not null unique, enabled boolean not null default false, access_mode text not null default 'read_only' check(access_mode in ('read_only','proposal'))
);
create table automation.agent_action_requests (
 id uuid primary key default gen_random_uuid(), agent_id uuid not null references automation.agent_definitions(id), action text not null, status text not null default 'proposed' check(status in ('proposed','approved','rejected')), approved_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create table migration.import_batches (
 id uuid primary key default gen_random_uuid(), source text not null check(source='base44'), created_at timestamptz not null default now()
);
create table migration.legacy_id_map (
 batch_id uuid not null references migration.import_batches(id), domain text not null, legacy_id text not null, target_id uuid not null, primary key(domain,legacy_id)
);
create table migration.import_errors (
 id uuid primary key default gen_random_uuid(), batch_id uuid not null references migration.import_batches(id), legacy_id text not null, error_code text not null
);

create function private.reject_mutation() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'append_only' using errcode='42501'; end $$;
create trigger immutable_ride_events before update or delete on public.ride_events for each row execute function private.reject_mutation();
create trigger immutable_payment_events before update or delete on public.payment_events for each row execute function private.reject_mutation();
create trigger immutable_points before update or delete on public.bearpoints_ledger for each row execute function private.reject_mutation();
create trigger immutable_audit before update or delete on private.audit_log for each row execute function private.reject_mutation();

-- No table mutation privileges for mobile clients. Definer functions below are
-- intentional command boundaries: fixed search_path, explicit UID checks, grants.
do $$ declare t record; begin
 for t in select tablename from pg_tables where schemaname='public' loop
  execute format('alter table public.%I enable row level security',t.tablename);
  execute format('revoke all on public.%I from anon, authenticated',t.tablename);
 end loop;
end $$;
grant select on public.profiles,public.driver_profiles,public.vehicles,public.driver_presence,public.driver_location_current,public.fare_quotes,public.rides,public.ride_events,public.ride_offers,public.payment_accounts,public.payment_intents,public.payment_events,public.driver_daily_charges,public.bearpoints_ledger to authenticated;
create policy own_profile on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy own_driver on public.driver_profiles for select to authenticated using(user_id=(select auth.uid()));
create policy own_vehicles on public.vehicles for select to authenticated using(driver_id=(select auth.uid()));
create policy own_presence on public.driver_presence for select to authenticated using(driver_id=(select auth.uid()));
create policy own_location on public.driver_location_current for select to authenticated using(driver_id=(select auth.uid()) or exists(select 1 from public.rides r where r.driver_id=driver_location_current.driver_id and r.passenger_id=(select auth.uid()) and r.status in ('DRIVER_APPROACHING','DRIVER_ARRIVED','IN_PROGRESS','ARRIVED')));
create policy own_quote on public.fare_quotes for select to authenticated using(passenger_id=(select auth.uid()));
create policy participant_ride on public.rides for select to authenticated using(passenger_id=(select auth.uid()) or driver_id=(select auth.uid()));
create policy participant_events on public.ride_events for select to authenticated using(exists(select 1 from public.rides r where r.id=ride_events.ride_id));
create policy own_offers on public.ride_offers for select to authenticated using(driver_id=(select auth.uid()));
create policy own_payment_account on public.payment_accounts for select to authenticated using(owner_id=(select auth.uid()));
create policy participant_payment on public.payment_intents for select to authenticated using(exists(select 1 from public.rides r where r.id=payment_intents.ride_id));
create policy participant_payment_event on public.payment_events for select to authenticated using(exists(select 1 from public.payment_intents p where p.id=payment_events.payment_intent_id));
create policy own_charge on public.driver_daily_charges for select to authenticated using(driver_id=(select auth.uid()));
create policy own_points on public.bearpoints_ledger for select to authenticated using(user_id=(select auth.uid()));

create function private.bootstrap_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id) values(new.id); return new; end $$;
create trigger beardrive_profile after insert on auth.users for each row execute function private.bootstrap_profile();

create function private.record_ride_event(p_ride_id uuid,p_from text,p_event text) returns void language plpgsql security definer set search_path='' as $$
declare r public.rides;
begin
 update public.rides set version=version+1 where id=p_ride_id returning * into strict r;
 insert into public.ride_events(ride_id,sequence_no,event_type,from_status,to_status,actor_user_id,correlation_id) values(r.id,r.version,p_event,p_from,r.status,auth.uid(),r.correlation_id);
 insert into private.outbox_events(ride_id,event_type,correlation_id) values(r.id,p_event,r.correlation_id) on conflict do nothing;
end $$;

create function api.request_ride(p_quote_id uuid,p_payment_method text,p_idempotency_key uuid,p_correlation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.fare_quotes; r public.rides; previous private.idempotency_records; pin text; fingerprint text;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if p_idempotency_key is null or p_correlation_id is null then raise exception 'missing_request_identity'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 fingerprint:=p_quote_id::text||':'||p_payment_method;
 select * into previous from private.idempotency_records where actor_id=auth.uid() and operation='request_ride' and key=p_idempotency_key;
 if found then
  if previous.request_hash<>fingerprint then raise exception 'idempotency_conflict'; end if;
  select * into r from public.rides where id=previous.resource_id;
  return jsonb_build_object('ride',to_jsonb(r),'pin',null);
 end if;
 if not (select requests_enabled from private.runtime_config where singleton) then raise exception 'requests_disabled'; end if;
 select * into q from public.fare_quotes where id=p_quote_id and passenger_id=auth.uid() for update;
 if not found or q.expires_at<=now() or q.consumed_at is not null then raise exception 'quote_unavailable'; end if;
 -- Rejection sampling is unnecessary for a short, rate-limited code; no Math.random.
 pin:=lpad(((get_byte(extensions.gen_random_bytes(2),0)*256+get_byte(extensions.gen_random_bytes(2),1)) % 10000)::text,4,'0');
 insert into public.rides(passenger_id,quote_id,payment_method,amount_minor,currency,correlation_id) values(auth.uid(),q.id,p_payment_method,q.amount_minor,q.currency,p_correlation_id) returning * into r;
 insert into private.ride_access_codes(ride_id,pin_hash) values(r.id,extensions.crypt(pin,extensions.gen_salt('bf')));
 update public.fare_quotes set consumed_at=now() where id=q.id;
 insert into private.idempotency_records values(auth.uid(),'request_ride',p_idempotency_key,fingerprint,r.id,now());
 perform private.record_ride_event(r.id,null,'ride.requested');
 select * into r from public.rides where id=r.id;
 return jsonb_build_object('ride',to_jsonb(r),'pin',pin);
end $$;

create function api.update_driver_location(p_lat double precision,p_lng double precision,p_accuracy_m double precision,p_sampled_at timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare cfg private.runtime_config;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 select * into cfg from private.runtime_config where singleton;
 if p_lat is null or p_lng is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180) or p_accuracy_m is null or not(p_accuracy_m between 0 and cfg.max_accuracy_m) or p_sampled_at is null or p_sampled_at<now()-make_interval(secs=>cfg.max_location_age_seconds) or p_sampled_at>now()+interval '5 seconds' then raise exception 'invalid_location'; end if;
 if not exists(select 1 from public.driver_presence where driver_id=auth.uid() and online) then raise exception 'driver_offline'; end if;
 insert into public.driver_location_current(driver_id,position,sampled_at,accuracy_m) values(auth.uid(),extensions.st_setsrid(extensions.st_makepoint(p_lng,p_lat),4326)::extensions.geography,p_sampled_at,p_accuracy_m)
 on conflict(driver_id) do update set position=excluded.position,sampled_at=excluded.sampled_at,accuracy_m=excluded.accuracy_m,received_at=now() where driver_location_current.sampled_at<excluded.sampled_at;
 return found;
end $$;

create function private.run_matching_round(p_ride_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare r public.rides; q public.fare_quotes; cfg private.runtime_config; count_offers integer;
begin
 select * into strict r from public.rides where id=p_ride_id for update;
 if r.status<>'SEARCHING' then return 0; end if;
 select * into strict q from public.fare_quotes where id=r.quote_id;
 select * into cfg from private.runtime_config where singleton;
 if cfg.matching_radius_m is null or cfg.offer_ttl_seconds is null or cfg.batch_size is null then raise exception 'matching_unconfigured'; end if;
 update public.ride_offers set status='expired' where ride_id=r.id and status='pending' and expires_at<=now();
 insert into public.ride_offers(ride_id,driver_id,vehicle_id,expires_at)
 select r.id,d.user_id,v.id,now()+make_interval(secs=>cfg.offer_ttl_seconds)
 from public.driver_profiles d join public.driver_presence p on p.driver_id=d.user_id join public.vehicles v on v.id=p.vehicle_id and v.driver_id=d.user_id join public.driver_location_current l on l.driver_id=d.user_id
 where d.user_id<>r.passenger_id and d.status='approved' and d.documents_valid_until>now() and p.online and v.status='approved' and v.documents_valid_until>now() and v.category=q.category
 and l.sampled_at between now()-make_interval(secs=>cfg.max_location_age_seconds) and now()+interval '5 seconds' and l.accuracy_m<=cfg.max_accuracy_m
 and extensions.st_dwithin(l.position,q.origin,cfg.matching_radius_m)
 and not exists(select 1 from public.rides busy where busy.driver_id=d.user_id and busy.status in ('DRIVER_APPROACHING','DRIVER_ARRIVED','IN_PROGRESS','ARRIVED'))
 order by extensions.st_distance(l.position,q.origin),d.user_id limit cfg.batch_size on conflict(ride_id,driver_id) do nothing;
 get diagnostics count_offers=row_count; return count_offers;
end $$;

create function api.accept_offer(p_offer_id uuid) returns public.rides language plpgsql security definer set search_path='' as $$
declare o public.ride_offers; r public.rides; cfg private.runtime_config;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 -- Same lock order for every acceptance: driver -> ride -> offers.
 perform 1 from public.driver_profiles where user_id=auth.uid() for update;
 select * into o from public.ride_offers where id=p_offer_id and driver_id=auth.uid();
 if not found then raise exception 'offer_unavailable'; end if;
 select * into strict r from public.rides where id=o.ride_id for update;
 select * into strict o from public.ride_offers where id=p_offer_id for update;
 if r.driver_id=auth.uid() and o.status='accepted' then return r; end if;
 if r.status<>'SEARCHING' or o.status<>'pending' or o.expires_at<=now() then raise exception 'offer_unavailable'; end if;
 select * into cfg from private.runtime_config where singleton;
 if not exists(select 1 from public.driver_profiles d join public.driver_presence p on p.driver_id=d.user_id join public.vehicles v on v.id=p.vehicle_id and v.driver_id=d.user_id join public.driver_location_current l on l.driver_id=d.user_id join public.fare_quotes q on q.id=r.quote_id where d.user_id=auth.uid() and d.status='approved' and d.documents_valid_until>now() and v.id=o.vehicle_id and v.status='approved' and v.documents_valid_until>now() and v.category=q.category and p.online and l.sampled_at between now()-make_interval(secs=>cfg.max_location_age_seconds) and now()+interval '5 seconds' and l.accuracy_m<=cfg.max_accuracy_m) then raise exception 'driver_ineligible'; end if;
 update public.rides set driver_id=auth.uid(),vehicle_id=o.vehicle_id,status='DRIVER_APPROACHING' where id=r.id returning * into r;
 update public.ride_offers set status=case when id=o.id then 'accepted' else 'lost' end where ride_id=r.id and status='pending';
 perform private.record_ride_event(r.id,'SEARCHING','offer.accepted');
 return r;
end $$;

create function api.driver_arrived(p_ride_id uuid) returns public.rides language plpgsql security definer set search_path='' as $$
declare r public.rides;
begin
 select * into r from public.rides where id=p_ride_id and driver_id=auth.uid() for update;
 if not found then raise exception 'not_allowed' using errcode='42501'; end if;
 if r.status='DRIVER_ARRIVED' then return r; end if;
 if r.status<>'DRIVER_APPROACHING' then raise exception 'invalid_transition'; end if;
 update public.rides set status='DRIVER_ARRIVED' where id=r.id returning * into r;
 perform private.record_ride_event(r.id,'DRIVER_APPROACHING','driver.arrived'); return r;
end $$;

create function api.validate_pin(p_ride_id uuid,p_pin text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.rides; c private.ride_access_codes;
begin
 select * into r from public.rides where id=p_ride_id and driver_id=auth.uid() for update;
 if not found then raise exception 'not_allowed' using errcode='42501'; end if;
 if r.status<>'DRIVER_ARRIVED' then raise exception 'invalid_transition'; end if;
 select * into strict c from private.ride_access_codes where ride_id=r.id for update;
 if c.locked_until>now() then return jsonb_build_object('ok',false,'error','pin_locked'); end if;
 if p_pin is null or p_pin!~'^[0-9]{4}$' or extensions.crypt(p_pin,c.pin_hash)<>c.pin_hash then
  update private.ride_access_codes set attempts=case when locked_until<=now() then 1 else attempts+1 end,locked_until=case when (case when locked_until<=now() then 0 else attempts end)+1>=5 then now()+interval '5 minutes' else null end where ride_id=r.id;
  -- Return, do not raise: raising would roll back the attempt counter.
  return jsonb_build_object('ok',false,'error','invalid_pin');
 end if;
 update public.rides set status='IN_PROGRESS' where id=r.id;
 perform private.record_ride_event(r.id,'DRIVER_ARRIVED','pin.validated');
 return jsonb_build_object('ok',true);
end $$;

create function api.complete_ride(p_ride_id uuid) returns public.rides language plpgsql security definer set search_path='' as $$
declare r public.rides; old_status text;
begin
 select * into r from public.rides where id=p_ride_id and driver_id=auth.uid() for update;
 if not found then raise exception 'not_allowed' using errcode='42501'; end if;
 if r.status in ('COMPLETED','PAYMENT_PENDING') then return r; end if;
 if r.status not in ('IN_PROGRESS','ARRIVED') then raise exception 'invalid_transition'; end if;
 old_status:=r.status;
 update public.rides set status=case when payment_method='cash' then 'COMPLETED' else 'PAYMENT_PENDING' end,payment_status=case when payment_method='cash' then 'approved' else 'pending' end,completed_at=case when payment_method='cash' then now() else null end where id=r.id returning * into r;
 perform private.record_ride_event(r.id,old_status,case when r.status='COMPLETED' then 'ride.completed' else 'ride.payment_pending' end); return r;
end $$;

create function api.create_payment_intent(p_ride_id uuid) returns public.payment_intents language plpgsql security definer set search_path='' as $$
declare r public.rides; a public.payment_accounts; p public.payment_intents;
begin
 select * into r from public.rides where id=p_ride_id and passenger_id=auth.uid() for update;
 if not found then raise exception 'not_allowed' using errcode='42501'; end if;
 if r.payment_method<>'mercadopago' or r.status<>'PAYMENT_PENDING' then raise exception 'payment_not_available'; end if;
 if not(select payments_enabled from private.runtime_config where singleton) then raise exception 'payments_disabled'; end if;
 select * into a from public.payment_accounts where owner_id=r.driver_id and provider='mercadopago' and status='active' and is_test;
 if not found then raise exception 'test_account_required'; end if;
 insert into public.payment_intents(ride_id,account_id,payer_id,amount_minor,currency,provider_reference,correlation_id) values(r.id,a.id,r.passenger_id,r.amount_minor,r.currency,'ride:'||r.id,r.correlation_id) on conflict(ride_id) do nothing;
 select * into strict p from public.payment_intents where ride_id=r.id; return p;
end $$;

-- Only trusted server worker may call this AFTER verifying the PSP signature
-- and fetching the current payment status from the provider.
create function private.process_verified_payment(p_intent_id uuid,p_event_id text,p_amount_minor bigint,p_currency text,p_account_ref text,p_reference text,p_status text,p_payload_sha256 text)
returns boolean language plpgsql security definer set search_path='' as $$
declare p public.payment_intents; r public.rides; inserted integer;
begin
 select r0.* into r from public.rides r0 join public.payment_intents p0 on p0.ride_id=r0.id where p0.id=p_intent_id for update of r0;
 if not found then raise exception 'intent_missing'; end if;
 select * into strict p from public.payment_intents where id=p_intent_id for update;
 if p_event_id is null or p_event_id='' or p_payload_sha256 is null or p_payload_sha256!~'^[0-9a-f]{64}$' or p_status is null or p_status not in ('approved','pending','rejected','cancelled') then raise exception 'invalid_event'; end if;
 if p.amount_minor is distinct from p_amount_minor or p.currency is distinct from p_currency or p.provider_reference is distinct from p_reference or not exists(select 1 from public.payment_accounts where id=p.account_id and provider_account_ref=p_account_ref and is_test) then
  insert into private.security_events(event_type,resource_id,correlation_id) values('payment.mismatch',p.id,p.correlation_id); return false;
 end if;
 insert into private.webhook_inbox values('mercadopago',p_event_id,p_payload_sha256,now()) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 then return false; end if;
 insert into public.payment_events(payment_intent_id,provider,provider_event_id,normalized_status,payload_sha256) values(p.id,'mercadopago',p_event_id,p_status,p_payload_sha256);
 -- An approved payment cannot be downgraded by a delayed notification.
 if p.status='approved' then return true; end if;
 update public.payment_intents set status=p_status where id=p.id;
 if p_status='approved' then
  if r.status<>'PAYMENT_PENDING' then raise exception 'ride_not_payable'; end if;
  update public.rides set status='COMPLETED',payment_status='approved',completed_at=now() where id=r.id;
  perform private.record_ride_event(r.id,'PAYMENT_PENDING','ride.completed');
 end if;
 return true;
end $$;

create function private.apply_post_ride_effects(p_ride_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare r public.rides; cfg private.runtime_config;
begin
 select * into strict r from public.rides where id=p_ride_id for update;
 if r.status<>'COMPLETED' then raise exception 'ride_not_completed'; end if;
 select * into cfg from private.runtime_config where singleton;
 if cfg.daily_charge_minor is null or cfg.points_per_ride is null then raise exception 'effects_unconfigured'; end if;
 insert into public.bearpoints_ledger(user_id,ride_id,points) values(r.passenger_id,r.id,cfg.points_per_ride) on conflict(ride_id) do nothing;
 if cfg.daily_charge_minor>0 then
  insert into public.driver_daily_charges(driver_id,business_day,amount_minor,trigger_ride_id) values(r.driver_id,(r.completed_at at time zone 'America/Argentina/Buenos_Aires')::date,cfg.daily_charge_minor,r.id) on conflict(driver_id,business_day) do nothing;
 end if;
 update private.outbox_events set processed_at=now() where ride_id=r.id and event_type='ride.completed'; return true;
end $$;

create function api.get_ride(p_ride_id uuid) returns public.rides language sql security invoker set search_path='' as $$ select * from public.rides where id=p_ride_id $$;
revoke all on all functions in schema private from public,anon,authenticated;
revoke all on all functions in schema api from public,anon,authenticated;
grant execute on function api.request_ride(uuid,text,uuid,uuid),api.update_driver_location(double precision,double precision,double precision,timestamptz),api.accept_offer(uuid),api.driver_arrived(uuid),api.validate_pin(uuid,text),api.complete_ride(uuid),api.create_payment_intent(uuid),api.get_ride(uuid) to authenticated;
grant execute on function private.run_matching_round(uuid),private.process_verified_payment(uuid,text,bigint,text,text,text,text,text),private.apply_post_ride_effects(uuid) to service_role;
grant all on all tables in schema private to service_role;
