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

As migrations estão em `supabase/migrations/` (11 arquivos no total).

**No primeiro deploy**, as migrations são aplicadas automaticamente pelo script `scripts/migrate.mjs` durante o build da Vercel (via `vercel-build`). Ele:
1. Cria a tabela de controle `_schema_migrations` (se não existir)
2. Lê os arquivos `.sql` em ordem numérica
3. Aplica apenas os que ainda não foram executados
4. Registra cada migration aplicada em `_schema_migrations`

> **Importante:** É necessário configurar a variável `DATABASE_URL` no ambiente da Vercel (Project Settings → Environment Variables) com a connection string do Supabase.

| Ordem | Arquivo | Descrição |
|-------|---------|-----------|
| 1 | `20260601000000_initial_schema.sql` | Schema inicial (tabelas, RLS, funções) |
| 2 | `20260602000000_add_aviso_trial_dias.sql` | Coluna aviso_trial_dias |
| 3 | `20260604000000_staff_gerencia_agenda.sql` | Staff gerencia agenda |
| 4 | `20260606000000_auto_create_saas_admins.sql` | Criação automática de admins |
| 5 | `20260607000000_delete_saas_user_rpc.sql` | RPC para deletar usuário |
| 6 | `20260613000000_add_imagem_url_to_servicos.sql` | Imagem em serviços + bucket `servicos` |
| 7 | `20260613000001_create_logos_bucket.sql` | Bucket `logos` + políticas |
| 8 | `20260614000000_add_avatar_url_to_membros.sql` | Avatar em membros + bucket `avatars` |
| 9 | `20260615000000_create_marketplace_destaques.sql` | Marketplace + bucket `marketplace` |
| 10 | `20260616000000_add_valor_assinatura.sql` | Coluna valor_assinatura |
| 11 | `20260617000000_super_admin_singleton.sql` | Singleton de super admin + RPC `is_first_saas_admin()` |
| 12 | `20260618000000_confirm_saas_admin_by_email.sql` | RPC de fallback para promover primeiro admin |
| 13 | `20260619000000_add_saas_admin_rpc.sql` | RPC `add_saas_admin` + modal no painel |
| 14 | `20260620000000_add_saas_admin_auto_confirm.sql` | Auto-confirma email ao adicionar admin |

**Executar migrations manualmente (opcional):**
```bash
node scripts/migrate.mjs
```

> O script lê a `DATABASE_URL` do arquivo `.env` ou das variáveis de ambiente.

### 2.3 Configurar Autenticação

Após o deploy, em **Authentication → URL Configuration**:

| Campo | Valor |
|-------|-------|
| Site URL | `https://seu-dominio.vercel.app` (ou `*.netlify.app`) |
| Redirect URLs | `https://seu-dominio.vercel.app/**` |

### 2.4 SMTP em Produção

Para e-mails de confirmação e recuperação de senha:

1. **Authentication → Providers → Email** → habilite **Confirm email**
2. **Project Settings → Auth → SMTP Settings** → **Enable Custom SMTP**

**Opções de provedor:**

| Provedor | SMTP Host | Porta | Observação |
|----------|-----------|-------|------------|
| Gmail | `smtp.gmail.com` | 587 | Usar App Password (16 caracteres) |
| Resend (recomendado) | `smtp.resend.com` | 465/587 | Usar API Key `re_...` |

> **Resend:** Comece com `onboarding@resend.dev`. Após verificar seu domínio, troque para `noreply@seudominio.com`.

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

O `vercel.json` já está configurado com redirecionamento SPA.

O `package.json` contém o script `vercel-build` que roda as migrations antes do build:

```json
"vercel-build": "node scripts/migrate.mjs && npm run build"
```

O Vercel executa automaticamente o comando `vercel-build` se ele existir no `package.json`.

1. Acesse [Vercel Dashboard](https://vercel.com/) → **Add New → Project**
2. Importe o repositório
3. **Framework Preset:** Vite (detectado automaticamente)
4. **Build Command:** detectado automaticamente como `vercel-build`
5. **Output Directory:** `dist`
6. Adicione as variáveis de ambiente (incluindo `DATABASE_URL`)
7. **Deploy**

> **Importante:** A `DATABASE_URL` deve ser a connection string direta do Supabase (com `postgresql://`), disponível em Project Settings → Database → Connection string.

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
