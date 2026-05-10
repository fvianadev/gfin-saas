const { Client } = require('pg');
require('dotenv').config();

async function patchPolicies() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Aplicando correção de RLS...');
    
    await client.query(`
      DROP POLICY IF EXISTS "Donos gerenciam seus estabelecimentos" ON estabelecimentos;
      
      CREATE POLICY "Usuarios autenticados podem criar estabelecimentos" 
      ON estabelecimentos FOR INSERT 
      TO authenticated 
      WITH CHECK (auth.uid() = owner_id);

      CREATE POLICY "Donos gerenciam seus proprios estabelecimentos" 
      ON estabelecimentos FOR ALL 
      TO authenticated 
      USING (auth.uid() = owner_id);
    `);

    console.log('✅ Políticas de Estabelecimento corrigidas com sucesso!');
    await client.end();
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

patchPolicies();
