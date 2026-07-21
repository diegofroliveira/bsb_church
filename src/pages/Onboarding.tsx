import { useState, type FormEvent } from 'react'
import { Building2, CheckCircle2, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useOrganization } from '../context/OrganizationContext'

export function Onboarding() {
  const navigate = useNavigate()
  const { needsOnboarding, refreshContexts } = useOrganization()
  const [tenantName, setTenantName] = useState('')
  const [orgUnitName, setOrgUnitName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const { error: onboardingError } = await supabase.rpc('onboard_tenant', {
        p_tenant_name: tenantName.trim(),
        p_org_unit_name: orgUnitName.trim(),
      })

      if (onboardingError) throw onboardingError

      await refreshContexts()
      navigate('/', { replace: true })
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível concluir o onboarding.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!needsOnboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-emerald-100 bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            Sua organização já está configurada
          </h1>
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
          >
            Acessar o IgrejaPro
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-12 text-slate-900 sm:px-6">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl lg:grid-cols-[0.9fr_1.1fr]">
        <section className="bg-gradient-to-br from-blue-700 to-indigo-950 p-8 text-white sm:p-12">
          <ShieldCheck className="h-10 w-10 text-blue-200" />
          <p className="mt-8 text-xs font-black uppercase tracking-[0.25em] text-blue-200">
            IgrejaPro · Core seguro
          </p>
          <h1 className="mt-3 text-3xl font-black leading-tight">
            Comece pela identidade da sua organização
          </h1>
          <p className="mt-4 text-sm leading-6 text-blue-100">
            Esta etapa cria um tenant independente, sua igreja inicial e o seu
            acesso de responsável. Nenhum dado será compartilhado com outra
            organização automaticamente.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-blue-50">
            <li>✓ isolamento por tenant desde o primeiro cadastro</li>
            <li>✓ permissões calculadas no banco</li>
            <li>✓ módulos ativados sem apagar dados</li>
          </ul>
        </section>

        <section className="p-8 sm:p-12">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <Building2 className="h-6 w-6" />
          </div>
          <h2 className="mt-6 text-2xl font-black text-slate-900">
            Criar organização
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            O nome do produto permanece IgrejaPro até a definição da nova marca.
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                Nome da organização ou ministério
              </span>
              <input
                required
                minLength={3}
                maxLength={120}
                value={tenantName}
                onChange={(event) => setTenantName(event.target.value)}
                placeholder="Ex.: Ministério Exemplo"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-slate-700">
                Nome da igreja ou localidade inicial
              </span>
              <input
                required
                minLength={3}
                maxLength={120}
                value={orgUnitName}
                onChange={(event) => setOrgUnitName(event.target.value)}
                placeholder="Ex.: Igreja Central"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
              />
            </label>

            {error && (
              <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
            >
              {isSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Criar ambiente seguro
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
