-- Motochain Service v2. Applied remotely as motochain_initial_schema.
-- Schema snapshot for a new database, not an idempotent upgrade script.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create function private.valid_metadata(payload jsonb)
returns boolean language plpgsql immutable security invoker set search_path = ''
as $$
declare
  fields text[];
  field text;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then return false; end if;
  case payload->>'kind'
    when 'motor' then fields := array['kind','name','brand','model','year','color','marker'];
    when 'service' then fields := array['kind','date','odometer','complaint','action','parts'];
    else return false;
  end case;
  if not (payload ?& fields) or (payload - fields) <> '{}'::jsonb then return false; end if;
  foreach field in array fields loop
    if jsonb_typeof(payload->field) <> 'string'
      or length(payload->>field) > 600
      or (field not in ('marker','parts') and btrim(payload->>field) = '')
      then return false; end if;
  end loop;
  if payload->>'kind' = 'motor' then
    if not (payload->>'year' ~ '^[0-9]{4}$') then return false; end if;
    return (payload->>'year')::integer >= 1900;
  end if;
  if not (payload->>'odometer' ~ '^[0-9]{1,7}$')
     or not (payload->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') then return false; end if;
  return to_char((payload->>'date')::date, 'YYYY-MM-DD') = payload->>'date';
exception when invalid_datetime_format or datetime_field_overflow then return false;
end;
$$;
revoke all on function private.valid_metadata(jsonb) from public, anon, authenticated;
grant execute on function private.valid_metadata(jsonb) to service_role;

create table public.metadata (
  hash text primary key check (hash ~ '^0x[a-f0-9]{64}$'),
  raw text not null,
  data jsonb generated always as (raw::jsonb) stored,
  bytes integer generated always as (octet_length(raw)) stored,
  created_at timestamptz not null default now(),
  constraint metadata_size check (octet_length(raw) between 1 and 12288),
  constraint metadata_fields check (private.valid_metadata(raw::jsonb))
);
comment on table public.metadata is 'Reviewed motor/service metadata keyed by Keccak-256 of canonical JSON. Blockchain remains authoritative for owner, motor IDs, record IDs and confirmation.';
comment on column public.metadata.raw is 'Exact canonical JSON produced by src/lib/schema.js; backend must validate digest and wallet signature before insertion. Never store receipt sources.';
alter table public.metadata enable row level security;
revoke all on public.metadata from public, anon, authenticated, service_role;
grant select on public.metadata to anon, authenticated, service_role;
grant insert (hash, raw) on public.metadata to service_role;
create policy metadata_public_read on public.metadata for select to anon, authenticated using (true);

create table private.challenges (
  nonce text primary key check (nonce ~ '^[a-f0-9]{48}$'),
  wallet text not null check (wallet ~ '^0x[a-f0-9]{40}$'),
  message text not null check (length(message) between 1 and 2000),
  expires bigint not null check (expires > 0)
);
create index challenges_expires_idx on private.challenges (expires);
comment on table private.challenges is 'Single-use wallet challenges. Expiry is Unix milliseconds matching server/security.js; consume atomically only after signature verification.';

create table private.sessions (
  token text primary key check (token ~ '^[a-f0-9]{64}$'),
  wallet text not null check (wallet ~ '^0x[a-f0-9]{40}$'),
  expires bigint not null check (expires > 0)
);
create index sessions_expires_idx on private.sessions (expires);
comment on column private.sessions.token is 'SHA-256 of bearer token, never the plaintext token.';
comment on table private.sessions is 'Custom wallet AI sessions, not Supabase Auth users. Expiry is Unix milliseconds.';

create table private.usage (
  scope text not null check (length(scope) between 1 and 120),
  period date not null,
  count bigint not null default 0 check (count >= 0),
  primary key (scope, period)
);
create index usage_period_idx on private.usage (period);
comment on table private.usage is 'UTC daily counters: login:<wallet>, ai:global, ai:<wallet>, metadata:global, metadata:<wallet>. Backend must reserve all applicable counters atomically.';

alter table private.challenges enable row level security;
alter table private.sessions enable row level security;
alter table private.usage enable row level security;
revoke all on private.challenges, private.sessions, private.usage from public, anon, authenticated, service_role;
grant select, insert, update, delete on private.challenges, private.sessions, private.usage to service_role;
create policy challenges_backend_only on private.challenges for all to service_role using (true) with check (true);
create policy sessions_backend_only on private.sessions for all to service_role using (true) with check (true);
create policy usage_backend_only on private.usage for all to service_role using (true) with check (true);

