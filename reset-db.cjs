const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function resetDatabase() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('--- INICIANDO RESET DO BANCO ---');

    // 1. Remover tabelas existentes em ordem reversa de dependência
    console.log('Removendo tabelas antigas...');
    await client.query(`
      DROP TABLE IF EXISTS transacoes CASCADE;
      DROP TABLE IF EXISTS membros_equipe CASCADE;
      DROP TABLE IF EXISTS estabelecimentos CASCADE;
    `);

    // 2. Ler e executar a migração correta
    console.log('Aplicando nova migração SaaS...');
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20240506_initial_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await client.query(sql);

    console.log('✅ BANCO RECRIADO COM SUCESSO!');
    await client.end();
  } catch (err) {
    console.error('❌ ERRO NO RESET:', err.message);
    process.exit(1);
  }
}

resetDatabase();
