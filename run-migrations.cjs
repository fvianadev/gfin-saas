const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Conectando ao banco para aplicar migrações...');
    await client.connect();

    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20240506_initial_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executando script de migração...');
    await client.query(sql);

    console.log('✅ Migrações aplicadas com sucesso! Tabelas criadas.');
    await client.end();
  } catch (err) {
    console.error('❌ Erro ao aplicar migrações:', err.message);
    process.exit(1);
  }
}

runMigrations();
