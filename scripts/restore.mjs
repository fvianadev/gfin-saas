import postgres from 'postgres'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

dotenv.config()

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('❌ DATABASE_URL não definida.')
  process.exit(1)
}

const dir = path.resolve(process.cwd(), 'backups')
if (!fs.existsSync(dir)) {
  console.error(`❌ Diretório de backups não encontrado: ${dir}`)
  process.exit(1)
}

const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort().reverse()
if (files.length === 0) {
  console.error('❌ Nenhum arquivo .sql encontrado em backups/')
  process.exit(1)
}

console.log('=== BACKUPS DISPONÍVEIS ===')
console.log('')
files.forEach((f, i) => {
  const stats = fs.statSync(path.join(dir, f))
  const size = (stats.size / 1024 / 1024).toFixed(2)
  console.log(`  ${i + 1}. ${f}  (${size} MB)`)
})
console.log('')
console.log('  0. Cancelar')
console.log('')

const parsed = new URL(dbUrl)

// Limpa banco antes de restaurar
const sql = postgres({
  host: parsed.hostname,
  port: parseInt(parsed.port || '5432'),
  database: parsed.pathname.replace(/^\//, '') || 'postgres',
  username: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  ssl: 'require',
  connect_timeout: 30,
})

console.log('▶️  Limpando banco...')
await sql`
  DO $$ DECLARE r RECORD; BEGIN
    FOR r IN (SELECT proname, pg_get_function_identity_arguments(oid) as args
              FROM pg_proc WHERE pronamespace = 'public'::regnamespace) LOOP
      EXECUTE 'DROP FUNCTION IF EXISTS public.' || r.proname || '(' || r.args || ') CASCADE';
    END LOOP;
  END $$;
`
await sql`
  DO $$ DECLARE r RECORD; BEGIN
    FOR r IN (SELECT tablename FROM pg_tables
              WHERE schemaname = 'public' AND tablename != '_schema_migrations') LOOP
      EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
  END $$;
`
await sql`DELETE FROM _schema_migrations`
await sql.end()
console.log('✅ Banco limpo')
console.log('')

// Pega o mais recente
const selected = files[0]
const filePath = path.join(dir, selected)
console.log(`▶️  Restaurando: ${selected}`)

try {
  execSync(
    `psql --host=${parsed.hostname} --port=${parsed.port || 5432} ` +
    `--username=${parsed.username} --dbname=${parsed.pathname.replace(/^\//, '')} ` +
    `--file="${filePath}"`,
    {
      env: { ...process.env, PGPASSWORD: decodeURIComponent(parsed.password) },
      stdio: 'inherit',
      timeout: 300000
    }
  )
} catch (err) {
  console.error('❌ psql falhou. Verifique se o psql está instalado.')
  process.exit(1)
}

console.log('')
console.log('✅ Backup restaurado com sucesso!')
console.log(`   Fonte: ${selected}`)
