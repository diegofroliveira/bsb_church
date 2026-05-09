
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const fs = require('fs');

// Load env
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(url, key);

async function checkDiego() {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('name', '%Diego%');
    
    if (error) {
        console.error('Erro:', error);
        return;
    }
    console.log(JSON.stringify(data, null, 2));
}

checkDiego();
