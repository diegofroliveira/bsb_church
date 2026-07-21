import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Building2,
  Check,
  Clipboard,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { useOrganization } from '../context/OrganizationContext'
import { supabase } from '../lib/supabase'

interface OrgUnitRow {
  id: string
  name: string
  unit_type: string
  parent_id: string | null
  status: string
}

interface RoleRow {
  id: string
  code: string
  name: string
  description: string | null
  is_system: boolean
}

interface MembershipRow {
  membership_id: string
  user_id: string
  display_name: string | null
  email_masked: string
  status: string
  joined_at: string | null
  role_codes: string[]
}

interface InvitationRow {
  id: string
  email: string
  role_id: string
  org_unit_id: string | null
  status: string
  expires_at: string
}

interface PermissionRow {
  code: string
  description: string
  sensitivity: string
}

interface AuditRow {
  id: number
  occurred_at: string
  action: string
  entity_type: string
  entity_id: string | null
}

type Tab = 'overview' | 'organizations' | 'users' | 'roles' | 'audit'

const ORG_TYPES = [
  ['church', 'Igreja'],
  ['campus', 'Campus'],
  ['congregation', 'Congregação'],
  ['department', 'Departamento'],
  ['ministry', 'Ministério'],
] as const

function messageFrom(cause: unknown) {
  return cause instanceof Error ? cause.message : 'A operação não pôde ser concluída.'
}

export function CoreAdministration() {
  const { activeContext, can, modules, refreshContexts } = useOrganization()
  const [tab, setTab] = useState<Tab>('overview')
  const [orgUnits, setOrgUnits] = useState<OrgUnitRow[]>([])
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [memberships, setMemberships] = useState<MembershipRow[]>([])
  const [invitations, setInvitations] = useState<InvitationRow[]>([])
  const [permissions, setPermissions] = useState<PermissionRow[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [invitationLink, setInvitationLink] = useState<string | null>(null)

  const tenantId = activeContext?.tenantId

  const load = useCallback(async () => {
    if (!tenantId) return
    setIsLoading(true)
    setError(null)

    try {
      const [orgResult, roleResult, memberResult, invitationResult, permissionResult, auditResult] =
        await Promise.all([
          supabase
            .from('org_units')
            .select('id,name,unit_type,parent_id,status')
            .eq('tenant_id', tenantId)
            .order('name'),
          supabase
            .from('roles')
            .select('id,code,name,description,is_system')
            .eq('tenant_id', tenantId)
            .order('name'),
          supabase.rpc('list_tenant_memberships', { p_tenant_id: tenantId }),
          supabase
            .from('tenant_invitations')
            .select('id,email,role_id,org_unit_id,status,expires_at')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false }),
          supabase.from('permissions').select('code,description,sensitivity').order('code'),
          supabase
            .from('audit_events')
            .select('id,occurred_at,action,entity_type,entity_id')
            .eq('tenant_id', tenantId)
            .order('occurred_at', { ascending: false })
            .limit(30),
        ])

      const failed = [orgResult, roleResult, memberResult, invitationResult, permissionResult, auditResult]
        .map((result) => result.error)
        .find(Boolean)
      if (failed) throw failed

      setOrgUnits((orgResult.data ?? []) as OrgUnitRow[])
      setRoles((roleResult.data ?? []) as RoleRow[])
      setMemberships((memberResult.data ?? []) as MembershipRow[])
      setInvitations((invitationResult.data ?? []) as InvitationRow[])
      setPermissions((permissionResult.data ?? []) as PermissionRow[])
      setAudit((auditResult.data ?? []) as AuditRow[])
    } catch (cause) {
      setError(messageFrom(cause))
    } finally {
      setIsLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void load()
  }, [load])

  const metrics = useMemo(
    () => [
      ['Unidades ativas', orgUnits.filter((unit) => unit.status === 'active').length],
      ['Usuários ativos', memberships.filter((item) => item.status === 'active').length],
      ['Papéis', roles.length],
      ['Módulos ativos', modules.length],
    ],
    [memberships, modules, orgUnits, roles],
  )

  const run = async (operation: () => Promise<void>, success: string) => {
    setError(null)
    setNotice(null)
    try {
      await operation()
      setNotice(success)
      await load()
      await refreshContexts()
    } catch (cause) {
      setError(messageFrom(cause))
    }
  }

  const createOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    await run(async () => {
      const { error: rpcError } = await supabase.rpc('create_org_unit', {
        p_tenant_id: tenantId,
        p_name: String(form.get('name') ?? ''),
        p_org_type: String(form.get('type') ?? 'church'),
        p_parent_id: String(form.get('parent') ?? '') || null,
      })
      if (rpcError) throw rpcError
      formElement.reset()
    }, 'Unidade organizacional criada e auditada.')
  }

  const createInvitation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    await run(async () => {
      const { data, error: rpcError } = await supabase.rpc('create_tenant_invitation', {
        p_tenant_id: tenantId,
        p_email: String(form.get('email') ?? ''),
        p_role_id: String(form.get('role') ?? ''),
        p_org_unit_id: String(form.get('orgUnit') ?? '') || null,
      })
      if (rpcError) throw rpcError
      const token = Array.isArray(data) ? data[0]?.invitation_token : null
      if (!token) throw new Error('O token de convite não foi retornado.')
      setInvitationLink(`${window.location.origin}/accept-invite?token=${token}`)
      formElement.reset()
    }, 'Convite criado. Copie o link; o token é exibido somente agora.')
  }

  const createRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    await run(async () => {
      const { error: rpcError } = await supabase.rpc('create_tenant_role', {
        p_tenant_id: tenantId,
        p_code: String(form.get('code') ?? ''),
        p_name: String(form.get('name') ?? ''),
        p_description: String(form.get('description') ?? '') || null,
        p_permissions: form.getAll('permissions').map(String),
      })
      if (rpcError) throw rpcError
      formElement.reset()
    }, 'Papel personalizado criado.')
  }

  const setMembershipStatus = async (membershipId: string, status: 'active' | 'suspended') => {
    await run(async () => {
      const { error: rpcError } = await supabase.rpc('set_tenant_membership_status', {
        p_tenant_id: tenantId,
        p_membership_id: membershipId,
        p_status: status,
      })
      if (rpcError) throw rpcError
    }, status === 'active' ? 'Membership reativada.' : 'Membership suspensa.')
  }

  if (!tenantId) return null

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Core operacional</p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">Administração organizacional</h1>
          <p className="mt-2 text-sm text-slate-500">{activeContext?.tenantName}</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
      </header>

      {(error || notice) && (
        <div role={error ? 'alert' : 'status'} className={`rounded-xl border p-4 text-sm ${error ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>
          {error ?? notice}
        </div>
      )}

      <nav className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2">
        {([
          ['overview', 'Visão geral'],
          ['organizations', 'Organizações'],
          ['users', 'Usuários'],
          ['roles', 'Papéis'],
          ['audit', 'Auditoria'],
        ] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold ${tab === key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
            {label}
          </button>
        ))}
      </nav>

      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-200 bg-white"><LoaderCircle className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : (
        <>
          {tab === 'overview' && (
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
                  <p className="mt-3 text-3xl font-black text-slate-900">{value}</p>
                </div>
              ))}
              <div className="sm:col-span-2 xl:col-span-4 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-blue-600" /><p className="font-bold text-blue-950">Capacidades efetivas no contexto</p></div>
                <div className="mt-4 flex flex-wrap gap-2">{modules.map((module) => <span key={module} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700">{module}</span>)}</div>
              </div>
            </section>
          )}

          {tab === 'organizations' && (
            <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 font-black text-slate-900"><Building2 className="h-5 w-5 text-blue-600" /> Estrutura atual</h2>
                <div className="mt-4 divide-y divide-slate-100">{orgUnits.map((unit) => <div key={unit.id} className="py-3"><p className="font-bold text-slate-800">{unit.name}</p><p className="text-xs text-slate-500">{unit.unit_type} · {unit.status}</p></div>)}</div>
              </div>
              {can('tenant.manage') && (
                <form onSubmit={(event) => void createOrganization(event)} className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                  <h2 className="font-black text-slate-900">Nova unidade</h2>
                  <input name="name" required minLength={2} placeholder="Nome" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                  <select name="type" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{ORG_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                  <select name="parent" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Sem unidade pai</option>{orgUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select>
                  <button className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700">Criar unidade</button>
                </form>
              )}
            </section>
          )}

          {tab === 'users' && (
            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="flex items-center gap-2 font-black text-slate-900"><Users className="h-5 w-5 text-blue-600" /> Memberships</h2>
                <div className="mt-4 divide-y divide-slate-100">{memberships.map((member) => <div key={member.membership_id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-slate-800">{member.display_name || member.email_masked}</p><p className="text-xs text-slate-500">{member.email_masked} · {member.role_codes.join(', ') || 'sem papel'} · {member.status}</p></div>{can('users.manage') && <button type="button" onClick={() => void setMembershipStatus(member.membership_id, member.status === 'active' ? 'suspended' : 'active')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">{member.status === 'active' ? 'Suspender' : 'Reativar'}</button>}</div>)}</div>
              </div>
              {can('users.manage') && (
                <div className="space-y-5">
                  <form onSubmit={(event) => void createInvitation(event)} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
                    <h2 className="flex items-center gap-2 font-black text-slate-900"><UserPlus className="h-5 w-5 text-blue-600" /> Novo convite</h2>
                    <input name="email" type="email" required placeholder="email@exemplo.com" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                    <select name="role" required className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Selecione o papel</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>
                    <select name="orgUnit" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="">Tenant inteiro</option>{orgUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select>
                    <button className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700">Gerar convite</button>
                  </form>
                  {invitationLink && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold text-amber-900">Link exibido uma única vez</p><div className="mt-2 flex gap-2"><input readOnly value={invitationLink} className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-2 py-2 text-xs" /><button type="button" aria-label="Copiar link" onClick={() => void navigator.clipboard.writeText(invitationLink)} className="rounded-lg bg-amber-600 p-2 text-white"><Clipboard className="h-4 w-4" /></button></div></div>}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-black text-slate-900">Convites pendentes</h3><div className="mt-3 space-y-2">{invitations.filter((item) => item.status === 'pending').map((item) => <div key={item.id} className="text-xs text-slate-600">{item.email} · expira {new Date(item.expires_at).toLocaleDateString('pt-BR')}</div>)}</div></div>
                </div>
              )}
            </section>
          )}

          {tab === 'roles' && (
            <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="flex items-center gap-2 font-black text-slate-900"><KeyRound className="h-5 w-5 text-blue-600" /> Papéis</h2><div className="mt-4 divide-y divide-slate-100">{roles.map((role) => <div key={role.id} className="py-3"><p className="font-bold text-slate-800">{role.name} {role.is_system && <span className="text-xs text-blue-500">sistema</span>}</p><p className="text-xs text-slate-500">{role.code}</p></div>)}</div></div>
              {can('tenant.manage') && <form onSubmit={(event) => void createRole(event)} className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black text-slate-900">Papel personalizado</h2><input name="name" required placeholder="Nome" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /><input name="code" required pattern="[a-z][a-z0-9_.-]+" placeholder="codigo_interno" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /><textarea name="description" placeholder="Descrição" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" /><div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-100 p-3">{permissions.map((permission) => <label key={permission.code} className="flex gap-2 text-xs text-slate-700"><input type="checkbox" name="permissions" value={permission.code} /><span><strong>{permission.code}</strong><br />{permission.description}</span></label>)}</div><button className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">Criar papel</button></form>}
            </section>
          )}

          {tab === 'audit' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="flex items-center gap-2 font-black text-slate-900"><Check className="h-5 w-5 text-blue-600" /> Operações recentes</h2><div className="mt-4 divide-y divide-slate-100">{audit.map((event) => <div key={event.id} className="py-3"><p className="font-mono text-xs font-bold text-slate-700">{event.action}</p><p className="mt-1 text-xs text-slate-500">{event.entity_type} · {new Date(event.occurred_at).toLocaleString('pt-BR')}</p></div>)}</div></section>
          )}
        </>
      )}
    </div>
  )
}
