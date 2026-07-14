import { handleApiError, readJson, requireAdmin, sendJson, upsertProfile } from './_admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Método não permitido.' });
  try {
    const { supabase } = await requireAdmin(req);
    const { email, password, name, role, assigned_gc } = await readJson(req);
    if (!email || !password || !name) throw Object.assign(new Error('E-mail, senha e nome são obrigatórios.'), { status: 400 });
    if (String(password).length < 6) throw Object.assign(new Error('A senha precisa ter pelo menos 6 caracteres.'), { status: 400 });
    const { data, error } = await supabase.auth.admin.createUser({
      email: String(email).trim().toLowerCase(), password, email_confirm: true,
      user_metadata: { name: String(name).trim(), role, assigned_gc: assigned_gc || null }
    });
    if (error || !data?.user) throw error || new Error('Não foi possível criar o usuário.');
    const profile = await upsertProfile(supabase, data.user, { name, role, assigned_gc });
    return sendJson(res, 201, { success: true, user: { id: data.user.id, email: data.user.email, name, role, assigned_gc }, profile });
  } catch (error) {
    return handleApiError(res, error);
  }
}

