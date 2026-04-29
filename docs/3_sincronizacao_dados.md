# Sincronização de Dados e Automação (ETL Python)

Como o Sistema Prover não disponibiliza uma API REST, o `IgrejaPro` resolve a captura dos dados simulando ações de um humano, acessando relatórios e integrando diretamente ao banco final (Supabase).

## Arquitetura do Pipeline
A rotina principal pode ser ativada rodando o orquestrador:
```bash
.\venv\Scripts\python.exe run_sync.py
```

O orquestrador delega as tarefas para os seguintes scripts:

1. `extrator_prover.py` (A Extração)
2. `importador_supabase.py` (A Transformação e Carga)

---

## 1. Módulo de Extração (`extrator_prover.py`)
Utiliza **Playwright** (modo de automação de navegadores) para realizar todo o fluxo.

**Passo a passo lógico:**
- Abre uma sessão de navegador Chromium em modo invisível (headless).
- Realiza o Login em `sis.sistemaprover.com.br` injetando credenciais predefinidas nas variáveis locais.
- Navega via requisições diretas de clique até as páginas de `exportar_dados`.
- Inicia o download de diversos módulos:
  - Membros Ativos, Inativos e em Observação.
  - Células e seus relatórios de saúde.
  - Relatórios Financeiros (Dízimos e Ofertas).
  - Controle de Eventos (EBD, Cursos, etc).
- Os arquivos CSVs/Excel resultantes são despejados na pasta local `dados_exportados/`.

---

## 2. Módulo de Transformação e Carga (`importador_supabase.py`)
Com os arquivos brutos baixados na máquina/servidor, o importador entra em ação utilizando o **Pandas**.

**Passo a passo lógico:**
- Varre a pasta `dados_exportados/` procurando pelos relatórios mais recentes.
- Limpeza e Tratamento:
  - Normaliza nomes de colunas (caixa baixa, remoção de caracteres especiais).
  - Converte datas brasileiras (DD/MM/AAAA) para o formato ISO aceito pelo PostgreSQL (AAAA-MM-DD).
  - Retira aspas excessivas ou linhas em branco e resolve duplicidades de membros (mantendo a alteração mais recente).
- **UPSERT no Supabase**:
  - Utiliza o método `upsert` em lote (batching) com a biblioteca `supabase-py` na nuvem.
  - Se o registro já existir (baseado no ID ou Nome chave), ele atualiza. Se não existir, ele insere.
  - Isso garante consistência e evita a replicação fantasma de dados no frontend.

---

## 3. Agendamento (Como manter automático)
Para que o Dashboard nunca fique desatualizado, você pode rodar o `run_sync.py` de hora em hora (ou todo final do dia) via ferramentas do próprio sistema operacional.

**Exemplo - Agendador de Tarefas do Windows:**
1. Abra o `Task Scheduler`.
2. Crie uma "Basic Task".
3. Trigger: Diário (Daily) às 23:00.
4. Action: Start a Program.
   - Program/script: `C:\caminho_do_projeto\venv\Scripts\python.exe`
   - Add arguments: `C:\caminho_do_projeto\run_sync.py`
   - Start in: `C:\caminho_do_projeto`
