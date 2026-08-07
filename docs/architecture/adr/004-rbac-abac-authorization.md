# ADR-004: Autorização com RBAC e ABAC hierárquico

- Status: Aceito
- Data: 2026-07-15
- Decisores: Produto, Tech Lead e Segurança do IgrejaPro

## Contexto

Títulos como apóstolo, bispo, pastor, líder, discipulador, funcionário e administrador variam entre organizações. Um enum fixo de cargos não representa todas as igrejas nem oferece granularidade suficiente.

## Decisão

Usaremos um modelo híbrido:

- RBAC: roles configuráveis agrupam permissões atômicas.
- ABAC: decisões consideram tenant, unidade/descendentes, status da membership, vínculo operacional, sensibilidade do dado e entitlement.

Permissões serão chaves estáveis no formato `dominio.recurso.acao`, por exemplo `people.person.read`, `finance.transaction.approve` e `iam.user.manage`.

Uma `access_assignment` liga usuário, role e escopo. Escopos possíveis inicialmente: próprio usuário, grupo atribuído, unidade, subárvore ou tenant inteiro. Títulos religiosos serão templates de roles configuráveis, nunca condições codificadas no sistema.

A fonte confiável será o banco. `user_metadata` ou claims poderão acelerar apresentação, mas não autorizarão uma operação sem validação server-side/RLS.

Regras adicionais:

- Negação por padrão.
- Separação de funções para operações financeiras críticas.
- Acesso a cuidado pastoral, documentos e contribuições exige permissões específicas.
- Alterações de role, escopo e grants geram auditoria.
- Usuários suspensos ou memberships inativas perdem acesso imediatamente.

## Consequências

### Positivas

- Adapta-se à nomenclatura de cada organização.
- Oferece menor privilégio sem multiplicar cargos no código.
- A mesma matriz serve ao frontend, API, RLS e QA.

### Negativas

- Cálculo de permissão é mais complexo que um campo `role`.
- Cache de autorização exige invalidação cuidadosa.
- Administradores precisarão de uma interface compreensível para configurar roles.

## Alternativas rejeitadas

- Enum global de cargos: rígido e culturalmente inadequado.
- Autorização apenas por rota React: facilmente contornável.
- ACL individual em todos os registros: manutenção e consultas excessivamente complexas.
