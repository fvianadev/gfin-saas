# GFin — Guia de Deploy

Guia completo para colocar o GFin em produção usando **Vercel** ou **Netlify** com **Supabase**.

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

As migrations estão em `supabase/migrations/` (10 arquivos no total).

**Opção A — SQL Editor (recomendado para primeiro setup):**

Abra cada arquivo em ordem numérica e execute no **SQL Editor** do Supabase:

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

> As migrations de storage buckets (`servicos`, `logos`, `avatars`, `marketplace`) já criam os buckets e as políticas de acesso via SQL. Não é necessário usar o CLI do Supabase ou scripts extras.

**Opção B — Supabase CLI:**
```bash
supabase db push
```

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
| `VITE_DEV_PASSWORD` | ✅ | Senha para ativar modo admin de desenvolvimento |

> Use **apenas** a `anon key` no frontend. Nunca exponha a `service_role key`.

---

## 4. Deploy Frontend

### Opção A — Vercel ✅

O `vercel.json` já está configurado com redirecionamento SPA.

1. Acesse [Vercel Dashboard](https://vercel.com/) → **Add New → Project**
2. Importe o repositório `sistemagfin/gfin`
3. **Framework Preset:** Vite (detectado automaticamente)
4. **Build Command:** `npm run build`
5. **Output Directory:** `dist`
6. Adicione as variáveis de ambiente
7. **Deploy**

### Opção B — Netlify ✅

O `netlify.toml` já está configurado com build e redirects.

1. Acesse [Netlify Dashboard](https://app.netlify.com/) → **Add new site → Import an existing project**
2. Conecte o repositório `sistemagfin/gfin`
3. O Netlify detecta o `netlify.toml` automaticamente
4. Adicione as variáveis de ambiente em **Site Configuration → Environment Variables**
5. **Deploy**

---

## 5. Pós-Deploy

- [ ] Login aparece na URL do deploy
- [ ] Criar conta → primeiro usuário vira admin do estabelecimento
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

*GFin — v1.2.0*
