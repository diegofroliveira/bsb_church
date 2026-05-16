const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vadufkgbluisdamgkbln.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhZHVma2dibHVpc2RhbWdrYmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NjE2NDksImV4cCI6MjA5MjQzNzY0OX0.40XwaADEKukkhuLqcQQnNpx-6a1ipKnz_4Fy8DJdrao';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const normalizeStr = (s) => {
  if (!s) return '';
  return s.trim().replace(/\s+/g, ' ').toUpperCase();
};

async function run() {
  let allMembros = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('membros').select('nome, pai, mae, estado_civil, status').range(from, from + 999);
    if (error) break;
    if (!data || data.length === 0) break;
    allMembros = allMembros.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }

  const parents = new Set();
  allMembros.forEach(m => {
    if (m.pai) parents.add(normalizeStr(m.pai));
    if (m.mae) parents.add(normalizeStr(m.mae));
  });

  const casaisSemFilhos = allMembros.filter(m => {
    if (m.status !== 'Ativo') return false;
    const ec = m.estado_civil || '';
    if (!ec.includes('Casado')) return false;
    
    const nomeNorm = normalizeStr(m.nome);
    return !parents.has(nomeNorm);
  });

  console.log('--- RESULTADO ---');
  console.log(`Total encontrado: ${casaisSemFilhos.length}`);
  casaisSemFilhos.slice(0, 100).forEach(m => console.log(m.nome));
}

run();
