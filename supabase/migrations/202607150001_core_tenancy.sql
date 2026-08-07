begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create table public.tenants (
  id uuid primary key default extensions.gen_random_uuid(),
  slug extensions.citext not null unique,
  name text not null check (length(trim(name)) between 2 and 160),
  status text not null default 'active' check (status in ('active', 'suspended', 'archived')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.org_units (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  parent_id uuid,
  slug extensions.citext not null,
  name text not null check (length(trim(name)) between 2 and 160),
  unit_type text not null check (unit_type in (
    'denomination', 'apostolic_ministry', 'network', 'region', 'field',
    'church', 'campus', 'congregation', 'department', 'ministry', 'other'
  )),
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_units_tenant_id_id_key unique (tenant_id, id),
  constraint org_units_tenant_slug_key unique (tenant_id, slug),
  constraint org_units_parent_same_tenant_fk
    foreign key (tenant_id, parent_id)
    references public.org_units(tenant_id, id)
    on delete restrict,
  constraint org_units_not_own_parent check (parent_id is null or parent_id <> id)
);

create index org_units_tenant_parent_idx on public.org_units(tenant_id, parent_id);
create index org_units_tenant_type_idx on public.org_units(tenant_id, unit_type);

create table public.org_unit_closure (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  ancestor_id uuid not null,
  descendant_id uuid not null,
  depth integer not null check (depth >= 0),
  primary key (tenant_id, ancestor_id, descendant_id),
  foreign key (tenant_id, ancestor_id)
    references public.org_units(tenant_id, id) on delete cascade,
  foreign key (tenant_id, descendant_id)
    references public.org_units(tenant_id, id) on delete cascade
);

create index org_unit_closure_descendant_idx
  on public.org_unit_closure(tenant_id, descendant_id, depth);

create or replace function public.maintain_org_unit_closure_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.org_unit_closure(tenant_id, ancestor_id, descendant_id, depth)
  values (new.tenant_id, new.id, new.id, 0);

  if new.parent_id is not null then
    insert into public.org_unit_closure(tenant_id, ancestor_id, descendant_id, depth)
    select new.tenant_id, c.ancestor_id, new.id, c.depth + 1
    from public.org_unit_closure c
    where c.tenant_id = new.tenant_id
      and c.descendant_id = new.parent_id;
  end if;

  return new;
end;
$$;

create trigger org_units_closure_after_insert
after insert on public.org_units
for each row execute function public.maintain_org_unit_closure_on_insert();

create or replace function public.maintain_org_unit_closure_on_move()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.parent_id is not distinct from old.parent_id then
    return new;
  end if;

  if new.parent_id is not null and exists (
    select 1
    from public.org_unit_closure c
    where c.tenant_id = new.tenant_id
      and c.ancestor_id = new.id
      and c.descendant_id = new.parent_id
  ) then
    raise exception 'A unidade não pode ser movida para dentro da própria subárvore.'
      using errcode = '23514';
  end if;

  delete from public.org_unit_closure target
  using public.org_unit_closure subtree
  where subtree.tenant_id = new.tenant_id
    and subtree.ancestor_id = new.id
    and target.tenant_id = new.tenant_id
    and target.descendant_id = subtree.descendant_id
    and target.ancestor_id not in (
      select internal.descendant_id
      from public.org_unit_closure internal
      where internal.tenant_id = new.tenant_id
        and internal.ancestor_id = new.id
    );

  if new.parent_id is not null then
    insert into public.org_unit_closure(tenant_id, ancestor_id, descendant_id, depth)
    select new.tenant_id,
           parent_path.ancestor_id,
           subtree.descendant_id,
           parent_path.depth + subtree.depth + 1
    from public.org_unit_closure parent_path
    cross join public.org_unit_closure subtree
    where parent_path.tenant_id = new.tenant_id
      and parent_path.descendant_id = new.parent_id
      and subtree.tenant_id = new.tenant_id
      and subtree.ancestor_id = new.id
    on conflict (tenant_id, ancestor_id, descendant_id)
    do update set depth = excluded.depth;
  end if;

  return new;
end;
$$;

create trigger org_units_closure_after_move
after update of parent_id on public.org_units
for each row execute function public.maintain_org_unit_closure_on_move();

create table public.tenant_relationships (
  id uuid primary key default extensions.gen_random_uuid(),
  source_tenant_id uuid not null references public.tenants(id) on delete cascade,
  target_tenant_id uuid not null references public.tenants(id) on delete cascade,
  relationship_type text not null check (relationship_type in (
    'administration', 'affiliation', 'apostolic_covering', 'supervision', 'partnership'
  )),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended', 'ended')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  constraint tenant_relationships_distinct_tenants
    check (source_tenant_id <> target_tenant_id),
  constraint tenant_relationships_valid_period
    check (valid_until is null or valid_until > valid_from),
  constraint tenant_relationships_unique
    unique (source_tenant_id, target_tenant_id, relationship_type)
);

create index tenant_relationships_target_idx
  on public.tenant_relationships(target_tenant_id, status);

create table public.data_sharing_grants (
  id uuid primary key default extensions.gen_random_uuid(),
  relationship_id uuid not null references public.tenant_relationships(id) on delete cascade,
  source_tenant_id uuid not null references public.tenants(id) on delete cascade,
  target_tenant_id uuid not null references public.tenants(id) on delete cascade,
  scope_org_unit_id uuid,
  module_key text not null,
  allowed_actions text[] not null default array['read']::text[],
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  foreign key (source_tenant_id, scope_org_unit_id)
    references public.org_units(tenant_id, id) on delete cascade,
  constraint data_sharing_grants_distinct_tenants
    check (source_tenant_id <> target_tenant_id),
  constraint data_sharing_grants_valid_period
    check (valid_until is null or valid_until > valid_from),
  constraint data_sharing_grants_actions_not_empty
    check (cardinality(allowed_actions) > 0)
);

create index data_sharing_grants_lookup_idx
  on public.data_sharing_grants(source_tenant_id, target_tenant_id, module_key, status);

create or replace function public.validate_data_sharing_grant_relationship()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.tenant_relationships r
    where r.id = new.relationship_id
      and r.source_tenant_id = new.source_tenant_id
      and r.target_tenant_id = new.target_tenant_id
  ) then
    raise exception 'O compartilhamento deve corresponder aos tenants do vínculo.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger data_sharing_grants_validate_relationship
before insert or update on public.data_sharing_grants
for each row execute function public.validate_data_sharing_grant_relationship();

create table public.external_references (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null,
  entity_type text not null,
  entity_id uuid not null,
  external_id text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, provider, entity_type, external_id)
);

create index external_references_entity_idx
  on public.external_references(tenant_id, entity_type, entity_id);

revoke all on function public.maintain_org_unit_closure_on_insert() from public;
revoke all on function public.maintain_org_unit_closure_on_move() from public;
revoke all on function public.validate_data_sharing_grant_relationship() from public;

commit;
