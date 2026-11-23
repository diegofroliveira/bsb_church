import { handleApiError, sendJson } from './_admin-auth.js';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://vadufkgbluisdamgkbln.supabase.co';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return sendJson(res, 200, {}); // Falha silenciosa para fallback local
    }
    
    const supabase = createClient(SUPABASE_URL, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data } = await supabase
      .from('profiles')
      .select('avatar')
      .eq('role', 'admin');

    if (data && data.length > 0) {
      for (const r of data) {
        if (r.avatar && r.avatar.startsWith('{"')) {
          try {
            const parsed = JSON.parse(r.avatar);
            if (parsed && parsed.admin && Array.isArray(parsed.admin.modules)) {
              return sendJson(res, 200, parsed);
            }
          } catch (_) {}
        }
      }
    }
    return sendJson(res, 200, {});
  } catch (error) {
    return handleApiError(res, error);
  }
}
