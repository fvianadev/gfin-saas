const { Client } = require('pg');
require('dotenv').config();

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Conectando ao banco para migração de Agendamentos...');
    await client.connect();

    const query = `
      -- 1. Atualizar Tabela de Itens
      ALTER TABLE servicos_produtos ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'Geral';
      ALTER TABLE servicos_produtos ADD COLUMN IF NOT EXISTS duracao_minutos INTEGER DEFAULT 30;

      -- 2. Tabela de Horários de Funcionamento
      CREATE TABLE IF NOT EXISTS horarios_funcionamento (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          estabelecimento_id UUID REFERENCES estabelecimentos(id) ON DELETE CASCADE NOT NULL,
          dia_semana INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
          hora_inicio TIME NOT NULL DEFAULT '08:00',
          hora_fim TIME NOT NULL DEFAULT '18:00',
          ativo BOOLEAN DEFAULT true,
          UNIQUE(estabelecimento_id, dia_semana)
      );

      -- 3. Tabela de Agendamentos
      CREATE TABLE IF NOT EXISTS agendamentos (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMPTZ DEFAULT now(),
          estabelecimento_id UUID REFERENCES estabelecimentos(id) ON DELETE CASCADE NOT NULL,
          membro_id UUID REFERENCES membros_equipe(id) ON DELETE CASCADE,
          servico_id UUID REFERENCES servicos_produtos(id) ON DELETE CASCADE,
          cliente_nome TEXT NOT NULL,
          cliente_whatsapp TEXT NOT NULL,
          data_hora_inicio TIMESTAMPTZ NOT NULL,
          data_hora_fim TIMESTAMPTZ NOT NULL,
          status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'concluido', 'cancelado')),
          observacao TEXT
      );

      -- 4. Segurança (RLS)
      ALTER TABLE horarios_funcionamento ENABLE ROW LEVEL SECURITY;
      ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Acesso total horarios" ON horarios_funcionamento;
      CREATE POLICY "Acesso total horarios" ON horarios_funcionamento FOR ALL USING (true) WITH CHECK (true);

      DROP POLICY IF EXISTS "Publico pode agendar" ON agendamentos;
      CREATE POLICY "Publico pode agendar" ON agendamentos FOR INSERT WITH CHECK (true);

      DROP POLICY IF EXISTS "Estabelecimento vê seus agendamentos" ON agendamentos;
      CREATE POLICY "Estabelecimento vê seus agendamentos" ON agendamentos FOR ALL USING (true) WITH CHECK (true);
    `;

    console.log('Aplicando modificações...');
    await client.query(query);

    console.log('✅ Banco de dados atualizado com sucesso para v1.1.0!');
    await client.end();
  } catch (err) {
    console.error('❌ Erro na migração:', err.message);
    process.exit(1);
  }
}

runMigration();
