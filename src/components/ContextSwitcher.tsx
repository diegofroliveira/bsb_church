import { Building2, ChevronDown, LoaderCircle } from 'lucide-react'
import { useOrganization } from '../context/OrganizationContext'

export function ContextSwitcher() {
  const {
    contexts,
    activeContext,
    isLoading,
    switchContext,
  } = useOrganization()

  if (!activeContext) return null

  const activeKey = `${activeContext.tenantId}:${activeContext.orgUnitId ?? ''}`

  return (
    <label className="relative block">
      <span className="sr-only">Contexto organizacional ativo</span>
      <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <select
        aria-label="Contexto organizacional ativo"
        value={activeKey}
        disabled={isLoading}
        onChange={(event) => {
          const selected = contexts.find(
            (context) =>
              `${context.tenantId}:${context.orgUnitId ?? ''}` ===
              event.target.value,
          )
          if (selected) void switchContext(selected)
        }}
        className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-wait disabled:opacity-60"
      >
        {contexts.map((context) => (
          <option
            key={`${context.tenantId}:${context.orgUnitId ?? ''}:${context.roleCode ?? ''}`}
            value={`${context.tenantId}:${context.orgUnitId ?? ''}`}
          >
            {context.tenantName}
            {context.orgUnitName ? ` · ${context.orgUnitName}` : ''}
          </option>
        ))}
      </select>
      {isLoading ? (
        <LoaderCircle className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-500" />
      ) : (
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      )}
    </label>
  )
}
