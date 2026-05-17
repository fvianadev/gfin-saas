const { Client } = require('pg');
require('dotenv').config();

async function debugDB() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const slug = 'barbearia-viana';
    
    console.log('--- DEBUG DATABASE STATE ---');
    
    const resEstab = await client.query('SELECT * FROM estabelecimentos WHERE slug = $1', [slug]);
    if (resEstab.rows.length === 0) {
      console.log('❌ Establishment NOT FOUND with slug:', slug);
      return;
    }
    const estab = resEstab.rows[0];
    console.log('✅ Found establishment:', estab.id, estab.nome);

    const resServ = await client.query('SELECT * FROM servicos_produtos WHERE estabelecimento_id = $1 AND tipo = \'receita\'', [estab.id]);
    console.log('Services:', resServ.rows.length);

    const resProf = await client.query('SELECT * FROM membros_equipe WHERE estabelecimento_id = $1 AND ativo = true', [estab.id]);
    console.log('Professionals:', resProf.rows.length);

    const resHor = await client.query('SELECT * FROM horarios_funcionamento WHERE estabelecimento_id = $1 AND ativo = true', [estab.id]);
    console.log('Hours:', resHor.rows.length);

    const resPolicies = await client.query(`
      SELECT policyname, tablename, roles, cmd, qual, with_check 
      FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename IN ('estabelecimentos', 'servicos_produtos', 'membros_equipe', 'agendamentos', 'horarios_funcionamento')
    `);
    console.log('\n--- RLS POLICIES ---');
    resPolicies.rows.forEach(p => {
      console.log(`[${p.tablename}] ${p.policyname} (${p.roles}) - ${p.cmd}`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

debugDB();
