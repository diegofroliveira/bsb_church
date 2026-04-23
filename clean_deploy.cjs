const { execSync } = require('child_process');

const url = 'https://vadufkgbluisdamgkbln.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhZHVma2dibHVpc2RhbWdrYmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NjE2NDksImV4cCI6MjA5MjQzNzY0OX0.40XwaADEKukkhuLqcQQnNpx-6a1ipKnz_4Fy8DJdrao';

const run = (cmd, input) => {
    try {
        console.log(`Running: ${cmd}`);
        execSync(cmd, { input, stdio: ['pipe', 'inherit', 'inherit'], encoding: 'utf-8' });
    } catch (e) {
        console.log(`Note: ${e.message}`);
    }
};

console.log('🧹 Limpando ambiente...');
run('vercel env rm VITE_SUPABASE_URL production --yes');
run('vercel env rm VITE_SUPABASE_ANON_KEY production --yes');

console.log('🚀 Injetando chaves puras (sem newline)...');
// O Vercel CLI lê do stdin se o valor não for passado
run('vercel env add VITE_SUPABASE_URL production', url);
run('vercel env add VITE_SUPABASE_ANON_KEY production', key);

console.log('📦 Gerando deploy final de produção...');
run('vercel deploy --prod --yes');

console.log('\n✨ PROCESSO CONCLUÍDO!');
