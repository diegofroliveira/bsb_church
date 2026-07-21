import { describe, expect, it } from 'vitest'
import {
  contextKey,
  normalizeContexts,
  selectPreferredContext,
  type OrganizationContextRow,
} from './platformContext'

const rows: OrganizationContextRow[] = [
  {
    tenant_id: 'tenant-a',
    tenant_name: 'Tenant A',
    membership_id: 'membership-a',
    org_unit_id: null,
    role_code: 'tenant_owner',
  },
  {
    tenant_id: 'tenant-a',
    tenant_name: 'Tenant A',
    membership_id: 'membership-a',
    org_unit_id: null,
    role_code: 'auditor',
  },
  {
    tenant_id: 'tenant-b',
    tenant_name: 'Tenant B',
    membership_id: 'membership-b',
    org_unit_id: 'org-b',
    org_unit_name: 'Igreja B',
    role_code: 'leader',
  },
]

describe('platform context', () => {
  it('deduplica o mesmo tenant/unidade sem perder os papéis', () => {
    const contexts = normalizeContexts(rows)

    expect(contexts).toHaveLength(2)
    expect(contexts[0].roleCode).toBe('tenant_owner, auditor')
  })

  it('mantém tenants diferentes como contextos independentes', () => {
    const contexts = normalizeContexts(rows)

    expect(contexts.map(contextKey)).toEqual(['tenant-a:tenant', 'tenant-b:org-b'])
  })

  it('restaura somente um contexto que ainda pertence ao usuário', () => {
    const contexts = normalizeContexts(rows)

    expect(selectPreferredContext(contexts, 'tenant-b:org-b')?.tenantId).toBe(
      'tenant-b',
    )
    expect(selectPreferredContext(contexts, 'tenant-c:tenant')?.tenantId).toBe(
      'tenant-a',
    )
  })

  it('retorna nulo quando não há membership ativa', () => {
    expect(selectPreferredContext([], null)).toBeNull()
  })
})
