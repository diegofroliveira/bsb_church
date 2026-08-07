# Catálogo inicial de módulos e entitlements

Status: baseline de produto da Sprint 0

Produto: IgrejaPro

## Objetivo

Definir fronteiras comerciais e funcionais sem acoplar o código a nomes de planos. Este catálogo não significa que todos os módulos serão implementados na Sprint 0.

## Princípios

1. O núcleo é obrigatório para todos os tenants.
2. Módulo habilitado não equivale a usuário autorizado.
3. Entitlements são verificados no backend.
4. Feature flags controlam liberação operacional, não contratação nem segurança.
5. Limites de uso são configuráveis e versionados.
6. Desabilitar um módulo não apaga seus dados.
7. Exportação e obrigações legais não podem ser bloqueadas de forma incompatível com a política de portabilidade.
8. O código consulta capabilities, nunca o nome comercial do plano.

## Regra de decisão

```text
acesso = módulo ativo
      AND entitlement ativo
      AND limite disponível, quando aplicável
      AND permissão concedida
      AND escopo compatível
      AND política de dados satisfeita
```

## Convenção de identificadores

- Módulo: `MOD-XXX`
- Código técnico do módulo: `snake_case`
- Entitlement: `<modulo>.<capacidade>`
- Limite: `limit.<metrica>`
- Permissão: `<recurso>.<acao>` — pertence ao catálogo de autorização, não ao catálogo comercial.

Exemplo:

```text
Entitlement: people.import
Permissão: people.create
Escopo: organization:123
Limite: limit.active_people = 500
```

## MOD-CORE — Núcleo da plataforma

Código: `core`

Disponibilidade: obrigatório

Sprint 0: fundação

Capacidades:

- tenant e organizações;
- identidade e participação organizacional;
- papéis, permissões e escopos;
- configurações essenciais;
- auditoria de operações críticas;
- catálogo de módulos e entitlements;
- privacidade, exportação e isolamento.

Entitlements iniciais:

| Código | Descrição | Medição |
|---|---|---|
| `core.organization.manage` | Gerenciar organizações permitidas pelo plano | `limit.organizations` |
| `core.user.invite` | Convidar identidades para uma organização | `limit.active_users` |
| `core.role.customize` | Criar papéis personalizados | `limit.custom_roles` |
| `core.audit.view` | Consultar auditoria conforme permissão | Retenção por período |
| `core.data.export` | Exportar dados próprios conforme governança | Política de uso justo |

## MOD-PEOPLE — Pessoas e Famílias

Código: `people`

Dependência: `core`

Sprint 0: somente compatibilidade arquitetural e migração de tenancy

Capacidades planejadas:

- pessoas e vínculos organizacionais;
- famílias e relações familiares;
- ocorrências, funções e históricos;
- documentos, pesquisa, filtros e qualidade cadastral;
- importação, comparação e unificação de duplicidades.

Entitlements iniciais:

| Código | Descrição | Medição |
|---|---|---|
| `people.registry` | Operar cadastros de pessoas | `limit.active_people` |
| `people.family` | Operar famílias e relações | Incluído no módulo |
| `people.history` | Registrar ocorrências e históricos | Retenção por período |
| `people.import` | Importar cadastros em lote | Linhas por lote/período |
| `people.deduplicate` | Detectar e unificar duplicidades | Operações por período |

## MOD-CARE — Cuidado e Discipulado

Código: `care`

Dependências: `core`, `people`

Sprint 0: fora do escopo funcional

Entitlements:

- `care.discipleship`
- `care.followup`
- `care.journey`
- `care.protocol`
- `care.alerts`

## MOD-GROUPS — Grupos e Estrutura Ministerial

Código: `groups`

Dependências: `core`, `people`

Sprint 0: fora do escopo funcional

Entitlements:

- `groups.registry`
- `groups.hierarchy`
- `groups.meetings`
- `groups.attendance`
- `groups.metrics`

## MOD-EVENTS — Agenda, Eventos e Ensino

Código: `events`

Dependências: `core`; integração opcional com `people`

Sprint 0: fora do escopo funcional

Entitlements:

- `events.calendar`
- `events.registration`
- `events.checkin`
- `events.teaching`
- `events.certificate`
- `events.payment`

## MOD-SCHEDULES — Escalas e Voluntariado

Código: `schedules`

Dependências: `core`, `people`; integração opcional com `events`

Sprint 0: fora do escopo funcional

Entitlements:

- `schedules.teams`
- `schedules.availability`
- `schedules.publish`
- `schedules.confirmation`
- `schedules.substitution`

## MOD-FINANCE — Financeiro

Código: `finance`

Dependência: `core`; integração opcional com `people` e `events`

Sprint 0: fora do escopo funcional

Entitlements:

- `finance.contributions`
- `finance.payables`
- `finance.receivables`
- `finance.accounts`
- `finance.cost_centers`
- `finance.budget`
- `finance.reconciliation`
- `finance.accounting_export`

## MOD-COMMS — Comunicação e Portal

Código: `communications`

Dependências: `core`; integração opcional com os demais módulos

Sprint 0: fora do escopo funcional

Entitlements:

- `communications.portal`
- `communications.notices`
- `communications.forms`
- `communications.requests`
- `communications.email`
- `communications.messaging`

Métricas de custo variável devem ser limites separados, como `limit.messages.month` e `limit.email.month`.

## MOD-ANALYTICS — Relatórios e Analytics

Código: `analytics`

Dependência: `core`; fontes condicionadas aos módulos ativos

Sprint 0: apenas critérios de isolamento e compatibilidade dos relatórios existentes

Entitlements:

- `analytics.operational`
- `analytics.dashboard`
- `analytics.custom_reports`
- `analytics.export`
- `analytics.scheduled_delivery`

## MOD-GOVERNANCE — Redes e Denominações

Código: `governance`

Dependência: `core`

Sprint 0: contrato conceitual; fluxo completo fora do escopo

Entitlements:

- `governance.organization_tree`
- `governance.affiliation`
- `governance.sharing_grants`
- `governance.consolidated_metrics`
- `governance.comparatives`

## MOD-INTEGRATIONS — Integrações e Automação

Código: `integrations`

Dependência: `core`; capacidades dependem do módulo de origem

Sprint 0: fora do escopo funcional

Entitlements:

- `integrations.api`
- `integrations.webhooks`
- `integrations.importers`
- `integrations.automation`
- `integrations.service_accounts`

## Limites comerciais iniciais

| Código | Unidade | Período | Comportamento padrão ao atingir |
|---|---|---|---|
| `limit.organizations` | Organizações ativas | Atual | Bloquear nova criação, preservar existentes |
| `limit.active_people` | Pessoas ativas | Atual | Alertar e bloquear novas ativações conforme contrato |
| `limit.active_users` | Usuários ativos | Atual | Bloquear novo convite/ativação |
| `limit.storage_bytes` | Bytes armazenados | Atual | Bloquear novo upload, nunca apagar automaticamente |
| `limit.messages.month` | Mensagens enviadas | Mensal | Bloquear novo envio ou consumir franquia adicional aprovada |
| `limit.email.month` | E-mails enviados | Mensal | Bloquear novo envio ou consumir franquia adicional aprovada |
| `limit.api_requests.month` | Requisições | Mensal | Aplicar limite e resposta técnica documentada |
| `limit.audit_retention_days` | Dias | Contínuo | Aplicar retenção contratada respeitando obrigação legal |

## Estados de um entitlement

| Estado | Efeito |
|---|---|
| `active` | Capacidade disponível, sujeita a permissão e limite |
| `trial` | Capacidade temporária com data de término explícita |
| `grace_period` | Continuidade temporária auditada após mudança comercial |
| `suspended` | Novas operações bloqueadas; dados preservados |
| `expired` | Capacidade indisponível; exportação e obrigações permanecem |

## Requisitos de auditabilidade

Toda alteração de plano, entitlement ou limite deve registrar:

- tenant afetado;
- valor anterior e novo;
- responsável ou processo de serviço;
- origem da alteração;
- data de início e, quando aplicável, término;
- justificativa;
- identificador de correlação.

## Itens não definidos nesta baseline

- Nomes e preços de planos.
- Política de descontos.
- Tributação e meios de pagamento.
- Franquias numéricas definitivas.
- Combinações comerciais de módulos.
- Regras de inadimplência.

Esses itens serão definidos após validação de mercado e não alteram os códigos canônicos acima.
