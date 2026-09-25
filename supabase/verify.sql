begin;
set local role service_role;
insert into public.metadata(hash, raw) values (
  '0x' || repeat('a',64),
  '{"brand":"Honda","color":"Hitam","kind":"motor","marker":"","model":"Vario","name":"Database verification","year":"2023"}'
);
insert into public.metadata(hash, raw) values (
  '0x' || repeat('b',64),
  '{"action":"Ganti oli","complaint":"Perawatan","date":"2026-09-20","kind":"service","odometer":"12500","parts":"Oli mesin"}'
);
insert into private.usage(scope,period,count) values ('verification', current_date, 1);
insert into private.challenges values (repeat('a',48), '0x' || repeat('1',40), 'Verification challenge', 1790000000000);
insert into private.sessions values (repeat('b',64), '0x' || repeat('1',40), 1790000000000);
do $$
begin
  if private.valid_metadata('{"kind":"service","date":"2026-02-30","odometer":"1","complaint":"x","action":"y","parts":""}'::jsonb)
    then raise exception 'Invalid date accepted'; end if;
  if private.valid_metadata('{"kind":"service","date":"2026-09-20","odometer":"1","complaint":"x","action":"y","parts":"","image":"receipt"}'::jsonb)
    then raise exception 'Receipt source field accepted'; end if;
  begin
    insert into public.metadata(hash,raw) values ('0x' || repeat('c',64),'{"kind":"motor"}');
    raise exception 'Malformed metadata accepted';
  exception when check_violation then null; end;
  begin
    update public.metadata set raw = raw where hash = '0x' || repeat('a',64);
    raise exception 'Backend modified immutable metadata';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$
begin
  if (select count(*) from public.metadata where hash in ('0x' || repeat('a',64),'0x' || repeat('b',64))) <> 2
    then raise exception 'Public reading failed'; end if;
  begin
    perform * from private.sessions;
    raise exception 'Anonymous session access allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.metadata(hash,raw) values ('0x' || repeat('d',64),'{}');
    raise exception 'Anonymous write allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$
begin
  begin
    perform * from private.challenges;
    raise exception 'Authenticated challenge access allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.metadata where hash = '0x' || repeat('a',64);
    raise exception 'Authenticated delete allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: metadata insert/read, payload validation, private access and write restrictions; test data rolled back' as verification;
rollback;
