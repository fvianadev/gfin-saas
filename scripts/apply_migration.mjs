import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  connect_timeout: 30
});

async function applyMigration() {
  console.log("--- APLICANDO SCHEMA E PERMISSÕES NO GFIN ---");
  
  try {
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20240506_initial_schema.sql');
    const query = fs.readFileSync(migrationPath, 'utf8');

    // Executa o schema principal
    await sql.unsafe(query);
    console.log("✅ Tabelas e RLS aplicados.");

    // Força o recarregamento do cache do PostgREST (Supabase)
    // Isso evita o erro de "coluna não encontrada" logo após a migração
    await sql`NOTIFY pgrst, 'reload schema'`;
    console.log("✅ Cache do Supabase (PostgREST) recarregado.");

    console.log("🚀 Tudo pronto para o uso!");
  } catch (err) {
    console.error("❌ Erro ao aplicar migração:", err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

applyMigration();
