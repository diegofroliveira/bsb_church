import { handleApiError, readJson, requireAdmin, requireServiceRole, sendJson } from './_admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método não permitido.' });
  try {
    const { supabase, user: admin, hasServiceRole } = await requireAdmin(req);
    requireServiceRole(hasServiceRole);
    const { userId, password } = await readJson(req);
    if (!userId || userId === admin.id) throw Object.assign(new Error('Usuário inválido para redefinição.'), { status: 400 });
    if (!password || String(password).length < 6) throw Object.assign(new Error('A senha precisa ter pelo menos 6 caracteres.'), { status: 400 });
    const { data: target, error: targetError } = await supabase.auth.admin.getUserById(userId);
    if (targetError || !target?.user) throw Object.assign(new Error('Usuário não encontrado.'), { status: 404 });
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password,
      user_metadata: { ...(target.user.user_metadata || {}), force_password_reset: true }
    });
    if (error) throw error;
    return sendJson(res, 200, { success: true });
  } catch (error) {
    return handleApiError(res, error);
  }
}
