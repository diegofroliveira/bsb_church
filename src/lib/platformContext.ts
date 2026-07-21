import type { OrganizationContextOption } from '../types/platform'

export interface OrganizationContextRow {
  tenant_id: string
  tenant_name: string
  membership_id: string
  org_unit_id: string | null
  org_unit_name?: string | null
  role_code: string | null
}

export function contextKey(context: OrganizationContextOption) {
  return `${context.tenantId}:${context.orgUnitId ?? 'tenant'}`
}

export function normalizeContexts(rows: OrganizationContextRow[]) {
  return [
    ...rows
      .map<OrganizationContextOption>((row) => ({
        tenantId: row.tenant_id,
        tenantName: row.tenant_name,
        membershipId: row.membership_id,
        orgUnitId: row.org_unit_id,
        orgUnitName: row.org_unit_name ?? null,
        roleCode: row.role_code,
      }))
      .reduce((unique, context) => {
        const key = contextKey(context)
        const existing = unique.get(key)
        if (!existing) {
          unique.set(key, context)
        } else if (
          context.roleCode &&
          !existing.roleCode?.split(', ').includes(context.roleCode)
        ) {
          unique.set(key, {
            ...existing,
            roleCode: [existing.roleCode, context.roleCode]
              .filter(Boolean)
              .join(', '),
          })
        }
        return unique
      }, new Map<string, OrganizationContextOption>())
      .values(),
  ]
}

export function selectPreferredContext(
  contexts: OrganizationContextOption[],
  storedKey: string | null,
) {
  return (
    contexts.find((context) => contextKey(context) === storedKey) ??
    contexts[0] ??
    null
  )
}
