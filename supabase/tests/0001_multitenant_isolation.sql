begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(15);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);

select extensions.is(
  (select count(*)::integer from public.people),
  2,
  'administrador A consulta somente as duas pessoas do tenant A'
);

select extensions.is(
  (select count(*)::integer from public.people where tenant_id = '20000000-0000-4000-8000-000000000002'),
  0,
  'administrador A não consulta pessoa do tenant B'
);

select extensions.is(
  (select count(*)::integer from public.get_my_contexts()),
  1,
  'contextos retornam somente memberships do usuário autenticado'
);

select extensions.throws_ok(
  $$
    insert into public.people(tenant_id, org_unit_id, display_name, created_by)
    values (
      '20000000-0000-4000-8000-000000000002',
      '21000000-0000-4000-8000-000000000002',
      'Tentativa entre tenants',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "people"',
  'administrador A não insere pessoa no tenant B'
);

select extensions.is(
  (
    with updated as (
      update public.people
      set display_name = 'Alteração indevida'
      where id = 'b1000000-0000-4000-8000-000000000001'
      returning 1
    )
    select count(*)::integer from updated
  ),
  0,
  'administrador A não altera pessoa do tenant B mesmo conhecendo o ID'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', true);

select extensions.is(
  (select count(*)::integer from public.people),
  1,
  'administrador B consulta somente a pessoa do tenant B'
);

select extensions.is(
  (select count(*)::integer from public.people where tenant_id = '10000000-0000-4000-8000-000000000001'),
  0,
  'afiliação entre tenants não concede acesso automático ao tenant A'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', true);

select extensions.is(
  (select count(*)::integer from public.people),
  1,
  'liderança A consulta somente pessoas da subárvore atribuída'
);

select extensions.is(
  (select count(*)::integer from public.people where org_unit_id = '11110000-0000-4000-8000-000000000001'),
  1,
  'liderança A consulta pessoa da igreja local em seu escopo'
);

select extensions.is(
  (select count(*)::integer from public.people where org_unit_id = '11000000-0000-4000-8000-000000000001'),
  0,
  'liderança A não consulta pessoa da sede fora de seu escopo'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', true);

select extensions.is(
  (select count(*)::integer from public.people),
  0,
  'tenant suspenso não acessa pessoas'
);

reset role;
delete from public.plan_modules
where plan_id = '90000000-0000-4000-8000-000000000001'
  and module_key = 'people';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);

select extensions.is(
  (select count(*)::integer from public.people),
  0,
  'ausência de entitlement bloqueia acesso ao módulo people'
);

reset role;
insert into public.plan_modules(plan_id, module_key)
values ('90000000-0000-4000-8000-000000000001', 'people')
on conflict do nothing;

insert into public.data_sharing_grants(
  id, relationship_id, source_tenant_id, target_tenant_id,
  scope_org_unit_id, module_key, allowed_actions, status
) values (
  '82000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '11110000-0000-4000-8000-000000000001',
  'people',
  array['read']::text[],
  'active'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', true);

select extensions.is(
  (select count(*)::integer from public.people where tenant_id = '10000000-0000-4000-8000-000000000001'),
  1,
  'grant explícito libera somente a unidade compartilhada do tenant A'
);

select extensions.is(
  (select count(*)::integer from public.people where org_unit_id = '11000000-0000-4000-8000-000000000001'),
  0,
  'grant restrito não libera pessoa da sede do tenant A'
);

reset role;
set local role anon;

select extensions.throws_ok(
  $$ select * from public.people $$,
  '42501',
  'permission denied for table people',
  'papel anon não possui acesso à tabela de pessoas'
);

reset role;
select * from extensions.finish();
rollback;
