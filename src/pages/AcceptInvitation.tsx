import { useState } from 'react'
import { CheckCircle2, LoaderCircle, ShieldCheck, XCircle } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useOrganization } from '../context/OrganizationContext'
import { supabase } from '../lib/supabase'

export function AcceptInvitation() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { refreshContexts } = useOrganization()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const token = searchParams.get('token')?.trim() ?? ''

  const accept = async () => {
    if (!token) return
    setIsSubmitting(true)
    setError(null)
    try {
      const { error: invitationError } = await supabase.rpc(
        'accept_tenant_invitation',
        { p_token: token },
      )
      if (invitationError) throw invitationError
      await refreshContexts()
      setAccepted(true)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível aceitar este convite.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-2xl sm:p-10">
        {accepted ? (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h1 className="mt-5 text-2xl font-black text-slate-900">
              Convite aceito
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Seu novo contexto organizacional já está disponível.
            </p>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="mt-7 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700"
            >
              Entrar no contexto
            </button>
          </>
        ) : (
          <>
            {token ? (
              <ShieldCheck className="mx-auto h-12 w-12 text-blue-600" />
            ) : (
              <XCircle className="mx-auto h-12 w-12 text-red-500" />
            )}
            <h1 className="mt-5 text-2xl font-black text-slate-900">
              {token ? 'Confirmar vínculo organizacional' : 'Convite inválido'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {token
                ? 'Confirme somente se você reconhece a organização que enviou este convite.'
                : 'O link não contém um token de convite válido.'}
            </p>

            {error && (
              <div role="alert" className="mt-5 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={!token || isSubmitting}
              onClick={() => void accept()}
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Aceitar convite
            </button>
          </>
        )}
      </div>
    </div>
  )
}
