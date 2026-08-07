# Glossário canônico de domínio

Status: aprovado para a fundação da Sprint 0

Produto: IgrejaPro

Responsáveis: Produto, Arquitetura e Dados

## Objetivo

Este documento fixa a linguagem usada pelo produto, banco de dados, APIs, interface, testes e documentação. Os nomes apresentados ao usuário podem ser configuráveis; os conceitos e identificadores internos permanecem estáveis.

## Princípios de linguagem

1. `Tenant` não é sinônimo de igreja. Ele é a fronteira de propriedade, cobrança e isolamento de dados.
2. `Organização` representa uma entidade administrativa ou ministerial dentro de um tenant.
3. Vínculo institucional não concede acesso a dados por si só.
4. Papel descreve um conjunto reutilizável de permissões; função ministerial descreve a atuação de uma pessoa e não concede acesso automaticamente.
5. Entitlement habilita comercialmente uma capacidade; permissão autoriza uma ação para um usuário. Ambos são necessários.
6. Pessoa e usuário são conceitos diferentes. Uma pessoa pode não possuir login, e uma identidade pode ser vinculada a uma pessoa após verificação.
7. Títulos como apóstolo, bispo, pastor, supervisor ou dirigente são nomenclaturas configuráveis, não regras codificadas.

## Organizações e tenancy

### GL-001 — Tenant

Fronteira lógica de propriedade, isolamento, configuração e contratação no IgrejaPro. Todo dado operacional deve pertencer direta ou indiretamente a exatamente um tenant.

Regras:

- Possui identificador imutável.
- Não pode ser inferido a partir de parâmetros enviados pelo cliente sem validação da sessão.
- Um tenant pode conter uma ou várias organizações.
- Acesso entre tenants é negado por padrão.
- Mudança de propriedade de dados exige operação administrativa auditada; nunca é uma edição comum.

### GL-002 — Organização

Unidade administrativa ou ministerial registrada no tenant, como igreja, congregação, campo, região, convenção, ministério ou sede.

Regras:

- Pertence obrigatoriamente a um tenant.
- Possui tipo, nome, status e vigência.
- Pode participar de relações institucionais válidas.
- Pode ter configurações locais herdadas ou sobrescritas conforme política futura.

### GL-003 — Tipo de organização

Classificação configurável de uma organização. Exemplos iniciais: igreja local, congregação, sede, campo, região, rede, convenção e ministério.

O tipo organiza apresentação e regras permitidas, mas não concede acesso.

### GL-004 — Relação organizacional

Vínculo versionado entre duas organizações do mesmo tenant. Exemplos: administra, supervisiona, contém, é localidade de ou presta contas a.

Regras:

- Possui organização de origem, organização de destino, tipo, status e vigência.
- Relações hierárquicas não podem formar ciclos.
- A direção do vínculo deve ser explícita.
- O vínculo não concede acesso nominal automático.

### GL-005 — Afiliação intertenant

Vínculo consentido entre organizações pertencentes a tenants autônomos, usado em redes, ministérios apostólicos e denominações federadas.

Regras:

- Cada lado mantém propriedade e administração dos próprios dados.
- Exige convite, aceite e vigência.
- Compartilhamento é definido por concessões separadas.
- Revogar a afiliação revoga os compartilhamentos dependentes, preservando a auditoria.
- A Sprint 0 documenta o contrato; operações funcionais federadas serão incrementais.

### GL-006 — Contexto organizacional

Combinação ativa de tenant, organização, identidade e escopos usada para avaliar uma operação. Trocar o contexto recalcula permissões; privilégios de um contexto não vazam para outro.

### GL-007 — Escopo

Limite sobre o qual uma permissão pode ser exercida. Pode representar todo o tenant, uma organização, uma subárvore organizacional ou um recurso específico.

### GL-008 — Concessão de compartilhamento

Autorização explícita, revogável e auditada para compartilhar dados ou indicadores entre organizações ou tenants afiliados.

Deve informar:

- concedente e destinatário;
- finalidade;
- conjunto de dados;
- granularidade nominal, agregada ou anonimizada;
- vigência;
- responsável e base de autorização.

## Identidade e acesso

### GL-009 — Identidade de usuário

Identidade autenticável de uma pessoa natural. Contém os identificadores necessários à autenticação, mas não substitui o cadastro de pessoa.

### GL-010 — Participação organizacional

Vínculo entre uma identidade e uma organização que permite receber papéis naquele contexto. Possui status, vigência e origem do convite.

### GL-011 — Papel

Conjunto reutilizável de permissões, como administrador organizacional, operador, auditor ou usuário comum. Papéis podem ser modelos do sistema ou configurações do tenant.

### GL-012 — Permissão

Autorização atômica para executar uma ação sobre um recurso, por exemplo `people.read` ou `organization.manage`.

### GL-013 — Atribuição de papel

Associação entre identidade, papel e escopo. Deve possuir vigência e ser auditada quando criada, alterada ou revogada.

### GL-014 — Função ministerial

Atuação eclesiástica ou operacional de uma pessoa, como pastor, líder, discipulador ou tesoureiro. Pode ser usada como dado de negócio e sugestão de perfil, mas nunca substitui uma atribuição explícita de papel.

### GL-015 — Usuário da plataforma

Pessoa com identidade autenticável e pelo menos uma participação organizacional ativa. Um cadastro de pessoa sem login não é usuário da plataforma.

## Pessoas e relacionamentos

### GL-016 — Pessoa

Registro canônico de uma pessoa natural dentro de um tenant. Centraliza identidade cadastral e pode possuir múltiplos vínculos com organizações.

Regras:

- Não existe pesquisa global de pessoas entre tenants.
- Duplicidades são tratadas por processo explícito de comparação e unificação.
- Dados sensíveis recebem acesso e auditoria reforçados.

### GL-017 — Vínculo da pessoa com organização

Relação de uma pessoa com uma organização, como visitante, participante, membro, colaborador ou ministro. Possui status, vigência e origem.

### GL-018 — Família

Agregado relacional próprio dentro do tenant. Não é derivado apenas dos campos pai, mãe ou cônjuge.

### GL-019 — Relação familiar

Vínculo tipado entre pessoas e/ou uma família, como responsável, dependente, cônjuge, pai, mãe ou filho. Pode registrar convivência no mesmo domicílio e autorização de responsável.

### GL-020 — Ocorrência

Fato datado da jornada de uma pessoa, como batismo, recepção, mudança de vínculo ou atendimento. O tipo é configurável e a alteração é auditada.

### GL-021 — Histórico

Registro cronológico relevante para acompanhamento administrativo ou pastoral. Conteúdo pastoral confidencial não deve ser replicado em logs técnicos.

## Produto e comercialização

### GL-022 — Módulo

Conjunto comercial e funcional coeso de capacidades do IgrejaPro. O núcleo da plataforma é obrigatório; os demais módulos podem ser habilitados conforme contratação.

### GL-023 — Entitlement

Direito comercial e técnico de usar uma capacidade ou consumir uma franquia. Entitlements são avaliados no backend e não podem ser implementados apenas ocultando elementos da interface.

### GL-024 — Plano

Composição comercial versionada de módulos, entitlements, limites e condições. Nomes comerciais de planos não devem ser usados como condição no código.

### GL-025 — Limite de uso

Quantidade permitida para uma métrica, como pessoas ativas, organizações, armazenamento ou mensagens. Deve declarar unidade, período e comportamento ao atingir o limite.

### GL-026 — Feature flag

Controle operacional de liberação gradual. Não substitui entitlement nem permissão e não deve ser usado como única barreira de segurança.

## Governança de dados

### GL-027 — Dado pessoal

Informação relacionada a uma pessoa natural identificada ou identificável.

### GL-028 — Dado pessoal sensível

Informação que exige proteção reforçada, incluindo convicção religiosa, saúde e conteúdo pastoral associado a uma pessoa.

### GL-029 — Registro de auditoria

Evidência imutável ou protegida de uma operação relevante. Deve registrar ator, tenant, contexto, ação, recurso, resultado e data, sem armazenar segredos ou conteúdo sensível desnecessário.

### GL-030 — Exclusão lógica

Mudança controlada de status que retira um registro da operação normal sem apagar imediatamente sua trilha. Retenção e eliminação definitiva obedecem a política própria.

### GL-031 — Migração

Alteração versionada e reproduzível de estrutura ou dados. Deve possuir pré-condições, validação, reconciliação e estratégia de rollback ou restauração.

## Regra canônica de autorização

Uma operação só é permitida quando todas as condições abaixo forem verdadeiras:

```text
tenant válido
AND identidade autenticada quando exigida
AND participação ativa
AND entitlement ativo
AND permissão concedida
AND escopo compatível
AND política de dados satisfeita
AND feature flag liberada, quando aplicável
```

Qualquer condição ausente resulta em negação segura.
