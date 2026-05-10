const { Client } = require('pg');
require('dotenv').config();

async function fullReset() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('🔴 INICIANDO LIMPEZA TOTAL DO BANCO...');

    // 1. Limpar dados das tabelas (em ordem de dependência)
    console.log('→ Removendo transações...');
    await client.query(`DELETE FROM transacoes;`);
    
    console.log('→ Removendo membros da equipe...');
    await client.query(`DELETE FROM membros_equipe;`);
    
    console.log('→ Removendo estabelecimentos...');
    await client.query(`DELETE FROM estabelecimentos;`);

    // 2. Limpar usuários do Supabase Auth
    console.log('→ Removendo usuários do Auth...');
    await client.query(`DELETE FROM auth.users;`);

    console.log('');
    console.log('✅ BANCO COMPLETAMENTE LIMPO!');
    console.log('   ✓ transacoes         → 0 registros');
    console.log('   ✓ membros_equipe     → 0 registros');
    console.log('   ✓ estabelecimentos   → 0 registros');
    console.log('   ✓ auth.users         → 0 registros');
    console.log('');
    console.log('Pronto para criar a primeira conta!');
    
    await client.end();
  } catch (err) {
    console.error('❌ ERRO:', err.message);
    process.exit(1);
  }
}

fullReset();
