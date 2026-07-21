export interface OrganizationContextOption {
  tenantId: string
  tenantName: string
  membershipId: string
  orgUnitId: string | null
  orgUnitName: string | null
  roleCode: string | null
}

export interface ActiveCapabilities {
  permissions: string[]
  modules: string[]
}

export interface PlatformContextState extends ActiveCapabilities {
  active: OrganizationContextOption | null
  contexts: OrganizationContextOption[]
}
