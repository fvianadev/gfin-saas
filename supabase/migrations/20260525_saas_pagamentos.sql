-- Tabela de pagamentos/faturamento do SaaS
CREATE TABLE IF NOT EXISTS saas_pagamentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  estabelecimento_id UUID NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  valor NUMERIC(10,2) NOT NULL,
  referencia TEXT NOT NULL, -- ex: "Maio/2026", "Junho/2026"
  metodo_pagamento TEXT DEFAULT 'manual' CHECK (metodo_pagamento IN ('manual', 'pix', 'dinheiro', 'cartao')),
  status TEXT DEFAULT 'pago' CHECK (status IN ('pago', 'pendente', 'cancelado')),
  observacoes TEXT,
  pago_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS: apenas super admins podem ver/inserir/atualizar pagamentos
ALTER TABLE saas_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saas_admins_all_pagamentos" ON saas_pagamentos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM saas_admins WHERE id = auth.uid())
  );

-- Coluna de inadimplência em estabelecimentos (dias de atraso permitidos)
ALTER TABLE estabelecimentos
  ADD COLUMN IF NOT EXISTS dias_inadimplencia INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_ultimo_pagamento DATE,
  ADD COLUMN IF NOT EXISTS data_proxima_cobranca DATE;

-- Índice para busca por status
CREATE INDEX IF NOT EXISTS idx_saas_pagamentos_estab ON saas_pagamentos(estabelecimento_id);
CREATE INDEX IF NOT EXISTS idx_saas_pagamentos_status ON saas_pagamentos(status);
