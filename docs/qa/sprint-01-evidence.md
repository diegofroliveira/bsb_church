# Sprint 01 — Evidências de QA

Data da execução local: 20/07/2026
Branch: `feature/sprint-01-core-operacional`

## Resultado

| Verificação | Resultado | Evidência |
| --- | --- | --- |
| Segredos e arquivos sensíveis | Aprovado | `pnpm check:sensitive` |
| Cobertura estática de RLS | Aprovado | 22 tabelas registradas e protegidas |
| Testes unitários | Aprovado | 1 arquivo, 4 testes Vitest |
| TypeScript | Aprovado | `pnpm typecheck` sem erros |
| Lint | Aprovado com avisos preexistentes | 0 erros e 16 avisos de hooks em legado |
| Build de produção | Aprovado | Vite 8.1.5; bundle JS 505,83 kB (gzip 150,88 kB) |
| SQL estático | Aprovado | Migração, seed e testes parseados; planos pgTAP 40 + 71 consistentes |
| Testes reais do banco | Pendente do CI | Supabase local será iniciado pela esteira do PR |
| Dependências críticas | Aprovado | 0 vulnerabilidades críticas |

## Segurança de dependências

A atualização do Vite e os overrides transitivos eliminaram seis alertas corrigíveis do ferramental. Permanecem dois alertas de severidade alta em `xlsx@0.18.5` (prototype pollution e ReDoS), sem versão corrigida publicada no registro npm utilizado pelo projeto.

O pacote é usado apenas para gerar planilhas no navegador em telas autenticadas; a Sprint 01 não adicionou ingestão de arquivos XLSX. O risco residual foi aceito provisoriamente para preservar os relatórios existentes e deverá ser removido por substituição da biblioteca no hardening, antes do lançamento comercial.

## Critério de promoção

A Sprint 01 somente poderá ser integrada depois que os jobs remotos de qualidade e banco estiverem verdes e o Pull Request for aprovado. A integração na `main` permanece manual por poder acionar a produção.
