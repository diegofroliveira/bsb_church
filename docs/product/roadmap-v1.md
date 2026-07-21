# Roadmap do programa — IgrejaPro SaaS v1

Status: baseline de execução após a Sprint 0

Produto: IgrejaPro — nome mantido provisoriamente

## Objetivo do programa

Transformar o painel atual em um produto SaaS multitenant independente, modular e comercializável para igrejas locais, redes, ministérios e denominações, preservando os relatórios úteis sem transportar para o produto novo as limitações de segurança ou de domínio do legado.

A versão comercial v1 estará concluída somente após a Sprint 17. Uma tela já existente não significa funcionalidade entregue: cada fluxo precisa estar ligado ao modelo v2, protegido por RLS, permissão, escopo e entitlement, coberto por testes multitenant e liberado por feature flag quando coexistir com o legado.

## Modelo de execução

- Uma branch e um Pull Request por Sprint, criados a partir da `main` aprovada mais recente.
- Convenção recomendada: `feature/sprint-NN-descricao-curta`.
- Nenhum desenvolvimento direto em `main` e nenhuma promoção automática para produção.
- Discovery da Sprint seguinte pode ocorrer durante o QA da atual, mas código dependente somente parte de contratos aprovados.
- Cada Sprint deve ser implantável e reversível de forma independente.
- Dados reais não são fixtures, artefatos de CI ou evidências de PR.

## Estimativa relativa

Os pontos abaixo representam tamanho e risco relativos, não prazo ou compromisso de calendário:

- 21–34 pontos: Sprint média;
- 55 pontos: Sprint grande;
- 89 pontos: Sprint muito grande e candidata a fatiamento interno;
- itens acima de 89 pontos devem ser refatiados antes do planejamento.

## Sprints do programa

| Sprint | Resultado independente | Estimativa | Dependências principais |
|---|---|---:|---|
| 0 | Fundação SaaS multitenant e gates de segurança | 55 | — |
| 1 | Core operacional, onboarding, IAM e troca de contexto | 55 | Sprint 0 |
| 2 | Pessoas e vínculos organizacionais v2 | 55 | Sprint 1 |
| 3 | Famílias, jornada, consentimento e privacidade | 55 | Sprint 2 |
| 4 | Importação, reconciliação e independência do Prover | 55 | Sprints 2–3 |
| 5 | Estrutura de igrejas, redes, denominações e governança | 55 | Sprint 1 |
| 6 | Células, setores, grupos, equipes e presença | 89 | Sprints 2 e 5 |
| 7 | Discipulado e cuidado pastoral | 55 | Sprints 2 e 6 |
| 8 | Agenda, eventos e ensino | 55 | Sprints 2 e 5 |
| 9 | Voluntariado, escalas e confirmações | 55 | Sprints 6 e 8 |
| 10 | Financeiro operacional | 89 | Sprints 1, 2 e 5 |
| 11 | Orçamento, conciliação e governança financeira | 55 | Sprint 10 |
| 12 | Portal do membro, formulários e comunicação | 89 | Sprints 2, 6 e 8 |
| 13 | Relatórios, BI, georreferenciamento e exportações | 89 | Módulos operacionais aprovados |
| 14 | API, integrações, webhooks e automações | 55 | Sprints 1–13 conforme conector |
| 15 | IA segura e mensuração de consumo | 55 | Sprints 13–14 |
| 16 | Planos, limites, assinatura e operação comercial SaaS | 55 | Sprint 1 e módulos estáveis |
| 17 | Hardening, piloto e lançamento comercial | 55 | Sprints 1–16 |

## Entregas e portões por Sprint

### Sprint 1 — Core operacional e IAM

Entrega onboarding do tenant, organização inicial, convites, memberships, roles, escopos, troca de contexto, administração de usuários e auditoria administrativa. O aceite exige autorização efetiva no banco/API, suspensão imediata, ausência de privilégios implícitos e isolamento de usuários com múltiplos contextos.

### Sprint 2 — Pessoas

Entrega cadastro, contatos, endereços, documentos básicos, vínculos organizacionais, pesquisa, paginação, arquivamento, perfil consolidado e sinalização de duplicidades. O aceite exige chaves tenant-aware, acesso por escopo, proteção separada de campos sensíveis e auditoria das mutações.

### Sprint 3 — Famílias, jornada e privacidade

Entrega famílias como agregado próprio, parentescos, responsáveis, dependentes, ocorrências, histórico, consentimentos e solicitações de exportação, correção e anonimização. O aceite exige proteção reforçada de menores e compatibilidade com retenções financeiras e de auditoria.

### Sprint 4 — Independência do Prover

Entrega importador com staging, validação, dry-run, erros por linha, idempotência, referências externas, reconciliação, snapshot, delta e rollback. O corte somente é aceito quando a igreja piloto opera sem consultar o Prover e as contagens reconciliadas não apresentam órfãos ou duplicação.

### Sprint 5 — Estrutura e governança

Entrega árvore organizacional, movimentação de subárvores, afiliações entre tenants e grants explícitos de compartilhamento. O aceite rejeita ciclos e garante que vínculo institucional isolado nunca conceda acesso nominal.

### Sprint 6 — Grupos, células e presença

Entrega células, setores, grupos, equipes, participantes, lideranças com vigência, reuniões, presença, transferências e métricas. O aceite exige preservação histórica e escopo correto para líderes e supervisores.

### Sprint 7 — Discipulado e cuidado pastoral

Entrega relações de discipulado, acompanhamentos, tarefas, alertas, protocolos e anotações pastorais classificadas. O aceite exige need-to-know, auditoria reforçada e ausência de acesso pastoral implícito para administradores técnicos.

### Sprint 8 — Agenda, eventos e ensino

Entrega calendário, eventos, sessões, capacidade, inscrições, lista de espera, check-in, turmas, conteúdo e certificados básicos. O aceite exige controle transacional de vagas e ausência de exposição do cadastro interno em eventos públicos.

### Sprint 9 — Voluntariado e escalas

Entrega equipes, funções, disponibilidade, composição, publicação, aceite, recusa, substituição, lembretes e presença. O aceite exige detecção de conflito, versões auditadas e minimização dos dados exibidos aos voluntários.

### Sprint 10 — Financeiro operacional

Entrega contas, centros de custo, categorias, receitas, despesas, contas a pagar e receber, contribuições e comprovantes privados. O aceite exige segregação de funções configurável, RLS próprio e restrição de contribuições identificadas.

### Sprint 11 — Governança financeira

Entrega orçamento, conciliação, fechamento, fluxos de aprovação, relatórios e exportação contábil. O aceite exige fechamento imutável em operações ordinárias, reabertura justificada e conciliação idempotente.

### Sprint 12 — Portal e comunicação

Entrega portal responsivo, atualização de dados próprios, formulários, solicitações, avisos, aniversariantes e filas de comunicação com adapters. O aceite exige audiência calculada no servidor, consentimento, opt-out, idempotência e limites por tenant.

### Sprint 13 — Analytics e georreferenciamento

Entrega dashboards, relatórios operacionais, pastorais e financeiros segregados, georreferenciamento, comparativos, exportações assíncronas e entregas programadas. O aceite exige isolamento das métricas, supressão de pequenos grupos sensíveis e proteção das coordenadas individuais.

### Sprint 14 — Integrações e automação

Entrega API tenant-aware, service accounts, webhooks assinados, outbox, retries, dead-letter, importadores adicionais e automações. O aceite exige idempotência, rotação de chaves, proteção contra replay e reprocessamento observável.

### Sprint 15 — IA segura

Entrega consultas assistidas, insights, guardrails, consentimento, desidentificação e medição de consumo. O aceite exige escopo server-side, minimização de PII, limites por tenant e apresentação da IA como apoio, não como decisão pastoral ou financeira.

### Sprint 16 — Operação comercial SaaS

Entrega planos, trials, grace period, suspensão, limites, assinatura, medição de uso e administração interna da plataforma. O aceite exige capabilities em vez de nomes comerciais no código, preservação de dados na suspensão e separação entre billing, entitlement e autorização.

### Sprint 17 — Hardening e lançamento

Entrega piloto com a igreja atual, ensaio de carga, acessibilidade, backup/restore, monitoramento, alertas, SLOs, runbooks, onboarding de segundo tenant e documentação operacional/comercial. O lançamento exige zero vulnerabilidade crítica ou alta, restauração comprovada e jornadas críticas E2E aprovadas em desktop e celular.

## Definition of Done obrigatória

Toda Sprint somente pode ser encerrada quando:

1. critérios de aceite estão ligados a evidências no PR;
2. migrations são forward-only e o rollback operacional está documentado;
3. `supabase db reset`, lint e pgTAP estão aprovados em ambiente descartável;
4. testes A×B cobrem leitura, criação, alteração e exclusão de cada nova classe tenant-scoped;
5. membership suspensa, entitlement inativo, escopo incompatível e acesso anônimo são negados;
6. autorização é revalidada no banco/API, nunca somente no frontend;
7. lint, TypeScript, testes, build, scanner de segredos e dependências estão aprovados;
8. massas e evidências são sintéticas e não expõem dados pessoais;
9. operações sensíveis têm auditoria útil e sanitizada;
10. interfaces novas possuem smoke responsivo e acessibilidade proporcional ao risco;
11. coexistência com o legado possui teste de compatibilidade e rollback por feature flag;
12. QA registra riscos residuais e o Product Owner aprova o PR antes do merge.

## Riscos do programa

| Risco | Tratamento obrigatório |
|---|---|
| Escopo amplo gerar muitas telas superficiais | Entregar uma jornada ponta a ponta por vez; não considerar mock ou leitura legada como pronto |
| Dados históricos inconsistentes | Staging, dry-run, idempotência, reconciliação e quarentena |
| Vazamento entre tenants | RLS forçado, testes negativos A×B e autorização centralizada |
| Dados pastorais, de menores e financeiros | Permissões específicas, need-to-know, segregação e auditoria reforçada |
| Custo de mensagens, mapas, IA e storage | Adapters, limites, medição e degradação segura |
| Dependência de fornecedor | Contratos próprios de domínio, outbox e substituição do adapter |
| Ambiente local sem Docker confiável | Banco descartável no CI como gate bloqueante |
| Uma única igreja mascarar problemas SaaS | Segundo tenant controlado antes do lançamento |

## Definição de versão comercial v1

A v1 não é apenas o conjunto de telas. Ela requer operação independente do Prover, onboarding de tenant, módulos comercialmente controláveis, isolamento demonstrado, restore ensaiado, observabilidade, suporte documentado e pelo menos dois tenants operando sem acesso cruzado. Itens que dependam de fornecedores pagos podem estrear com adapter ou operação manual explícita, mas não podem ser simulados como serviço concluído.
