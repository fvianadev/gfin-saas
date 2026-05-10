# Plano de Implementação: Relatório de Produção e Comissões

Este é um plano seguro e sem impacto nas funcionalidades atuais (não vai quebrar nada que já está funcionando). A ideia é adicionar o recurso de forma isolada, estendendo o banco de dados e adicionando uma nova aba no painel.

## 1. Alterações no Banco de Dados (Supabase)

Para calcular a comissão, precisamos saber qual é a porcentagem de cada profissional. A forma mais segura de fazer isso sem quebrar a tabela atual é adicionar uma nova coluna na tabela de membros.

*   **Tabela:** `membros_equipe`
*   **Nova Coluna:** `percentual_comissao` (Tipo: `numeric` ou `integer`, Valor Padrão: `0`)
*   **Como será feito:** Criaremos um script de migração (ex: `add_comissao.cjs`) que executará um `ALTER TABLE membros_equipe ADD COLUMN percentual_comissao NUMERIC DEFAULT 0;`. Isso não afeta os membros já cadastrados.

*(Nota: Futuramente, se quiser comissões diferentes por serviço, poderemos adicionar a coluna também na tabela `servicos_produtos`, mas para esta versão, a comissão fixa por funcionário é ideal).*

## 2. Alterações na Interface (AdminDashboard.tsx)

Vamos criar um espaço totalmente dedicado a isso para não poluir o "Resumo" nem a "Lista".

*   **Nova Aba:** Adicionaremos `'relatorios'` no tipo `Tab` existente.
*   **Menu de Navegação:** Um novo botão no menu lateral e inferior (ícone de Documento ou Gráfico) chamado "Relatórios".
*   **Nova Tela de Relatórios (`activeTab === 'relatorios'`):**
    *   **Filtros de Período:** Dois campos de data (`Data Inicial` e `Data Final`) para escolha livre.
    *   **Filtros de Profissionais:** Uma lista de caixas de seleção (checkbox) listando todos os funcionários ativos, com a opção "Marcar Todos".
    *   **Botão "Gerar Relatório":** Ao clicar, o sistema fará uma busca *direta no Supabase* (para garantir que pega dados antigos se o usuário selecionar um período de meses atrás).

## 3. Lógica de Agrupamento e Cálculo

O sistema pegará apenas as **Receitas** do período filtrado e fará o seguinte processamento automático:

1.  Agrupa todas as transações por `membro_id`.
2.  Para cada funcionário, soma o valor total dos serviços que ele realizou.
3.  Calcula a comissão: `Total Produzido * (percentual_comissao / 100)`.
4.  Gera uma tabela limpa exibindo:
    *   Nome do Profissional
    *   Quantidade de Serviços Realizados
    *   Total Produzido (R$)
    *   % de Comissão
    *   **Comissão Devida (R$)**

## 4. Exportação (PDF e Planilha)

*   **Exportar para Planilha (CSV):** Criaremos uma função JavaScript nativa que pega os dados da tabela, converte para o formato CSV e faz o download automático de um arquivo `relatorio_comissoes.csv`. Pode ser aberto no Excel ou Google Sheets.
*   **Exportar para PDF:** Utilizaremos o sistema nativo de impressão do navegador (`window.print()`). Criaremos uma folha de estilo específica (`@media print`) que, na hora de imprimir ou salvar como PDF, esconde os botões, os menus laterais e o fundo escuro, gerando um documento PDF branco, limpo e profissional, contendo apenas a tabela e o logo da barbearia. Isso evita a necessidade de instalar bibliotecas pesadas de PDF.

## 5. Edição do Funcionário (Ajuste na Aba Equipe)

Para que o administrador possa definir essa comissão:
*   Na aba **Equipe**, o modal de "Novo Membro" (e o futuro modal de "Editar Membro") ganhará um campo extra: **"Porcentagem de Comissão (%)"**.

## 6. Solução de Design para a Barra de Navegação Mobile

Você tocou em um ponto excelente. A barra inferior (`bottom navigation`) com 6 botões já está no limite aceitável de usabilidade para dispositivos móveis, e adicionar um 7º botão tornaria os alvos de clique muito pequenos e propensos a erros.

**A Solução Proposta: Padrão "Mais" (Hamburger/Menu Drawer)**

Em vez de espremer mais botões, vamos adotar o padrão de design mais utilizado em aplicativos mobile (como Instagram, Nubank, etc.):

1.  **Limpar a Barra Inferior:** Reduziremos a barra inferior para apenas os **4 ou 5 itens mais acessados diariamente**, por exemplo:
    *   `Resumo` (Gráficos diários)
    *   `Lista` (Ver transações)
    *   `Equipe` (Ou `Itens`)
    *   `Mais` (ou `Menu`) - *Um ícone de 3 linhas (Hamburger) ou 3 pontinhos (MoreVertical).*
2.  **O Menu "Mais":** Ao clicar na aba "Mais", ao invés de abrir uma tela comum, subirá um painel (um `BottomSheet` ou um menu em tela cheia) elegante contendo todos os recursos gerenciais listados em blocos grandes e fáceis de clicar:
    *   ⚙️ Configurações
    *   ✂️ Serviços/Produtos
    *   🛡️ Auditoria
    *   📊 **Relatórios (Onde nosso novo módulo vai morar)**
    *   🚪 Sair do Admin

**Vantagens:**
*   A tela principal volta a respirar, ficando com botões grandes e confortáveis.
*   Ganhamos espaço "infinito" no menu "Mais" para futuras expansões do sistema (ex: Controle de Estoque, Disparo de WhatsApp, etc) sem nunca mais nos preocuparmos com a falta de espaço na barra.
*   No Computador (Desktop), a barra lateral esquerda (Sidebar) continua exibindo tudo normalmente em formato de lista, pois lá temos espaço de sobra.

---
**Status do Risco:** Muito Baixo. Todas as adições são complementares (novos campos, nova aba) e o ajuste visual do menu apenas reorganiza a navegação que já existe.
