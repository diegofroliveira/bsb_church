begin;

-- Dados exclusivamente sintéticos. Nunca substitua este seed por exportações reais.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'authenticated', 'authenticated', 'admin-a@example.invalid', extensions.crypt('synthetic-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'authenticated', 'authenticated', 'leader-a@example.invalid', extensions.crypt('synthetic-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'authenticated', 'authenticated', 'admin-b@example.invalid', extensions.crypt('synthetic-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'authenticated', 'authenticated', 'suspended@example.invalid', extensions.crypt('synthetic-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into public.tenants(id, slug, name, status) values
  ('10000000-0000-4000-8000-000000000001', 'denominacao-demo', 'Denominação Demonstração', 'active'),
  ('20000000-0000-4000-8000-000000000002', 'igreja-vinculada-demo', 'Igreja Vinculada Demonstração', 'active'),
  ('30000000-0000-4000-8000-000000000003', 'igreja-independente-demo', 'Igreja Independente Demonstração', 'active'),
  ('40000000-0000-4000-8000-000000000004', 'tenant-suspenso-demo', 'Tenant Suspenso Demonstração', 'suspended')
on conflict (id) do nothing;

insert into public.org_units(id, tenant_id, parent_id, slug, name, unit_type) values
  ('11000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', null, 'sede-denominacional', 'Sede Denominacional', 'denomination'),
  ('11100000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'regiao-norte', 'Região Norte', 'region'),
  ('11110000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '11100000-0000-4000-8000-000000000001', 'igreja-local-a', 'Igreja Local A', 'church'),
  ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', null, 'igreja-vinculada', 'Igreja Vinculada', 'church'),
  ('31000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', null, 'igreja-independente', 'Igreja Independente', 'church'),
  ('41000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000004', null, 'igreja-suspensa', 'Igreja Suspensa', 'church')
on conflict (id) do nothing;

insert into public.user_profiles(id, display_name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Administrador A'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'Liderança A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'Administrador B'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'Usuário Suspenso')
on conflict (id) do nothing;

insert into public.tenant_memberships(id, tenant_id, user_id, status, joined_at) values
  ('51000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'active', now()),
  ('51000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'active', now()),
  ('52000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'active', now()),
  ('54000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'active', now())
on conflict (id) do nothing;

insert into public.permissions(code, description, sensitivity) values
  ('tenant.manage', 'Administrar configuração do tenant.', 'internal'),
  ('users.read', 'Consultar usuários e atribuições.', 'personal'),
  ('users.manage', 'Convidar e administrar usuários.', 'personal'),
  ('people.read', 'Consultar pessoas no escopo autorizado.', 'personal'),
  ('people.write', 'Criar e alterar pessoas no escopo autorizado.', 'personal'),
  ('people.delete', 'Arquivar ou excluir pessoas conforme política.', 'sensitive'),
  ('people.sensitive', 'Consultar campos pessoais sensíveis.', 'sensitive'),
  ('audit.read', 'Consultar trilhas de auditoria.', 'sensitive'),
  ('integrations.manage', 'Administrar integrações e referências externas.', 'sensitive')
on conflict (code) do update set
  description = excluded.description,
  sensitivity = excluded.sensitivity;

insert into public.roles(id, tenant_id, code, name, is_system) values
  ('61000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'tenant_owner', 'Responsável pelo Tenant', true),
  ('61000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'local_leader', 'Liderança Local', true),
  ('62000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'tenant_owner', 'Responsável pelo Tenant', true),
  ('64000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004', 'tenant_owner', 'Responsável pelo Tenant', true)
on conflict (id) do nothing;

insert into public.role_permissions(tenant_id, role_id, permission_code)
select role.tenant_id, role.id, permission.code
from public.roles role
cross join public.permissions permission
where role.code = 'tenant_owner'
on conflict do nothing;

insert into public.role_permissions(tenant_id, role_id, permission_code) values
  ('10000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002', 'people.read'),
  ('10000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000002', 'people.write')
on conflict do nothing;

insert into public.access_assignments(id, tenant_id, membership_id, role_id, org_unit_id) values
  ('71000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', '61000000-0000-4000-8000-000000000001', null),
  ('71000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000002', '61000000-0000-4000-8000-000000000002', '11100000-0000-4000-8000-000000000001'),
  ('72000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001', null),
  ('74000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004', '54000000-0000-4000-8000-000000000001', '64000000-0000-4000-8000-000000000001', null)
on conflict (id) do nothing;

insert into public.module_catalog(key, name, description, is_foundation) values
  ('foundation', 'Fundação', 'Tenancy, organizações, identidade e auditoria.', true),
  ('people', 'Pessoas e Famílias', 'Cadastro e relacionamentos de pessoas.', false),
  ('groups', 'Grupos e Discipulado', 'Grupos, estruturas e cuidado.', false),
  ('agenda', 'Agenda e Eventos', 'Agenda, eventos, ensino e presença.', false),
  ('finance', 'Financeiro', 'Gestão financeira e contribuições.', false),
  ('portal', 'Portal do Membro', 'Autosserviço e comunicação.', false),
  ('analytics', 'Relatórios e Analytics', 'Indicadores, relatórios e geografia.', false),
  ('integrations', 'Integrações', 'APIs, importação e webhooks.', false),
  ('ai', 'Inteligência Artificial', 'Recursos de IA controlados por consumo.', false)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  is_foundation = excluded.is_foundation;

insert into public.plans(id, code, name, status) values
  ('90000000-0000-4000-8000-000000000001', 'pilot', 'Piloto', 'active')
on conflict (id) do nothing;

insert into public.plan_modules(plan_id, module_key) values
  ('90000000-0000-4000-8000-000000000001', 'foundation'),
  ('90000000-0000-4000-8000-000000000001', 'people')
on conflict do nothing;

insert into public.subscriptions(id, tenant_id, plan_id, status) values
  ('91000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 'trial'),
  ('92000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', 'trial'),
  ('94000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004', '90000000-0000-4000-8000-000000000001', 'trial')
on conflict (id) do nothing;

insert into public.tenant_relationships(
  id, source_tenant_id, target_tenant_id, relationship_type, status
) values (
  '81000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'affiliation',
  'active'
)
on conflict (id) do nothing;

insert into public.people(id, tenant_id, org_unit_id, display_name, status, created_by) values
  ('a1000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'Pessoa Sintética da Sede', 'active', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  ('a1000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '11110000-0000-4000-8000-000000000001', 'Pessoa Sintética da Igreja Local', 'active', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  ('b1000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', 'Pessoa Sintética do Tenant B', 'active', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'),
  ('d1000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000004', '41000000-0000-4000-8000-000000000004', 'Pessoa Sintética do Tenant Suspenso', 'active', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1')
on conflict (id) do nothing;

commit;
