import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type {
  ActiveCapabilities,
  OrganizationContextOption,
} from '../types/platform'
import {
  contextKey,
  normalizeContexts,
  selectPreferredContext,
  type OrganizationContextRow,
} from '../lib/platformContext'

interface CapabilitiesRow {
  permissions?: string[] | null
  modules?: string[] | null
}

interface OrganizationContextValue extends ActiveCapabilities {
  contexts: OrganizationContextOption[]
  activeContext: OrganizationContextOption | null
  isLoading: boolean
  error: string | null
  needsOnboarding: boolean
  refreshContexts: () => Promise<void>
  switchContext: (context: OrganizationContextOption) => Promise<void>
  can: (permission: string) => boolean
  hasModule: (moduleKey: string) => boolean
}

const EMPTY_CAPABILITIES: ActiveCapabilities = {
  permissions: [],
  modules: [],
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(
  undefined,
)

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [contexts, setContexts] = useState<OrganizationContextOption[]>([])
  const [activeContext, setActiveContext] =
    useState<OrganizationContextOption | null>(null)
  const [capabilities, setCapabilities] =
    useState<ActiveCapabilities>(EMPTY_CAPABILITIES)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCapabilities = useCallback(async () => {
    const { data, error: capabilityError } = await supabase.rpc(
      'get_my_capabilities',
    )

    if (capabilityError) throw capabilityError

    const row = (Array.isArray(data) ? data[0] : data) as
      | CapabilitiesRow
      | null

    setCapabilities({
      permissions: [...new Set(row?.permissions ?? [])].sort(),
      modules: [...new Set(row?.modules ?? [])].sort(),
    })
  }, [])

  const activate = useCallback(
    async (context: OrganizationContextOption) => {
      const { error: activationError } = await supabase.rpc(
        'set_my_active_context',
        {
          p_tenant_id: context.tenantId,
          p_org_unit_id: context.orgUnitId,
        },
      )

      if (activationError) throw activationError

      setActiveContext(context)
      if (user) {
        localStorage.setItem(
          `igrejapro.active-context.${user.id}`,
          contextKey(context),
        )
      }
      await loadCapabilities()
    },
    [loadCapabilities, user],
  )

  const refreshContexts = useCallback(async () => {
    if (!user) {
      setContexts([])
      setActiveContext(null)
      setCapabilities(EMPTY_CAPABILITIES)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { data, error: contextError } = await supabase.rpc(
        'get_my_contexts',
      )
      if (contextError) throw contextError

      const available = normalizeContexts((data ?? []) as OrganizationContextRow[])
      setContexts(available)

      if (available.length === 0) {
        setActiveContext(null)
        setCapabilities(EMPTY_CAPABILITIES)
        return
      }

      const storedKey = localStorage.getItem(
        `igrejapro.active-context.${user.id}`,
      )
      const preferred = selectPreferredContext(available, storedKey)

      if (preferred) await activate(preferred)
    } catch (cause) {
      setContexts([])
      setActiveContext(null)
      setCapabilities(EMPTY_CAPABILITIES)
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível carregar os contextos organizacionais.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [activate, user])

  useEffect(() => {
    void refreshContexts()
  }, [refreshContexts])

  const switchContext = useCallback(
    async (context: OrganizationContextOption) => {
      setIsLoading(true)
      setError(null)
      try {
        await activate(context)
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Não foi possível alterar o contexto.',
        )
        throw cause
      } finally {
        setIsLoading(false)
      }
    },
    [activate],
  )

  const value = useMemo<OrganizationContextValue>(
    () => ({
      contexts,
      activeContext,
      permissions: capabilities.permissions,
      modules: capabilities.modules,
      isLoading,
      error,
      needsOnboarding:
        Boolean(user) && !isLoading && !error && contexts.length === 0,
      refreshContexts,
      switchContext,
      can: (permission) => capabilities.permissions.includes(permission),
      hasModule: (moduleKey) => capabilities.modules.includes(moduleKey),
    }),
    [
      activeContext,
      capabilities,
      contexts,
      error,
      isLoading,
      refreshContexts,
      switchContext,
      user,
    ],
  )

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (!context) {
    throw new Error('useOrganization deve ser usado dentro de OrganizationProvider')
  }
  return context
}
