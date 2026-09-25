begin;
set local role service_role;
do $$
declare
  args jsonb := jsonb_build_object(
    'hash','0x'||repeat('7',64),
    'raw','{"brand":"Honda","color":"Hitam","kind":"motor","marker":"","model":"Beat","name":"SQL test","year":"2024"}',
    'wallet','0x'||repeat('7',40),'maxBytes',104857600,'maxFiles',10000,'uploadsPerDay',500,'walletUploadsPerDay',1);
  before_count bigint;
  day date := (now() at time zone 'UTC')::date;
begin
  select coalesce((select count from private.usage where scope='metadata:global' and period=day),0) into before_count;
  perform public.motochain_backend('store',args);
  perform public.motochain_backend('store',args);
  if (select count from private.usage where scope='metadata:global' and period=day) <> before_count+1
    then raise exception 'Duplicate upload counted'; end if;
  begin
    perform public.motochain_backend('store',args || jsonb_build_object('hash','0x'||repeat('8',64)));
    raise exception 'Quota not enforced';
  exception when sqlstate 'PT429' then null; end;
  if (select count from private.usage where scope='metadata:global' and period=day) <> before_count+1
    then raise exception 'Partial quota increment committed'; end if;
  perform public.motochain_backend('challenge',jsonb_build_object('nonce',repeat('7',48),'wallet','0x'||repeat('7',40),'message','Test'));
  perform public.motochain_backend('login',jsonb_build_object('nonce',repeat('7',48),'wallet','0x'||repeat('7',40),'token',repeat('7',64)));
  begin
    perform public.motochain_backend('login',jsonb_build_object('nonce',repeat('7',48),'wallet','0x'||repeat('7',40),'token',repeat('8',64)));
    raise exception 'Replay accepted';
  exception when sqlstate 'PT401' then null; end;
  if public.motochain_backend('session',jsonb_build_object('token',repeat('7',64))) is null
    then raise exception 'Session missing'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform public.motochain_backend('health');
    raise exception 'Anonymous RPC allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: quota atomic rollback, deduplication, session creation, replay prevention, private RPC permissions' as result;
rollback;
