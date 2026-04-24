import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vadufkgbluisdamgkbln.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhZHVma2dibHVpc2RhbWdrYmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NjE2NDksImV4cCI6MjA5MjQzNzY0OX0.40XwaADEKukkhuLqcQQnNpx-6a1ipKnz_4Fy8DJdrao';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data, error } = await supabase.from('discipulado').select('*');
  if (error) { console.error(error); return; }

  console.log("Total rows:", data.length);

  // Find duplicate (discipulador, discipulo) pairs
  const seen = new Map();
  const dupes = [];
  for (const row of data) {
    const key = `${row.discipulador}||${row.discipulo}`;
    if (seen.has(key)) {
      dupes.push(row);
    } else {
      seen.set(key, row);
    }
  }

  console.log("Unique pairs:", seen.size);
  console.log("Duplicate rows:", dupes.length);
  
  if (dupes.length > 0) {
    console.log("Sample duplicates (first 5):");
    dupes.slice(0, 5).forEach(d => console.log(`  id=${d.id_serial} ${d.discipulador} -> ${d.discipulo}`));
    
    // Also check ids of dupes to delete
    const dupeIds = dupes.map(d => d.id_serial);
    console.log("\nDuplicate IDs to delete:", dupeIds.slice(0, 10), "...");
    
    // Delete duplicates
    const { error: deleteError } = await supabase.from('discipulado').delete().in('id_serial', dupeIds);
    if (deleteError) {
      console.error("Delete error:", deleteError);
    } else {
      console.log(`\n✅ Deleted ${dupeIds.length} duplicate rows!`);
    }
  }
}
main();
