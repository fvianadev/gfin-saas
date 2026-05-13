import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  connect_timeout: 30
});

async function checkPrices() {
  try {
    const services = await sql`SELECT nome, preco_sugerido FROM servicos_produtos`;
    console.log("--- PREÇOS DOS SERVIÇOS NO BANCO ---");
    services.forEach(s => {
      console.log(`${s.nome}: R$ ${s.preco_sugerido}`);
    });
  } catch (err) {
    console.error("Erro ao ler preços:", err.message);
  } finally {
    await sql.end();
  }
}

checkPrices();
