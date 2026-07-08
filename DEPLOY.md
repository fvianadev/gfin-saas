# GFin — Guia de Deploy

Guia completo para colocar o GFin em produção usando **Vercel** com **Supabase**.

---

## 1. Pré-requisitos

- Conta no [Supabase](https://supabase.com/)
- Conta na [Vercel](https://vercel.com/) ou [Netlify](https://netlify.com/)
- Repositório no GitHub conectado à plataforma escolhida

---

## 2. Banco de Dados (Supabase)

### 2.1 Criar Projeto

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. **New Project** → nome, senha do banco, região
3. Aguarde o provisionamento (~2 min)

### 2.2 Aplicar Migrations

As migrations estão em `supabase/migrations/` (4 arquivos consolidados).

As migrations **não** são executadas automaticamente durante o build. Execute manualmente antes do primeiro deploy ou sempre que houver novas migrations:

```bash
node scripts/migrate.mjs
```

Ele:
1. Cria a tabela de controle `_schema_migrations` (se não existir)
2. Lê os arquivos `.sql` em ordem numérica
3. Aplica apenas os que ainda não foram executados
4. Registra cada migration aplicada em `_schema_migrations`

> **Importante:** O script lê a variável `DATABASE_URL` do ambiente local (`.env`) ou das variáveis de ambiente da Vercel (se executado via CLI da Vercel).

| Ordem | Arquivo | Descrição |
|-------|---------|-----------|
| 1 | `20260701000000_001_schema.sql` | Schema inicial (tabelas, RLS, funções) |
| 2 | `20260701000001_002_storage.sql` | Buckets de storage + políticas |
| 3 | `20260701000002_003_marketplace.sql` | Marketplace + destaques |
| 4 | `20260701000003_004_admin_rpcs.sql` | RPCs de gestão de admins e funções administrativas |

### 2.3 Configurar Autenticação

Após o deploy, em **Authentication → URL Configuration**:

| Campo | Valor |
|-------|-------|
| Site URL | `https://seu-dominio.vercel.app` (ou `*.netlify.app`) |
| Redirect URLs | `https://seu-dominio.vercel.app/**` |

### 2.4 SMTP em Produção ⚠️ Obrigatório

Sem SMTP configurado, o cadastro de usuários falha com **"Error sending confirmation email"** e a recuperação de senha também não funciona.

**Opção A — Configurar SMTP (recomendado):**

1. **Authentication → Providers → Email** → habilite **Confirm email**
2. **Project Settings → Auth → SMTP Settings** → **Enable Custom SMTP**

| Provedor | SMTP Host | Porta | Observação |
|----------|-----------|-------|------------|
| Resend (recomendado) | `smtp.resend.com` | 465/587 | Usar API Key `re_...` |
| Gmail | `smtp.gmail.com` | 587 | Usar App Password (16 caracteres) |

> **Resend:** Comece com `onboarding@resend.dev`. Após verificar seu domínio, troque para `noreply@seudominio.com`.

**Opção B — Desativar confirmação de e-mail (apenas para dev/testes):**

Em **Authentication → Providers → Email** → desabilite **Confirm email**. Os usuários serão logados automaticamente após o cadastro, sem necessidade de confirmar e-mail.

---

## 3. Variáveis de Ambiente

Copie `.env.example`:

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `VITE_SUPABASE_URL` | ✅ | Project URL (ex: `https://xxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | ✅ | anon/public key |
| `DATABASE_URL` | ✅ | Connection string do banco (ex: `postgresql://postgres:senha@db.xxx.supabase.co:5432/postgres`) |

> Use **apenas** a `anon key` no frontend. Nunca exponha a `service_role key`.

> A `DATABASE_URL` é usada **apenas no build** (script de migrations). Não é exposta ao frontend.

---

## 4. Deploy Frontend

### Vercel (recomendado) ✅

O `vercel.json` já está configurado com redirecionamento SPA e `buildCommand`.

1. Acesse [Vercel Dashboard](https://vercel.com/) → **Add New → Project**
2. Importe o repositório
3. **Framework Preset:** Vite (detectado automaticamente)
4. **Build Command:** `npm run build` (definido no `vercel.json`)
5. **Output Directory:** `dist`
6. Adicione as variáveis de ambiente (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
7. **Deploy**

> ⚠️ A `DATABASE_URL` **não é mais necessária** no ambiente da Vercel. As migrations devem ser executadas manualmente (veja seção 2.2).

#### Build local (teste antes do deploy)

```bash
npm run build       # build de produção
npm run typecheck   # (opcional) verificação de tipos TypeScript
```

---

## 5. Pós-Deploy

- [ ] Login aparece na URL do deploy
- [ ] Acessar `/setup` → criar o primeiro super admin
- [ ] Criar conta como estabelecimento → admin do estabelecimento
- [ ] Navegar entre rotas e recarregar → sem 404
- [ ] Configurar **Site URL** e **Redirect URLs** no Supabase Auth
- [ ] Verificar se os buckets de storage foram criados (devem estar listados em **Storage** no Supabase)

---

## 6. Deploys Automáticos

Push na branch configurada dispara deploy automático.

| Branch | Ambiente |
|--------|----------|
| `main` | Produção |
| `develop` | Preview/Staging |

---

*GFin — v1.3.0*
