# Setup local seguro

Este runbook prepara um ambiente de desenvolvimento sem acessar ou alterar produção.

## Pré-requisitos

- Git;
- Node.js 22;
- pnpm 10;
- Python 3.10 ou superior somente para a sincronização opcional;
- Docker Desktop;
- Supabase CLI, sempre apontando para o projeto local.

## Preparação

1. Confirme que está em uma branch de trabalho:

   ~~~powershell
   git status --short --branch
   ~~~

2. Não descarte nem sobrescreva alterações locais existentes.
3. Instale as dependências exatamente como registradas no lockfile:

   ~~~powershell
   corepack enable
   pnpm install --frozen-lockfile
   ~~~

## Variáveis de ambiente

Copie .env.example para .env.local e preencha somente com valores do ambiente isolado. O arquivo .env.local não deve ser versionado.

Variáveis públicas do frontend devem apontar para desenvolvimento:

- VITE_SUPABASE_URL;
- VITE_SUPABASE_ANON_KEY.

As credenciais do Prover devem existir apenas na sessão do terminal ou no cofre do CI:

- PROVER_EMAIL;
- PROVER_PASSWORD.

Nunca disponibilize no navegador SUPABASE_SERVICE_ROLE_KEY, tokens administrativos ou credenciais do Prover.

## Verificações locais

Execute antes de abrir um PR:

~~~powershell
node scripts/check-sensitive-files.mjs
pnpm run check:rls
pnpm run lint
pnpm run typecheck
pnpm run build
~~~

Inicialize e recrie o banco sintético antes de testar as policies:

~~~powershell
supabase start
supabase db reset
supabase db lint --local --level warning
supabase test db
~~~

O `seed.sql` é exclusivamente sintético. Não substitua seus registros por uma
exportação do Prover ou por uma cópia do banco produtivo.

Se a instalação dentro de uma pasta sincronizada pelo Google Drive não conseguir
materializar `node_modules`, valide em um clone local fora da pasta sincronizada.
Não versione dependências nem copie dados reais para esse clone.

## Execução

~~~powershell
pnpm run dev
~~~

Valide login, navegação principal e ausência de requisições para o projeto produtivo.

## Sincronização opcional

A sincronização manipula dados pessoais e não faz parte do fluxo normal de desenvolvimento. Quando indispensável, use credenciais temporárias e um destino isolado. Não publique diagnósticos com respostas, cookies ou cadastros.

## Encerramento

- Remova as credenciais da sessão do terminal.
- Confirme com git status --short que nenhum .env, export, diagnóstico ou dado real foi adicionado.
- Não faça merge, push forçado ou deploy por este runbook.
