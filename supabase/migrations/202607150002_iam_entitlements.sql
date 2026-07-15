begin;

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'active', 'suspended', 'ended')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id),
  unique (tenant_id, id)
);

create index tenant_memberships_user_idx
  on public.tenant_memberships(user_id, status, tenant_id);

create table public.permissions (
  code text primary key check (code ~ '^[a-z][a-z0-9_.-]+$'),
  description text not null,
  sensitivity text not null default 'internal'
    check (sensitivity in ('public', 'internal', 'personal', 'sensitive'))
);

create table public.roles (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null check (code ~ '^[a-z][a-z0-9_.-]+$'),
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, code),
  unique (tenant_id, id)
);

create table public.role_permissions (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role_id uuid not null,
  permission_code text not null references public.permissions(code) on delete cascade,
  primary key (tenant_id, role_id, permission_code),
  foreign key (tenant_id, role_id)
    references public.roles(tenant_id, id) on delete cascade
);

create table public.access_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  membership_id uuid not null,
  role_id uuid not null,
  org_unit_id uuid,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, membership_id)
    references public.tenant_memberships(tenant_id, id) on delete cascade,
  foreign key (tenant_id, role_id)
    references public.roles(tenant_id, id) on delete cascade,
  foreign key (tenant_id, org_unit_id)
    references public.org_units(tenant_id, id) on delete cascade,
  constraint access_assignments_valid_period
    check (valid_until is null or valid_until > valid_from),
  unique (tenant_id, membership_id, role_id, org_unit_id)
);

create index access_assignments_membership_idx
  on public.access_assignments(tenant_id, membership_id, valid_until);

create table public.module_catalog (
  key text primary key check (key ~ '^[a-z][a-z0-9_.-]+$'),
  name text not null,
  description text,
  is_foundation boolean not null default false,
  usage_unit text,
  created_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_.-]+$'),
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  created_at timestamptz not null default now()
);

create table public.plan_modules (
  plan_id uuid not null references public.plans(id) on delete cascade,
  module_key text not null references public.module_catalog(key) on delete cascade,
  limits jsonb not null default '{}'::jsonb,
  primary key (plan_id, module_key)
);

create table public.subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status text not null default 'trial' check (status in ('trial', 'active', 'past_due', 'suspended', 'cancelled')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  constraint subscriptions_valid_period check (ends_at is null or ends_at > starts_at)
);

create unique index subscriptions_one_current_per_tenant_idx
  on public.subscriptions(tenant_id)
  where status in ('trial', 'active', 'past_due');

create table public.tenant_entitlements (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_key text not null references public.module_catalog(key) on delete cascade,
  enabled boolean not null default true,
  limits jsonb not null default '{}'::jsonb,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  constraint tenant_entitlements_valid_period
    check (valid_until is null or valid_until > valid_from)
);

create index tenant_entitlements_lookup_idx
  on public.tenant_entitlements(tenant_id, module_key, enabled, valid_until);

create or replace function public.is_active_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tenant_memberships m
    join public.tenants t on t.id = m.tenant_id
    where m.tenant_id = p_tenant_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and t.status = 'active'
  );
$$;

create or replace function public.is_org_in_scope(
  p_tenant_id uuid,
  p_scope_org_unit_id uuid,
  p_target_org_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_scope_org_unit_id is null
    or exists (
      select 1
      from public.org_unit_closure c
      where c.tenant_id = p_tenant_id
        and c.ancestor_id = p_scope_org_unit_id
        and c.descendant_id = p_target_org_unit_id
    );
$$;

create or replace function public.has_permission(
  p_tenant_id uuid,
  p_permission_code text,
  p_org_unit_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tenant_memberships membership
    join public.tenants tenant on tenant.id = membership.tenant_id
    join public.access_assignments assignment
      on assignment.tenant_id = membership.tenant_id
     and assignment.membership_id = membership.id
    join public.role_permissions role_permission
      on role_permission.tenant_id = assignment.tenant_id
     and role_permission.role_id = assignment.role_id
    where membership.tenant_id = p_tenant_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and tenant.status = 'active'
      and role_permission.permission_code = p_permission_code
      and assignment.valid_from <= now()
      and (assignment.valid_until is null or assignment.valid_until > now())
      and (
        assignment.org_unit_id is null
        or (
          p_org_unit_id is not null
          and exists (
            select 1
            from public.org_unit_closure c
            where c.tenant_id = p_tenant_id
              and c.ancestor_id = assignment.org_unit_id
              and c.descendant_id = p_org_unit_id
          )
        )
      )
  );
$$;

create or replace function public.tenant_has_module(
  p_tenant_id uuid,
  p_module_key text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.tenants tenant
    join public.module_catalog module on module.key = p_module_key
    where tenant.id = p_tenant_id
      and tenant.status = 'active'
      and (
        module.is_foundation
        or exists (
          select 1
          from public.tenant_entitlements entitlement
          where entitlement.tenant_id = p_tenant_id
            and entitlement.module_key = p_module_key
            and entitlement.enabled
            and entitlement.valid_from <= now()
            and (entitlement.valid_until is null or entitlement.valid_until > now())
        )
        or exists (
          select 1
          from public.subscriptions subscription
          join public.plan_modules plan_module on plan_module.plan_id = subscription.plan_id
          where subscription.tenant_id = p_tenant_id
            and subscription.status in ('trial', 'active')
            and subscription.starts_at <= now()
            and (subscription.ends_at is null or subscription.ends_at > now())
            and plan_module.module_key = p_module_key
        )
      )
  );
$$;

create or replace function public.get_my_contexts()
returns table (
  tenant_id uuid,
  tenant_name text,
  membership_id uuid,
  org_unit_id uuid,
  role_code text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select membership.tenant_id,
         tenant.name,
         membership.id,
         assignment.org_unit_id,
         role.code
  from public.tenant_memberships membership
  join public.tenants tenant on tenant.id = membership.tenant_id
  left join public.access_assignments assignment
    on assignment.tenant_id = membership.tenant_id
   and assignment.membership_id = membership.id
   and assignment.valid_from <= now()
   and (assignment.valid_until is null or assignment.valid_until > now())
  left join public.roles role
    on role.tenant_id = assignment.tenant_id
   and role.id = assignment.role_id
  where membership.user_id = auth.uid()
    and membership.status = 'active'
    and tenant.status = 'active';
$$;

revoke all on function public.is_active_tenant_member(uuid) from public;
revoke all on function public.is_org_in_scope(uuid, uuid, uuid) from public;
revoke all on function public.has_permission(uuid, text, uuid) from public;
revoke all on function public.tenant_has_module(uuid, text) from public;
revoke all on function public.get_my_contexts() from public;

grant execute on function public.is_active_tenant_member(uuid) to authenticated;
grant execute on function public.is_org_in_scope(uuid, uuid, uuid) to authenticated;
grant execute on function public.has_permission(uuid, text, uuid) to authenticated;
grant execute on function public.tenant_has_module(uuid, text) to authenticated;
grant execute on function public.get_my_contexts() to authenticated;

commit;
