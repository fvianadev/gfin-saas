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
| `npm run db:setup` | Aplica migrations no banco |
| `npm run db:clear` | Limpa todas as tabelas |
| `npm run db:reset` | Limpa e aplica migrations novamente |

## Deploy

Compatível com **Vercel** e **Netlify**. Consulte o [DEPLOY.md](DEPLOY.md) para o guia completo.

## Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon
VITE_DEV_PASSWORD=sua_senha_dev
```
