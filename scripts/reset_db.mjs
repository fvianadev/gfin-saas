import postgres from 'postgres'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  connect_timeout: 30,
})

async function resetDatabase() {
  console.log('=== RESET COMPLETO DO BANCO GFIN ===')
  console.log('')

  // 1. Dropar todas as funções públicas (evita conflitos de dependência)
  console.log('▶️  Removendo funções...')
  await sql`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT proname, pg_get_function_identity_arguments(oid) as args
                FROM pg_proc WHERE pronamespace = 'public'::regnamespace) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || r.proname || '(' || r.args || ') CASCADE';
      END LOOP;
    END $$;
  `
  console.log('✅ Funções removidas')

  // 2. Dropar todas as tabelas do schema public
  console.log('▶️  Removendo tabelas...')
  await sql`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables
                WHERE schemaname = 'public' AND tablename != '_schema_migrations') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `
  console.log('✅ Tabelas removidas')

  // 3. Dropar todos os tipos (enums, etc)
  console.log('▶️  Removendo tipos...')
  await sql`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT typname FROM pg_type
                WHERE typnamespace = 'public'::regnamespace
                  AND typtype = 'e') LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
      END LOOP;
    END $$;
  `
  console.log('✅ Tipos removidos')

  // 4. Resetar tabela de migrations
  console.log('▶️  Resetando _schema_migrations...')
  await sql`DELETE FROM _schema_migrations`
  console.log('✅ _schema_migrations limpa')

  console.log('')
  console.log('=== BANCO RESETADO COM SUCESSO ===')
  console.log('Agora execute: node scripts/migrate.mjs')
  console.log('')

  await sql.end()
}

resetDatabase().catch(err => {
  console.error('❌ Reset falhou:', err?.message || err?.toString() || 'Erro desconhecido')
  if (err?.stack) console.error(err.stack)
  sql.end({ timeout: 5 }).catch(() => {})
  process.exit(1)
})
