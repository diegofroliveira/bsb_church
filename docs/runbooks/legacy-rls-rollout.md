# Rollout de RLS no schema legado

## Objetivo

Eliminar acesso anônimo e aplicar RLS às tabelas legadas que possam armazenar
dados pessoais, sem interromper os fluxos ainda usados pelo IgrejaPro.

## Regra de segurança

A migration `202607150005_legacy_security_inventory.sql` é uma barreira de
segurança: revoga privilégios de `anon` e habilita e força RLS nas tabelas
legadas encontradas. Como ela não conhece todas as regras históricas da
aplicação, sua execução em produção exige policies compatíveis preparadas e
testadas previamente.

## Procedimento

1. Restaurar um backup recente em uma instância descartável.
2. Confirmar quais itens de `security_table_registry` existem no schema.
3. Mapear, para cada tabela encontrada, operações, papéis e escopos atualmente
   usados pelo frontend e pelas funções de backend.
4. Criar policies temporárias mínimas, sempre baseadas em tenant e permissão;
   nunca conceder acesso amplo ao papel `anon`.
5. Aplicar todas as migrations da Sprint 0 na instância descartável.
6. Executar os fluxos de login, cadastro, família, células, discipulado,
   financeiro, eventos e relatórios que toquem as tabelas encontradas.
7. Verificar nos catálogos do PostgreSQL que RLS está habilitado e forçado,
   que `anon` não possui DML e que cada tabela tem policy explícita.
8. Registrar evidências redigidas, plano de rollback, janela e responsáveis.
9. Liberar a aplicação somente após aprovação conjunta de Produto, Tech Lead e
   QA.

## Critérios de abortar

- qualquer consulta autorizada passa a falhar;
- qualquer consulta cruza tenants;
- existe acesso DML de `anon`;
- uma tabela pessoal fica sem policy explícita;
- o backup ou o restore não foram validados.

Em qualquer desses casos, interromper o rollout e seguir
`docs/runbooks/rollback.md`. Nenhuma correção improvisada deve ser feita na
base de produção.
