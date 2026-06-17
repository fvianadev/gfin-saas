# GFin — Gestão Financeira

SaaS de gestão financeira para estabelecimentos com agendamento, marketplace e multi-tenancy.

## Stack

- **Frontend:** React 19, TypeScript 6, Vite 8, Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL, Auth, Storage, RLS)
- **Gráficos:** Recharts
- **Ícones:** Lucide React

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia servidor de desenvolvimento |
| `npm run build` | Compila TypeScript e faz o build de produção |
| `npm run lint` | Executa ESLint |
| `npm run preview` | Preview do build de produção |
| `node scripts/migrate.mjs` | Aplica migrations pendentes no banco |
| `npm run db:clear` | Limpa todas as tabelas |

## Deploy

Deploy automático na **Vercel**. O build roda as migrations automaticamente via `vercel-build`.

Consulte o [DEPLOY.md](DEPLOY.md) para o guia completo.

## Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon
DATABASE_URL=postgresql://postgres:senha@db.seu-projeto.supabase.co:5432/postgres
```
