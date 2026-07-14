import { handleApiError, readJson, requireAdmin, requireServiceRole, sendJson } from './_admin-auth.js';

const SPECIAL_CONFIG_ID = '00000000-0000-0000-0000-000000000000';

export default async function handler(req, res) {
  if (!['POST', 'DELETE'].includes(req.method)) return sendJson(res, 405, { error: 'Método não permitido.' });
  try {
    const { supabase, user: admin, hasServiceRole } = await requireAdmin(req);
    requireServiceRole(hasServiceRole);
    const { userId } = await readJson(req);
    if (!userId || userId === SPECIAL_CONFIG_ID) throw Object.assign(new Error('Usuário inválido.'), { status: 400 });
    if (userId === admin.id) throw Object.assign(new Error('Não é permitido excluir o próprio usuário.'), { status: 400 });
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;
    return sendJson(res, 200, { success: true, userId });
  } catch (error) {
    return handleApiError(res, error);
  }
}
