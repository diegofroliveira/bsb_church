# Critérios de aceite rastreáveis — Sprint 0

Status: baseline de Produto e QA

Produto: IgrejaPro

Branch prevista: `feature/sprint-0-security-multitenancy`

## Objetivo da Sprint

Estabelecer uma fundação segura, testável e evolutiva para o IgrejaPro, contendo exposições conhecidas, definindo o modelo multitenant e instalando controles automáticos de qualidade e isolamento, sem promover alterações para `main` ou produção antes de QA, revisão e aprovação explícita do Pull Request.

## Convenção de rastreabilidade

- História: `S0-NN`
- Critério de aceite: `AC-S0-NN-NN`
- Evidência: relatório de teste, log de CI sanitizado, migration validada, ADR, checklist ou captura sem dado pessoal.
- Um critério só pode ser marcado como aceito com evidência anexada ao Pull Request.

## Matriz resumida

| História | Prioridade | Resultado | Documentos relacionados |
|---|---:|---|---|
| S0-01 | P0 | Credenciais contidas | Glossário GL-029 |
| S0-02 | P0 | Dados pessoais fora do versionamento | Glossário GL-027 a GL-029 |
| S0-03 | P0 | Modelo organizacional definido | GL-001 a GL-008; TOP-01 a TOP-03 |
| S0-04 | P0 | Base associada ao tenant inicial | GL-001, GL-016 e GL-031 |
| S0-05 | P0 | Isolamento e autorização por escopo | GL-006 a GL-013 |
| S0-06 | P1 | Matriz inicial de acesso | GL-010 a GL-014 |
| S0-07 | P1 | CI com bloqueios obrigatórios | Definition of Done |
| S0-08 | P1 | Testes automatizados de isolamento | TOP-01 a TOP-03 |
| S0-09 | P1 | Ambientes e promoção controlada | GL-031 |
| S0-10 | P2 | Classificação e auditoria | GL-027 a GL-030 |

## S0-01 — Conter credenciais expostas

**História:** Como responsável pelo produto, quero eliminar credenciais expostas e substituir acessos comprometidos para impedir utilização indevida dos sistemas e dados.

```gherkin
@AC-S0-01-01 @security @p0
Cenário: Repositório sem credenciais
  Dado que a branch da Sprint 0 esteja pronta para revisão
  Quando a varredura de segredos for executada
  Então nenhuma senha, chave privada, token ou credencial real deverá ser encontrada
  E configurações sensíveis deverão usar variáveis de ambiente ou cofre de segredos
```

Evidência: relatório do scanner sem conteúdo dos segredos.

```gherkin
@AC-S0-01-02 @security @p0
Cenário: Credencial comprometida revogada
  Dado que uma credencial tenha sido exposta
  Quando a rotação autorizada for concluída
  Então a credencial anterior deverá deixar de autenticar
  E a nova credencial não deverá existir no repositório ou nos logs
```

Evidência: checklist de rotação com identificadores mascarados e teste negativo.

```gherkin
@AC-S0-01-03 @security
Cenário: Falha segura por configuração ausente
  Dado que uma variável obrigatória não esteja configurada
  Quando o processo dependente for iniciado
  Então deverá falhar com mensagem não sensível
  E nenhum valor secreto deverá ser impresso
```

Evidência: teste automatizado ou log sanitizado.

## S0-02 — Remover dados pessoais do versionamento

**História:** Como responsável pela proteção das informações, quero retirar artefatos com dados pessoais do repositório para mantê-los apenas em ambientes autorizados.

```gherkin
@AC-S0-02-01 @privacy @p0
Cenário: Branch sem dados pessoais reais
  Dado que os arquivos versionados tenham sido classificados
  Quando a varredura de dados pessoais for executada
  Então nenhum artefato com cadastro pessoal real deverá permanecer versionado
  E padrões equivalentes deverão estar protegidos contra inclusão acidental
```

Evidência: inventário de caminhos e relatório sanitizado.

```gherkin
@AC-S0-02-02 @privacy
Cenário: Fonte de migração preservada com segurança
  Dado que um arquivo pessoal seja necessário para migração
  Quando ele for retirado do repositório
  Então deverá ser armazenado em local privado autorizado
  E sua finalidade e responsável deverão estar documentados sem expor conteúdo
```

Evidência: registro de custódia sem dado pessoal.

```gherkin
@AC-S0-02-03 @privacy @manual-approval
Cenário: Histórico Git contaminado
  Dado que dados pessoais sejam encontrados em commits anteriores
  Quando o diagnóstico for concluído
  Então deverá existir plano controlado de saneamento do histórico
  E sua execução dependerá de aprovação explícita
```

Evidência: plano de resposta e aprovação registrada. Reescrita do histórico não é commit comum da feature branch.

## S0-03 — Definir o modelo organizacional multitenant

**História:** Como responsável por uma igreja, rede ou denominação, quero representar organizações e vínculos sem misturar propriedade ou acesso aos dados.

```gherkin
@AC-S0-03-01 @multitenancy @p0
Cenário: Organização com tenant obrigatório
  Dado que uma organização seja criada
  Quando o registro for persistido
  Então deverá possuir um tenant proprietário válido
  E não poderá existir como registro órfão
```

Evidência: restrição de schema e teste de persistência.

```gherkin
@AC-S0-03-02 @multitenancy
Cenário: Relação organizacional válida
  Dado duas organizações elegíveis
  Quando uma relação for registrada
  Então deverá possuir direção, tipo, status e vigência
  E relações hierárquicas não deverão permitir ciclos
```

Evidência: migration, validações e testes de ciclo.

```gherkin
@AC-S0-03-03 @federation @p0
Cenário: Vínculo sem acesso automático
  Dado que uma igreja esteja vinculada a outra organização
  Quando o vínculo entrar em vigor
  Então nenhum acesso nominal deverá ser concedido automaticamente
  E compartilhamentos dependerão de concessão explícita
```

Evidência: testes de autorização referenciando TOP-02 e TOP-03.

## S0-04 — Associar a base atual ao tenant inicial

**História:** Como administrador da implantação atual, quero associar dados existentes a um tenant inicial para evoluir sem perda ou registros órfãos.

```gherkin
@AC-S0-04-01 @migration @p0
Cenário: Simulação reconciliada
  Dado um backup representativo da base atual
  Quando a migration for executada no ambiente de teste
  Então todos os registros em escopo deverão receber o tenant inicial
  E as contagens antes e depois deverão ser reconciliadas
```

Evidência: relatório de dry-run com contagens, sem dados pessoais.

```gherkin
@AC-S0-04-02 @migration
Cenário: Registro órfão detectado
  Dado que um registro não possa ser associado com segurança
  Quando a validação pós-migração for executada
  Então a promoção deverá falhar
  E a inconsistência deverá ser registrada sem publicação parcial
```

Evidência: teste de falha e relatório sanitizado.

```gherkin
@AC-S0-04-03 @rollback
Cenário: Restauração após falha
  Dado que a migration falhe
  Quando o procedimento de rollback ou restauração for executado
  Então o ambiente deverá retornar ao estado validado anterior
```

Evidência: ensaio de rollback em ambiente não produtivo.

## S0-05 — Aplicar isolamento e autorização por escopo

**História:** Como organização cliente, quero que usuários acessem somente dados dos tenants e organizações autorizados para garantir privacidade.

```gherkin
@AC-S0-05-01 @rls @p0
Cenário: Leitura entre tenants negada
  Dado um usuário autenticado no tenant A
  E um registro pertencente ao tenant B
  Quando o usuário tentar consultar o registro
  Então nenhum dado deverá ser retornado
```

```gherkin
@AC-S0-05-02 @rls @p0
Cenário: Escrita entre tenants negada
  Dado um usuário autenticado no tenant A
  Quando tentar criar, alterar ou excluir dados no tenant B
  Então a camada de dados deverá bloquear a operação
  E a tentativa deverá ser auditável
```

```gherkin
@AC-S0-05-03 @authorization
Cenário: Usuário com contextos distintos
  Dado um usuário com papéis em duas organizações autorizadas
  Quando selecionar um contexto
  Então permissões deverão ser calculadas para esse contexto
  E privilégios não deverão vazar entre contextos
```

```gherkin
@AC-S0-05-04 @anonymous @p0
Cenário: Acesso anônimo a dados protegidos
  Dado um cliente sem sessão autenticada
  Quando consultar recursos protegidos
  Então a operação deverá retornar negação segura ou nenhum registro
  E nenhum dado pessoal deverá ser exposto
```

Evidência de AC-S0-05-01 a 04: suíte automatizada por operação e matriz de contexto.

## S0-06 — Criar matriz inicial de papéis e permissões

**História:** Como administrador de organização, quero atribuir papéis em escopos definidos para delegar responsabilidades com privilégio mínimo.

```gherkin
@AC-S0-06-01 @least-privilege
Cenário: Novo participante sem privilégio administrativo
  Dado um usuário convidado para uma organização
  Quando aceitar o convite
  Então não deverá possuir permissão administrativa por padrão
```

```gherkin
@AC-S0-06-02 @roles
Cenário: Papel contextual
  Dado um usuário líder em uma organização e usuário comum em outra
  Quando alternar o contexto
  Então receberá apenas as permissões do papel vigente naquele contexto
```

```gherkin
@AC-S0-06-03 @nomenclature
Cenário: Título configurável sem alterar autorização
  Dado que uma organização personalize um título ministerial
  Quando a nomenclatura for exibida
  Então o texto poderá mudar
  Mas os identificadores internos de permissão permanecerão estáveis
```

Evidência: matriz papel × permissão × escopo e testes correspondentes.

## S0-07 — Implantar pipeline de integração contínua

**História:** Como equipe de desenvolvimento, quero validar automaticamente cada alteração para impedir promoção de código inseguro ou defeituoso.

```gherkin
@AC-S0-07-01 @ci
Cenário: Pull Request válido
  Dado um Pull Request contra main
  Quando os controles obrigatórios forem executados
  Então lint, compilação, testes, varredura de segredos e validação de migrations deverão passar
  E os resultados deverão permanecer vinculados ao Pull Request
```

```gherkin
@AC-S0-07-02 @ci @blocking
Cenário: Controle obrigatório reprovado
  Dado que uma verificação obrigatória falhe
  Quando o Pull Request for avaliado
  Então o merge deverá permanecer bloqueado
```

```gherkin
@AC-S0-07-03 @production-protection
Cenário: Mudança sem aprovação
  Dado que uma alteração não tenha QA e Pull Request aprovados
  Quando uma promoção for solicitada
  Então a implantação em produção deverá ser impedida
```

Evidência: execução do pipeline e configuração de proteção documentada.

## S0-08 — Automatizar testes de isolamento multitenant

**História:** Como QA e Arquitetura, quero uma suíte automatizada de isolamento para detectar regressões antes de qualquer merge.

```gherkin
@AC-S0-08-01 @multitenancy-test
Cenário: Matriz de leitura isolada
  Dado dois tenants com dados de teste equivalentes
  Quando consultas forem executadas com usuários de cada tenant
  Então cada usuário visualizará exclusivamente os próprios registros autorizados
```

```gherkin
@AC-S0-08-02 @multitenancy-test
Cenário: Matriz de operações protegidas
  Dado usuários com diferentes papéis e escopos
  Quando leitura, criação, alteração e exclusão forem testadas
  Então cada combinação deverá respeitar entitlement, permissão e escopo
```

```gherkin
@AC-S0-08-03 @service-account
Cenário: Processo privilegiado multitenant
  Dado um processo de serviço autorizado
  Quando acessar mais de um tenant
  Então deverá possuir finalidade e credencial próprias
  E a operação deverá ser rastreável
```

Evidência: relatório da suíte com matriz de cenários, sem dados reais.

## S0-09 — Separar ambientes e controlar promoção

**História:** Como responsável pela operação, quero configurações e promoção separadas para testar sem afetar produção.

```gherkin
@AC-S0-09-01 @environments
Cenário: Configuração independente
  Dado os ambientes local, teste e produção
  Quando suas configurações forem inventariadas
  Então não deverão compartilhar credenciais sensíveis
  E os recursos deverão ser identificáveis por ambiente
```

```gherkin
@AC-S0-09-02 @deployment @manual-approval
Cenário: Promoção controlada
  Dado uma alteração aprovada por QA
  Quando a promoção for solicitada
  Então deverão existir Pull Request aprovado, backup, migration validada e rollback
  E a execução dependerá de autorização explícita
```

```gherkin
@AC-S0-09-03 @gitflow
Cenário: Proteção da branch principal
  Dado o desenvolvimento da Sprint 0
  Quando alterações forem produzidas
  Então deverão permanecer em feature/sprint-0-security-multitenancy
  E main não deverá receber alteração direta
```

Evidência: inventário mascarado de ambientes, checklist de promoção e histórico do PR.

## S0-10 — Criar baseline de auditoria e classificação

**História:** Como responsável pela governança, quero classificar informações e auditar operações sensíveis para aplicar proteção proporcional ao risco.

```gherkin
@AC-S0-10-01 @classification
Cenário: Entidades classificadas
  Dado o inventário das entidades em escopo
  Quando a classificação for concluída
  Então cada entidade deverá ser marcada como pública, interna, pessoal ou pessoal sensível
```

```gherkin
@AC-S0-10-02 @audit
Cenário: Operação sensível auditada
  Dado uma alteração de permissão, vínculo organizacional ou dado protegido
  Quando a operação ocorrer
  Então deverão ser registrados ator, tenant, contexto, data, ação, resultado e recurso
  E segredos ou conteúdo pastoral confidencial não deverão constar no log
```

Evidência: catálogo de classificação e testes de auditoria.

## Portão de aceite da Sprint 0

A Sprint somente pode ser apresentada como concluída quando:

- todos os critérios P0 estiverem aceitos;
- não houver segredo ou dado pessoal real na branch;
- migrations tiverem dry-run, reconciliação e ensaio de restauração;
- testes de acesso anônimo e cruzamento de tenants estiverem verdes;
- CI bloquear falhas obrigatórias;
- QA anexar evidências ao Pull Request;
- produção permanecer inalterada até aprovação explícita.

## Fora do escopo rastreado

- Renomeação, marca e identidade visual.
- Novas interfaces e funcionalidades cadastrais.
- Módulos de cuidado, grupos, eventos, escalas, financeiro e comunicação.
- Aplicativo nativo ou PWA.
- Billing, checkout e preços.
- Inteligência artificial.
- Novas integrações com sistemas de terceiros.
- Migração ou deploy em produção durante a elaboração da Sprint.
