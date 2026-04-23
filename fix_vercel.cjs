const { execSync } = require('child_process');

const vars = {
  VITE_SUPABASE_URL: 'https://vadufkgbluisdamgkbln.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhZHVma2dibHVpc2RhbWdrYmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NjE2NDksImV4cCI6MjA5MjQzNzY0OX0.40XwaADEKukkhuLqcQQnNpx-6a1ipKnz_4Fy8DJdrao'
};

console.log('🧹 Limpando variáveis antigas...');
try { execSync('vercel env rm VITE_SUPABASE_URL production --yes'); } catch(e) {}
try { execSync('vercel env rm VITE_SUPABASE_ANON_KEY production --yes'); } catch(e) {}

console.log('🚀 Injetando variáveis limpas...');
for (const [key, value] of Object.entries(vars)) {
  execSync(`echo ${value} | vercel env add ${key} production`);
  console.log(`✅ ${key} adicionada.`);
}

console.log('📦 Iniciando deploy final...');
execSync('vercel deploy --prod --yes', { stdio: 'inherit' });
