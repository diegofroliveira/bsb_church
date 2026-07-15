begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(40);

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
  null,
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
insert into public.tenant_entitlements(
  id, tenant_id, module_key, enabled, reason
) values (
  '93000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'people',
  false,
  'Teste de override negativo'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);

select extensions.is(
  (select count(*)::integer from public.people),
  0,
  'override negativo prevalece sobre módulo incluído no plano'
);

select extensions.is(
  (
    with deleted as (
      delete from public.people
      where id = 'a1000000-0000-4000-8000-000000000001'
      returning 1
    )
    select count(*)::integer from deleted
  ),
  0,
  'override negativo também bloqueia exclusão'
);

reset role;

select extensions.throws_ok(
  $$
    insert into public.tenant_entitlements(
      tenant_id, module_key, enabled, valid_from, reason
    ) values (
      '10000000-0000-4000-8000-000000000001',
      'people',
      true,
      now(),
      'Conflito intencional de teste'
    )
  $$,
  '23P01',
  'Já existe override de módulo sobreposto para o tenant.',
  'overrides de módulo não podem ter vigências sobrepostas'
);

delete from public.tenant_entitlements
where id = '93000000-0000-4000-8000-000000000001';

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
update public.data_sharing_grants
set status = 'suspended'
where id = '82000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', true);
select extensions.is(
  (select count(*)::integer from public.people where tenant_id = '10000000-0000-4000-8000-000000000001'),
  0,
  'grant suspenso não compartilha pessoas'
);

reset role;
update public.data_sharing_grants
set status = 'active'
where id = '82000000-0000-4000-8000-000000000001';
update public.tenant_relationships
set status = 'suspended'
where id = '81000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', true);
select extensions.is(
  (select count(*)::integer from public.people where tenant_id = '10000000-0000-4000-8000-000000000001'),
  0,
  'relacionamento suspenso invalida o compartilhamento'
);

reset role;
update public.tenant_relationships
set status = 'active'
where id = '81000000-0000-4000-8000-000000000001';
update public.data_sharing_grants
set allowed_actions = array['aggregate']::text[]
where id = '82000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', true);
select extensions.is(
  (select count(*)::integer from public.people where tenant_id = '10000000-0000-4000-8000-000000000001'),
  0,
  'grant sem ação read não libera registros nominais'
);

reset role;
update public.data_sharing_grants
set allowed_actions = array['read']::text[]
where id = '82000000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', true);
select extensions.is(
  (select count(*)::integer from public.people),
  0,
  'usuário autenticado sem membership não acessa pessoas'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', true);
select extensions.is(
  (select count(*)::integer from public.people),
  3,
  'usuário multitenant enxerga somente os tenants em que possui acesso'
);

select extensions.throws_ok(
  $$
    update public.people
    set tenant_id = '20000000-0000-4000-8000-000000000002',
        org_unit_id = '21000000-0000-4000-8000-000000000002'
    where id = 'a1000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'tenant_id de uma pessoa é imutável.',
  'usuário multitenant não transfere pessoa entre tenants'
);

select extensions.throws_ok(
  $$
    update public.people
    set created_by = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'
    where id = 'a1000000-0000-4000-8000-000000000001'
  $$,
  '42501',
  'created_by de uma pessoa é imutável.',
  'autor original do cadastro não pode ser adulterado'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);

select extensions.lives_ok(
  $$
    insert into public.people(
      id, tenant_id, org_unit_id, display_name, created_by
    ) values (
      'a1000000-0000-4000-8000-000000000099',
      '10000000-0000-4000-8000-000000000001',
      '11000000-0000-4000-8000-000000000001',
      'Pessoa Sintética Auditada',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
    )
  $$,
  'escrita legítima no tenant e escopo autorizados é permitida'
);

select extensions.is(
  (select count(*)::integer from public.audit_events
   where entity_id = 'a1000000-0000-4000-8000-000000000099'
     and action = 'people.insert'),
  1,
  'insert de pessoa gera auditoria automática'
);

select extensions.lives_ok(
  $$
    update public.people
    set display_name = 'Pessoa Sintética Atualizada'
    where id = 'a1000000-0000-4000-8000-000000000099'
  $$,
  'update legítimo no escopo é permitido'
);

select extensions.is(
  (select count(*)::integer from public.audit_events
   where entity_id = 'a1000000-0000-4000-8000-000000000099'
     and action = 'people.update'),
  1,
  'update de pessoa gera auditoria automática'
);

select extensions.lives_ok(
  $$ delete from public.people where id = 'a1000000-0000-4000-8000-000000000099' $$,
  'delete autorizado e com módulo ativo é permitido'
);

select extensions.is(
  (select count(*)::integer from public.audit_events
   where entity_id = 'a1000000-0000-4000-8000-000000000099'
     and action = 'people.delete'),
  1,
  'delete de pessoa gera auditoria automática'
);

reset role;
select extensions.throws_ok(
  $$
    update public.org_units
    set parent_id = '11110000-0000-4000-8000-000000000001'
    where id = '11000000-0000-4000-8000-000000000001'
  $$,
  '23514',
  'A unidade não pode ser movida para dentro da própria subárvore.',
  'movimentação não pode criar ciclo na hierarquia interna'
);

select extensions.lives_ok(
  $$
    insert into public.tenant_relationships(
      source_tenant_id, target_tenant_id, relationship_type, status
    ) values (
      '10000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000003',
      'administration',
      'active'
    )
  $$,
  'primeiro vínculo administrativo acíclico é permitido'
);

select extensions.throws_ok(
  $$
    insert into public.tenant_relationships(
      source_tenant_id, target_tenant_id, relationship_type, status
    ) values (
      '30000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000001',
      'administration',
      'active'
    )
  $$,
  '23514',
  'O vínculo criaria um ciclo administrativo entre tenants.',
  'vínculos administrativos não podem formar ciclo entre tenants'
);

select extensions.is(
  (
    select count(*)::integer
    from public.security_table_registry registry
    join pg_class relation on relation.relname = registry.table_name
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and registry.contains_personal_data
      and not relation.relrowsecurity
  ),
  0,
  'todas as tabelas pessoais existentes no inventário possuem RLS habilitado'
);

select extensions.is(
  (
    select count(*)::integer
    from public.security_table_registry registry
    join pg_class relation on relation.relname = registry.table_name
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and registry.contains_personal_data
      and not relation.relforcerowsecurity
  ),
  0,
  'todas as tabelas pessoais existentes no inventário possuem RLS forçado'
);

select extensions.is(
  (
    select count(*)::integer
    from public.security_table_registry registry
    join pg_class relation on relation.relname = registry.table_name
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and registry.contains_personal_data
      and (
        has_table_privilege('anon', relation.oid, 'SELECT')
        or has_table_privilege('anon', relation.oid, 'INSERT')
        or has_table_privilege('anon', relation.oid, 'UPDATE')
        or has_table_privilege('anon', relation.oid, 'DELETE')
      )
  ),
  0,
  'papel anon não possui privilégios DML em tabelas pessoais inventariadas'
);

select extensions.is(
  (
    select count(*)::integer
    from public.security_table_registry registry
    join pg_class relation on relation.relname = registry.table_name
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and registry.lifecycle = 'active'
      and registry.contains_personal_data
      and not exists (
        select 1
        from pg_policies policy
        where policy.schemaname = 'public'
          and policy.tablename = registry.table_name
      )
  ),
  0,
  'tabelas pessoais ativas possuem pelo menos uma policy explícita'
);

create table public.qa_legacy_people(id bigint primary key);
grant select on public.qa_legacy_people to anon;

select extensions.lives_ok(
  $$ select public.enforce_legacy_table_security('public.qa_legacy_people'::regclass) $$,
  'helper de contenção pode proteger uma tabela legada'
);

select extensions.ok(
  (
    select relation.relrowsecurity and relation.relforcerowsecurity
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'qa_legacy_people'
  ),
  'helper habilita e força RLS na tabela legada'
);

select extensions.is(
  has_table_privilege('anon', 'public.qa_legacy_people', 'SELECT'),
  false,
  'helper revoga privilégios de anon na tabela legada'
);

set local role anon;

select extensions.throws_ok(
  $$ select * from public.people $$,
  '42501',
  null,
  'papel anon não possui acesso à tabela de pessoas'
);

reset role;
select * from extensions.finish();
rollback;
