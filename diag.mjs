import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vadufkgbluisdamgkbln.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhZHVma2dibHVpc2RhbWdrYmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NjE2NDksImV4cCI6MjA5MjQzNzY0OX0.40XwaADEKukkhuLqcQQnNpx-6a1ipKnz_4Fy8DJdrao';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log("--- Testing Members query (with count + range) ---");
  const t1 = Date.now();
  const { data: d1, count: c1, error: e1 } = await supabase
    .from('membros')
    .select('*', { count: 'exact' })
    .order('nome', { ascending: true })
    .range(0, 9);
  console.log(`Members count: ${c1}, rows: ${d1?.length}, error: ${e1?.message}, time: ${Date.now()-t1}ms`);

  console.log("\n--- Testing Finance query ---");
  const t2 = Date.now();
  const { data: d2, error: e2 } = await supabase
    .from('financeiro')
    .select('*')
    .order('data', { ascending: false })
    .limit(5000);
  console.log(`Finance rows: ${d2?.length}, error: ${e2?.message}, time: ${Date.now()-t2}ms`);

  console.log("\n--- Testing Celulas query ---");
  const t3 = Date.now();
  const { data: d3, error: e3 } = await supabase.from('celulas').select('*');
  console.log(`Celulas rows: ${d3?.length}, error: ${e3?.message}, time: ${Date.now()-t3}ms`);

  console.log("\n--- Testing Discipulado query ---");
  const t4 = Date.now();
  const { data: d4, error: e4 } = await supabase.from('discipulado').select('*').order('discipulador', { ascending: true });
  console.log(`Discipulado rows: ${d4?.length}, error: ${e4?.message}, time: ${Date.now()-t4}ms`);

  console.log("\n--- Testing QA membros query ---");
  const t5 = Date.now();
  const { data: d5, error: e5 } = await supabase.from('membros').select('nome, status, tipo_cadastro, tipo_de_pessoa, grupos_caseiros, nascimento');
  console.log(`QA membros rows: ${d5?.length}, error: ${e5?.message}, time: ${Date.now()-t5}ms`);
}
main();
