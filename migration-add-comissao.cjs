const { Client } = require('pg');
require('dotenv').config();

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Conectando ao banco para aplicar nova coluna...');
    await client.connect();

    // Adicionando coluna percentual_comissao na tabela membros_equipe
    const query = `
      ALTER TABLE membros_equipe 
      ADD COLUMN IF NOT EXISTS percentual_comissao NUMERIC DEFAULT 0;
    `;

    console.log('Executando script...');
    await client.query(query);

    console.log('✅ Migração aplicada com sucesso! Coluna "percentual_comissao" adicionada.');
    await client.end();
  } catch (err) {
    console.error('❌ Erro ao aplicar migração:', err.message);
    process.exit(1);
  }
}

runMigration();
