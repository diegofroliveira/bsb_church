import { handleApiError, readJson, requireAdmin, requireServiceRole, sendJson, upsertProfile } from './_admin-auth.js';

const SPECIAL_CONFIG_ID = '00000000-0000-0000-0000-000000000000';

export default async function handler(req, res) {
  if (!['POST', 'PATCH'].includes(req.method)) return sendJson(res, 405, { error: 'Método não permitido.' });
  try {
    const { supabase, user: admin, hasServiceRole } = await requireAdmin(req);
    requireServiceRole(hasServiceRole);
    const body = await readJson(req);
    const { userId, name, role, assigned_gc, assigned_sector } = body;
    if (!userId || userId === SPECIAL_CONFIG_ID) throw Object.assign(new Error('Usuário inválido.'), { status: 400 });
    if (!String(name || '').trim()) throw Object.assign(new Error('O nome é obrigatório.'), { status: 400 });
    if (userId === admin.id && role !== 'admin') {
      throw Object.assign(new Error('Não é possível remover o próprio acesso de administrador.'), { status: 400 });
    }

    const { data: target, error: targetError } = await supabase.auth.admin.getUserById(userId);
    if (targetError || !target?.user) throw Object.assign(new Error('Usuário não encontrado.'), { status: 404 });
    const metadata = {
      ...(target.user.user_metadata || {}),
      name: String(name).trim(),
      role,
      assigned_gc: assigned_gc || null
      ,assigned_sector: assigned_sector || null
    };
    const { data: updated, error } = await supabase.auth.admin.updateUserById(userId, { user_metadata: metadata });
    if (error) throw error;
    const profile = await upsertProfile(supabase, updated.user, { name, role, assigned_gc, assigned_sector });
    return sendJson(res, 200, { success: true, user: { id: updated.user.id, email: updated.user.email, name, role, assigned_gc, assigned_sector }, profile });
  } catch (error) {
    return handleApiError(res, error);
  }
}
