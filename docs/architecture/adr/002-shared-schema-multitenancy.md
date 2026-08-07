# ADR-002: Multitenancy em schema compartilhado com RLS

- Status: Aceito
- Data: 2026-07-15
- Decisores: Produto, Tech Lead e Segurança do IgrejaPro

## Contexto

O produto deve atender desde uma igreja local até grandes denominações. O isolamento precisa ser forte, testável e economicamente viável sem manter um banco por cliente na fase inicial.

## Decisão

Usaremos PostgreSQL compartilhado, com `tenant_id NOT NULL` em toda tabela de negócio. Row Level Security será habilitado e forçado nessas tabelas. O acesso será permitido somente quando o usuário tiver membership ativa, permissão efetiva, escopo organizacional compatível e módulo habilitado quando aplicável.

Invariantes:

- `tenant_id` é imutável após a criação do registro.
- Chaves estrangeiras tenant-aware evitam referências entre tenants.
- Índices de acesso começam por `tenant_id`.
- Não haverá policy anônima para dados pessoais.
- Service role é restrita ao servidor e a jobs controlados.
- Funções `SECURITY DEFINER` terão `search_path` fixo, validação explícita e `EXECUTE` revogado de `PUBLIC`.
- Relatórios usam views `security_invoker` ou funções que aplicam o mesmo contexto de autorização.

## Consequências

### Positivas

- Custo inicial baixo e operação centralizada.
- Isolamento verificável com testes automatizados A×B.
- Migrações e relatórios são uniformes para todos os clientes.

### Negativas

- Uma policy incorreta pode afetar muitos clientes; testes negativos são obrigatórios.
- Clientes muito grandes poderão exigir particionamento ou infraestrutura dedicada no futuro.
- Consultas sempre precisam preservar o predicado de tenant.

## Alternativas rejeitadas

- Banco por tenant: isolamento forte, porém custo e operação prematuros.
- Schema por tenant: migrations e pooling tornam-se complexos em grande escala.
- Isolamento somente na aplicação: insuficiente contra consultas ou endpoints defeituosos.
