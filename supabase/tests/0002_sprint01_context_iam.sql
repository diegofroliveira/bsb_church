begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(71);

select extensions.ok(
  to_regprocedure('public.get_my_contexts()') is not null,
  'RPC de listagem de contextos existe'
);
select extensions.ok(
  to_regprocedure('public.set_my_active_context(uuid,uuid)') is not null,
  'RPC de selecao de contexto existe'
);
select extensions.ok(
  to_regprocedure('public.get_my_capabilities()') is not null,
  'RPC de capabilities existe'
);
select extensions.ok(
  to_regprocedure('public.onboard_tenant(text,text)') is not null,
  'contrato simplificado de onboarding existe'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);

select extensions.is(
  (select count(*)::integer from public.get_my_contexts()),
  1,
  'administrador A recebe somente seu contexto'
);
select extensions.ok(
  'users.manage' = any((select permissions from public.get_my_capabilities())),
  'capabilities do administrador A incluem gestao de usuarios'
);
select extensions.ok(
  'foundation' = any((select modules from public.get_my_capabilities())),
  'capabilities incluem o modulo foundation'
);
select extensions.ok(
  'people' = any((select modules from public.get_my_capabilities())),
  'capabilities incluem modulo contratado pelo tenant A'
);
select extensions.throws_ok(
  $$ select public.set_my_active_context(
    '20000000-0000-4000-8000-000000000002', null
  ) $$,
  '42501',
  'Contexto nao pertence ao usuario autenticado.',
  'administrador A nao ativa contexto do tenant B'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', true);

select extensions.lives_ok(
  $$ select public.set_my_active_context(
    '10000000-0000-4000-8000-000000000001',
    '11110000-0000-4000-8000-000000000001'
  ) $$,
  'lider pode ativar unidade descendente do escopo atribuido'
);
select extensions.throws_ok(
  $$ select public.set_my_active_context(
    '10000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001'
  ) $$,
  '42501',
  'Unidade fora do escopo do usuario.',
  'lider nao ativa unidade ancestral fora do seu escopo'
);
select extensions.ok(
  'people.read' = any((select permissions from public.get_my_capabilities())),
  'lider recebe permissao de leitura no contexto ativo'
);
select extensions.ok(
  not ('users.manage' = any((select permissions from public.get_my_capabilities()))),
  'lider nao recebe capability administrativa'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', true);

select extensions.is(
  (select count(*)::integer from public.tenant_invitations
   where tenant_id = '10000000-0000-4000-8000-000000000001'),
  0,
  'administrador B nao consulta convites do tenant A'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', true);

select extensions.throws_ok(
  $$ select * from public.create_tenant_invitation(
    '10000000-0000-4000-8000-000000000001',
    'without-membership@example.invalid',
    '61000000-0000-4000-8000-000000000002',
    '11110000-0000-4000-8000-000000000001',
    interval '7 days'
  ) $$,
  '42501',
  'Sem permissao para convidar usuarios.',
  'lider sem capability IAM nao cria convite'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);

select extensions.lives_ok(
  $$ select set_config('test.invitation_token', invitation_token, true)
     from public.create_tenant_invitation(
       '10000000-0000-4000-8000-000000000001',
       'without-membership@example.invalid',
       '61000000-0000-4000-8000-000000000002',
       '11110000-0000-4000-8000-000000000001',
       interval '7 days'
     ) $$,
  'administrador A cria convite e recebe token somente uma vez'
);
select extensions.is(
  (select count(*)::integer from public.tenant_invitations
   where tenant_id = '10000000-0000-4000-8000-000000000001'
     and email = 'without-membership@example.invalid'
     and status = 'pending'),
  1,
  'convite persiste pendente apenas com token em hash'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', true);

select extensions.is(
  (select count(*)::integer from public.tenant_invitations
   where email = 'without-membership@example.invalid'),
  0,
  'administrador B nao enxerga convite nominal do tenant A'
);
select extensions.throws_ok(
  $$ select public.accept_tenant_invitation(current_setting('test.invitation_token')) $$,
  '42501',
  'Convite destinado a outra identidade.',
  'identidade com e-mail diferente nao aceita convite conhecido'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', true);

select extensions.lives_ok(
  $$ select public.accept_tenant_invitation(current_setting('test.invitation_token')) $$,
  'destinatario autenticado aceita convite valido'
);
select extensions.is(
  (select count(*)::integer from public.tenant_memberships
   where tenant_id = '10000000-0000-4000-8000-000000000001'
     and user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'
     and status = 'active'),
  1,
  'aceite cria membership ativa no tenant correto'
);
select extensions.is(
  (select count(*)::integer
   from public.access_assignments assignment
   join public.tenant_memberships membership
     on membership.tenant_id = assignment.tenant_id
    and membership.id = assignment.membership_id
   where membership.user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'
     and assignment.tenant_id = '10000000-0000-4000-8000-000000000001'
     and assignment.role_id = '61000000-0000-4000-8000-000000000002'
     and assignment.org_unit_id = '11110000-0000-4000-8000-000000000001'),
  1,
  'aceite atribui role e escopo descritos no convite'
);
select extensions.throws_ok(
  $$ select public.accept_tenant_invitation(current_setting('test.invitation_token')) $$,
  '22023',
  'Convite invalido ou expirado.',
  'token aceito nao pode ser reutilizado'
);
select extensions.is(
  (select org_unit_id from public.user_active_contexts
   where user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),
  '11110000-0000-4000-8000-000000000001'::uuid,
  'aceite seleciona o contexto autorizado'
);
select extensions.ok(
  'people.read' = any((select permissions from public.get_my_capabilities())),
  'novo usuario recebe capabilities da role convidada'
);
select extensions.ok(
  not ('users.manage' = any((select permissions from public.get_my_capabilities()))),
  'convite de lider nao eleva usuario a administrador'
);
select extensions.throws_ok(
  $$ select public.create_tenant_role(
    '10000000-0000-4000-8000-000000000001',
    'escalada', 'Escalada indevida', null,
    array['users.manage']::text[]
  ) $$,
  '42501',
  'Sem permissao para administrar roles.',
  'usuario convidado nao cria role privilegiada'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);

select extensions.lives_ok(
  $$ select set_config(
       'test.custom_role_id',
       public.create_tenant_role(
         '10000000-0000-4000-8000-000000000001',
         'secretaria_sintetica', 'Secretaria sintetica', 'Role QA',
         array['people.read', 'people.write']::text[]
       )::text,
       true
     ) $$,
  'administrador cria role customizada com catalogo controlado'
);
select extensions.is(
  (select tenant_id from public.roles
   where id = current_setting('test.custom_role_id')::uuid),
  '10000000-0000-4000-8000-000000000001'::uuid,
  'role customizada pertence ao tenant A'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', true);

select extensions.throws_ok(
  $$ select public.update_tenant_role(
    '10000000-0000-4000-8000-000000000001',
    current_setting('test.custom_role_id')::uuid,
    'Role adulterada', null, array['users.manage']::text[]
  ) $$,
  '42501',
  'Sem permissao para administrar roles.',
  'administrador B nao altera role do tenant A'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);

select extensions.throws_ok(
  $$ select public.create_tenant_role(
    '10000000-0000-4000-8000-000000000001',
    'invalida', 'Role invalida', null,
    array['permission.does.not.exist']::text[]
  ) $$,
  '22023',
  'Catalogo de permissoes contem chave desconhecida.',
  'role nao aceita permissao fora do catalogo'
);
select extensions.lives_ok(
  $$ select public.assign_tenant_role(
    '10000000-0000-4000-8000-000000000001',
    (select id from public.tenant_memberships
     where tenant_id = '10000000-0000-4000-8000-000000000001'
       and user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),
    current_setting('test.custom_role_id')::uuid,
    '11110000-0000-4000-8000-000000000001', null
  ) $$,
  'administrador atribui role customizada no proprio tenant'
);
select extensions.throws_ok(
  $$ select public.assign_tenant_role(
    '10000000-0000-4000-8000-000000000001',
    '52000000-0000-4000-8000-000000000001',
    current_setting('test.custom_role_id')::uuid,
    null, null
  ) $$,
  '23503',
  'Membership ativa nao pertence ao tenant.',
  'assignment rejeita membership do tenant B'
);
select extensions.throws_ok(
  $$ insert into public.tenant_invitations(
       tenant_id, email, token_hash, role_id, invited_by, expires_at
     ) values (
       '10000000-0000-4000-8000-000000000001', 'direct@example.invalid',
       extensions.digest('direct-token', 'sha256'),
       '61000000-0000-4000-8000-000000000002',
       'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', now() + interval '1 day'
     ) $$,
  '42501', null,
  'DML direto de convite permanece fechado ao cliente autenticado'
);
select extensions.is(
  (select count(*)::integer from public.audit_events
   where action = 'iam.invitation.create'
     and actor_user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  1,
  'criacao de convite gera auditoria administrativa'
);
select extensions.is(
  (select count(*)::integer from public.audit_events
   where action = 'iam.invitation.accept'
     and actor_user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),
  1,
  'aceite de convite gera auditoria com ator correto'
);
select extensions.is(
  (select count(*)::integer from public.audit_events
   where action = 'iam.role.create'
     and entity_id = current_setting('test.custom_role_id')::uuid),
  1,
  'criacao de role gera auditoria'
);
select extensions.lives_ok(
  $$ select public.set_tenant_membership_status(
    '10000000-0000-4000-8000-000000000001',
    (select id from public.tenant_memberships
     where tenant_id = '10000000-0000-4000-8000-000000000001'
       and user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),
    'suspended'
  ) $$,
  'administrador suspende membership de outro usuario'
);
select extensions.is(
  (select count(*)::integer from public.user_active_contexts
   where user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),
  0,
  'suspensao remove imediatamente o contexto ativo do usuario'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', true);

select extensions.is(
  (select count(*)::integer from public.get_my_capabilities()),
  0,
  'membership suspensa nao retorna capabilities'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);

select extensions.throws_ok(
  $$ select public.set_tenant_membership_status(
    '10000000-0000-4000-8000-000000000001',
    '51000000-0000-4000-8000-000000000001',
    'suspended'
  ) $$,
  '42501',
  'Usuario nao pode suspender a propria membership.',
  'administrador nao remove acidentalmente o proprio acesso'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', true);

select extensions.lives_ok(
  $$ select set_config(
       'test.new_tenant_id',
       public.onboard_tenant('Nova Igreja Sintetica', 'Comunidade Sintetica')::text,
       true
     ) $$,
  'usuario autenticado sem contexto ativo conclui onboarding atomico'
);
select extensions.is(
  (select count(*)::integer from public.tenants
   where id = current_setting('test.new_tenant_id')::uuid),
  1,
  'onboarding cria tenant visivel ao responsavel'
);
select extensions.is(
  (select count(*)::integer from public.tenant_memberships
   where tenant_id = current_setting('test.new_tenant_id')::uuid
     and user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'
     and status = 'active'),
  1,
  'onboarding cria membership ativa do responsavel'
);
select extensions.is(
  (select count(*)::integer from public.org_units
   where tenant_id = current_setting('test.new_tenant_id')::uuid
     and parent_id is null and unit_type = 'church'),
  1,
  'onboarding cria unidade raiz do tipo igreja'
);
select extensions.is(
  (select count(*)::integer
   from public.access_assignments assignment
   join public.roles role
     on role.tenant_id = assignment.tenant_id and role.id = assignment.role_id
   join public.tenant_memberships membership
     on membership.tenant_id = assignment.tenant_id
    and membership.id = assignment.membership_id
   where assignment.tenant_id = current_setting('test.new_tenant_id')::uuid
     and membership.user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'
     and role.code = 'tenant_owner'
     and assignment.org_unit_id is null),
  1,
  'onboarding concede role sistemica tenant_owner'
);
select extensions.is(
  (select count(*)::integer from public.user_active_contexts
   where user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'
     and tenant_id = current_setting('test.new_tenant_id')::uuid),
  1,
  'onboarding seleciona contexto do novo tenant'
);
select extensions.is(
  (select count(*)::integer from public.audit_events
   where tenant_id = current_setting('test.new_tenant_id')::uuid
     and action = 'tenant.onboard'),
  1,
  'onboarding gera auditoria atomica'
);
select extensions.is(
  (select slug::text from public.tenants
   where id = current_setting('test.new_tenant_id')::uuid),
  'nova-igreja-sintetica',
  'onboarding simplificado normaliza slug legivel'
);
select extensions.ok(
  'iam.role.manage' = any((select permissions from public.get_my_capabilities())),
  'responsavel recebe capability IAM no tenant criado'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', true);

select extensions.is(
  (select count(*)::integer from public.tenants
   where id = current_setting('test.new_tenant_id')::uuid),
  0,
  'administrador B nao consulta tenant criado por outra identidade'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1', true);

select extensions.is(
  (select count(*)::integer from public.people),
  2,
  'usuario multitenant ve somente pessoas do contexto A inicialmente'
);
select extensions.lives_ok(
  $$ select public.set_my_active_context(
    '20000000-0000-4000-8000-000000000002', null
  ) $$,
  'usuario multitenant troca explicitamente para o contexto B'
);
select extensions.is(
  (select count(*)::integer from public.people),
  1,
  'troca para contexto B remove imediatamente dados operacionais de A'
);
select extensions.is(
  (select count(*)::integer from public.tenants
   where id = '10000000-0000-4000-8000-000000000001'),
  0,
  'policy de tenant tambem respeita somente o contexto ativo B'
);
select extensions.is(
  (select count(*)::integer from public.get_my_contexts()),
  2,
  'get_my_contexts continua listando memberships A e B para permitir troca'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);

select extensions.is(
  (select count(*)::integer from public.list_tenant_memberships(
    '10000000-0000-4000-8000-000000000001'
  )),
  4,
  'administrador lista memberships de todos os status no tenant ativo'
);
select extensions.is(
  (select email_masked from public.list_tenant_memberships(
    '10000000-0000-4000-8000-000000000001'
  ) where user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'),
  'w***@example.invalid',
  'listagem administrativa mascara o e-mail'
);
select extensions.is(
  (select count(*)::integer from public.list_tenant_memberships(
    '10000000-0000-4000-8000-000000000001'
  ) where email_masked = 'without-membership@example.invalid'),
  0,
  'RPC nao retorna e-mail completo em coluna de apresentacao'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', true);
select extensions.throws_ok(
  $$ select * from public.list_tenant_memberships(
    '10000000-0000-4000-8000-000000000001'
  ) $$,
  '42501',
  'Sem permissao para consultar memberships.',
  'administrador B nao lista memberships do tenant A'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);

select extensions.lives_ok(
  $$ select set_config(
    'test.new_org_unit_id',
    public.create_org_unit(
      '10000000-0000-4000-8000-000000000001',
      'Congregacao Sintetica', 'congregation',
      '11000000-0000-4000-8000-000000000001'
    )::text,
    true
  ) $$,
  'administrador cria unidade na arvore do tenant ativo'
);
select extensions.is(
  (select count(*)::integer from public.org_unit_closure
   where tenant_id = '10000000-0000-4000-8000-000000000001'
     and ancestor_id = current_setting('test.new_org_unit_id')::uuid
     and descendant_id = current_setting('test.new_org_unit_id')::uuid
     and depth = 0),
  1,
  'trigger inclui nova unidade na closure table'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', true);
select extensions.throws_ok(
  $$ select public.create_org_unit(
    '10000000-0000-4000-8000-000000000001',
    'Unidade indevida', 'church', null
  ) $$,
  '42501',
  'Sem permissao para administrar a arvore organizacional.',
  'administrador B nao cria unidade no tenant A'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select extensions.lives_ok(
  $$ select public.update_org_unit(
    '10000000-0000-4000-8000-000000000001',
    current_setting('test.new_org_unit_id')::uuid,
    'Congregacao Sintetica Atualizada',
    '11100000-0000-4000-8000-000000000001'
  ) $$,
  'administrador move e renomeia unidade no tenant ativo'
);
select extensions.is(
  (select count(*)::integer from public.org_unit_closure
   where tenant_id = '10000000-0000-4000-8000-000000000001'
     and ancestor_id = '11100000-0000-4000-8000-000000000001'
     and descendant_id = current_setting('test.new_org_unit_id')::uuid),
  1,
  'movimentacao recalcula ancestral regional na closure table'
);
select extensions.throws_ok(
  $$ select public.update_org_unit(
    '10000000-0000-4000-8000-000000000001',
    current_setting('test.new_org_unit_id')::uuid,
    'Tentativa cruzada',
    '21000000-0000-4000-8000-000000000002'
  ) $$,
  '23503',
  'Unidade pai nao pertence ao tenant.',
  'movimentacao rejeita pai do tenant B'
);
select extensions.throws_ok(
  $$ select public.update_org_unit(
    '10000000-0000-4000-8000-000000000001',
    '11100000-0000-4000-8000-000000000001',
    'Regiao Norte',
    current_setting('test.new_org_unit_id')::uuid
  ) $$,
  '23514', null,
  'movimentacao administrativa nao cria ciclo na arvore'
);
select extensions.is(
  (select count(*)::integer from public.audit_events
   where action = 'org.unit.create'
     and entity_id = current_setting('test.new_org_unit_id')::uuid),
  1,
  'criacao de unidade gera auditoria'
);
select extensions.is(
  (select count(*)::integer from public.audit_events
   where action = 'org.unit.update'
     and entity_id = current_setting('test.new_org_unit_id')::uuid),
  1,
  'movimentacao de unidade gera auditoria'
);

reset role;
select extensions.is(
  (select count(*)::integer from public.security_table_registry
   where table_name in ('user_active_contexts', 'tenant_invitations')
     and contains_personal_data and lifecycle = 'active'),
  2,
  'novas tabelas pessoais constam no inventario de seguranca'
);
select extensions.is(
  (
    select count(*)::integer
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in ('user_active_contexts', 'tenant_invitations')
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ),
  2,
  'novas tabelas possuem RLS habilitado e forcado'
);

select * from extensions.finish();
rollback;
