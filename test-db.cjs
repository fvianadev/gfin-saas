const { Client } = require('pg');
require('dotenv').config();

async function testConnection() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Tentando conectar ao Supabase...');
    await client.connect();
    console.log('✅ Conexão estabelecida com sucesso!');
    
    const res = await client.query('SELECT current_database(), now();');
    console.log('Dados do Banco:', res.rows[0]);
    
    await client.end();
  } catch (err) {
    console.error('❌ Erro na conexão:', err.message);
    process.exit(1);
  }
}

testConnection();
