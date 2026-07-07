import postgres from 'postgres'
import dotenv from 'dotenv'
dotenv.config()

const dbUrl = new URL(process.env.DATABASE_URL || '')
const sql = postgres({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port || '5432'),
  database: dbUrl.pathname.replace(/^\//, '') || 'postgres',
  username: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  ssl: 'require',
})

try {
  const [funcExists] = await sql`SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'is_first_saas_admin') AS exists`
  console.log('Função is_first_saas_admin existe:', funcExists.exists)

  const [rpcResult] = await sql`SELECT public.is_first_saas_admin()`
  console.log('is_first_saas_admin() retornou:', rpcResult)

  const [tableExists] = await sql`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'saas_admins') AS exists`
  console.log('Tabela saas_admins existe:', tableExists.exists)

  if (tableExists.exists) {
    const [count] = await sql`SELECT COUNT(*)::int AS c FROM public.saas_admins`
    console.log('Linhas em saas_admins:', count.c)
  }
} catch (e) {
  console.error('ERRO:', e.message)
}
await sql.end()
