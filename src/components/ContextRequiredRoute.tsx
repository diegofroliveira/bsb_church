import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useOrganization } from '../context/OrganizationContext'

export function ContextRequiredRoute() {
  const { activeContext, error, isLoading, needsOnboarding } = useOrganization()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
      </div>
    )
  }

  if (!activeContext || error) {
    if (needsOnboarding) {
      return <Navigate to="/onboarding" replace state={{ from: location }} />
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">
            Contexto organizacional indisponível
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {error ?? 'Sua sessão não possui um contexto ativo válido.'}
          </p>
        </div>
      </div>
    )
  }

  return <Outlet />
}
