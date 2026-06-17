import postgres from 'postgres'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

const dbUrl = new URL(process.env.DATABASE_URL || '')
if (!process.env.DATABASE_URL || !dbUrl.hostname) {
  console.error('❌ DATABASE_URL não definida ou inválida.')
  console.error('   Formato: postgresql://usuario:senha@host:5432/banco')
  console.error('   Pegue em: Supabase → Settings → Database → Connection string')
  process.exit(1)
}

const sql = postgres({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port || '5432'),
  database: dbUrl.pathname?.replace(/^\//, '') || 'postgres',
  username: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  ssl: 'require',
})

async function migrate() {
  await sql`CREATE TABLE IF NOT EXISTS _schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT now()
  )`

  const dir = path.join(process.cwd(), 'supabase/migrations')
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()

  for (const file of files) {
    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count
      FROM _schema_migrations
      WHERE filename = ${file}
    `
    if (count > 0) {
      console.log(`⏭️  ${file} — já aplicada`)
      continue
    }

    console.log(`▶️  Aplicando ${file}...`)
    const content = fs.readFileSync(path.join(dir, file), 'utf8')
    await sql.unsafe(content)
    await sql`INSERT INTO _schema_migrations (filename) VALUES (${file})`
    console.log(`✅ ${file}`)
  }

  await sql`NOTIFY pgrst, 'reload schema'`
  console.log('🚀 Migrations concluídas')
  await sql.end()
}

migrate().catch(err => {
  console.error('❌ Migration falhou:', err?.message || err?.toString() || 'Erro desconhecido')
  if (err?.stack) console.error(err.stack)
  process.exit(1)
})
