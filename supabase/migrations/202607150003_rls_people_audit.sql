begin;

create table public.people (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  org_unit_id uuid not null,
  display_name text not null check (length(trim(display_name)) between 2 and 200),
  status text not null default 'active' check (status in ('active', 'inactive', 'visitor', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (tenant_id, org_unit_id)
    references public.org_units(tenant_id, id) on delete restrict,
  unique (tenant_id, id)
);

create index people_tenant_org_status_idx
  on public.people(tenant_id, org_unit_id, status);
create index people_tenant_name_idx
  on public.people(tenant_id, lower(display_name));

create table public.audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  org_unit_id uuid,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  foreign key (tenant_id, org_unit_id)
    references public.org_units(tenant_id, id) on delete restrict
);

create index audit_events_tenant_time_idx
  on public.audit_events(tenant_id, occurred_at desc);
create index audit_events_tenant_entity_idx
  on public.audit_events(tenant_id, entity_type, entity_id);

create or replace function public.has_people_read_access(
  p_tenant_id uuid,
  p_org_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (
    public.tenant_has_module(p_tenant_id, 'people')
    and public.has_permission(p_tenant_id, 'people.read', p_org_unit_id)
  ) or exists (
    select 1
    from public.data_sharing_grants grant_record
    join public.tenant_relationships relationship
      on relationship.id = grant_record.relationship_id
    join public.tenant_memberships target_membership
      on target_membership.tenant_id = grant_record.target_tenant_id
     and target_membership.user_id = auth.uid()
     and target_membership.status = 'active'
    join public.tenants target_tenant
      on target_tenant.id = target_membership.tenant_id
     and target_tenant.status = 'active'
    where grant_record.source_tenant_id = p_tenant_id
      and grant_record.module_key = 'people'
      and 'read' = any(grant_record.allowed_actions)
      and grant_record.status = 'active'
      and grant_record.valid_from <= now()
      and (grant_record.valid_until is null or grant_record.valid_until > now())
      and relationship.status = 'active'
      and relationship.valid_from <= now()
      and (relationship.valid_until is null or relationship.valid_until > now())
      and public.tenant_has_module(p_tenant_id, 'people')
      and public.has_permission(grant_record.target_tenant_id, 'people.read', null)
      and (
        grant_record.scope_org_unit_id is null
        or public.is_org_in_scope(
          p_tenant_id,
          grant_record.scope_org_unit_id,
          p_org_unit_id
        )
      )
  );
$$;

create or replace function public.has_people_write_access(
  p_tenant_id uuid,
  p_org_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.tenant_has_module(p_tenant_id, 'people')
     and public.has_permission(p_tenant_id, 'people.write', p_org_unit_id);
$$;

create or replace function public.record_audit_event(
  p_tenant_id uuid,
  p_org_unit_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_request_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_id bigint;
begin
  if not public.is_active_tenant_member(p_tenant_id) then
    raise exception 'Acesso negado ao tenant.' using errcode = '42501';
  end if;

  if p_metadata ?| array['password', 'token', 'secret', 'document', 'pastoral_note'] then
    raise exception 'Metadados de auditoria contêm chave proibida.' using errcode = '22023';
  end if;

  insert into public.audit_events(
    tenant_id, org_unit_id, actor_user_id, action, entity_type,
    entity_id, request_id, metadata
  ) values (
    p_tenant_id, p_org_unit_id, auth.uid(), p_action, p_entity_type,
    p_entity_id, p_request_id, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

revoke all on function public.has_people_read_access(uuid, uuid) from public;
revoke all on function public.has_people_write_access(uuid, uuid) from public;
revoke all on function public.record_audit_event(uuid, uuid, text, text, uuid, uuid, jsonb) from public;
grant execute on function public.has_people_read_access(uuid, uuid) to authenticated;
grant execute on function public.has_people_write_access(uuid, uuid) to authenticated;
grant execute on function public.record_audit_event(uuid, uuid, text, text, uuid, uuid, jsonb) to authenticated;

alter table public.tenants enable row level security;
alter table public.tenants force row level security;
alter table public.org_units enable row level security;
alter table public.org_units force row level security;
alter table public.org_unit_closure enable row level security;
alter table public.org_unit_closure force row level security;
alter table public.tenant_relationships enable row level security;
alter table public.tenant_relationships force row level security;
alter table public.data_sharing_grants enable row level security;
alter table public.data_sharing_grants force row level security;
alter table public.external_references enable row level security;
alter table public.external_references force row level security;
alter table public.user_profiles enable row level security;
alter table public.user_profiles force row level security;
alter table public.tenant_memberships enable row level security;
alter table public.tenant_memberships force row level security;
alter table public.permissions enable row level security;
alter table public.permissions force row level security;
alter table public.roles enable row level security;
alter table public.roles force row level security;
alter table public.role_permissions enable row level security;
alter table public.role_permissions force row level security;
alter table public.access_assignments enable row level security;
alter table public.access_assignments force row level security;
alter table public.module_catalog enable row level security;
alter table public.module_catalog force row level security;
alter table public.plans enable row level security;
alter table public.plans force row level security;
alter table public.plan_modules enable row level security;
alter table public.plan_modules force row level security;
alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;
alter table public.tenant_entitlements enable row level security;
alter table public.tenant_entitlements force row level security;
alter table public.people enable row level security;
alter table public.people force row level security;
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;

create policy tenants_select_member
  on public.tenants for select to authenticated
  using (public.is_active_tenant_member(id));

create policy org_units_select_member
  on public.org_units for select to authenticated
  using (public.is_active_tenant_member(tenant_id));

create policy org_unit_closure_select_member
  on public.org_unit_closure for select to authenticated
  using (public.is_active_tenant_member(tenant_id));

create policy relationships_select_participant
  on public.tenant_relationships for select to authenticated
  using (
    public.is_active_tenant_member(source_tenant_id)
    or public.is_active_tenant_member(target_tenant_id)
  );

create policy sharing_grants_select_participant
  on public.data_sharing_grants for select to authenticated
  using (
    public.is_active_tenant_member(source_tenant_id)
    or public.is_active_tenant_member(target_tenant_id)
  );

create policy external_references_select_manager
  on public.external_references for select to authenticated
  using (public.has_permission(tenant_id, 'integrations.manage', null));

create policy user_profiles_select_self
  on public.user_profiles for select to authenticated
  using (id = auth.uid());

create policy memberships_select_self_or_manager
  on public.tenant_memberships for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_permission(tenant_id, 'users.read', null)
  );

create policy permissions_select_authenticated
  on public.permissions for select to authenticated
  using (true);

create policy roles_select_member
  on public.roles for select to authenticated
  using (public.is_active_tenant_member(tenant_id));

create policy role_permissions_select_member
  on public.role_permissions for select to authenticated
  using (public.is_active_tenant_member(tenant_id));

create policy assignments_select_self_or_manager
  on public.access_assignments for select to authenticated
  using (
    exists (
      select 1 from public.tenant_memberships membership
      where membership.id = access_assignments.membership_id
        and membership.tenant_id = access_assignments.tenant_id
        and membership.user_id = auth.uid()
    )
    or public.has_permission(tenant_id, 'users.read', org_unit_id)
  );

create policy module_catalog_select_authenticated
  on public.module_catalog for select to authenticated
  using (true);

create policy plans_select_authenticated
  on public.plans for select to authenticated
  using (status = 'active');

create policy plan_modules_select_authenticated
  on public.plan_modules for select to authenticated
  using (exists (
    select 1 from public.plans plan
    where plan.id = plan_modules.plan_id
      and plan.status = 'active'
  ));

create policy subscriptions_select_member
  on public.subscriptions for select to authenticated
  using (public.is_active_tenant_member(tenant_id));

create policy entitlements_select_member
  on public.tenant_entitlements for select to authenticated
  using (public.is_active_tenant_member(tenant_id));

create policy people_select_scoped
  on public.people for select to authenticated
  using (public.has_people_read_access(tenant_id, org_unit_id));

create policy people_insert_scoped
  on public.people for insert to authenticated
  with check (
    public.has_people_write_access(tenant_id, org_unit_id)
    and created_by = auth.uid()
  );

create policy people_update_scoped
  on public.people for update to authenticated
  using (public.has_people_write_access(tenant_id, org_unit_id))
  with check (public.has_people_write_access(tenant_id, org_unit_id));

create policy people_delete_scoped
  on public.people for delete to authenticated
  using (public.has_permission(tenant_id, 'people.delete', org_unit_id));

create policy audit_events_select_auditor
  on public.audit_events for select to authenticated
  using (public.has_permission(tenant_id, 'audit.read', org_unit_id));

-- Escopo intencionalmente limitado às tabelas v2. A remediação das tabelas
-- legadas terá migration própria e rollout separado para não quebrar produção.
revoke all on public.tenants, public.org_units, public.org_unit_closure,
  public.tenant_relationships, public.data_sharing_grants,
  public.external_references, public.user_profiles,
  public.tenant_memberships, public.permissions, public.roles,
  public.role_permissions, public.access_assignments,
  public.module_catalog, public.plans, public.plan_modules,
  public.subscriptions, public.tenant_entitlements,
  public.people, public.audit_events
from anon;

grant select on public.tenants, public.org_units, public.org_unit_closure,
  public.tenant_relationships, public.data_sharing_grants,
  public.user_profiles, public.tenant_memberships, public.permissions,
  public.roles, public.role_permissions, public.access_assignments,
  public.module_catalog, public.plans, public.plan_modules,
  public.subscriptions, public.tenant_entitlements, public.people,
  public.audit_events, public.external_references
to authenticated;

grant insert, update, delete on public.people to authenticated;
grant usage, select on sequence public.audit_events_id_seq to authenticated;

commit;
