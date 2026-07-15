# Evidências de QA — Sprint 0

Data da execução local: 2026-07-15
Branch: `feature/sprint-0-saas-foundation`

## Resultado

| Gate | Resultado | Observação |
|---|---|---|
| Segredos e artefatos sensíveis versionados | Aprovado | Nenhum segredo conhecido ou arquivo de exportação detectado |
| Cobertura estática de RLS | Aprovado | 20 tabelas com RLS habilitado, forçado e ao menos uma policy |
| Parse das migrations, seed e pgTAP | Aprovado | 7 arquivos SQL analisados sem erro sintático |
| Consistência da suíte pgTAP | Aprovado | Plano e implementação contêm 40 asserções |
| Lint | Aprovado com ressalva | 0 erros e 17 avisos legados de dependências de hooks |
| TypeScript | Aprovado | `tsc -b` sem erros |
| Build de produção | Aprovado | Vite gerou o bundle; permanece aviso de chunk acima de 500 kB |
| Auditoria de dependências | Inconclusivo localmente | O registry respondeu HTTP 410 nos endpoints de audit; CI não deve ficar indisponível por falha do registry |
| Execução real das migrations e pgTAP | Pendente de CI | Docker/Supabase local não está disponível nesta estação |

Todos os testes utilizaram apenas configuração e dados sintéticos. Nenhuma
operação foi executada em produção.

## Decisão de release

Esta evidência não autoriza merge ou deploy. O PR só pode ser aprovado depois
que o job `database` executar `supabase db reset`, `supabase db lint` e
`supabase test db` com sucesso em ambiente descartável.

O bloqueio dos objetos legados deve seguir o runbook específico e não pode ser
aplicado diretamente em produção sem inventário e teste de compatibilidade.
