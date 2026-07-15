# ADR-006: Migração incremental por strangler

- Status: Aceito
- Data: 2026-07-15
- Decisores: Produto, Tech Lead e Dados do IgrejaPro

## Contexto

O sistema atual já entrega relatórios úteis e recebe dados do Prover. Uma reescrita total interromperia valor, aumentaria risco e atrasaria a independência. Ao mesmo tempo, o modelo legado não oferece tenancy e usa vínculos textuais em vários pontos.

## Decisão

Migraremos por domínio, mantendo produção intacta até que cada fatia seja validada:

1. Criar tenancy, IAM, entitlements, auditoria e RLS em modelo v2.
2. Cadastrar a igreja atual como tenant inaugural fora de produção, com seed sintético nos testes.
3. Construir Cadastro/Famílias v2 e um adapter de leitura do legado.
4. Importar por staging e jobs idempotentes, preservando IDs externos em `external_references`.
5. Reconciliar contagens, relacionamentos, rejeições e checksums antes do corte.
6. Liberar o novo módulo por tenant/feature flag, com rollback documentado.
7. Repetir para grupos, agenda, financeiro, portal e demais módulos.
8. Desligar a sincronização do Prover apenas após paridade e aceite.

Evitar dual-write prolongado. Preferiremos snapshot, delta controlado e corte por módulo. Dados reais não serão fixtures, logs ou artefatos de CI. Migração de PII exige ambiente autorizado, criptografia em trânsito, retenção definida e relatório de execução.

## Consequências

### Positivas

- Entrega contínua e rollback por módulo.
- Relatórios existentes podem ser preservados por views de compatibilidade.
- Erros de qualidade são isolados e reconciliáveis.

### Negativas

- Haverá coexistência temporária de modelos.
- Adapters e views de compatibilidade têm custo transitório.
- Cutovers exigem disciplina de dados e comunicação.

## Alternativas rejeitadas

- Big bang: risco operacional e de dados excessivo.
- Manter Prover como fonte definitiva: contraria a independência do produto.
- Dual-write indefinido: amplia inconsistência e complexidade de recuperação.
