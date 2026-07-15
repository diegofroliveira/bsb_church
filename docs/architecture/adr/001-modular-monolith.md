# ADR-001: Monólito modular como arquitetura inicial

- Status: Aceito
- Data: 2026-07-15
- Decisores: Produto e Tech Lead do IgrejaPro

## Contexto

O IgrejaPro precisa evoluir de um painel interno para um SaaS multitenant com orçamento inicial próximo de zero. O produto terá vários domínios, mas ainda não possui volume, equipe ou requisitos operacionais que justifiquem serviços distribuídos.

## Decisão

Adotaremos um monólito modular, mantendo React/TypeScript no cliente, PostgreSQL/Auth/Storage no Supabase e funções server-side para comandos privilegiados. Os módulos serão separados por domínio e terão contratos explícitos, embora sejam implantados como poucas unidades.

Módulos iniciais:

1. Identity, Tenancy & Access.
2. Pessoas, Famílias & Jornada.
3. Estrutura Eclesiástica.
4. Grupos, Discipulado & Equipes.
5. Agenda, Eventos, Ensino, Presença & Escalas.
6. Financeiro.
7. Comunicação & Portal.
8. Analytics & Relatórios.
9. Integrações & Importação.
10. Assinaturas, Entitlements & Auditoria.

Regras de dependência:

- Domínios não consultam tabelas de outro domínio de forma ad hoc; usam contratos, views ou funções documentadas.
- O cliente nunca usa credenciais privilegiadas.
- Regras de autorização e isolamento são aplicadas no banco/API, não apenas na interface.
- Eventos de domínio relevantes serão registrados em outbox para permitir integrações futuras.

## Consequências

### Positivas

- Menor custo operacional e menor tempo até o mercado.
- Transações entre módulos permanecem simples.
- Limites explícitos permitem extrair serviços no futuro sem antecipar complexidade.

### Negativas

- Disciplina arquitetural será necessária para evitar acoplamento entre módulos.
- Deploys continuam compartilhados até que um módulo seja extraído.
- Consultas analíticas pesadas precisarão de views/materializações para não afetar operações.

## Alternativas rejeitadas

- Microserviços desde o início: custo e complexidade incompatíveis com a fase atual.
- Backend integralmente no navegador: não oferece uma fronteira segura para comandos privilegiados.
- Reescrita total antes de entregar valor: aumenta risco e posterga a independência do legado.
