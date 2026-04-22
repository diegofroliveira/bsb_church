import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ ALERTA: Variáveis do Supabase NÃO encontradas no .env');
}

// Inicializa com strings vazias se faltar algo para evitar crash fatal imediato
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);
