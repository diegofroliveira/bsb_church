import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY precisam estar configuradas.',
  );
}

// Client principal — usado para autenticação (login/logout)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
});

// Client de leitura via SDK (mantido para queries simples sem .or())
export const supabaseReader = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// rawGet — fetch nativo que SEMPRE usa a anon key no header Authorization.
//
// O Supabase JS v2 sobrescreve o Authorization header dinamicamente em cada
// request com o JWT do usuário logado, mesmo quando global.headers é definido.
// Isso faz com que tabelas com RLS somente para 'anon' retornem 0 linhas para
// usuários autenticados. rawGet() usa fetch diretamente, garantindo que o
// header não seja sobrescrito pelo SDK.
// ─────────────────────────────────────────────────────────────────────────────
const ANON_HEADERS = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

export async function rawGet(
  table: string,
  queryParams: string,
  extraHeaders: Record<string, string> = {}
): Promise<{ data: any[] | null; error: any }> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/${table}?${queryParams}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { ...ANON_HEADERS, ...extraHeaders },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: response.statusText }));
      return { data: null, error: errorBody };
    }
    const data = await response.json();
    return { data: Array.isArray(data) ? data : [data], error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

// Alias para compatibilidade — rawGet com paginação para tabelas grandes
export async function rawGetAll(
  table: string,
  selectCols: string,
  pageSize = 1000
): Promise<{ data: any[] | null; error: any }> {
  const allRows: any[] = [];
  let from = 0;
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(selectCols)}&limit=${pageSize}&offset=${from}`;
    const response = await fetch(url, { headers: ANON_HEADERS });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: response.statusText }));
      return { data: allRows.length > 0 ? allRows : null, error: errorBody };
    }
    const rows: any[] = await response.json();
    allRows.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return { data: allRows, error: null };
}



