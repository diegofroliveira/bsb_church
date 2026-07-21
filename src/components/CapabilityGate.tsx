import type { ReactNode } from 'react'
import { useOrganization } from '../context/OrganizationContext'

interface CapabilityGateProps {
  permission?: string
  module?: string
  fallback?: ReactNode
  children: ReactNode
}

export function CapabilityGate({
  permission,
  module,
  fallback = null,
  children,
}: CapabilityGateProps) {
  const { can, hasModule } = useOrganization()
  const permitted = !permission || can(permission)
  const entitled = !module || hasModule(module)

  return permitted && entitled ? children : fallback
}
