# Plano de testes — Sprint 1

## Objetivo

Validar o core operacional do IgrejaPro: onboarding, convites, memberships, papéis, escopos, troca de contexto, entitlements e auditoria. A prioridade máxima é demonstrar que a experiência administrativa não cria um caminho alternativo ao isolamento estabelecido na Sprint 0.

## Escopo

- tenant e organização inicial;
- convite, aceitação, expiração, revogação e reutilização;
- ativação, suspensão e reativação de memberships;
- roles, permissões e access assignments;
- escopos `self`, `org_unit`, `org_subtree` e `tenant`;
- troca de tenant e organização ativos;
- entitlements e limites essenciais;
- navegação e endpoints administrativos;
- auditoria, responsividade, acessibilidade e observabilidade.

## Fora de escopo

- dados pessoais reais;
- cadastro funcional completo de pessoas e famílias;
- migração ou corte do Prover;
- módulos ministeriais, eventos e financeiro;
- cobrança automática;
- testes destrutivos ou promoção em produção.

## Ambientes e massa sintética

A massa mínima deve incluir:

- tenant A com organização raiz A0 e filhas A1, A1.1 e A2;
- tenant B com organização raiz B0;
- tenant C suspenso;
- tenant A com módulo de administração ativo e tenant B com override explícito inativo;
- usuário A administrador somente no tenant A;
- usuário B comum somente no tenant B;
- usuário AB com membership ativa em A e B, mas papéis diferentes;
- usuário AS com membership suspensa;
- usuário E sem membership;
- convite válido, expirado, revogado e utilizado;
- papel sem permissões, papel administrativo e papel limitado a `org_subtree`;
- limite de organizações e de usuários em estado disponível e esgotado.

Todos os emails devem usar domínio reservado, como `.invalid`. Nenhuma fixture pode reproduzir nome, contato, documento, endereço ou vínculo real.

## Matriz funcional e de segurança

| ID | Critério | Cenário | Camada | Resultado esperado | Prioridade |
|---|---|---|---|---|---|
| QA-S1-001 | AC-S1-01-01 | Onboarding completo | Integração/E2E | Tenant, raiz e admin são criados atomicamente | Crítica |
| QA-S1-002 | AC-S1-01-01 | Falha no segundo passo do onboarding | Integração/Banco | Transação é revertida sem órfãos | Crítica |
| QA-S1-003 | AC-S1-01-02 | Identificador público duplicado | API/Banco | Rejeitado sem expor tenant existente | Alta |
| QA-S1-004 | AC-S1-01-03 | Limite de organizações esgotado | API/Banco | Nova criação negada; existentes preservadas | Alta |
| QA-S1-005 | AC-S1-02-01 | Convite válido aceito | Integração/E2E | Membership comum é criada uma vez | Crítica |
| QA-S1-006 | AC-S1-02-02 | Convite expirado | API/Banco | Negado sem membership parcial | Alta |
| QA-S1-007 | AC-S1-02-02 | Convite revogado ou reutilizado | Concorrência/API | Apenas uma aceitação pode vencer | Crítica |
| QA-S1-008 | AC-S1-02-02 | Token de convite adulterado | Segurança/API | Negado sem enumeração de conta ou tenant | Crítica |
| QA-S1-009 | AC-S1-02-03 | Suspensão com sessão ativa | RLS/E2E | Próxima operação protegida é negada | Crítica |
| QA-S1-010 | AC-S1-02-03 | Reativação autorizada | Integração | Acesso retorna somente no escopo atribuído | Alta |
| QA-S1-011 | AC-S1-02-04 | Limite de usuários esgotado | API/Banco | Convite/ativação negado sem derrubar ativos | Alta |
| QA-S1-012 | AC-S1-03-01 | Papel vazio atribuído | RLS/API | Nenhuma capacidade protegida é liberada | Crítica |
| QA-S1-013 | AC-S1-03-02 | Escopo na subárvore A1 | RLS/Integração | A1 e A1.1 permitidos; A0, A2 e B0 negados | Crítica |
| QA-S1-014 | AC-S1-03-03 | Admin técnico consulta pastoral/financeiro | RLS/API | Negado por ausência de permissão específica | Crítica |
| QA-S1-015 | AC-S1-03-04 | Renomear título de papel | Integração | Chaves e decisões de permissão não mudam | Média |
| QA-S1-016 | AC-S1-04-01 | Usuário AB alterna A para B | E2E/API | Dados, menus e permissões são recalculados | Crítica |
| QA-S1-017 | AC-S1-04-01 | Cache após alternância | E2E | Nenhuma resposta ou seleção de A aparece em B | Crítica |
| QA-S1-018 | AC-S1-04-02 | Contexto C forjado no payload | API/RLS | Negado sem revelar recursos | Crítica |
| QA-S1-019 | AC-S1-04-03 | Contexto salvo foi suspenso | E2E | Contexto é invalidado; usuário escolhe outro ou sai | Alta |
| QA-S1-020 | AC-S1-05-01 | Metadata diz admin, assignment não | API/RLS | Operação administrativa negada | Crítica |
| QA-S1-021 | AC-S1-05-02 | Usuário comum abre URL administrativa | E2E/API | UI bloqueia e servidor revalida | Crítica |
| QA-S1-022 | AC-S1-05-02 | Chamada direta sem frontend | API/RLS | Mesma operação permanece negada | Crítica |
| QA-S1-023 | AC-S1-05-03 | Assignment revogado durante sessão | Integração | Nova operação reflete revogação | Crítica |
| QA-S1-024 | AC-S1-06-01 | Usuário autorizado, módulo inativo | API/RLS/E2E | Capacidade negada e fluxo indisponível | Crítica |
| QA-S1-025 | AC-S1-06-02 | Módulo ativo, usuário sem permissão | API/RLS | Capacidade negada | Crítica |
| QA-S1-026 | AC-S1-06-03 | Contextos têm módulos diferentes | E2E | Menu muda sem preservar rota proibida | Alta |
| QA-S1-027 | AC-S1-07-01 | Membership criada/suspensa | Banco/Integração | Eventos registram before/after minimizado | Alta |
| QA-S1-028 | AC-S1-07-01 | Role, escopo ou entitlement alterado | Banco/Integração | Ator, tenant, ação, resultado e instante presentes | Alta |
| QA-S1-029 | AC-S1-07-01 | Auditoria inspecionada | Segurança | Não contém token, senha ou payload pessoal | Crítica |
| QA-S1-030 | AC-S1-07-03 | Operador de suporte consulta tenant | RLS/API | Zero conteúdo sem concessão específica | Crítica |
| QA-S1-031 | AC-S1-08-01 | Fluxos em 360 × 800 | UI responsiva | Ações críticas utilizáveis sem corte impeditivo | Alta |
| QA-S1-032 | AC-S1-08-02 | Navegação somente por teclado | Acessibilidade/E2E | Foco visível, ordem correta e rótulos úteis | Alta |
| QA-S1-033 | AC-S1-08-02 | Erros de formulário com leitor de tela | Acessibilidade | Erro é associado ao campo e anunciado | Alta |
| QA-S1-034 | AC-S1-08-03 | API retorna falha esperada | Observabilidade | Mensagem segura e correlation ID disponíveis | Média |
| QA-S1-035 | DoD | anon consulta objetos administrativos | RLS | Negado, sem registros | Crítica |
| QA-S1-036 | DoD | Usuário sem membership consulta contexto | RLS | Negado | Crítica |
| QA-S1-037 | DoD | Tenant A usa UUID conhecido de B | API/RLS | Negado sem distinguir registro externo | Crítica |
| QA-S1-038 | DoD | Migration em schema vazio | Banco/CI | Reset, lint e pgTAP aprovados | Crítica |
| QA-S1-039 | DoD | Scanner encontra segredo sintético | CI | PR bloqueado sem imprimir o valor | Crítica |
| QA-S1-040 | DoD | Build e typecheck | CI | Nenhum erro bloqueante | Crítica |

## Testes de concorrência

- duas aceitações simultâneas do mesmo convite criam no máximo uma membership;
- duas criações simultâneas no último slot de `limit.active_users` não excedem o limite;
- suspensão concorrente com operação protegida termina em estado consistente e nega operações subsequentes;
- alteração e revogação simultâneas de assignment não preservam privilégio antigo;
- criação simultânea de identificador público duplicado mantém unicidade.

## Regressão mínima

- login, logout e reset de senha continuam disponíveis;
- rota protegida rejeita usuário sem sessão;
- contexto autorizado da Sprint 0 continua isolado;
- navegação principal renderiza sem consultar produção;
- página legada não ganha autoridade por metadata ou estado local;
- scanner sensível, cobertura RLS, lint, TypeScript e build continuam aprovados;
- os 40 testes pgTAP da Sprint 0 permanecem verdes.

## Testes não funcionais

- consultas frequentes de membership, assignment e árvore usam índices iniciados por `tenant_id` quando aplicável;
- erros de autorização não diferenciam registro inexistente de registro de outro tenant;
- tokens de convite têm entropia, expiração e armazenamento compatíveis com o risco;
- logs possuem identificadores técnicos mínimos e correlation ID, sem tokens;
- mudanças de contexto cancelam ou segregam requisições ainda em voo;
- telas críticas funcionam a 360 px, 768 px e viewport desktop;
- fluxo primário pode ser operado por teclado e não possui violações críticas de acessibilidade;
- o CI executa banco descartável sem depender de estado persistente anterior.

## Evidências obrigatórias no PR

- SHA exato testado;
- versão do schema e relação de migrations;
- resultado do reset, lint e pgTAP;
- matriz QA com aprovado, reprovado ou bloqueado;
- resultado de unitários, integração e E2E;
- lint, typecheck, build e scanners;
- capturas responsivas apenas com massa sintética;
- evidência de auditoria sanitizada;
- ensaio de rollback e feature flag;
- riscos residuais aceitos por Produto e Tech Lead.

## Critérios de entrada

- PR da Sprint 0 aprovado e branch-base identificada;
- catálogo de permissões e entitlements estável para o escopo;
- histórias e critérios deste documento aprovados;
- ambientes local/CI apontam somente para recursos não produtivos;
- fixtures sintéticas revisadas;
- estratégia de convite e envio desacoplada do fornecedor;
- fallback/feature flag do fluxo legado documentado.

## Critérios de saída

- todos os testes críticos e altos aprovados;
- zero vulnerabilidade crítica ou alta aberta;
- zero vazamento entre tenants, contextos ou escopos;
- nenhuma decisão administrativa efetiva baseada apenas em metadata ou frontend;
- reset, lint e pgTAP aprovados em banco descartável;
- regressão da Sprint 0 integralmente verde;
- rollback ensaiado em ambiente não produtivo;
- evidências anexadas ao PR;
- riscos residuais aceitos explicitamente;
- produção permanece inalterada até autorização separada.
