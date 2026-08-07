# Plano de testes — Sprint 0

## Objetivo

Validar que a fundação SaaS mantém o IgrejaPro funcional, bloqueia novos vazamentos e isola integralmente organizações diferentes. Todos os testes usam dados sintéticos e ambiente local ou staging.

## Fora de escopo

- Alterações ou testes destrutivos em produção;
- migração de dados pessoais reais;
- testes completos dos módulos ministerial, financeiro e de eventos;
- deploy, merge em main ou rotação externa sem autorização.

## Ambientes e massa

A massa mínima deve conter:

- tenant A: denominação A, igreja A1 e igreja A2 vinculadas;
- tenant B: igreja independente B1;
- usuário sem organização;
- membro, líder local, pastor, administrador organizacional e administrador da plataforma;
- usuário com vínculo válido em duas organizações;
- vínculo ativo, futuro e expirado.

Nenhuma fixture pode conter nome, email, telefone, documento, endereço ou valor financeiro real.

## Matriz funcional e de segurança

| ID | Cenário | Camada | Resultado esperado | Prioridade |
|---|---|---|---|---|
| QA-001 | anon consulta cadastro pessoal | Integração/RLS | Negado | Crítica |
| QA-002 | Usuário sem organização consulta cadastro | Integração/RLS | Negado | Crítica |
| QA-003 | Usuário do tenant A usa ID conhecido do tenant B | API/RLS | Negado sem revelar a existência | Crítica |
| QA-004 | Usuário do tenant A tenta criar ou alterar no tenant B | API/RLS | Negado e auditado | Crítica |
| QA-005 | Pastor de A1 consulta registros de A1 | Integração/E2E | Permitido conforme o papel | Alta |
| QA-006 | Pastor de A1 consulta A2 sem delegação | Integração/E2E | Negado | Crítica |
| QA-007 | Administrador denominacional com delegação consulta A1 | Integração/E2E | Permitido e auditado | Alta |
| QA-008 | Vínculo expirado é utilizado | Unitário/Integração | Negado | Alta |
| QA-009 | Usuário alterna entre organizações permitidas | E2E | Contexto muda sem misturar dados | Crítica |
| QA-010 | Consulta agregada e exportação entre tenants | Integração | Retorna somente o escopo autorizado | Crítica |
| QA-011 | Administrador da plataforma acessa tenant | Integração | Acesso explícito e auditado | Alta |
| QA-012 | Migração em schema vazio | Banco | Conclui e cria constraints/índices | Alta |
| QA-013 | Migração sobre schema legado de teste | Banco/Smoke | Conclui sem quebrar os fluxos atuais | Crítica |
| QA-014 | Migração é executada novamente | Banco | Idempotente ou falha segura documentada | Alta |
| QA-015 | Relação hierárquica cíclica é criada | Unitário/Banco | Rejeitada | Alta |
| QA-016 | Arquivo de exportação é versionado | CI | Pipeline bloqueia sem imprimir PII | Crítica |
| QA-017 | Credencial sintética reconhecível é incluída | CI | Pipeline bloqueia sem imprimir o valor | Crítica |
| QA-018 | Build do legado é executado | CI/Smoke | Compila sem regressão | Crítica |
| QA-019 | PR sem script de testes no package | CI | Etapa informa ausência e continua; demais gates executam | Média |
| QA-020 | Log ou diagnóstico contém resposta pessoal | Revisão/CI | Bloqueado e corrigido | Crítica |

## Regressão mínima

- Aplicação inicia sem erro fatal.
- Login e logout continuam disponíveis.
- Rotas protegidas rejeitam usuário sem sessão.
- Navegação principal renderiza.
- Uma consulta autorizada do tenant padrão funciona no ambiente de teste.
- Nenhuma chamada aponta acidentalmente para produção.

## Testes não funcionais

- Consulta filtrada por tenant usa índice verificável por plano de execução.
- Erros de autorização não distinguem registro inexistente de registro de outro tenant.
- Logs contêm apenas identificadores técnicos mínimos, sem dados pessoais.
- A CI termina dentro do timeout configurado.
- O restore é ensaiado em instância descartável antes de qualquer release.

## Evidências

Anexar ao PR:

- SHA testado;
- resultado da CI;
- comandos executados;
- versão do schema e migrações;
- matriz com aprovado, reprovado ou bloqueado;
- evidência redigida, sem tokens, payloads pessoais ou screenshots de registros reais.

## Critérios de entrada

- ADR multitenant aprovado;
- schema e migrations disponíveis em branch de trabalho;
- ambiente isolado provisionado;
- fixtures sintéticas revisadas;
- nenhuma dependência crítica sem responsável.

## Critérios de saída

- Todos os testes críticos e altos aprovados.
- Nenhuma vulnerabilidade crítica ou alta aberta.
- Nenhum vazamento entre tenants.
- Build, lint, typecheck e verificador sensível aprovados.
- Rollback ensaiado e documentado.
- Riscos residuais aceitos pelo Product Owner e Tech Lead.
