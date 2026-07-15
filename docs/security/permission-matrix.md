# Matriz inicial de permissões

Esta matriz define templates iniciais. Cada tenant poderá renomear cargos e criar roles, mas não criar novas chaves de permissão fora do catálogo controlado. Permissão efetiva exige simultaneamente membership ativa, role, escopo, entitlement e condições de sensibilidade.

## Escopos

| Código | Escopo | Regra |
|---|---|---|
| `self` | Próprio usuário/pessoa vinculada | somente o registro próprio e operações explicitamente permitidas |
| `assigned_group` | Grupo atribuído | membros e atividades do grupo designado |
| `org_unit` | Unidade | registros diretamente vinculados à unidade |
| `org_subtree` | Subárvore | unidade atribuída e seus descendentes |
| `tenant` | Tenant inteiro | todas as unidades do tenant, sujeito à sensibilidade |
| `shared_grant` | Compartilhamento federado | apenas finalidade, módulo, ação e escopo descritos no grant |

## Templates de roles

- Membro: autosserviço no portal.
- Discipulador: acompanhamento das pessoas explicitamente atribuídas.
- Líder de grupo: operação do grupo e sua equipe.
- Líder de setor: visão de uma subárvore ministerial.
- Pastor local: gestão pastoral da unidade/subárvore.
- Financeiro: operação financeira segregada.
- Secretaria: cadastro e rotinas administrativas.
- Administrador do tenant: configuração técnica e usuários, sem acesso pastoral/financeiro implícito.
- Supervisor de rede: template para bispo, apóstolo ou gestor denominacional, limitado ao escopo recebido.
- Suporte IgrejaPro: sem acesso a conteúdo por padrão; acesso temporário break-glass, consentido e auditado.

## Legenda

- `S`: permitido no escopo atribuído.
- `T`: permitido no tenant.
- `A`: permitido apenas nos próprios dados.
- `X`: negado por padrão.
- `*`: exige controle adicional descrito nas observações.

## Foundation, cadastro e pastoral

| Permissão | Membro | Discipulador | Líder grupo | Líder setor | Pastor local | Secretaria | Admin tenant | Supervisor rede |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `org.structure.read` | X | S | S | S | S | S | T | S |
| `org.structure.manage` | X | X | X | X | S | X | T | S* |
| `people.person.read` | A | S | S | S | S | S | T* | S |
| `people.person.create` | X | X | S* | S | S | S | T | S* |
| `people.person.update` | A* | S* | S* | S | S | S | T* | S* |
| `people.person.archive` | X | X | X | X | S | S* | T* | S* |
| `people.person.sensitive.read` | A* | S* | S* | S* | S* | X | X | S* |
| `people.document.read` | A* | X | X | X | S* | S* | X | X |
| `people.household.read` | A | S | S | S | S | S | T* | S |
| `people.household.manage` | X | X | S* | S | S | S | T* | S* |
| `pastoral.care.read` | A* | S* | S* | S* | S* | X | X | S* |
| `pastoral.care.write` | X | S* | S* | S* | S* | X | X | S* |
| `pastoral.discipleship.manage` | X | S | S | S | S | X | X | S |
| `privacy.consent.manage` | A* | X | X | X | S* | S* | T* | X |
| `privacy.data_export.request` | A | X | X | X | S* | S* | T* | X |

## Grupos, agenda e comunicação

| Permissão | Membro | Discipulador | Líder grupo | Líder setor | Pastor local | Secretaria | Admin tenant | Supervisor rede |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `groups.group.read` | S* | S | S | S | S | S | T* | S |
| `groups.group.manage` | X | X | S | S | S | S* | T* | S* |
| `groups.membership.manage` | X | X | S | S | S | S | T* | S* |
| `groups.meeting.manage` | X | S* | S | S | S | X | T* | S* |
| `groups.attendance.record` | X | S | S | S | S | X | T* | X |
| `agenda.event.read` | S | S | S | S | S | S | T* | S |
| `agenda.event.manage` | X | X | S* | S | S | S | T* | S* |
| `agenda.registration.self` | A | A | A | A | A | A | A | A |
| `agenda.scale.read` | A | S | S | S | S | S | T* | S |
| `agenda.scale.manage` | X | X | S | S | S | S | T* | S* |
| `communication.message.send` | X | S* | S | S | S | S | T* | S* |
| `communication.broadcast.send` | X | X | X | S* | S | S* | T* | S* |
| `portal.content.manage` | X | X | X | S* | S | S | T | S* |

## Financeiro, relatórios e administração

| Permissão | Financeiro | Pastor local | Secretaria | Admin tenant | Supervisor rede | Suporte IgrejaPro |
|---|---:|---:|---:|---:|---:|---:|
| `finance.account.read` | S | S* | X | X | S* | X |
| `finance.account.manage` | S* | S* | X | X | X | X |
| `finance.transaction.read` | S | S* | X | X | S* | X |
| `finance.transaction.create` | S | S* | X | X | X | X |
| `finance.transaction.approve` | S* | S* | X | X | X | X |
| `finance.reconciliation.manage` | S* | X | X | X | X | X |
| `finance.contribution.identify` | S* | S* | X | X | X | X |
| `reports.operational.read` | S | S | S | T* | S | X |
| `reports.pastoral.read` | X | S* | X | X | S* | X |
| `reports.financial.read` | S | S* | X | X | S* | X |
| `reports.export` | S* | S* | S* | T* | S* | X |
| `iam.user.read` | X | S* | S* | T | S* | X |
| `iam.user.manage` | X | X | X | T* | S* | X |
| `iam.role.manage` | X | X | X | T* | X | X |
| `billing.subscription.read` | X | S* | X | T | S* | X |
| `billing.subscription.manage` | X | X | X | T* | X | X |
| `integration.connector.manage` | X | X | X | T* | X | X |
| `audit.event.read` | X | S* | X | T* | S* | X |
| `support.break_glass.request` | X | X | X | X | X | X* |

## Controles adicionais marcados com `*`

- Dados próprios: atualização de campos críticos pode exigir aprovação da secretaria e nunca altera vínculo/role.
- Crianças e dependentes: acesso exige vínculo de responsável ou função autorizada; exportação é restrita.
- Cuidado pastoral: acesso por need-to-know, finalidade e escopo; leitura e escrita geram auditoria reforçada.
- Financeiro: criar e aprovar a mesma transação deve ser impedido quando o tenant habilitar segregação de funções. Contribuições identificadas são mais restritas que totais agregados.
- Administrador do tenant: administra plataforma, mas não recebe automaticamente cuidado pastoral, documentos ou contribuições identificadas.
- Supervisor de rede: só usa `org_subtree` dentro do próprio tenant ou `shared_grant` explícito entre tenants.
- Exportações: exigem justificativa, limite, registro de auditoria e, para alto volume, execução assíncrona com expiração.
- Comunicação: exige base legal/consentimento apropriado, audiência resolvida no servidor e prevenção de envio duplicado.
- Break-glass: requer solicitação do suporte, aprovação de administrador autorizado do tenant, prazo curto, motivo, sessão registrada e revogação automática.

## Regras de implementação

1. O catálogo de permissões é criado por migration e não é editável livremente pelo tenant.
2. Roles são agrupamentos tenant-scoped; templates apenas iniciam a configuração.
3. Nenhuma role recebe `*` global. Cada ação é explícita.
4. A interface pode ocultar ações, mas API/RPC/RLS sempre revalidam.
5. Alterações em roles, assignments, escopos e grants invalidam caches de autorização.
6. Permissões financeiras, pastorais, documentos e administração não são implicitamente herdadas por título religioso.
7. A suíte A×B testa cada classe de operação e ao menos um caso por módulo contratado.
