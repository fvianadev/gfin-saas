# Guia de Implantação: GFin SaaS (Módulo Profissional)

Este guia descreve os passos necessários para realizar uma nova implantação do GFin SaaS do zero, garantindo que todas as funcionalidades de agendamento e segurança estejam ativas.

## 1. Supabase (Banco de Dados)

Crie um novo projeto no Supabase e siga a ordem de execução dos scripts no **SQL Editor**:

1.  **Schema Inicial**: Execute o arquivo `supabase/migrations/20240506_initial_schema.sql`.
2.  **Módulo de Agendamento**: Execute o arquivo `supabase/migrations/20240513_add_scheduling_module.sql`.
3.  **Segurança RLS (Hardening)**: Execute o arquivo `supabase/migrations/20240513_security_hardening.sql`.

> [!IMPORTANT]
> Certifique-se de que as tabelas `estabelecimentos`, `membros_equipe`, `transacoes` e `agendamentos` foram criadas com o RLS habilitado.

## 2. Hospedagem (Vercel / Netlify)

Conecte seu repositório Git e configure as seguintes **Variáveis de Ambiente**:

- `VITE_SUPABASE_URL`: URL da API do seu projeto Supabase.
- `VITE_SUPABASE_ANON_KEY`: Chave anônima pública (anon key).
- `DATABASE_URL`: (Opcional, para scripts de migração) URL de conexão direta do Postgres.

## 3. Configurações Pós-Deploy

Para garantir o funcionamento do PWA e da Autenticação:
1.  No Supabase, vá em **Authentication > URL Configuration**.
2.  Adicione a URL do seu deploy (ex: `https://seu-gfin.vercel.app`) em **Site URL**.
3.  Adicione a mesma URL em **Redirect URLs**.

## 4. Estrutura de Pastas Úteis

- `/src/components`: Contém o `AdminDashboard.tsx` e `PublicBooking.tsx` (coração do app).
- `/supabase/migrations`: Scripts SQL para backup e restauração do banco.
- `/src/lib`: Configuração do cliente Supabase e formatadores.

## 5. Dicas de Operação

- **Primeiro Acesso**: Crie sua conta na Landing Page para gerar o primeiro estabelecimento e o administrador.
- **PIN de Staff**: O PIN padrão do administrador criado na Landing Page é `0000`. Você pode alterar isso no painel de equipe.
- **Fuso Horário**: O sistema está travado em UTC-03:00 (Brasil), garantindo que os agendamentos sejam consistentes.

---
*GFin SaaS - Versão Develop 1.1.0*
