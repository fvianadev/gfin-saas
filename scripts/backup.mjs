import postgres from 'postgres'
import dotenv from 'dotenv'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

dotenv.config()

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('❌ DATABASE_URL não definida.')
  process.exit(1)
}

const parsed = new URL(dbUrl)
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const dir = path.resolve(process.cwd(), 'backups')
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
const filePath = path.join(dir, `gfin_backup_${timestamp}.sql`)

console.log(`📁 Backup → ${filePath}`)
console.log('')

// 1. Dump via pg_dump (estrutura + dados do schema public)
try {
  execSync(
    `pg_dump --host=${parsed.hostname} --port=${parsed.port || 5432} ` +
    `--username=${parsed.username} --dbname=${parsed.pathname.replace(/^\//, '')} ` +
    `--schema=public --no-owner --no-acl --verbose ` +
    `--file="${filePath}"`,
    {
      env: { ...process.env, PGPASSWORD: decodeURIComponent(parsed.password) },
      stdio: 'inherit',
      timeout: 120000
    }
  )
} catch (err) {
  console.error('❌ pg_dump falhou. Verifique se o pg_dump está instalado.')
  console.error('   Download: https://www.postgresql.org/download/')
  process.exit(1)
}

console.log('')
console.log('✅ Backup concluído!')
console.log(`   Arquivo: ${filePath}`)
console.log('')
console.log('   Para restaurar: node scripts/restore.mjs')
