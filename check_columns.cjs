const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://vadufkgbluisdamgkbln.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhZHVma2dibHVpc2RhbWdrYmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NjE2NDksImV4cCI6MjA5MjQzNzY0OX0.40XwaADEKukkhuLqcQQnNpx-6a1ipKnz_4Fy8DJdrao';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase.from('membros').select('*').limit(1);
  if (error) {
    console.error(error);
    return;
  }
  console.log('Columns:', Object.keys(data[0]).sort());
}

check();
