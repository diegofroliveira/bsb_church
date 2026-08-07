import { createClient } from '@supabase/supabase-js';

export function sendJson(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(payload));
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (!req.body) return {};
  try {
    return JSON.parse(req.body);
  } catch {
    throw new Error('Corpo da requisição inválido.');
  }
}

function getBearerToken(req) {
  const header = req.headers?.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function getSupabaseUrl() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!url) {
    throw Object.assign(new Error('SUPABASE_URL precisa estar configurada no ambiente.'), { status: 503 });
  }
  return url;
}

function getAdminClient() {
  const url = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw Object.assign(new Error('SUPABASE_SERVICE_ROLE_KEY precisa estar configurada na Vercel para operações administrativas.'), { status: 503 });
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function getSessionClient(token) {
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw Object.assign(new Error('SUPABASE_ANON_KEY precisa estar configurada no ambiente.'), { status: 503 });
  }
  return createClient(getSupabaseUrl(), anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function requireAdmin(req) {
  const token = getBearerToken(req);
  if (!token) throw Object.assign(new Error('Sessão administrativa não informada.'), { status: 401 });

  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const supabase = hasServiceRole ? getAdminClient() : getSessionClient(token);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    throw Object.assign(new Error('Sessão expirada ou inválida.'), { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .maybeSingle();

  const role = String(profile?.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'administrador') {
    throw Object.assign(new Error('Apenas administradores podem executar esta operação.'), { status: 403 });
  }

  return { supabase, user: authData.user, profile, hasServiceRole };
}

export function requireServiceRole(hasServiceRole) {
  if (!hasServiceRole) {
    throw Object.assign(new Error('SUPABASE_SERVICE_ROLE_KEY precisa estar configurada na Vercel para esta operação.'), { status: 503 });
  }
}

export function handleApiError(res, error) {
  console.error(error);
  const status = Number(error?.status) || 500;
  return sendJson(res, status, { error: error?.message || 'Erro interno do servidor.' });
}

export async function upsertProfile(supabase, user, values) {
  const record = {
    id: user.id,
    email: user.email || values.email || null,
    name: values.name ?? user.user_metadata?.name ?? '',
    role: values.role ?? user.user_metadata?.role ?? 'pastor',
    avatar: values.avatar ?? user.user_metadata?.avatar ?? null,
    assigned_gc: values.assigned_gc ?? user.user_metadata?.assigned_gc ?? null,
    assigned_sector: values.assigned_sector ?? user.user_metadata?.assigned_sector ?? null,
    updated_at: new Date().toISOString()
  };

  let result = await supabase.from('profiles').upsert(record).select().maybeSingle();
  if (result.error && /assigned_gc|assigned_sector|column/i.test(result.error.message)) {
    const { assigned_gc: _assignedGc, assigned_sector: _assignedSector, ...withoutScope } = record;
    result = await supabase.from('profiles').upsert(withoutScope).select().maybeSingle();
  }
  if (result.error) throw result.error;
  return result.data || record;
}
