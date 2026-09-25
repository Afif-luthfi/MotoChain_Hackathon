-- Service-only transaction API. Every mutating request shares one short lock.
-- Gemini calls and signature verification happen outside this transaction.
create function private.reserve_usage(p_entries jsonb)
returns void language plpgsql security invoker set search_path = ''
as $$
declare entry jsonb; day date := (now() at time zone 'UTC')::date; maximum bigint;
begin
  for entry in select value from jsonb_array_elements(p_entries) loop
    maximum := (entry->>1)::bigint;
    if maximum is null or maximum < 1 then raise exception 'Invalid quota'; end if;
    if coalesce((select count from private.usage where scope=entry->>0 and period=day),0) >= maximum
      then raise sqlstate 'PT429' using message='Kuota penggunaan tercapai. Coba kembali besok.'; end if;
    insert into private.usage(scope,period,count) values(entry->>0,day,1)
      on conflict(scope,period) do update set count=private.usage.count+1;
  end loop;
end $$;
revoke all on function private.reserve_usage(jsonb) from public, anon, authenticated;
grant execute on function private.reserve_usage(jsonb) to service_role;

create function public.motochain_backend(p_operation text, p_args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare
  row_data record;
  total_bytes bigint;
  total_files bigint;
  now_ms bigint := floor(extract(epoch from clock_timestamp())*1000);
  day date := (now() at time zone 'UTC')::date;
begin
  if p_operation='health' then
    perform hash from public.metadata limit 1;
    return jsonb_build_object('storage','supabase');
  elsif p_operation='read' then
    return (select to_jsonb(raw) from public.metadata where hash=p_args->>'hash');
  elsif p_operation='get_challenge' then
    return (select to_jsonb(c) from private.challenges c where nonce=p_args->>'nonce' and expires>now_ms);
  elsif p_operation='session' then
    return (select to_jsonb(s) from private.sessions s where token=p_args->>'token' and expires>now_ms);
  end if;

  perform pg_advisory_xact_lock(968, 2026);
  delete from private.challenges where expires<=now_ms;
  delete from private.sessions where expires<=now_ms;
  delete from private.usage where period<day-8;

  if p_operation='store' then
    select raw into row_data from public.metadata where hash=p_args->>'hash';
    if found then
      if row_data.raw <> p_args->>'raw' then
        raise sqlstate 'PT409' using message='Metadata dengan hash ini sudah berbeda.';
      end if;
      return 'false'::jsonb;
    end if;
    select coalesce(sum(bytes),0), count(*) into total_bytes,total_files from public.metadata;
    if total_bytes+octet_length(p_args->>'raw')>(p_args->>'maxBytes')::bigint
      or total_files>=(p_args->>'maxFiles')::bigint then
      raise sqlstate 'PT507' using message='Penyimpanan penuh. Hubungi pengelola aplikasi.';
    end if;
    perform private.reserve_usage(jsonb_build_array(
      jsonb_build_array('metadata:global',(p_args->>'uploadsPerDay')::bigint),
      jsonb_build_array('metadata:' || (p_args->>'wallet'),(p_args->>'walletUploadsPerDay')::bigint)
    ));
    insert into public.metadata(hash,raw) values(p_args->>'hash',p_args->>'raw');
    return 'true'::jsonb;
  elsif p_operation='challenge' then
    perform private.reserve_usage(jsonb_build_array(jsonb_build_array('login:' || (p_args->>'wallet'),30)));
    insert into private.challenges(nonce,wallet,message,expires)
      values(p_args->>'nonce',p_args->>'wallet',p_args->>'message',now_ms+300000);
    return '{}'::jsonb;
  elsif p_operation='login' then
    -- This delete and the following insert are a single transaction:
    -- simultaneous replays can create at most one session.
    delete from private.challenges
      where nonce=p_args->>'nonce' and wallet=p_args->>'wallet' and expires>now_ms
      returning * into row_data;
    if not found then raise sqlstate 'PT401' using message='Permintaan masuk kedaluwarsa atau sudah dipakai.'; end if;
    insert into private.sessions(token,wallet,expires)
      values(p_args->>'token',row_data.wallet,now_ms+3600000);
    return jsonb_build_object('expires',now_ms+3600000);
  elsif p_operation='ai' then
    perform private.reserve_usage(jsonb_build_array(
      jsonb_build_array('ai:global',(p_args->>'maximum')::bigint),
      jsonb_build_array('ai:' || (p_args->>'wallet'),(p_args->>'perWallet')::bigint)
    ));
    return '{}'::jsonb;
  end if;
  raise exception 'Unknown backend operation';
end $$;
revoke all on function public.motochain_backend(text,jsonb) from public, anon, authenticated;
grant execute on function public.motochain_backend(text,jsonb) to service_role;
comment on function public.motochain_backend(text,jsonb) is 'Only the trusted Edge Function service role may invoke this API, after verifying signatures/allowlists. Not callable with publishable keys.';

