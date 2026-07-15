begin;

create or replace function public.prevent_people_ownership_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.tenant_id <> old.tenant_id then
    raise exception 'tenant_id de uma pessoa é imutável.' using errcode = '42501';
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'created_by de uma pessoa é imutável.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger people_prevent_ownership_change
before update on public.people
for each row execute function public.prevent_people_ownership_change();

revoke all on function public.prevent_people_ownership_change() from public;

drop function if exists public.record_audit_event(uuid, uuid, text, text, uuid, uuid, jsonb);

create or replace function public.audit_people_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected public.people;
begin
  if tg_op = 'DELETE' then
    affected := old;
  else
    affected := new;
  end if;

  insert into public.audit_events(
    tenant_id,
    org_unit_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    affected.tenant_id,
    affected.org_unit_id,
    auth.uid(),
    'people.' || lower(tg_op),
    'person',
    affected.id,
    jsonb_build_object('operation', lower(tg_op))
  );

  return affected;
end;
$$;

create trigger people_append_audit_event
after insert or update or delete on public.people
for each row execute function public.audit_people_change();

revoke all on function public.audit_people_change() from public;

create or replace function public.prevent_overlapping_entitlements()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended(new.tenant_id::text || ':' || new.module_key, 0)
  );

  if exists (
    select 1
    from public.tenant_entitlements existing
    where existing.tenant_id = new.tenant_id
      and existing.module_key = new.module_key
      and existing.id <> new.id
      and tstzrange(
        existing.valid_from,
        coalesce(existing.valid_until, 'infinity'::timestamptz),
        '[)'
      ) && tstzrange(
        new.valid_from,
        coalesce(new.valid_until, 'infinity'::timestamptz),
        '[)'
      )
  ) then
    raise exception 'Já existe override de módulo sobreposto para o tenant.'
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

create trigger tenant_entitlements_prevent_overlap
before insert or update on public.tenant_entitlements
for each row execute function public.prevent_overlapping_entitlements();

revoke all on function public.prevent_overlapping_entitlements() from public;

create or replace function public.tenant_has_module(
  p_tenant_id uuid,
  p_module_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  foundation boolean;
  override_enabled boolean;
begin
  select module.is_foundation
  into foundation
  from public.module_catalog module
  join public.tenants tenant on tenant.id = p_tenant_id
  where module.key = p_module_key
    and tenant.status = 'active';

  if foundation is null then
    return false;
  end if;

  if foundation then
    return true;
  end if;

  select entitlement.enabled
  into override_enabled
  from public.tenant_entitlements entitlement
  where entitlement.tenant_id = p_tenant_id
    and entitlement.module_key = p_module_key
    and entitlement.valid_from <= now()
    and (entitlement.valid_until is null or entitlement.valid_until > now())
  order by entitlement.valid_from desc
  limit 1;

  if found then
    return override_enabled;
  end if;

  return exists (
    select 1
    from public.subscriptions subscription
    join public.plan_modules plan_module on plan_module.plan_id = subscription.plan_id
    where subscription.tenant_id = p_tenant_id
      and subscription.status in ('trial', 'active')
      and subscription.starts_at <= now()
      and (subscription.ends_at is null or subscription.ends_at > now())
      and plan_module.module_key = p_module_key
  );
end;
$$;

revoke all on function public.tenant_has_module(uuid, text) from public;
grant execute on function public.tenant_has_module(uuid, text) to authenticated;

drop policy people_delete_scoped on public.people;
create policy people_delete_scoped
  on public.people for delete to authenticated
  using (
    public.tenant_has_module(tenant_id, 'people')
    and public.has_permission(tenant_id, 'people.delete', org_unit_id)
  );

alter table public.tenant_relationships
  add constraint tenant_relationships_id_endpoints_key
  unique (id, source_tenant_id, target_tenant_id);

alter table public.data_sharing_grants
  add constraint data_sharing_grants_relationship_endpoints_fk
  foreign key (relationship_id, source_tenant_id, target_tenant_id)
  references public.tenant_relationships(id, source_tenant_id, target_tenant_id)
  on delete cascade;

alter table public.data_sharing_grants
  add constraint data_sharing_grants_module_fk
  foreign key (module_key) references public.module_catalog(key) on delete restrict;

alter table public.data_sharing_grants
  add constraint data_sharing_grants_allowed_actions_check
  check (allowed_actions <@ array['read', 'aggregate', 'export']::text[]);

create or replace function public.prevent_relationship_endpoint_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.source_tenant_id <> old.source_tenant_id
     or new.target_tenant_id <> old.target_tenant_id then
    raise exception 'Os endpoints de um vínculo são imutáveis.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger tenant_relationships_immutable_endpoints
before update on public.tenant_relationships
for each row execute function public.prevent_relationship_endpoint_change();

revoke all on function public.prevent_relationship_endpoint_change() from public;

create or replace function public.prevent_hierarchical_tenant_cycle()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status <> 'active'
     or new.relationship_type not in ('administration', 'supervision') then
    return new;
  end if;

  if exists (
    with recursive reachable(tenant_id) as (
      select relationship.target_tenant_id
      from public.tenant_relationships relationship
      where relationship.source_tenant_id = new.target_tenant_id
        and relationship.status = 'active'
        and relationship.relationship_type in ('administration', 'supervision')
        and relationship.id <> new.id
      union
      select relationship.target_tenant_id
      from public.tenant_relationships relationship
      join reachable on reachable.tenant_id = relationship.source_tenant_id
      where relationship.status = 'active'
        and relationship.relationship_type in ('administration', 'supervision')
        and relationship.id <> new.id
    )
    select 1 from reachable where tenant_id = new.source_tenant_id
  ) then
    raise exception 'O vínculo criaria um ciclo administrativo entre tenants.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger tenant_relationships_prevent_hierarchical_cycle
before insert or update of source_tenant_id, target_tenant_id, relationship_type, status
on public.tenant_relationships
for each row execute function public.prevent_hierarchical_tenant_cycle();

revoke all on function public.prevent_hierarchical_tenant_cycle() from public;

commit;
