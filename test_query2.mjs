import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

async function run() {
  const { data, error } = await supabase
    .from('transacoes')
    .select('*, membros_equipe(nome)')
    .eq('excluido', false);
    
  if (error) {
    console.error('SUPABASE ERROR:', error);
  } else {
    console.log('SUPABASE DATA:', data);
  }
}
run();
