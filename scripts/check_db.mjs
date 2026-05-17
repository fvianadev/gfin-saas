import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
async function run() {
  const transacoes = await sql`SELECT * FROM transacoes`;
  console.log('TRANSACOES:', transacoes);
  const admin = await sql`SELECT * FROM membros_equipe`;
  console.log('MEMBROS:', admin);
  process.exit(0);
}
run();
