const { Client } = require('pg');
require('dotenv').config();

async function fixPermissions() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Aplicando correção de permissões para Agendamentos...');
    await client.connect();

    const query = `
      -- 1. Garantir permissões básicas para as roles do Supabase
      GRANT ALL ON TABLE agendamentos TO postgres, service_role;
      GRANT INSERT, SELECT ON TABLE agendamentos TO anon, authenticated;
      
      GRANT ALL ON TABLE horarios_funcionamento TO postgres, service_role;
      GRANT SELECT ON TABLE horarios_funcionamento TO anon, authenticated;
      GRANT ALL ON TABLE horarios_funcionamento TO authenticated;

      -- 2. Reforçar políticas RLS (Garantindo que o anon possa inserir)
      ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;
      
      DROP POLICY IF EXISTS "Publico pode agendar" ON agendamentos;
      CREATE POLICY "Publico pode agendar" ON agendamentos 
      FOR INSERT 
      TO anon, authenticated
      WITH CHECK (true);

      DROP POLICY IF EXISTS "Estabelecimento vê seus agendamentos" ON agendamentos;
      CREATE POLICY "Estabelecimento vê seus agendamentos" ON agendamentos 
      FOR ALL 
      TO authenticated
      USING (true)
      WITH CHECK (true);

      -- 3. Permissões de visualização de horários para o público
      ALTER TABLE horarios_funcionamento ENABLE ROW LEVEL SECURITY;
      
      DROP POLICY IF EXISTS "Publico vê horarios" ON horarios_funcionamento;
      CREATE POLICY "Publico vê horarios" ON horarios_funcionamento 
      FOR SELECT 
      TO anon, authenticated
      USING (true);
    `;

    await client.query(query);
    console.log('✅ Permissões corrigidas com sucesso!');
    await client.end();
  } catch (err) {
    console.error('❌ Erro ao corrigir permissões:', err.message);
    process.exit(1);
  }
}

fixPermissions();
