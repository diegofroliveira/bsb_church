import { handleApiError, requireAdmin, sendJson } from './_admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendJson(res, 405, { error: 'Método não permitido.' });
  try {
    const { supabase } = await requireAdmin(req);
    const users = [];
    for (let page = 1; page <= 100; page += 1) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      users.push(...(data?.users || []));
      if (!data?.users || data.users.length < 1000) break;
    }

    const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*');
    if (profilesError) throw profilesError;
    const byId = new Map((profiles || []).map(profile => [profile.id, profile]));
    const result = users
      .filter(user => user.id !== '00000000-0000-0000-0000-000000000000')
      .map(user => {
        const profile = byId.get(user.id) || {};
        return {
          id: user.id,
          email: user.email || profile.email || '',
          name: profile.name || user.user_metadata?.name || user.email?.split('@')[0] || '',
          role: profile.role || user.user_metadata?.role || 'pastor',
          avatar: profile.avatar || user.user_metadata?.avatar,
          assigned_gc: profile.assigned_gc ?? user.user_metadata?.assigned_gc,
          created_at: user.created_at,
          updated_at: profile.updated_at || user.updated_at
        };
      });
    return sendJson(res, 200, { users: result });
  } catch (error) {
    return handleApiError(res, error);
  }
}

