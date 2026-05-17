import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.DATABASE_URL;

async function fixPermissions() {
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('Restaurando permissões do Supabase no GFin...');

    const query = `
      -- 1. Garantir uso do schema
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

      -- 2. Garantir acesso a todas as tabelas atuais
      GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
      GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

      -- 3. Garantir que novas tabelas criadas no futuro também tenham permissão
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
    `;

    await client.query(query);
    console.log('✅ Permissões restauradas! Pode tentar o cadastro novamente.');

  } catch (err) {
    console.error('❌ Erro ao restaurar permissões:', err.message);
  } finally {
    await client.end();
  }
}

fixPermissions();
