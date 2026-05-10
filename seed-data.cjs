const { Client } = require('pg');
require('dotenv').config();

async function seedData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Conectado ao banco para inserir dados de teste...');

    // 1. Tenta buscar um owner_id real
    const resUser = await client.query('SELECT id FROM auth.users LIMIT 1');
    const ownerId = resUser.rows.length > 0 ? resUser.rows[0].id : null;

    // 2. Insere o Estabelecimento
    const resEstab = await client.query(`
      INSERT INTO estabelecimentos (nome, slug, owner_id)
      VALUES ('Barbearia Premium', 'barbearia-premium', $1)
      ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome
      RETURNING id;
    `, [ownerId]);

    const estabId = resEstab.rows[0].id;
    console.log('✅ Estabelecimento OK:', estabId);

    // 3. Insere o Funcionário (Lucas) com PIN 1234
    const resMembro = await client.query(`
      INSERT INTO membros_equipe (estabelecimento_id, nome, pin_hash, cargo)
      VALUES ($1, 'Lucas Barbeiro', '1234', 'staff')
      ON CONFLICT (id) DO NOTHING -- Ajustado para evitar erro se já existir
      RETURNING id;
    `, [estabId]);

    // Se o INSERT acima não retornar nada (devido ao ON CONFLICT), buscamos o ID
    let membroId = resMembro.rows.length > 0 ? resMembro.rows[0].id : null;
    if (!membroId) {
      const resSearch = await client.query('SELECT id FROM membros_equipe WHERE nome = $1 AND estabelecimento_id = $2', ['Lucas Barbeiro', estabId]);
      membroId = resSearch.rows[0].id;
    }

    console.log('✅ Funcionário OK:', membroId);
    console.log('\n--------------------------------------------------');
    console.log('🚀 DADOS PARA O SEU APP.TSX:');
    console.log('ESTABELECIMENTO_ID:', estabId);
    console.log('MEMBRO_ID:', membroId);
    console.log('--------------------------------------------------');
    
    await client.end();
  } catch (err) {
    console.error('❌ Erro ao inserir dados:', err.message);
    process.exit(1);
  }
}

seedData();
