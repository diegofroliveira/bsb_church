/// <reference types="node" />
import { createClient } from '@supabase/supabase-js';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://vadufkgbluisdamgkbln.supabase.co';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Configuração ausente' }), { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) throw error;

    const mappedUsers = users.map(u => ({
      id: u.id,
      email: u.email || '',
      name: u.user_metadata?.name || u.email?.split('@')[0] || 'Usuário',
      role: u.user_metadata?.role || 'secretaria',
      assigned_gc: u.user_metadata?.assigned_gc || '',
      created_at: u.created_at,
      avatar: u.user_metadata?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`
    }));

    return new Response(JSON.stringify({ users: mappedUsers }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
}
