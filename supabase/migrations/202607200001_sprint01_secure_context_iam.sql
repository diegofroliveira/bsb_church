begin;

-- Sprint 1: contexto operacional, onboarding e comandos IAM. Todas as escritas
-- administrativas permanecem fechadas para DML direto e passam por RPCs
-- SECURITY DEFINER que recalculam membership, permissao e escopo.

insert into public.permissions(code, description, sensitivity) values
  ('org.read', 'Consultar a estrutura organizacional autorizada.', 'internal'),
  ('org.manage', 'Administrar a estrutura organizacional autorizada.', 'internal'),
  ('iam.membership.read', 'Consultar memberships no escopo autorizado.', 'personal'),
  ('iam.membership.manage', 'Convidar, ativar e suspender memberships.', 'personal'),
  ('iam.role.read', 'Consultar roles e permissoes do tenant.', 'internal'),
  ('iam.role.manage', 'Criar e administrar roles e atribuicoes.', 'sensitive')
on conflict (code) do update set
  description = excluded.description,
  sensitivity = excluded.sensitivity;

alter table public.tenant_memberships
  add constraint tenant_memberships_tenant_id_id_user_id_key
  unique (tenant_id, id, user_id);

create table public.user_active_contexts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  membership_id uuid not null,
  org_unit_id uuid,
  selected_at timestamptz not null default now(),
  constraint user_active_contexts_membership_fk
    foreign key (tenant_id, membership_id, user_id)
    references public.tenant_memberships(tenant_id, id, user_id)
    on delete cascade,
  constraint user_active_contexts_org_unit_fk
    foreign key (tenant_id, org_unit_id)
    references public.org_units(tenant_id, id)
    on delete cascade
);

create index user_active_contexts_tenant_idx
  on public.user_active_contexts(tenant_id, org_unit_id);

create table public.tenant_invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email extensions.citext not null,
  token_hash bytea not null unique,
  role_id uuid not null,
  org_unit_id uuid,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint tenant_invitations_role_fk
    foreign key (tenant_id, role_id)
    references public.roles(tenant_id, id)
    on delete cascade,
  constraint tenant_invitations_org_unit_fk
    foreign key (tenant_id, org_unit_id)
    references public.org_units(tenant_id, id)
    on delete cascade,
  constraint tenant_invitations_expiry_check check (expires_at > created_at),
  constraint tenant_invitations_acceptance_check check (
    (status = 'accepted' and accepted_by is not null and accepted_at is not null)
    or (status <> 'accepted' and accepted_by is null and accepted_at is null)
  )
);

create unique index tenant_invitations_one_pending_email_idx
  on public.tenant_invitations(tenant_id, email)
  where status = 'pending';

create index tenant_invitations_tenant_status_idx
  on public.tenant_invitations(tenant_id, status, expires_at);

create unique index access_assignments_one_tenant_wide_role_idx
  on public.access_assignments(tenant_id, membership_id, role_id)
  where org_unit_id is null and valid_until is null;

create or replace function public.is_active_context_tenant(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_active_contexts context
    join public.tenant_memberships membership
      on membership.tenant_id = context.tenant_id
     and membership.id = context.membership_id
     and membership.user_id = context.user_id
     and membership.status = 'active'
    join public.tenants tenant
      on tenant.id = context.tenant_id
     and tenant.status = 'active'
    where context.user_id = auth.uid()
      and context.tenant_id = p_tenant_id
  );
$$;

-- Membership ativa nao basta: toda policy operacional fica presa ao tenant
-- selecionado. get_my_contexts lista as memberships via SECURITY DEFINER.
create or replace function public.is_active_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_context_tenant(p_tenant_id);
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
  select public.is_active_context_tenant(p_tenant_id)
    and exists (
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
              from public.org_unit_closure closure
              where closure.tenant_id = p_tenant_id
                and closure.ancestor_id = assignment.org_unit_id
                and closure.descendant_id = p_org_unit_id
            )
          )
        )
    );
$$;

create or replace function public.can_manage_memberships(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_permission(p_tenant_id, 'users.manage', null)
      or public.has_permission(p_tenant_id, 'iam.membership.manage', null);
$$;

create or replace function public.can_manage_roles(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_permission(p_tenant_id, 'tenant.manage', null)
      or public.has_permission(p_tenant_id, 'iam.role.manage', null);
$$;

create or replace function public.append_iam_audit(
  p_tenant_id uuid,
  p_org_unit_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  if p_metadata ?| array['password', 'token', 'secret', 'document', 'pastoral_note'] then
    raise exception 'Metadados de auditoria contem chave proibida.' using errcode = '22023';
  end if;

  insert into public.audit_events(
    tenant_id, org_unit_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_tenant_id, p_org_unit_id, auth.uid(), p_action, p_entity_type,
    p_entity_id, coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_id;

  return v_id;
end;
$$;

drop function if exists public.get_my_contexts();
create function public.get_my_contexts()
returns table (
  tenant_id uuid,
  tenant_name text,
  membership_id uuid,
  org_unit_id uuid,
  org_unit_name text,
  role_code text,
  role_name text,
  is_active boolean
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
         org_unit.name,
         role.code,
         role.name,
         active_context.tenant_id = membership.tenant_id
           and active_context.org_unit_id is not distinct from assignment.org_unit_id
  from public.tenant_memberships membership
  join public.tenants tenant
    on tenant.id = membership.tenant_id
   and tenant.status = 'active'
  join public.access_assignments assignment
    on assignment.tenant_id = membership.tenant_id
   and assignment.membership_id = membership.id
   and assignment.valid_from <= now()
   and (assignment.valid_until is null or assignment.valid_until > now())
  join public.roles role
    on role.tenant_id = assignment.tenant_id
   and role.id = assignment.role_id
  left join public.org_units org_unit
    on org_unit.tenant_id = assignment.tenant_id
   and org_unit.id = assignment.org_unit_id
  left join public.user_active_contexts active_context
    on active_context.user_id = membership.user_id
  where membership.user_id = auth.uid()
    and membership.status = 'active'
  order by tenant.name, org_unit.name nulls first, role.name;
$$;

create or replace function public.set_my_active_context(
  p_tenant_id uuid,
  p_org_unit_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership_id uuid;
begin
  select membership.id
  into v_membership_id
  from public.tenant_memberships membership
  join public.tenants tenant
    on tenant.id = membership.tenant_id
   and tenant.status = 'active'
  where membership.tenant_id = p_tenant_id
    and membership.user_id = auth.uid()
    and membership.status = 'active';

  if v_membership_id is null then
    raise exception 'Contexto nao pertence ao usuario autenticado.' using errcode = '42501';
  end if;

  if p_org_unit_id is null then
    if not exists (
      select 1
      from public.access_assignments assignment
      where assignment.tenant_id = p_tenant_id
        and assignment.membership_id = v_membership_id
        and assignment.org_unit_id is null
        and assignment.valid_from <= now()
        and (assignment.valid_until is null or assignment.valid_until > now())
    ) then
      raise exception 'Usuario nao possui escopo de tenant.' using errcode = '42501';
    end if;
  elsif not exists (
    select 1
    from public.org_units target
    join public.access_assignments assignment
      on assignment.tenant_id = target.tenant_id
     and assignment.membership_id = v_membership_id
     and assignment.valid_from <= now()
     and (assignment.valid_until is null or assignment.valid_until > now())
    where target.tenant_id = p_tenant_id
      and target.id = p_org_unit_id
      and target.status = 'active'
      and (
        assignment.org_unit_id is null
        or public.is_org_in_scope(p_tenant_id, assignment.org_unit_id, target.id)
      )
  ) then
    raise exception 'Unidade fora do escopo do usuario.' using errcode = '42501';
  end if;

  insert into public.user_active_contexts(
    user_id, tenant_id, membership_id, org_unit_id, selected_at
  ) values (
    auth.uid(), p_tenant_id, v_membership_id, p_org_unit_id, now()
  )
  on conflict (user_id) do update set
    tenant_id = excluded.tenant_id,
    membership_id = excluded.membership_id,
    org_unit_id = excluded.org_unit_id,
    selected_at = excluded.selected_at;
end;
$$;

create or replace function public.get_my_capabilities()
returns table (
  tenant_id uuid,
  org_unit_id uuid,
  permissions text[],
  modules text[]
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select context.tenant_id,
         context.org_unit_id,
         coalesce((
           select array_agg(distinct role_permission.permission_code order by role_permission.permission_code)
           from public.access_assignments assignment
           join public.role_permissions role_permission
             on role_permission.tenant_id = assignment.tenant_id
            and role_permission.role_id = assignment.role_id
           where assignment.tenant_id = context.tenant_id
             and assignment.membership_id = context.membership_id
             and assignment.valid_from <= now()
             and (assignment.valid_until is null or assignment.valid_until > now())
             and (
               assignment.org_unit_id is null
               or (
                 context.org_unit_id is not null
                 and public.is_org_in_scope(
                   context.tenant_id,
                   assignment.org_unit_id,
                   context.org_unit_id
                 )
               )
             )
         ), array[]::text[]),
         coalesce((
           select array_agg(module.key order by module.key)
           from public.module_catalog module
           where public.tenant_has_module(context.tenant_id, module.key)
         ), array[]::text[])
  from public.user_active_contexts context
  join public.tenant_memberships membership
    on membership.tenant_id = context.tenant_id
   and membership.id = context.membership_id
   and membership.user_id = auth.uid()
   and membership.status = 'active'
  join public.tenants tenant
    on tenant.id = context.tenant_id
   and tenant.status = 'active'
  where context.user_id = auth.uid();
$$;

create or replace function public.list_tenant_memberships(p_tenant_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  display_name text,
  email_masked text,
  status text,
  joined_at timestamptz,
  role_codes text[]
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (
    public.has_permission(p_tenant_id, 'users.read', null)
    or public.has_permission(p_tenant_id, 'iam.membership.read', null)
  ) then
    raise exception 'Sem permissao para consultar memberships.' using errcode = '42501';
  end if;

  return query
  select membership.id,
         membership.user_id,
         profile.display_name,
         case
           when position('@' in auth_user.email) > 1
             then left(auth_user.email, 1) || '***@' || split_part(auth_user.email, '@', 2)
           else '***'
         end,
         membership.status,
         membership.joined_at,
         coalesce((
           select array_agg(distinct role.code order by role.code)
           from public.access_assignments assignment
           join public.roles role
             on role.tenant_id = assignment.tenant_id
            and role.id = assignment.role_id
           where assignment.tenant_id = membership.tenant_id
             and assignment.membership_id = membership.id
             and assignment.valid_from <= now()
             and (assignment.valid_until is null or assignment.valid_until > now())
         ), array[]::text[])
  from public.tenant_memberships membership
  join auth.users auth_user on auth_user.id = membership.user_id
  left join public.user_profiles profile on profile.id = membership.user_id
  where membership.tenant_id = p_tenant_id
  order by coalesce(profile.display_name, auth_user.email), membership.id;
end;
$$;

create or replace function public.create_org_unit(
  p_tenant_id uuid,
  p_name text,
  p_org_type text,
  p_parent_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_unit_id uuid := extensions.gen_random_uuid();
  v_base_slug text;
  v_slug text;
begin
  if not public.has_permission(p_tenant_id, 'tenant.manage', null) then
    raise exception 'Sem permissao para administrar a arvore organizacional.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 160 then
    raise exception 'Nome da unidade organizacional invalido.' using errcode = '22023';
  end if;
  if p_org_type not in (
    'denomination', 'apostolic_ministry', 'network', 'region', 'field',
    'church', 'campus', 'congregation', 'department', 'ministry', 'other'
  ) then
    raise exception 'Tipo de organizacao invalido.' using errcode = '22023';
  end if;
  if p_parent_id is not null and not exists (
    select 1 from public.org_units parent
    where parent.tenant_id = p_tenant_id
      and parent.id = p_parent_id
      and parent.status = 'active'
  ) then
    raise exception 'Unidade pai nao pertence ao tenant.' using errcode = '23503';
  end if;

  v_base_slug := trim(both '-' from regexp_replace(
    translate(
      lower(p_name),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ),
    '[^a-z0-9]+', '-', 'g'
  ));
  if v_base_slug = '' then
    v_base_slug := 'unidade';
  end if;
  v_slug := v_base_slug;
  if exists (
    select 1 from public.org_units org
    where org.tenant_id = p_tenant_id and org.slug = v_slug
  ) then
    v_slug := left(v_base_slug, 48) || '-' || substr(v_org_unit_id::text, 1, 8);
  end if;

  insert into public.org_units(
    id, tenant_id, parent_id, slug, name, unit_type
  ) values (
    v_org_unit_id, p_tenant_id, p_parent_id, v_slug, trim(p_name), p_org_type
  );

  perform public.append_iam_audit(
    p_tenant_id, v_org_unit_id, 'org.unit.create', 'org_unit', v_org_unit_id,
    jsonb_build_object('parent_id', p_parent_id, 'unit_type', p_org_type)
  );
  return v_org_unit_id;
end;
$$;

create or replace function public.update_org_unit(
  p_tenant_id uuid,
  p_org_unit_id uuid,
  p_name text,
  p_parent_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission(p_tenant_id, 'tenant.manage', null) then
    raise exception 'Sem permissao para administrar a arvore organizacional.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 160 then
    raise exception 'Nome da unidade organizacional invalido.' using errcode = '22023';
  end if;
  if p_parent_id is not null and not exists (
    select 1 from public.org_units parent
    where parent.tenant_id = p_tenant_id
      and parent.id = p_parent_id
      and parent.status = 'active'
  ) then
    raise exception 'Unidade pai nao pertence ao tenant.' using errcode = '23503';
  end if;

  update public.org_units
  set name = trim(p_name), parent_id = p_parent_id, updated_at = now()
  where tenant_id = p_tenant_id and id = p_org_unit_id;
  if not found then
    raise exception 'Unidade organizacional nao encontrada.' using errcode = 'P0002';
  end if;

  perform public.append_iam_audit(
    p_tenant_id, p_org_unit_id, 'org.unit.update', 'org_unit', p_org_unit_id,
    jsonb_build_object('parent_id', p_parent_id)
  );
end;
$$;

create or replace function public.onboard_tenant(
  p_name text,
  p_slug text,
  p_org_name text,
  p_org_type text default 'church'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid := extensions.gen_random_uuid();
  v_org_id uuid := extensions.gen_random_uuid();
  v_membership_id uuid := extensions.gen_random_uuid();
  v_role_id uuid := extensions.gen_random_uuid();
  v_display_name text;
begin
  if auth.uid() is null then
    raise exception 'Autenticacao obrigatoria.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) not between 2 and 160
     or length(trim(coalesce(p_org_name, ''))) not between 2 and 160 then
    raise exception 'Nome do tenant e da organizacao sao obrigatorios.' using errcode = '22023';
  end if;
  if coalesce(p_slug, '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Slug invalido.' using errcode = '22023';
  end if;
  if p_org_type not in (
    'denomination', 'apostolic_ministry', 'network', 'region', 'field',
    'church', 'campus', 'congregation', 'department', 'ministry', 'other'
  ) then
    raise exception 'Tipo de organizacao invalido.' using errcode = '22023';
  end if;

  select coalesce(nullif(trim(raw_user_meta_data->>'name'), ''), split_part(email, '@', 1))
  into v_display_name
  from auth.users
  where id = auth.uid();

  insert into public.tenants(id, slug, name)
  values (v_tenant_id, lower(p_slug), trim(p_name));

  insert into public.org_units(id, tenant_id, slug, name, unit_type)
  values (v_org_id, v_tenant_id, 'principal', trim(p_org_name), p_org_type);

  insert into public.user_profiles(id, display_name)
  values (auth.uid(), coalesce(v_display_name, 'Responsavel'))
  on conflict (id) do update set updated_at = now();

  insert into public.tenant_memberships(id, tenant_id, user_id, status, joined_at)
  values (v_membership_id, v_tenant_id, auth.uid(), 'active', now());

  insert into public.roles(id, tenant_id, code, name, description, is_system)
  values (
    v_role_id, v_tenant_id, 'tenant_owner', 'Responsavel pelo Tenant',
    'Role sistemica criada no onboarding.', true
  );

  insert into public.role_permissions(tenant_id, role_id, permission_code)
  select v_tenant_id, v_role_id, permission.code
  from public.permissions permission
  where permission.code in (
    'tenant.manage', 'users.read', 'users.manage', 'audit.read',
    'org.read', 'org.manage', 'iam.membership.read',
    'iam.membership.manage', 'iam.role.read', 'iam.role.manage'
  );

  insert into public.access_assignments(
    tenant_id, membership_id, role_id, org_unit_id
  ) values (v_tenant_id, v_membership_id, v_role_id, null);

  insert into public.user_active_contexts(
    user_id, tenant_id, membership_id, org_unit_id
  ) values (auth.uid(), v_tenant_id, v_membership_id, v_org_id)
  on conflict (user_id) do update set
    tenant_id = excluded.tenant_id,
    membership_id = excluded.membership_id,
    org_unit_id = excluded.org_unit_id,
    selected_at = now();

  perform public.append_iam_audit(
    v_tenant_id, v_org_id, 'tenant.onboard', 'tenant', v_tenant_id,
    jsonb_build_object('root_org_unit_id', v_org_id)
  );

  return v_tenant_id;
end;
$$;

-- Contrato simples consumido pelo onboarding web. A variante de quatro
-- parametros permanece disponivel para fluxos administrativos futuros.
create or replace function public.onboard_tenant(
  p_tenant_name text,
  p_org_unit_name text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base_slug text;
  v_slug text;
begin
  v_base_slug := trim(both '-' from regexp_replace(
    translate(
      lower(coalesce(p_tenant_name, '')),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ),
    '[^a-z0-9]+', '-', 'g'
  ));
  if v_base_slug = '' then
    v_base_slug := 'organizacao';
  end if;

  v_slug := v_base_slug;
  if exists (select 1 from public.tenants tenant where tenant.slug = v_slug) then
    v_slug := left(v_base_slug, 48) || '-' || substr(extensions.gen_random_uuid()::text, 1, 8);
  end if;

  return public.onboard_tenant(
    p_tenant_name,
    v_slug,
    p_org_unit_name,
    'church'
  );
end;
$$;

create or replace function public.create_tenant_invitation(
  p_tenant_id uuid,
  p_email text,
  p_role_id uuid,
  p_org_unit_id uuid default null,
  p_expires_in interval default interval '7 days'
)
returns table (invitation_id uuid, invitation_token text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid := extensions.gen_random_uuid();
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if not public.can_manage_memberships(p_tenant_id) then
    raise exception 'Sem permissao para convidar usuarios.' using errcode = '42501';
  end if;
  if coalesce(p_email, '') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'E-mail invalido.' using errcode = '22023';
  end if;
  if p_expires_in <= interval '0 seconds' or p_expires_in > interval '30 days' then
    raise exception 'Validade do convite deve estar entre zero e trinta dias.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.roles role
    where role.tenant_id = p_tenant_id and role.id = p_role_id
  ) then
    raise exception 'Role nao pertence ao tenant.' using errcode = '23503';
  end if;
  if p_org_unit_id is not null and not exists (
    select 1 from public.org_units org
    where org.tenant_id = p_tenant_id and org.id = p_org_unit_id and org.status = 'active'
  ) then
    raise exception 'Unidade nao pertence ao tenant.' using errcode = '23503';
  end if;

  update public.tenant_invitations
  set status = 'expired'
  where tenant_id = p_tenant_id
    and email = trim(lower(p_email))
    and status = 'pending'
    and expires_at <= now();

  insert into public.tenant_invitations(
    id, tenant_id, email, token_hash, role_id, org_unit_id,
    invited_by, expires_at
  ) values (
    v_id, p_tenant_id, trim(lower(p_email)),
    extensions.digest(v_token, 'sha256'), p_role_id, p_org_unit_id,
    auth.uid(), now() + p_expires_in
  );

  perform public.append_iam_audit(
    p_tenant_id, p_org_unit_id, 'iam.invitation.create', 'tenant_invitation', v_id,
    jsonb_build_object('role_id', p_role_id)
  );

  return query select v_id, v_token;
end;
$$;

create or replace function public.accept_tenant_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.tenant_invitations;
  v_membership_id uuid;
  v_user_email extensions.citext;
begin
  if auth.uid() is null then
    raise exception 'Autenticacao obrigatoria.' using errcode = '42501';
  end if;

  select lower(email)::extensions.citext
  into v_user_email
  from auth.users
  where id = auth.uid();

  select invitation.*
  into v_invitation
  from public.tenant_invitations invitation
  join public.tenants tenant
    on tenant.id = invitation.tenant_id and tenant.status = 'active'
  where invitation.token_hash = extensions.digest(coalesce(p_token, ''), 'sha256')
    and invitation.status = 'pending'
    and invitation.expires_at > now()
  for update of invitation;

  if v_invitation.id is null then
    raise exception 'Convite invalido ou expirado.' using errcode = '22023';
  end if;
  if v_invitation.email <> v_user_email then
    raise exception 'Convite destinado a outra identidade.' using errcode = '42501';
  end if;

  insert into public.user_profiles(id, display_name)
  select auth.uid(), coalesce(nullif(trim(raw_user_meta_data->>'name'), ''), split_part(email, '@', 1))
  from auth.users where id = auth.uid()
  on conflict (id) do update set updated_at = now();

  insert into public.tenant_memberships(tenant_id, user_id, status, joined_at)
  values (v_invitation.tenant_id, auth.uid(), 'active', now())
  on conflict (tenant_id, user_id) do update set
    status = 'active', joined_at = coalesce(public.tenant_memberships.joined_at, now())
  returning id into v_membership_id;

  insert into public.access_assignments(
    tenant_id, membership_id, role_id, org_unit_id
  ) values (
    v_invitation.tenant_id, v_membership_id,
    v_invitation.role_id, v_invitation.org_unit_id
  ) on conflict do nothing;

  update public.tenant_invitations
  set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
  where id = v_invitation.id;

  insert into public.user_active_contexts(
    user_id, tenant_id, membership_id, org_unit_id
  ) values (
    auth.uid(), v_invitation.tenant_id, v_membership_id, v_invitation.org_unit_id
  ) on conflict (user_id) do update set
    tenant_id = excluded.tenant_id,
    membership_id = excluded.membership_id,
    org_unit_id = excluded.org_unit_id,
    selected_at = now();

  perform public.append_iam_audit(
    v_invitation.tenant_id, v_invitation.org_unit_id,
    'iam.invitation.accept', 'tenant_membership', v_membership_id,
    jsonb_build_object('invitation_id', v_invitation.id)
  );

  return v_invitation.tenant_id;
end;
$$;

create or replace function public.revoke_tenant_invitation(
  p_tenant_id uuid,
  p_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_manage_memberships(p_tenant_id) then
    raise exception 'Sem permissao para revogar convites.' using errcode = '42501';
  end if;

  update public.tenant_invitations
  set status = 'revoked', revoked_at = now()
  where id = p_invitation_id and tenant_id = p_tenant_id and status = 'pending';

  if not found then
    raise exception 'Convite pendente nao encontrado.' using errcode = 'P0002';
  end if;

  perform public.append_iam_audit(
    p_tenant_id, null, 'iam.invitation.revoke', 'tenant_invitation', p_invitation_id
  );
end;
$$;

create or replace function public.create_tenant_role(
  p_tenant_id uuid,
  p_code text,
  p_name text,
  p_description text,
  p_permissions text[] default array[]::text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role_id uuid := extensions.gen_random_uuid();
begin
  if not public.can_manage_roles(p_tenant_id) then
    raise exception 'Sem permissao para administrar roles.' using errcode = '42501';
  end if;
  if coalesce(p_code, '') !~ '^[a-z][a-z0-9_.-]+$'
     or length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Codigo ou nome da role invalido.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_permissions, array[]::text[])) requested(code)
    left join public.permissions permission on permission.code = requested.code
    where permission.code is null
  ) then
    raise exception 'Catalogo de permissoes contem chave desconhecida.' using errcode = '22023';
  end if;

  insert into public.roles(id, tenant_id, code, name, description, is_system)
  values (v_role_id, p_tenant_id, p_code, trim(p_name), p_description, false);

  insert into public.role_permissions(tenant_id, role_id, permission_code)
  select p_tenant_id, v_role_id, code
  from unnest(coalesce(p_permissions, array[]::text[])) requested(code)
  on conflict do nothing;

  perform public.append_iam_audit(
    p_tenant_id, null, 'iam.role.create', 'role', v_role_id,
    jsonb_build_object('permission_count', cardinality(coalesce(p_permissions, array[]::text[])))
  );
  return v_role_id;
end;
$$;

create or replace function public.update_tenant_role(
  p_tenant_id uuid,
  p_role_id uuid,
  p_name text,
  p_description text,
  p_permissions text[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_manage_roles(p_tenant_id) then
    raise exception 'Sem permissao para administrar roles.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Nome da role invalido.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_permissions, array[]::text[])) requested(code)
    left join public.permissions permission on permission.code = requested.code
    where permission.code is null
  ) then
    raise exception 'Catalogo de permissoes contem chave desconhecida.' using errcode = '22023';
  end if;

  update public.roles
  set name = trim(p_name), description = p_description
  where id = p_role_id and tenant_id = p_tenant_id and not is_system;
  if not found then
    raise exception 'Role customizavel nao encontrada.' using errcode = 'P0002';
  end if;

  delete from public.role_permissions
  where tenant_id = p_tenant_id and role_id = p_role_id;
  insert into public.role_permissions(tenant_id, role_id, permission_code)
  select p_tenant_id, p_role_id, code
  from unnest(coalesce(p_permissions, array[]::text[])) requested(code)
  on conflict do nothing;

  perform public.append_iam_audit(
    p_tenant_id, null, 'iam.role.update', 'role', p_role_id,
    jsonb_build_object('permission_count', cardinality(coalesce(p_permissions, array[]::text[])))
  );
end;
$$;

create or replace function public.assign_tenant_role(
  p_tenant_id uuid,
  p_membership_id uuid,
  p_role_id uuid,
  p_org_unit_id uuid default null,
  p_valid_until timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment_id uuid;
  v_system_role boolean;
begin
  if not public.can_manage_roles(p_tenant_id) then
    raise exception 'Sem permissao para atribuir roles.' using errcode = '42501';
  end if;
  if p_valid_until is not null and p_valid_until <= now() then
    raise exception 'Vigencia final deve estar no futuro.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.tenant_memberships membership
    where membership.tenant_id = p_tenant_id
      and membership.id = p_membership_id
      and membership.status = 'active'
  ) then
    raise exception 'Membership ativa nao pertence ao tenant.' using errcode = '23503';
  end if;
  select role.is_system into v_system_role
  from public.roles role
  where role.tenant_id = p_tenant_id and role.id = p_role_id;
  if v_system_role is null then
    raise exception 'Role nao pertence ao tenant.' using errcode = '23503';
  end if;
  if v_system_role and not public.has_permission(p_tenant_id, 'tenant.manage', null) then
    raise exception 'Role sistemica exige permissao de responsavel do tenant.' using errcode = '42501';
  end if;
  if p_org_unit_id is not null and not exists (
    select 1 from public.org_units org
    where org.tenant_id = p_tenant_id and org.id = p_org_unit_id and org.status = 'active'
  ) then
    raise exception 'Unidade nao pertence ao tenant.' using errcode = '23503';
  end if;

  select assignment.id into v_assignment_id
  from public.access_assignments assignment
  where assignment.tenant_id = p_tenant_id
    and assignment.membership_id = p_membership_id
    and assignment.role_id = p_role_id
    and assignment.org_unit_id is not distinct from p_org_unit_id
    and assignment.valid_until is null
  limit 1;

  if v_assignment_id is null then
    insert into public.access_assignments(
      tenant_id, membership_id, role_id, org_unit_id, valid_until
    ) values (
      p_tenant_id, p_membership_id, p_role_id, p_org_unit_id, p_valid_until
    ) returning id into v_assignment_id;
  end if;

  perform public.append_iam_audit(
    p_tenant_id, p_org_unit_id, 'iam.assignment.create',
    'access_assignment', v_assignment_id,
    jsonb_build_object('membership_id', p_membership_id, 'role_id', p_role_id)
  );
  return v_assignment_id;
end;
$$;

create or replace function public.revoke_tenant_role_assignment(
  p_tenant_id uuid,
  p_assignment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment public.access_assignments;
  v_role_code text;
begin
  if not public.can_manage_roles(p_tenant_id) then
    raise exception 'Sem permissao para revogar atribuicoes.' using errcode = '42501';
  end if;

  select assignment.*
  into v_assignment
  from public.access_assignments assignment
  where assignment.id = p_assignment_id and assignment.tenant_id = p_tenant_id
  for update;

  if v_assignment.id is null then
    raise exception 'Atribuicao nao encontrada.' using errcode = 'P0002';
  end if;
  select role.code into v_role_code
  from public.roles role
  where role.tenant_id = v_assignment.tenant_id
    and role.id = v_assignment.role_id;
  if v_role_code = 'tenant_owner' and v_assignment.org_unit_id is null and (
    select count(*)
    from public.access_assignments assignment
    join public.roles role
      on role.tenant_id = assignment.tenant_id and role.id = assignment.role_id
    join public.tenant_memberships membership
      on membership.tenant_id = assignment.tenant_id
     and membership.id = assignment.membership_id
     and membership.status = 'active'
    where assignment.tenant_id = p_tenant_id
      and assignment.org_unit_id is null
      and assignment.valid_from <= now()
      and (assignment.valid_until is null or assignment.valid_until > now())
      and role.code = 'tenant_owner'
  ) <= 1 then
    raise exception 'Tenant deve manter ao menos um responsavel ativo.' using errcode = '23514';
  end if;

  delete from public.access_assignments where id = p_assignment_id;
  perform public.append_iam_audit(
    p_tenant_id, v_assignment.org_unit_id, 'iam.assignment.revoke',
    'access_assignment', p_assignment_id
  );
end;
$$;

create or replace function public.set_tenant_membership_status(
  p_tenant_id uuid,
  p_membership_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_membership public.tenant_memberships;
  v_is_owner boolean;
begin
  if not public.can_manage_memberships(p_tenant_id) then
    raise exception 'Sem permissao para administrar memberships.' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended', 'ended') then
    raise exception 'Status de membership invalido.' using errcode = '22023';
  end if;

  select membership.* into v_membership
  from public.tenant_memberships membership
  where membership.tenant_id = p_tenant_id and membership.id = p_membership_id
  for update;
  if v_membership.id is null then
    raise exception 'Membership nao encontrada.' using errcode = 'P0002';
  end if;
  if v_membership.user_id = auth.uid() and p_status <> 'active' then
    raise exception 'Usuario nao pode suspender a propria membership.' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.access_assignments assignment
    join public.roles role
      on role.tenant_id = assignment.tenant_id and role.id = assignment.role_id
    where assignment.tenant_id = p_tenant_id
      and assignment.membership_id = p_membership_id
      and assignment.org_unit_id is null
      and assignment.valid_from <= now()
      and (assignment.valid_until is null or assignment.valid_until > now())
      and role.code = 'tenant_owner'
  ) into v_is_owner;

  if p_status <> 'active' and v_is_owner and (
    select count(distinct assignment.membership_id)
    from public.access_assignments assignment
    join public.roles role
      on role.tenant_id = assignment.tenant_id and role.id = assignment.role_id
    join public.tenant_memberships membership
      on membership.tenant_id = assignment.tenant_id
     and membership.id = assignment.membership_id
     and membership.status = 'active'
    where assignment.tenant_id = p_tenant_id
      and assignment.org_unit_id is null
      and assignment.valid_from <= now()
      and (assignment.valid_until is null or assignment.valid_until > now())
      and role.code = 'tenant_owner'
  ) <= 1 then
    raise exception 'Tenant deve manter ao menos um responsavel ativo.' using errcode = '23514';
  end if;

  update public.tenant_memberships
  set status = p_status,
      joined_at = case when p_status = 'active' then coalesce(joined_at, now()) else joined_at end
  where id = p_membership_id;

  if p_status <> 'active' then
    delete from public.user_active_contexts
    where user_id = v_membership.user_id and tenant_id = p_tenant_id;
  end if;

  perform public.append_iam_audit(
    p_tenant_id, null, 'iam.membership.status', 'tenant_membership', p_membership_id,
    jsonb_build_object('status', p_status)
  );
end;
$$;

alter table public.user_active_contexts enable row level security;
alter table public.user_active_contexts force row level security;
alter table public.tenant_invitations enable row level security;
alter table public.tenant_invitations force row level security;

create policy user_active_contexts_select_self
  on public.user_active_contexts for select to authenticated
  using (user_id = auth.uid());

create policy tenant_invitations_select_manager
  on public.tenant_invitations for select to authenticated
  using (public.can_manage_memberships(tenant_id));

insert into public.security_table_registry(
  table_name, classification, contains_personal_data, lifecycle, notes
) values
  ('user_active_contexts', 'personal', true, 'active', 'Contexto operacional selecionado pelo usuario.'),
  ('tenant_invitations', 'personal', true, 'active', 'Convites de acesso; tokens persistidos apenas como hash.')
on conflict (table_name) do update set
  classification = excluded.classification,
  contains_personal_data = excluded.contains_personal_data,
  lifecycle = excluded.lifecycle,
  notes = excluded.notes;

revoke all on public.user_active_contexts, public.tenant_invitations from anon;
grant select on public.user_active_contexts, public.tenant_invitations to authenticated;

revoke all on function public.is_active_context_tenant(uuid) from public;
revoke all on function public.can_manage_memberships(uuid) from public;
revoke all on function public.can_manage_roles(uuid) from public;
revoke all on function public.append_iam_audit(uuid, uuid, text, text, uuid, jsonb) from public;
revoke all on function public.get_my_contexts() from public;
revoke all on function public.set_my_active_context(uuid, uuid) from public;
revoke all on function public.get_my_capabilities() from public;
revoke all on function public.list_tenant_memberships(uuid) from public;
revoke all on function public.create_org_unit(uuid, text, text, uuid) from public;
revoke all on function public.update_org_unit(uuid, uuid, text, uuid) from public;
revoke all on function public.onboard_tenant(text, text, text, text) from public;
revoke all on function public.onboard_tenant(text, text) from public;
revoke all on function public.create_tenant_invitation(uuid, text, uuid, uuid, interval) from public;
revoke all on function public.accept_tenant_invitation(text) from public;
revoke all on function public.revoke_tenant_invitation(uuid, uuid) from public;
revoke all on function public.create_tenant_role(uuid, text, text, text, text[]) from public;
revoke all on function public.update_tenant_role(uuid, uuid, text, text, text[]) from public;
revoke all on function public.assign_tenant_role(uuid, uuid, uuid, uuid, timestamptz) from public;
revoke all on function public.revoke_tenant_role_assignment(uuid, uuid) from public;
revoke all on function public.set_tenant_membership_status(uuid, uuid, text) from public;

grant execute on function public.get_my_contexts() to authenticated;
grant execute on function public.set_my_active_context(uuid, uuid) to authenticated;
grant execute on function public.get_my_capabilities() to authenticated;
grant execute on function public.list_tenant_memberships(uuid) to authenticated;
grant execute on function public.create_org_unit(uuid, text, text, uuid) to authenticated;
grant execute on function public.update_org_unit(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.onboard_tenant(text, text, text, text) to authenticated;
grant execute on function public.onboard_tenant(text, text) to authenticated;
grant execute on function public.create_tenant_invitation(uuid, text, uuid, uuid, interval) to authenticated;
grant execute on function public.accept_tenant_invitation(text) to authenticated;
grant execute on function public.revoke_tenant_invitation(uuid, uuid) to authenticated;
grant execute on function public.create_tenant_role(uuid, text, text, text, text[]) to authenticated;
grant execute on function public.update_tenant_role(uuid, uuid, text, text, text[]) to authenticated;
grant execute on function public.assign_tenant_role(uuid, uuid, uuid, uuid, timestamptz) to authenticated;
grant execute on function public.revoke_tenant_role_assignment(uuid, uuid) to authenticated;
grant execute on function public.set_tenant_membership_status(uuid, uuid, text) to authenticated;

commit;
