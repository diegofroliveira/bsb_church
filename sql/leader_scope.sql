-- IgrejaPro: escopos seguros para lideranca.
-- Execute no Supabase SQL Editor antes de liberar o modulo "Visoes de Lideranca".

alter table public.profiles add column if not exists assigned_sector text;

create or replace function public.leader_scope_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select p.*
  from public.profiles p
  where p.id = auth.uid()
    and lower(coalesce(p.role, '')) in ('admin', 'pastor', 'leader', 'lider');
$$;

revoke all on function public.leader_scope_profile() from public;
grant execute on function public.leader_scope_profile() to authenticated;

create or replace function public.get_leader_group_view()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.profiles;
  result jsonb;
begin
  select * into p from public.leader_scope_profile();
  if p.id is null or nullif(trim(p.assigned_gc), '') is null then
    raise exception 'Nenhum grupo caseiro foi atribuido a este usuario.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'scope', jsonb_build_object('group', p.assigned_gc),
    'members', coalesce((select jsonb_agg(to_jsonb(x) order by x.nome) from (
      select m.id, m.nome, m.sexo, m.nascimento, m.status, m.tipo_de_pessoa,
        m.grupos_caseiros, m.data_de_cadastro,
        case
          when upper(trim(m.nome)) = any(array[
            upper(trim(coalesce(c.lider, ''))), upper(trim(coalesce(c.auxiliar, ''))),
            upper(trim(coalesce(c.auxiliar_1, ''))), upper(trim(coalesce(c.auxiliar_2, '')))
          ]) then case when upper(trim(m.nome)) = upper(trim(coalesce(c.lider, ''))) then 'Lider' else 'Auxiliar' end
          else 'Membro'
        end as cargo_gc,
        (select d.discipulador from public.discipulado d where upper(trim(d.discipulo)) = upper(trim(m.nome)) limit 1) as discipulador
      from public.membros m
      left join public.celulas c on upper(trim(c.grupo_caseiro)) = upper(trim(m.grupos_caseiros))
      where m.status = 'Ativo' and upper(trim(m.grupos_caseiros)) = upper(trim(p.assigned_gc))
    ) x), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(to_jsonb(l) order by l.discipulador, l.discipulo) from (
      select d.discipulo, d.discipulador, d.status
      from public.discipulado d
      where exists (
        select 1 from public.membros m
        where m.status = 'Ativo'
          and upper(trim(m.grupos_caseiros)) = upper(trim(p.assigned_gc))
          and upper(trim(m.nome)) = upper(trim(d.discipulo))
      )
    ) l), '[]'::jsonb),
    'cells', coalesce((select jsonb_agg(to_jsonb(c)) from public.celulas c where upper(trim(c.grupo_caseiro)) = upper(trim(p.assigned_gc))), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.get_leader_sector_view()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.profiles;
  result jsonb;
begin
  select * into p from public.leader_scope_profile();
  if p.id is null or nullif(trim(p.assigned_sector), '') is null then
    raise exception 'Nenhum setor foi atribuido a este usuario.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'scope', jsonb_build_object('sector', p.assigned_sector),
    'members', coalesce((select jsonb_agg(to_jsonb(x) order by x.nome) from (
      select m.id, m.nome, m.sexo, m.nascimento, m.status, m.tipo_de_pessoa,
        m.grupos_caseiros, m.data_de_cadastro,
        (select d.discipulador from public.discipulado d where upper(trim(d.discipulo)) = upper(trim(m.nome)) limit 1) as discipulador
      from public.membros m
      where m.status = 'Ativo' and exists (
        select 1 from public.celulas c
        where upper(trim(c.grupo_caseiro)) = upper(trim(m.grupos_caseiros))
          and upper(trim(c.setor)) = upper(trim(p.assigned_sector))
      )
    ) x), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(to_jsonb(l) order by l.discipulador, l.discipulo) from (
      select d.discipulo, d.discipulador, d.status
      from public.discipulado d
      where exists (
        select 1 from public.membros m
        where m.status = 'Ativo' and upper(trim(m.nome)) = upper(trim(d.discipulo))
          and exists (
            select 1 from public.celulas c
            where upper(trim(c.grupo_caseiro)) = upper(trim(m.grupos_caseiros))
              and upper(trim(c.setor)) = upper(trim(p.assigned_sector))
          )
      )
    ) l), '[]'::jsonb),
    'cells', coalesce((select jsonb_agg(to_jsonb(c) order by c.grupo_caseiro) from public.celulas c where upper(trim(c.setor)) = upper(trim(p.assigned_sector))), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_leader_group_view() from public;
revoke all on function public.get_leader_sector_view() from public;
grant execute on function public.get_leader_group_view() to authenticated;
grant execute on function public.get_leader_sector_view() to authenticated;
