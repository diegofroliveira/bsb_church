import { createClient } from '@supabase/supabase-js'

export function sendJson(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
  return res.end(JSON.stringify(payload))
}

function getBearerToken(req) {
  const header = req.headers?.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

function getSupabaseUrl() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  if (!url) {
    throw Object.assign(
      new Error('SUPABASE_URL precisa estar configurada no ambiente.'),
      { status: 503 },
    )
  }
  return url
}

function getSessionClient(token) {
  const anonKey =
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!anonKey) {
    throw Object.assign(
      new Error('SUPABASE_ANON_KEY precisa estar configurada no ambiente.'),
      { status: 503 },
    )
  }
  return createClient(getSupabaseUrl(), anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function requirePermission(req, requiredPermission) {
  const token = getBearerToken(req)
  if (!token) {
    throw Object.assign(new Error('Sessão não informada.'), { status: 401 })
  }

  const supabase = getSessionClient(token)
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData.user) {
    throw Object.assign(new Error('Sessão expirada ou inválida.'), {
      status: 401,
    })
  }

  const { data, error } = await supabase.rpc('get_my_capabilities')
  if (error) throw error

  const context = Array.isArray(data) ? data[0] : data
  const permissions = context?.permissions ?? []
  if (!context?.tenant_id || !permissions.includes(requiredPermission)) {
    throw Object.assign(
      new Error('O contexto ativo não possui permissão para esta operação.'),
      { status: 403 },
    )
  }

  return {
    supabase,
    user: authData.user,
    context: {
      tenantId: context.tenant_id,
      orgUnitId: context.org_unit_id ?? null,
      permissions,
      modules: context.modules ?? [],
    },
  }
}

export function handleApiError(res, error) {
  const status = Number(error?.status) || 500
  console.error('API authorization error', {
    status,
    message: error?.message || 'Erro interno',
  })
  return sendJson(res, status, {
    error: error?.message || 'Erro interno do servidor.',
  })
}
