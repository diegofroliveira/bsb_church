# Tratamento de segredos e PII no histórico Git

Reescrever histórico é uma operação disruptiva. Este runbook é um plano; não autoriza sua execução.

## Antes de qualquer reescrita

1. Rotacionar todas as credenciais expostas. Limpar o Git não invalida um segredo.
2. Identificar arquivos, commits, branches, tags, forks, releases e artefatos afetados.
3. Remover o conteúdo do código corrente em um PR normal.
4. Suspender merges e combinar uma janela com todos os colaboradores.
5. Criar backup espelho criptografado, com acesso restrito e prazo de descarte.
6. Obter aprovação do responsável pelo repositório e por proteção de dados.

## Ensaio isolado

Use git filter-repo em um clone descartável. Nunca experimente no clone de trabalho principal.

Exemplo ilustrativo para remover caminhos inteiros:

~~~text
git filter-repo --path dados_exportados --path public/data --invert-paths
~~~

A lista final deve vir do inventário aprovado. Para um segredo presente dentro de arquivos que precisam permanecer, use uma substituição revisada, sem registrar o valor real em scripts versionados.

## Validação obrigatória

- Buscar novamente os indicadores da credencial em todo o histórico.
- Executar node scripts/check-sensitive-files.mjs no estado corrente.
- Confirmar que build e testes continuam válidos.
- Comparar branches e tags esperadas.
- Validar que nenhum dado legítimo foi removido por engano.

## Publicação coordenada

Um administrador deverá realizar o push forçado protegido somente após aprovação explícita. Em seguida:

- invalidar caches e artifacts que preservem o conteúdo;
- solicitar limpeza de forks quando aplicável;
- orientar todos a fazer novo clone, evitando reintrodução do histórico antigo;
- manter a proteção contra force push novamente habilitada;
- registrar o incidente sem reproduzir credenciais ou PII.

## Limitação

Uma reescrita não garante remoção de clones, caches ou cópias externas. Por isso, rotação, revogação e análise de impacto são obrigatórias.
