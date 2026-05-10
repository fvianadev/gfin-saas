# Guia de Deploy para Produção - GFin SaaS

Este documento explica o passo a passo para conectar o seu sistema a um banco de dados Supabase totalmente novo (produção) e subir a aplicação na internet.

---

## 1. Criar o Banco de Dados de Produção

1. Acesse o [Supabase](https://supabase.com/) e faça login.
2. Crie um novo projeto (ex: `gfin-production`).
3. Aguarde o provisionamento do banco de dados (pode levar 1 a 2 minutos).

---

## 2. Configurar as Variáveis de Ambiente

No painel do seu novo projeto no Supabase:

1. **VITE_SUPABASE_URL** e **VITE_SUPABASE_ANON_KEY**:
   - Vá em `Project Settings` > `API`.
   - Copie o **Project URL** e a **anon / public key**.
   
2. **DATABASE_URL** (String de Conexão do Banco):
   - Vá em `Project Settings` > `Database`.
   - Role até a seção `Connection string` e selecione `URI`.
   - Copie a string. Ela se parece com: `postgresql://postgres.[sua-ref]:[sua-senha]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
   - *Importante: Lembre-se de substituir o trecho `[YOUR-PASSWORD]` pela senha que você criou junto com o projeto.*

Na raiz do seu projeto (no seu computador), abra ou crie o arquivo `.env` e cole essas três informações:

```env
VITE_SUPABASE_URL=sua_url_de_producao
VITE_SUPABASE_ANON_KEY=sua_anon_key_de_producao

# Necessário para os scripts de banco de dados rodarem
DATABASE_URL=postgresql://postgres...
```

---

## 3. Preparar o Banco (Scripts Iniciais)

Agora que as chaves no `.env` apontam para produção, você precisa recriar toda a estrutura do sistema (tabelas e permissões). No terminal, na raiz do projeto, execute os scripts que já construímos, **nesta exata ordem**:

### A) Criar as Tabelas e Relações (Schema)
Este script vai criar as tabelas `estabelecimentos`, `membros_equipe`, `transacoes`, etc.
```bash
node run-migrations.cjs
```
*(Se ele der sucesso, suas tabelas estão prontas).*

### B) Criar as Políticas de Segurança (RLS)
Garante que nenhum cliente possa ver os dados financeiros de outro cliente.
```bash
node patch-policies.cjs
```

### (Opcional) Limpar Banco Antigo ou Inserir Dados Demo
- Se você errou algo e quer limpar o banco novo, use: `node clear_db.mjs`
- Se você quiser inserir aqueles dados de teste (Barbearia Premium, Lucas Barbeiro), use: `node seed-data.cjs`. *Obs: Em produção real com clientes reais, você geralmente pula o seed-data.*

---

## 4. Deploy do Frontend (Painel Web)

A aplicação é em React com Vite. Os lugares mais fáceis e gratuitos para subir a aplicação são a **Vercel** ou o **Netlify**.

### Opção 1: Vercel (Recomendado)
1. Instale o Vercel CLI (se ainda não tiver): `npm i -g vercel`
2. No terminal do projeto, digite:
   ```bash
   vercel
   ```
3. Siga as instruções na tela (Y, enter, etc).
4. **MUITO IMPORTANTE:** Quando a Vercel perguntar se você quer adicionar *Environment Variables*, diga que sim (ou acesse o painel da Vercel depois no site) e adicione o `VITE_SUPABASE_URL` e o `VITE_SUPABASE_ANON_KEY`. O `DATABASE_URL` não é necessário na Vercel, pois ele serve apenas para seus scripts locais.

### Opção 2: Netlify
1. Crie uma conta no [Netlify](https://www.netlify.com/).
2. Você pode arrastar a pasta `dist` gerada após rodar `npm run build` direto para o site deles, OU conectar o seu GitHub e pedir para ele fazer o deploy automático da sua pasta raiz.
3. Nas configurações do Netlify (Site Settings > Environment Variables), adicione o `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

---

## 5. Passos Pós-Deploy

1. Acesse o seu link de produção (ex: `https://gfin-seu-app.vercel.app`).
2. Tente criar a primeira conta da empresa fazendo login na raiz.
3. Se o login funcionar, a conexão de produção está 100% perfeita.
4. Na aba "Configurações" da sua empresa nova, adicione o `Logo` e defina um `Nome`.

Parabéns! O SaaS está no ar, blindado, com banco de dados limpo e configurado para escala.
