import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vadufkgbluisdamgkbln.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhZHVma2dibHVpc2RhbWdrYmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NjE2NDksImV4cCI6MjA5MjQzNzY0OX0.40XwaADEKukkhuLqcQQnNpx-6a1ipKnz_4Fy8DJdrao';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data: fin } = await supabase.from('financeiro').select('*').limit(1);
  console.log("Financeiro:", fin);
  
  const { data: cel } = await supabase.from('celulas').select('*').limit(1);
  console.log("Celulas:", cel);

  const { data: mem } = await supabase.from('membros').select('*').limit(1);
  console.log("Membros:", mem);
}
main();
