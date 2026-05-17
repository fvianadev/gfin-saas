import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function debugPublic() {
  const slug = 'barbearia-viana'; // Based on the user's URL
  
  console.log('--- DEBUG PUBLIC ACCESS ---');
  
  const { data: estab, error: e1 } = await supabase.from('estabelecimentos').select('*').eq('slug', slug).single();
  if (e1) console.error('Error fetching establishment:', e1.message);
  else console.log('Found establishment:', estab.id, estab.nome);

  if (estab) {
    const { data: serv, error: e2 } = await supabase.from('servicos_produtos').select('*').eq('estabelecimento_id', estab.id).eq('tipo', 'receita');
    if (e2) console.error('Error fetching services:', e2.message);
    else console.log('Found services:', serv.length);

    const { data: prof, error: e3 } = await supabase.from('membros_equipe').select('*').eq('estabelecimento_id', estab.id).eq('ativo', true);
    if (e3) console.error('Error fetching professionals:', e3.message);
    else console.log('Found professionals:', prof.length);

    const { data: hor, error: e4 } = await supabase.from('horarios_funcionamento').select('*').eq('estabelecimento_id', estab.id).eq('ativo', true);
    if (e4) console.error('Error fetching hours:', e4.message);
    else console.log('Found hours:', hor.length);
  }
}

debugPublic();
