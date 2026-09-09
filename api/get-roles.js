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
      const rowWithConfig = data.find(r => r.avatar && r.avatar.startsWith('{"'));
      if (rowWithConfig && rowWithConfig.avatar) {
        return sendJson(res, 200, JSON.parse(rowWithConfig.avatar));
      }
    }
    return sendJson(res, 200, {});
  } catch (error) {
    return handleApiError(res, error);
  }
}
