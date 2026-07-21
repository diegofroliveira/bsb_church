# Critérios de aceite rastreáveis — Sprint 1

Status: baseline de Produto e QA

Produto: IgrejaPro

Branch prevista: `feature/sprint-01-core-operacional`

## Objetivo da Sprint

Transformar a fundação técnica da Sprint 0 em um núcleo operacional utilizável: criar e configurar tenants e organizações, convidar usuários, administrar memberships, atribuir papéis e escopos, alternar contextos autorizados e navegar conforme permissões e entitlements, sem depender do campo legado `role` ou de controles apenas no navegador.

## Convenção de rastreabilidade

- História: `S1-NN`.
- Critério de aceite: `AC-S1-NN-NN`.
- Evidência: teste automatizado, execução pgTAP, resultado E2E, log sanitizado, migration, checklist ou captura usando exclusivamente dados sintéticos.
- Critério crítico ou alto sem evidência bloqueia o encerramento da Sprint.

## Matriz resumida

| História | Prioridade | Resultado esperado |
|---|---:|---|
| S1-01 | P0 | Tenant e organização inicial operáveis |
| S1-02 | P0 | Convite e ciclo de vida de memberships seguros |
| S1-03 | P0 | Roles e escopos administráveis com menor privilégio |
| S1-04 | P0 | Troca de contexto sem vazamento de privilégios ou dados |
| S1-05 | P0 | Autorização efetiva independente do metadata legado |
| S1-06 | P1 | Entitlements aplicados ao backend e à experiência |
| S1-07 | P1 | Auditoria administrativa e recuperação segura |
| S1-08 | P1 | Experiência responsiva, acessível e observável |

## S1-01 — Onboarding do tenant

**História:** Como responsável por uma igreja ou rede, quero criar o contexto inicial da organização para começar a configurar o produto sem intervenção no banco.

```gherkin
@AC-S1-01-01 @onboarding @p0
Cenário: Criação atômica do contexto inicial
  Dado um operador da plataforma autorizado
  Quando criar um tenant com sua organização raiz e administrador inicial
  Então os três elementos deverão pertencer ao mesmo contexto
  E uma falha parcial deverá desfazer toda a operação
```

```gherkin
@AC-S1-01-02 @validation
Cenário: Identificador público duplicado
  Dado um tenant com identificador público ativo
  Quando outro tenant tentar usar o mesmo identificador
  Então a operação deverá ser rejeitada sem revelar dados internos
```

```gherkin
@AC-S1-01-03 @limits
Cenário: Limite de organizações atingido
  Dado um tenant no limite contratado de organizações ativas
  Quando um administrador tentar criar nova organização
  Então a criação deverá ser bloqueada
  E as organizações existentes deverão permanecer acessíveis
```

## S1-02 — Convites e memberships

**História:** Como administrador do tenant, quero convidar e administrar usuários para conceder acesso rastreável e revogável.

```gherkin
@AC-S1-02-01 @invite @p0
Cenário: Convite válido
  Dado um administrador com permissão e entitlement de convite
  Quando convidar um endereço ainda não ativo no tenant
  Então deverá ser criado um convite de uso único com validade
  E a aceitação deverá criar membership sem privilégio administrativo implícito
```

```gherkin
@AC-S1-02-02 @invite @security
Cenário: Convite inválido ou reutilizado
  Dado um convite expirado, revogado ou já utilizado
  Quando sua aceitação for tentada
  Então a operação deverá falhar de forma segura
  E não deverá revelar a existência de memberships em outros tenants
```

```gherkin
@AC-S1-02-03 @suspension @p0
Cenário: Suspensão imediata
  Dado um usuário com sessão válida e membership ativa
  Quando a membership for suspensa
  Então novas operações protegidas deverão ser negadas imediatamente
  E a suspensão deverá ser auditada
```

```gherkin
@AC-S1-02-04 @limits
Cenário: Limite de usuários ativos
  Dado um tenant no limite de usuários ativos
  Quando um novo convite ou reativação for solicitado
  Então a ativação deverá ser bloqueada
  E usuários existentes não deverão perder acesso
```

## S1-03 — Papéis e escopos

**História:** Como administrador autorizado, quero atribuir responsabilidades por escopo para aplicar menor privilégio de acordo com a estrutura da igreja.

```gherkin
@AC-S1-03-01 @roles @p0
Cenário: Papel sem permissão implícita
  Dado um novo papel personalizado sem permissões
  Quando ele for atribuído a uma membership
  Então nenhuma ação protegida deverá ser liberada
```

```gherkin
@AC-S1-03-02 @scope @p0
Cenário: Atribuição limitada à subárvore
  Dado um usuário atribuído a uma unidade com escopo de subárvore
  Quando acessar organizações
  Então deverá alcançar a unidade e seus descendentes
  Mas não seus irmãos, ancestrais não concedidos ou outro tenant
```

```gherkin
@AC-S1-03-03 @role-admin
Cenário: Administrador técnico sem acesso sensível
  Dado o template de administrador do tenant
  Quando consultar recursos pastorais ou financeiros
  Então o acesso deverá ser negado sem permissão específica
```

```gherkin
@AC-S1-03-04 @custom-role
Cenário: Personalização de título
  Dado um papel existente com permissões estáveis
  Quando seu título de apresentação for alterado
  Então as chaves de permissão deverão permanecer inalteradas
```

## S1-04 — Seleção e troca de contexto

**História:** Como usuário com mais de um vínculo, quero selecionar meu tenant e organização ativos para trabalhar sem misturar responsabilidades.

```gherkin
@AC-S1-04-01 @context @p0
Cenário: Alternância entre contextos autorizados
  Dado um usuário com memberships ativas nos tenants A e B
  Quando alternar do contexto A para o contexto B
  Então a interface e as consultas deverão ser recalculadas para B
  E nenhum dado, cache ou privilégio de A deverá permanecer disponível
```

```gherkin
@AC-S1-04-02 @context @security
Cenário: Contexto forjado
  Dado um usuário sem membership no tenant C
  Quando enviar manualmente o identificador de C
  Então banco e API deverão negar a operação sem revelar recursos de C
```

```gherkin
@AC-S1-04-03 @context
Cenário: Contexto persistido tornou-se inválido
  Dado um contexto salvo cuja membership foi suspensa
  Quando o usuário retornar à aplicação
  Então deverá selecionar outro contexto ainda autorizado ou encerrar a sessão
```

## S1-05 — Autoridade no banco e na API

**História:** Como organização cliente, quero que a autorização seja revalidada fora do navegador para impedir acesso por manipulação da interface.

```gherkin
@AC-S1-05-01 @authorization @p0
Cenário: Metadata divergente
  Dado um usuário cujo metadata declare papel administrativo
  Mas que não possua atribuição correspondente no modelo v2
  Quando chamar uma operação administrativa
  Então a operação deverá ser negada
```

```gherkin
@AC-S1-05-02 @authorization @p0
Cenário: Rota acessada manualmente
  Dado um usuário sem a permissão necessária
  Quando acessar diretamente uma rota ou endpoint protegido
  Então frontend, API e banco deverão negar a capacidade
```

```gherkin
@AC-S1-05-03 @authorization
Cenário: Alteração de role durante sessão
  Dado um usuário autenticado cuja atribuição foi revogada
  Quando executar nova operação
  Então a decisão deverá refletir a revogação sem exigir novo deploy
```

## S1-06 — Entitlements e navegação

**História:** Como gestor do produto, quero liberar capacidades contratadas sem confundir contratação com autorização pessoal.

```gherkin
@AC-S1-06-01 @entitlement @p0
Cenário: Módulo desabilitado
  Dado um usuário autorizado para uma ação
  Mas com o módulo correspondente desabilitado no tenant
  Quando tentar executar a ação
  Então backend e banco deverão negar a operação
  E a interface não deverá oferecer o fluxo como disponível
```

```gherkin
@AC-S1-06-02 @entitlement
Cenário: Módulo habilitado sem permissão
  Dado um módulo habilitado no tenant
  Mas um usuário sem a permissão necessária
  Quando tentar acessar a capacidade
  Então a operação deverá ser negada
```

```gherkin
@AC-S1-06-03 @navigation
Cenário: Navegação contextual
  Dado dois contextos do mesmo usuário com entitlements diferentes
  Quando o contexto ativo mudar
  Então menus e ações deverão refletir o novo conjunto de capacidades
```

## S1-07 — Auditoria e recuperação

**História:** Como responsável por segurança, quero rastrear mudanças administrativas e recuperar falhas para operar o SaaS com responsabilidade.

```gherkin
@AC-S1-07-01 @audit @p0
Cenário: Operação IAM auditada
  Dado uma criação, suspensão ou reativação de membership
  Ou uma alteração de papel, escopo ou entitlement
  Quando a operação for concluída ou negada por regra relevante
  Então deverá existir evento com ator, tenant, contexto, ação, recurso, resultado e instante
  E nenhum token ou conteúdo sensível desnecessário deverá ser registrado
```

```gherkin
@AC-S1-07-02 @recovery
Cenário: Falha no onboarding
  Dado uma falha durante a criação do contexto inicial
  Quando o processo de recuperação for executado
  Então não deverá permanecer tenant, membership ou convite órfão
```

```gherkin
@AC-S1-07-03 @support
Cenário: Suporte sem acesso implícito
  Dado um operador da plataforma sem concessão break-glass
  Quando consultar conteúdo de um tenant
  Então nenhum dado operacional deverá ser retornado
```

## S1-08 — Qualidade da experiência

**História:** Como administrador, quero configurar acessos em uma interface compreensível e segura em desktop ou celular.

```gherkin
@AC-S1-08-01 @responsive
Cenário: Administração em viewport móvel
  Dado uma tela de largura equivalente a 360 pixels
  Quando o administrador percorrer usuários, papéis e organizações
  Então conteúdo e ações críticas deverão permanecer utilizáveis sem rolagem horizontal impeditiva
```

```gherkin
@AC-S1-08-02 @accessibility
Cenário: Operação por teclado
  Dado um usuário sem mouse
  Quando navegar pelo onboarding, seletor de contexto e gestão de memberships
  Então foco, rótulos, ordem e mensagens de erro deverão ser perceptíveis
```

```gherkin
@AC-S1-08-03 @observability
Cenário: Falha administrativa rastreável
  Dado uma operação que falhe no servidor
  Quando o erro for apresentado
  Então o usuário receberá mensagem segura e acionável
  E o diagnóstico terá correlation ID sem expor segredo ou dado de outro tenant
```

## Portão de aceite da Sprint 1

A Sprint somente pode ser encerrada quando:

- todos os critérios P0 estiverem aceitos com evidência;
- as rotas administrativas não dependerem do campo legado `role` para autorização efetiva;
- a suíte A×B cobrir usuários exclusivos, multi-tenant, suspensos e sem membership;
- convites expirados, forjados e reutilizados forem negados;
- entitlement, permissão e escopo forem testados separadamente e em conjunto;
- alterações IAM relevantes produzirem auditoria sanitizada;
- banco descartável concluir reset, lint e pgTAP;
- lint, TypeScript, testes, build e scanners estiverem aprovados;
- smoke responsivo e de acessibilidade não possuir bloqueador;
- rollback e feature flag de coexistência estiverem documentados;
- produção permanecer inalterada até aprovação explícita do PR.

## Fora do escopo

- Cadastro completo de pessoas e famílias.
- Importação de dados reais ou corte do Prover.
- Operações funcionais de grupos, discipulado, eventos ou financeiro.
- Checkout, cobrança automática ou preços definitivos.
- Break-glass funcional; nesta Sprint, suporte permanece sem acesso ao conteúdo.
- Deploy ou migration em produção sem aprovação própria.
