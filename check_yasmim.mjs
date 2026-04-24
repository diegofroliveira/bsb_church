import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vadufkgbluisdamgkbln.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhZHVma2dibHVpc2RhbWdrYmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NjE2NDksImV4cCI6MjA5MjQzNzY0OX0.40XwaADEKukkhuLqcQQnNpx-6a1ipKnz_4Fy8DJdrao';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { count } = await supabase.from('discipulado').select('*', { count: 'exact', head: true });
  console.log("Total after dedup:", count);

  const { data } = await supabase.from('discipulado').select('*').ilike('discipulador', '%YASMIM%');
  console.log("YASMIM as discipulador:", data);

  const { data: d2 } = await supabase.from('discipulado').select('*').ilike('discipulo', '%YASMIM%');
  console.log("YASMIM as discipulo:", d2);
}
main();
