import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  connect_timeout: 30
});

async function clearDatabase() {
  console.log("--- LIMPANDO BANCO GFIN ---");
  try {
    // Drop das tabelas em ordem reversa de dependência
    await sql`DROP TABLE IF EXISTS auditoria_transacoes CASCADE`;
    await sql`DROP TABLE IF EXISTS transacoes CASCADE`;
    await sql`DROP TABLE IF EXISTS servicos_produtos CASCADE`;
    await sql`DROP TABLE IF EXISTS membros_equipe CASCADE`;
    await sql`DROP TABLE IF EXISTS estabelecimentos CASCADE`;
    
    console.log("✅ Banco limpo!");
  } catch (err) {
    console.error("❌ Erro ao limpar banco:", err.message);
  } finally {
    await sql.end();
  }
}

clearDatabase();
