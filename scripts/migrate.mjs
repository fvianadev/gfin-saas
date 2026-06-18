import postgres from 'postgres'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Carrega dotenv apenas se disponível (ambiente local)
try { (await import('dotenv')).config() } catch {}

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('❌ DATABASE_URL não definida.')
  console.error('   Formato: postgresql://usuario:senha@host:5432/banco')
  console.error('   Na Vercel: Settings → Environment Variables')
  console.error('   Local: arquivo .env na raiz do projeto')
  process.exit(1)
}

let parsed
try {
  parsed = new URL(dbUrl)
} catch {
  console.error('❌ DATABASE_URL inválida:', dbUrl.replace(/\/\/.*@/, '//***@'))
  console.error('   Formato esperado: postgresql://usuario:senha@host:5432/banco')
  process.exit(1)
}

const sql = postgres({
  host: parsed.hostname,
  port: parseInt(parsed.port || '5432'),
  database: parsed.pathname?.replace(/^\//, '') || 'postgres',
  username: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  ssl: 'require',
  connect_timeout: 30,
  family: 4,
})

async function migrate() {
  // Resolve o diretório de migrations relativo a este script (funciona na Vercel)
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const dir = path.resolve(__dirname, '..', 'supabase', 'migrations')

  if (!fs.existsSync(dir)) {
    console.error(`❌ Diretório de migrations não encontrado: ${dir}`)
    process.exit(1)
  }

  await sql`CREATE TABLE IF NOT EXISTS _schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT now()
  )`

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()

  if (files.length === 0) {
    console.log('⚠️  Nenhum arquivo .sql encontrado em supabase/migrations')
  }

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
  sql.end({ timeout: 5 }).catch(() => {})
  process.exit(1)
})
