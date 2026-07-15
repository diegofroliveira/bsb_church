# Rollback da Sprint 0

Este documento descreve a preparação de rollback. A execução em produção exige backup verificado, janela aprovada e autorização explícita.

## Princípios

- Preferir mudanças aditivas e compatíveis com a versão anterior.
- Separar deploy de aplicação e migração de banco.
- Nunca apagar colunas ou dados na mesma entrega que deixa de utilizá-los.
- Para dados já migrados, preferir correção por roll-forward a um down destrutivo.

## Antes da homologação

1. Registrar o SHA do commit estável.
2. Gerar backup lógico do banco isolado e validar a leitura do arquivo.
3. Registrar versão e checksum de cada migração.
4. Executar a migração em uma cópia estrutural do legado.
5. Executar smoke tests e testes de isolamento entre tenants.
6. Ensaiar a reversão no mesmo ambiente isolado.

## Falha apenas na aplicação

1. Suspender a promoção da versão defeituosa.
2. Reapontar homologação para o último artefato aprovado.
3. Executar smoke tests de login, navegação e consulta.
4. Preservar logs técnicos sem PII para análise.

Produção não deve ser alterada durante a Sprint 0.

## Falha de migração

1. Interromper novas escritas no ambiente afetado, se necessário.
2. Não executar manualmente SQL não revisado.
3. Se a migração for aditiva e não houver corrupção, corrigir por nova migração versionada.
4. Se houver alteração de dados, comparar contagens e checksums com o backup.
5. Restaurar somente após validar o procedimento em uma instância descartável.
6. Registrar incidente, causa, decisão e evidências.

## RLS bloqueando fluxos válidos

1. Manter deny by default para usuários anônimos e outros tenants.
2. Reproduzir o caso com fixture sintética.
3. Corrigir a política com o menor escopo possível.
4. Executar toda a matriz de autorização, inclusive casos negativos.
5. Não desabilitar RLS como solução temporária em produção.

## Critérios de conclusão

- Serviço anterior recuperado ou correção validada.
- Integridade e isolamento dos dados confirmados.
- Nenhum segredo ou PII incluído nas evidências.
- Incidente e ações preventivas documentados.
