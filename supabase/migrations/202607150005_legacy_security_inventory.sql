begin;

create table public.security_table_registry (
  table_name text primary key check (table_name ~ '^[a-z][a-z0-9_]*$'),
  classification text not null
    check (classification in ('public', 'internal', 'personal', 'sensitive')),
  contains_personal_data boolean not null default false,
  lifecycle text not null default 'active'
    check (lifecycle in ('active', 'legacy', 'retired')),
  notes text,
  created_at timestamptz not null default now()
);

insert into public.security_table_registry(
  table_name, classification, contains_personal_data, lifecycle, notes
) values
  ('people', 'personal', true, 'active', 'Fatia vertical v2 da Sprint 0.'),
  ('audit_events', 'sensitive', true, 'active', 'Trilha de operações sensíveis.'),
  ('user_profiles', 'personal', true, 'active', 'Identidade de apresentação do usuário.'),
  ('tenant_memberships', 'personal', true, 'active', 'Vínculos de usuários com tenants.'),
  ('membros', 'sensitive', true, 'legacy', 'Cadastro legado.'),
  ('celulas', 'personal', true, 'legacy', 'Grupos e respectivas lideranças.'),
  ('discipulado', 'sensitive', true, 'legacy', 'Relacionamentos de cuidado.'),
  ('financeiro', 'sensitive', true, 'legacy', 'Movimentações financeiras.'),
  ('eventos', 'personal', true, 'legacy', 'Eventos e inscrições legadas.'),
  ('pessoas_familiares', 'sensitive', true, 'legacy', 'Relacionamentos familiares.'),
  ('pessoas_historico', 'sensitive', true, 'legacy', 'Histórico individual.'),
  ('pessoas_funcoes', 'personal', true, 'legacy', 'Funções individuais.'),
  ('localidades', 'personal', true, 'legacy', 'Estrutura e participantes.'),
  ('orcamento', 'sensitive', true, 'legacy', 'Orçamento financeiro.'),
  ('profiles', 'personal', true, 'legacy', 'Perfis de autenticação legados.')
on conflict (table_name) do update set
  classification = excluded.classification,
  contains_personal_data = excluded.contains_personal_data,
  lifecycle = excluded.lifecycle,
  notes = excluded.notes;

create or replace function public.enforce_legacy_table_security(p_table regclass)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  execute format('revoke all privileges on table %s from anon', p_table);
  execute format('alter table %s enable row level security', p_table);
  execute format('alter table %s force row level security', p_table);
end;
$$;

do $$
declare
  legacy_name text;
  legacy_table regclass;
begin
  foreach legacy_name in array array[
    'membros', 'celulas', 'discipulado', 'financeiro', 'eventos',
    'pessoas_familiares', 'pessoas_historico', 'pessoas_funcoes',
    'localidades', 'orcamento', 'profiles'
  ] loop
    legacy_table := to_regclass('public.' || legacy_name);
    if legacy_table is not null then
      perform public.enforce_legacy_table_security(legacy_table);
    end if;
  end loop;
end;
$$;

revoke all on function public.enforce_legacy_table_security(regclass) from public;

alter table public.security_table_registry enable row level security;
alter table public.security_table_registry force row level security;

create policy security_registry_select_authenticated
  on public.security_table_registry for select to authenticated
  using (true);

revoke all on public.security_table_registry from anon;
grant select on public.security_table_registry to authenticated;

commit;
