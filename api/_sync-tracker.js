export const SYNC_TRACKER_ID = '00000000-0000-0000-0000-000000000002';

export const MAX_SYNC_PER_DAY = 2;
export const MAX_SYNC_PER_WEEK = 5;

/**
 * Converte data para fuso horário de Brasília (America/Sao_Paulo)
 */
export function getBrasiliaDate(d = new Date()) {
  const dateObj = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  const s = dateObj.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
  return new Date(s);
}

/**
 * Retorna o início do dia atual em horário de Brasília (00:00:00)
 */
export function getStartOfTodayBrasilia(d = new Date()) {
  const br = getBrasiliaDate(d);
  br.setHours(0, 0, 0, 0);
  return br;
}

/**
 * Retorna o início da semana atual em horário de Brasília (Segunda-feira às 00:00:00)
 */
export function getStartOfWeekBrasilia(d = new Date()) {
  const br = getBrasiliaDate(d);
  const day = br.getDay(); // 0 = Domingo, 1 = Segunda, ...
  const diffToMonday = (day === 0 ? 6 : day - 1);
  br.setDate(br.getDate() - diffToMonday);
  br.setHours(0, 0, 0, 0);
  return br;
}

/**
 * Recupera o histórico recente de sincronizações.
 * Tenta primeiro a tabela public.sync_logs; se não existir, usa a linha especial no profiles.
 */
export async function getSyncLogs(supabase) {
  // 1. Tentar ler da tabela dedicada sync_logs
  try {
    const { data, error } = await supabase
      .from('sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(60);

    if (!error && Array.isArray(data)) {
      return data;
    }
  } catch (_) {}

  // 2. Fallback: ler do registro de rastreamento na tabela profiles
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('avatar')
      .eq('id', SYNC_TRACKER_ID)
      .maybeSingle();

    if (!error && data?.avatar) {
      const parsed = JSON.parse(data.avatar);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (_) {}

  return [];
}

/**
 * Registra um evento de sincronização na base (tabela sync_logs e/ou profiles fallback).
 */
export async function recordSyncLog(supabase, logEntry) {
  const entry = {
    id: logEntry.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'sync-' + Date.now()),
    user_id: logEntry.user_id || null,
    user_name: logEntry.user_name || 'Usuário',
    user_email: logEntry.user_email || '',
    role: (logEntry.role || 'secretaria').toLowerCase(),
    status: logEntry.status || 'success',
    created_at: logEntry.created_at || new Date().toISOString()
  };

  // 1. Tentar gravar na tabela dedicada sync_logs
  try {
    await supabase.from('sync_logs').insert([entry]);
  } catch (_) {}

  // 2. Gravar no fallback profiles para resiliência garantida
  try {
    const currentLogs = await getSyncLogs(supabase);
    const updated = [entry, ...currentLogs.filter(l => l.id !== entry.id)].slice(0, 60);

    await supabase.from('profiles').upsert({
      id: SYNC_TRACKER_ID,
      email: 'system-sync@igreja.local',
      name: 'Registro de Sincronizações',
      role: 'system',
      avatar: JSON.stringify(updated),
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Erro ao salvar sync log no profiles:', err);
  }

  return entry;
}

/**
 * Reseta o histórico de sincronizações da secretaria (usado pelo administrador).
 */
export async function resetSecretariaLogs(supabase) {
  try {
    await supabase.from('sync_logs').delete().eq('role', 'secretaria');
  } catch (_) {}

  try {
    const currentLogs = await getSyncLogs(supabase);
    const filtered = currentLogs.filter(l => (l.role || '').toLowerCase() !== 'secretaria');
    await supabase.from('profiles').upsert({
      id: SYNC_TRACKER_ID,
      email: 'system-sync@igreja.local',
      name: 'Registro de Sincronizações',
      role: 'system',
      avatar: JSON.stringify(filtered),
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Erro ao resetar logs no profiles:', err);
  }
}

/**
 * Calcula cotas e limites com base nas regras:
 * - Admin: ilimitado
 * - Secretaria: max 2 por dia, max 5 por semana (iniciando na Segunda-feira em Brasília)
 */
export function calculateQuota(logs = [], role = 'secretaria') {
  const normalizedRole = String(role || '').toLowerCase();
  const isAdmin = normalizedRole === 'admin' || normalizedRole === 'administrador';

  if (isAdmin) {
    return {
      isAdmin: true,
      role: normalizedRole,
      usedToday: 0,
      usedThisWeek: 0,
      remainingToday: Infinity,
      remainingThisWeek: Infinity,
      maxPerDay: Infinity,
      maxPerWeek: Infinity,
      canSync: true,
      blockedReason: null
    };
  }

  const now = new Date();
  const startToday = getStartOfTodayBrasilia(now);
  const startWeek = getStartOfWeekBrasilia(now);

  const secLogs = (logs || []).filter(l => (l.role || '').toLowerCase() === 'secretaria');

  let usedToday = 0;
  let usedThisWeek = 0;

  for (const log of secLogs) {
    const logDate = getBrasiliaDate(new Date(log.created_at));
    if (logDate >= startToday) {
      usedToday++;
    }
    if (logDate >= startWeek) {
      usedThisWeek++;
    }
  }

  const remainingToday = Math.max(0, MAX_SYNC_PER_DAY - usedToday);
  const remainingThisWeek = Math.max(0, MAX_SYNC_PER_WEEK - usedThisWeek);

  let canSync = true;
  let blockedReason = null;

  if (usedToday >= MAX_SYNC_PER_DAY) {
    canSync = false;
    blockedReason = `Você já utilizou o limite diário de ${MAX_SYNC_PER_DAY} atualizações para o perfil Secretaria.`;
  } else if (usedThisWeek >= MAX_SYNC_PER_WEEK) {
    canSync = false;
    blockedReason = `Você já utilizou o limite semanal de ${MAX_SYNC_PER_WEEK} atualizações para o perfil Secretaria.`;
  }

  return {
    isAdmin: false,
    role: normalizedRole,
    usedToday,
    usedThisWeek,
    remainingToday,
    remainingThisWeek,
    maxPerDay: MAX_SYNC_PER_DAY,
    maxPerWeek: MAX_SYNC_PER_WEEK,
    canSync,
    blockedReason
  };
}
