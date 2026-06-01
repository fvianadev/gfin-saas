# GFin SaaS — Guia de Deploy

Guia completo e atualizado para colocar o GFin em produção usando **Netlify** ou **Vercel** com **Supabase** como banco de dados.

---

## 1. Pré-requisitos

- Conta no [Supabase](https://supabase.com/)
- Conta no [Netlify](https://www.netlify.com/) **ou** no [Vercel](https://vercel.com/)
- Repositório conectado ao GitHub

---

## 2. Configurar o Banco de Dados (Supabase)

### 2.1 Criar o Projeto

1. Acesse o [Supabase](https://supabase.com/) e faça login.
2. Clique em **New Project** e preencha nome, senha e região.
3. Aguarde o provisionamento (1–2 minutos).

### 2.2 Aplicar a Migration

O schema completo do banco está em um único arquivo consolidado:

```
supabase/migrations/20260601000000_initial_schema.sql
```

**Opção A — Via CLI do Supabase (recomendado):**
```bash
supabase db push
```

**Opção B — Via SQL Editor no painel do Supabase:**
1. Vá em **SQL Editor** no painel do projeto.
2. Copie o conteúdo do arquivo acima e execute.

### 2.3 Configurar Autenticação

Após o deploy do frontend, adicione a URL do site em:

- **Authentication → URL Configuration → Site URL**: `https://seu-dominio.netlify.app`
- **Authentication → URL Configuration → Redirect URLs**: `https://seu-dominio.netlify.app/**`

---

## 3. Obter as Chaves do Supabase

No painel do projeto Supabase, vá em **Project Settings → API**:

| Variável | Onde encontrar |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | anon / public key |

> [!NOTE]
> A `VITE_DEV_PASSWORD` protege o modo de geração de dados fictícios no painel Admin. Defina um valor seguro.

---

## 4. Deploy do Frontend

### Opção A — Netlify ✅ (configurado)

O projeto já possui o arquivo `netlify.toml` com tudo configurado.

1. Acesse o [Netlify](https://app.netlify.com/) e clique em **Add new site → Import an existing project**.
2. Conecte o repositório `fvianadev/gfin-saas`.
3. Configure a **branch** de deploy (ex: `main` para produção ou `develop` para staging).
4. O Netlify detecta o `netlify.toml` automaticamente — **não altere** os campos de build.
5. Vá em **Site Configuration → Environment Variables** e adicione:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui
VITE_DEV_PASSWORD=sua_senha_dev_aqui
```

6. Clique em **Deploy site**.

---

### Opção B — Vercel ✅ (configurado)

O projeto já possui o arquivo `vercel.json` com redirecionamento SPA.

1. Acesse o [Vercel](https://vercel.com/) e clique em **Add New → Project**.
2. Importe o repositório `fvianadev/gfin-saas`.
3. Em **Framework Preset**, selecione **Vite**.
4. Em **Build & Output Settings**:
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Em **Environment Variables**, adicione:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui
VITE_DEV_PASSWORD=sua_senha_dev_aqui
```

6. Clique em **Deploy**.

---

## 5. Variáveis de Ambiente — Referência

Consulte o arquivo [.env.example](.env.example) na raiz do projeto para ver todas as variáveis necessárias.

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ Sim | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | ✅ Sim | Chave pública anon do Supabase |
| `VITE_DEV_PASSWORD` | ✅ Sim | Senha para ativar modo de dados fictícios no Admin |

> [!WARNING]
> Nunca exponha a `service_role` key no frontend. Use apenas a `anon key`.

---

## 6. Verificação Pós-Deploy

- [ ] Acesse a URL do deploy — a tela de login deve aparecer.
- [ ] Crie uma conta — o primeiro usuário vira administrador do estabelecimento.
- [ ] Navegue entre as rotas (ex: `/dashboard`) e recarregue a página — não deve dar 404.
- [ ] No painel Admin, verifique se os dados carregam corretamente do Supabase.
- [ ] Configure o **Site URL** e **Redirect URLs** no Supabase Authentication.

---

## 7. Deploys Automáticos (CI/CD)

Tanto Netlify quanto Vercel fazem **deploy automático** a cada `git push` na branch configurada.

| Branch | Ambiente sugerido |
|---|---|
| `main` | Produção |
| `develop` | Staging / Preview |

---

*GFin SaaS — v1.2.0*
