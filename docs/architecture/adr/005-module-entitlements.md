# ADR-005: Módulos, planos e entitlements

- Status: Aceito
- Data: 2026-07-15
- Decisores: Produto e Tech Lead do IgrejaPro

## Contexto

O produto será comercializado em módulos e preços variados. Exceções comerciais, testes e add-ons não podem gerar condicionais de plano espalhadas pelo código.

## Decisão

Manteremos um catálogo versionado de módulos, planos e capacidades:

- `module_catalog`: módulos estáveis do produto.
- `plans` e `plan_modules`: composição comercial padrão.
- `subscriptions`: plano e ciclo de vida contratado pelo tenant.
- `tenant_entitlements`: concessões, limites ou bloqueios específicos, com validade.
- `usage_meter`: consumo de recursos tarifados, especialmente IA e comunicação.

O módulo Foundation será obrigatório e conterá tenancy, organizações, pessoas/famílias básicas, identidade, permissões e auditoria básica. Módulos opcionais iniciais: Grupos & Discipulado, Agenda & Ensino, Escalas & Presença, Financeiro, Comunicação & Portal, Analytics & Georreferenciamento, Integrações e IA.

Entitlements serão aplicados na navegação, nos comandos server-side e nas funções/policies de dados. Ocultar uma tela não constitui controle de acesso. Mudanças terão vigência, motivo, autor e auditoria.

## Consequências

### Positivas

- Planos podem evoluir sem alterar regras de cada tela.
- Permite trials, add-ons, limites e exceções auditáveis.
- Reduz risco de um tenant acessar módulo não contratado.

### Negativas

- Cache de entitlements precisa considerar expiração e revogação.
- Billing e autorização continuam conceitos distintos, embora relacionados.
- Métricas de uso exigem idempotência.

## Alternativas rejeitadas

- Condicionais pelo nome do plano: frágeis e difíceis de auditar.
- Somente feature flags: não modelam direito contratual nem limites.
- Somente bloqueio no frontend: não protege dados ou APIs.
