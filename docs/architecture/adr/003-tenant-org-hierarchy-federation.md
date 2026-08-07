# ADR-003: Tenant, hierarquia organizacional e federação

- Status: Aceito
- Data: 2026-07-15
- Decisores: Produto e Tech Lead do IgrejaPro

## Contexto

O IgrejaPro deve representar igrejas independentes, localidades, ministérios apostólicos e denominações. Também deve permitir vínculos entre organizações autônomas sem transformar supervisão eclesiástica em acesso irrestrito aos dados.

## Decisão

Separaremos três conceitos:

- `tenant`: fronteira de segurança, contrato, assinatura e propriedade dos dados.
- `org_unit`: unidade interna do tenant, como denominação, ministério, igreja, campus, localidade ou departamento.
- `tenant_relationship`: vínculo entre tenants autônomos, como afiliação, cobertura, supervisão ou administração.

A hierarquia interna usará `org_unit.parent_id` e uma closure table para consultas de ancestrais e descendentes. Toda unidade pertence a exatamente um tenant e não pode ter pai de outro tenant.

Um relacionamento entre tenants não concede acesso. Compartilhamento exige `data_sharing_grant` explícito, limitado por finalidade, módulo, ação, escopo, validade e possibilidade de revogação. Toda concessão e utilização relevante será auditada.

Uma grande denominação poderá operar como um único tenant com muitas unidades, ou como uma federação de tenants autônomos. A escolha não altera o princípio de menor privilégio.

## Consequências

### Positivas

- Suporta estruturas pequenas e grandes sem confundir governança com propriedade de dados.
- Permite autonomia local e colaboração consentida.
- Escopos hierárquicos podem ser calculados de forma eficiente.

### Negativas

- Movimentar subárvores exige atualização transacional da closure table.
- Compartilhamento federado adiciona regras e auditoria.
- A conversão entre tenant único e federação exigirá processo assistido.

## Alternativas rejeitadas

- Uma árvore global para todas as igrejas: mistura fronteiras legais e de segurança.
- Acesso automático do tenant pai: viola autonomia e menor privilégio.
- Somente `parent_id`, sem closure table: prejudica consultas e policies hierárquicas frequentes.
