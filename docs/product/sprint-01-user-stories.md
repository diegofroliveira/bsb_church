# Sprint 1 — Core operacional e onboarding multitenant

Status: especificação de produto para planejamento e implementação

Produto: IgrejaPro

## Objetivo da Sprint

Transformar a fundação técnica da Sprint 0 em um núcleo administrativo utilizável. Ao final da Sprint, uma organização deve conseguir concluir seu onboarding, estruturar suas unidades, convidar usuários, atribuir acessos e operar em um contexto seguro de tenant e unidade organizacional.

A Sprint não entrega cadastros de pessoas e famílias. Ela prepara o caminho seguro e compreensível para esses módulos.

## Resultado esperado

- onboarding funcional para uma igreja independente e para uma estrutura centralizada;
- administração da árvore organizacional sem ciclos ou mudança implícita de propriedade;
- convite, ativação, suspensão e encerramento de participações;
- papéis e atribuições de acesso com escopo explícito;
- troca de contexto sem vazamento de privilégios;
- visualização dos módulos disponíveis e da auditoria permitida;
- navegação orientada simultaneamente por entitlement e permissão efetiva.

## Princípios de produto

1. Tenant é a fronteira de propriedade, segurança e contratação; não é sinônimo de igreja.
2. Títulos eclesiásticos são nomes configuráveis e não concedem acesso automaticamente.
3. Um vínculo institucional não autoriza acesso a dados por si só.
4. O banco e os comandos server-side são a fonte confiável de autorização.
5. Trocar de contexto recalcula permissões; privilégios de um contexto não podem permanecer em outro.
6. O usuário deve entender em qual organização está atuando antes de executar uma ação administrativa.
7. Bloquear um módulo não apaga seus dados nem elimina direitos de portabilidade.
8. Nenhum fluxo de onboarding deve exigir preço, checkout ou integração financeira nesta Sprint.

## Personas prioritárias

| Persona | Necessidade na Sprint 1 |
|---|---|
| Responsável pelo tenant | Configurar a organização inicial e delegar administração com segurança |
| Administrador do tenant | Administrar estrutura, usuários, papéis e módulos sem receber acesso pastoral ou financeiro implícito |
| Pastor ou administrador local | Operar somente a organização ou subárvore explicitamente atribuída |
| Usuário com múltiplos vínculos | Alternar entre tenants e unidades sem misturar dados ou privilégios |
| Usuário convidado | Aceitar o convite e compreender o contexto ao qual está entrando |
| Auditor autorizado | Consultar ações administrativas dentro do escopo permitido |

## Jornadas prioritárias

### J01 — Primeiro acesso e onboarding

1. O responsável autentica sua identidade.
2. O sistema identifica uma participação ativa que ainda requer configuração inicial.
3. O responsável informa os dados institucionais mínimos e escolhe uma topologia inicial.
4. O sistema cria ou confirma a organização principal dentro do tenant provisionado.
5. O responsável pode adicionar unidades filhas, convidar a primeira equipe e revisar módulos habilitados.
6. Uma tela de revisão mostra exatamente o que será ativado.
7. A conclusão é auditada e leva o usuário ao painel no novo contexto.

O onboarding deve ser retomável. Reabrir uma etapa concluída não pode criar registros duplicados.

### J02 — Estruturar sede, regiões e localidades

1. Um usuário com `tenant.manage` abre a estrutura organizacional.
2. Ele cria uma unidade ou seleciona uma unidade existente para editar ou mover.
3. O sistema apresenta apenas pais válidos dentro do tenant.
4. Antes de mover uma subárvore, a interface apresenta origem, destino e impacto de escopo.
5. O servidor recusa autorreferência, ciclos, pai de outro tenant e operação fora do escopo.
6. A árvore é atualizada e a alteração fica auditada.

### J03 — Convidar e administrar usuário

1. Um administrador com `users.manage` informa o e-mail do convidado.
2. Seleciona papel, escopo organizacional e vigência inicial.
3. O sistema valida limite comercial, duplicidade e autoridade do administrador sobre o escopo.
4. O convite é enviado sem expor dados do tenant além do mínimo necessário.
5. Após aceite, a membership passa de `invited` para `active`.
6. Suspensão ou encerramento revoga o acesso imediatamente e preserva auditoria.

### J04 — Criar papel e atribuir acesso

1. Um administrador autorizado parte de um template ou cria um papel do tenant.
2. Define nome e descrição locais.
3. Seleciona permissões do catálogo controlado; não cria chaves arbitrárias.
4. Revisa permissões sensíveis e o escopo da atribuição.
5. O servidor valida que o administrador não está delegando além da própria autoridade.
6. A alteração invalida contextos ou caches de autorização afetados e gera auditoria.

### J05 — Alternar contexto

1. O usuário abre o seletor global de contexto.
2. Vê apenas tenants e unidades alcançáveis por memberships e assignments vigentes.
3. Seleciona outro contexto.
4. A aplicação descarta dados em memória do contexto anterior, recalcula capacidades e recarrega a rota.
5. Se a rota atual não existir no novo contexto, o usuário é levado à página inicial autorizada com explicação breve.

## Épicos e histórias de usuário

### EP-01 — Provisionamento e onboarding

#### US-01.01 — Retomar onboarding

Como responsável pelo tenant, quero retomar o onboarding do ponto salvo para concluir a configuração sem duplicar organizações ou convites.

Critérios de aceite:

- o progresso é persistido no servidor e vinculado ao tenant;
- repetir a submissão com a mesma chave idempotente não duplica registros;
- somente um responsável autorizado pode alterar o onboarding;
- etapas concluídas podem ser revistas enquanto o onboarding não estiver finalizado;
- falha parcial informa o que foi salvo e oferece nova tentativa segura;
- a conclusão registra autor, tenant, data e correlação na auditoria.

#### US-01.02 — Configurar organização principal

Como responsável pelo tenant, quero informar nome, tipo, identificador amigável e localização básica da organização principal para reconhecer meu ambiente.

Critérios de aceite:

- nome e tipo são obrigatórios;
- a organização pertence ao tenant derivado da sessão, nunca a um `tenant_id` confiado ao cliente;
- o identificador amigável é único conforme regra definida pelo backend;
- a Sprint não exige documentos fiscais, dados bancários ou cadastro pastoral;
- editar a apresentação não altera o identificador imutável nem a propriedade do tenant.

#### US-01.03 — Escolher topologia inicial

Como responsável, quero começar com uma igreja independente ou uma estrutura centralizada para que o produto represente meu modo de organização.

Critérios de aceite:

- igreja independente cria ou mantém uma organização principal;
- estrutura centralizada permite adicionar unidades abaixo da principal;
- a escolha inicial não impede evolução futura;
- federação entre tenants é apresentada como capacidade futura, sem simular acesso federado nesta Sprint;
- nenhuma topologia concede acesso nominal automaticamente.

### EP-02 — Estrutura organizacional

#### US-01.04 — Consultar árvore organizacional

Como administrador, quero visualizar a árvore no meu escopo para compreender a estrutura que posso administrar.

Critérios de aceite:

- a consulta retorna somente unidades alcançáveis no contexto ativo;
- cada item mostra nome, tipo, status e relação hierárquica;
- busca não revela nomes de unidades fora do tenant ou escopo;
- árvore vazia apresenta ação coerente com a permissão efetiva;
- estruturas extensas possuem carregamento progressivo ou paginação adequada.

#### US-01.05 — Criar e editar unidade

Como administrador autorizado, quero criar ou editar uma unidade para manter a estrutura institucional atualizada.

Critérios de aceite:

- o pai deve estar no mesmo tenant e dentro do escopo administrável;
- tipo, nome, status e vigência são validados no servidor;
- inativar uma unidade não apaga histórico nem move registros automaticamente;
- usuários sem `tenant.manage` não executam o comando mesmo forjando a requisição;
- toda criação ou alteração gera auditoria.

#### US-01.06 — Mover unidade com segurança

Como administrador autorizado, quero mover uma unidade para outro ponto da árvore sem formar ciclos ou alterar silenciosamente a propriedade dos dados.

Critérios de aceite:

- a unidade não pode ser movida para si ou para uma descendente;
- origem e destino pertencem ao mesmo tenant;
- a interface exige confirmação com resumo do impacto;
- a operação é transacional e mantém a closure table consistente;
- registros operacionais preservam seu `tenant_id` e vínculos explícitos;
- assignments afetados são recalculados imediatamente.

### EP-03 — Usuários e memberships

#### US-01.07 — Convidar usuário

Como administrador com `users.manage`, quero convidar uma pessoa por e-mail e definir seu acesso inicial para delegar trabalho sem compartilhar credenciais.

Critérios de aceite:

- senha nunca é definida pelo administrador;
- convite contém tenant, papel, escopo e vigência validados no servidor;
- e-mail já vinculado ao tenant não cria membership duplicada;
- reenvio é limitado e auditado;
- atingir `limit.active_users` impede nova ativação e preserva usuários existentes;
- convite expirado não pode ser aceito.

#### US-01.08 — Aceitar convite

Como usuário convidado, quero autenticar ou criar minha identidade e aceitar o vínculo para entrar no contexto correto.

Critérios de aceite:

- o aceite exige destinatário autenticado compatível com o convite;
- o usuário vê o nome institucional e o acesso proposto antes de aceitar;
- aceitar muda o status para `active` e registra `joined_at`;
- recusar ou expirar não concede acesso;
- um convite de tenant A não pode ser usado no tenant B.

#### US-01.09 — Suspender ou encerrar membership

Como administrador autorizado, quero suspender temporariamente ou encerrar uma participação para revogar acesso com rastreabilidade.

Critérios de aceite:

- `suspended` bloqueia imediatamente novos acessos e pode ser reativado;
- `ended` representa encerramento e preserva histórico;
- o administrador não pode remover o último responsável ativo sem transferência explícita;
- sessões/contextos afetados deixam de autorizar operações;
- motivo, autor, data e estado anterior são auditados.

#### US-01.10 — Consultar acessos de um usuário

Como administrador, quero visualizar memberships, papéis, escopos e vigências para explicar por que um usuário possui determinado acesso.

Critérios de aceite:

- a tela diferencia função ministerial, papel de acesso e membership;
- permissões efetivas são explicáveis por papel e escopo;
- dados de outros tenants não aparecem, ainda que a identidade participe deles;
- atribuições expiradas são identificadas e não contam como acesso atual.

### EP-04 — Papéis, permissões e escopos

#### US-01.11 — Gerenciar papel personalizado

Como administrador com autoridade de IAM, quero criar e editar papéis locais usando o catálogo de permissões para adaptar nomenclaturas sem alterar o modelo de segurança.

Critérios de aceite:

- código de permissão vem do catálogo global controlado;
- nome e descrição do papel são tenant-scoped;
- papel de sistema não pode ser removido ou descaracterizado por edição comum;
- permissões sensíveis apresentam alerta e confirmação;
- alteração não eleva automaticamente quem administra IAM a dados pastorais ou financeiros;
- mudanças geram auditoria e invalidam autorização em cache.

#### US-01.12 — Atribuir papel com escopo e vigência

Como administrador, quero atribuir um papel ao tenant, unidade ou subárvore permitida para aplicar menor privilégio.

Critérios de aceite:

- assignment referencia membership ativa ou convidada válida do mesmo tenant;
- unidade e papel pertencem ao mesmo tenant;
- fim da vigência é posterior ao início;
- o concedente não delega fora do próprio escopo administrável;
- remover ou expirar a atribuição interrompe sua contribuição para o acesso efetivo;
- tentativa cruzada A×B é recusada e testada.

### EP-05 — Contexto e shell do produto

#### US-01.13 — Selecionar contexto ativo

Como usuário com múltiplos vínculos, quero selecionar tenant e unidade para saber onde estou atuando e receber somente as capacidades daquele contexto.

Critérios de aceite:

- contextos são obtidos do servidor a partir de memberships e assignments vigentes;
- contexto anterior não autoriza a consulta do novo contexto;
- seleção persistida é apenas preferência e precisa ser revalidada a cada sessão;
- contexto suspenso, encerrado ou revogado não pode ser restaurado por URL ou armazenamento local;
- cabeçalho exibe tenant e unidade ativos em todas as telas autenticadas.

#### US-01.14 — Navegação por capacidade efetiva

Como usuário, quero ver somente módulos e ações disponíveis para reduzir confusão sem depender da interface para segurança.

Critérios de aceite:

- item de navegação exige módulo/entitlement e pelo menos uma permissão de entrada;
- rota direta revalida acesso no servidor;
- ausência de entitlement diferencia “módulo não disponível” de “sem permissão” sem revelar dados;
- troca de contexto recompõe a navegação e invalida consultas anteriores;
- o módulo Foundation permanece disponível nos limites da permissão.

### EP-06 — Módulos e auditoria

#### US-01.15 — Consultar módulos e limites

Como responsável pelo tenant, quero visualizar módulos habilitados, estado e limites para compreender as capacidades contratadas.

Critérios de aceite:

- são apresentados estados ativo, trial, carência, suspenso ou expirado quando aplicável;
- a tela não oferece checkout ou edição livre de entitlement nesta Sprint;
- limites exibidos informam valor, consumo disponível quando mensurável e comportamento ao atingir;
- módulo suspenso não sugere que dados foram apagados;
- permissão e contratação são explicadas como controles distintos.

#### US-01.16 — Consultar auditoria administrativa

Como auditor autorizado, quero filtrar eventos administrativos para rastrear mudanças relevantes.

Critérios de aceite:

- acesso exige `audit.read` e escopo compatível;
- filtros mínimos incluem período, ator, categoria, recurso e correlação;
- eventos exibem antes/depois de forma segura, com campos sensíveis mascarados;
- registros de auditoria não são editáveis pela interface;
- exportação em lote não faz parte desta Sprint.

## Estados de negócio

### Tenant

| Estado | Experiência esperada |
|---|---|
| `trial` | Operação conforme entitlements temporários e indicação de vigência |
| `active` | Operação normal |
| `suspended` | Operações bloqueadas; apresentar orientação sem expor conteúdo |
| `closed` | Sem operação normal; preservar canais autorizados de suporte e portabilidade |

### Membership

| Estado | Efeito |
|---|---|
| `invited` | Convite pendente, sem acesso operacional |
| `active` | Elegível para autorização conforme assignments |
| `suspended` | Acesso interrompido imediatamente, histórico preservado |
| `ended` | Vínculo encerrado, sem acesso e sem reativação implícita |

### Unidade organizacional

| Estado | Efeito |
|---|---|
| `active` | Pode compor contexto e receber operações autorizadas |
| `inactive` | Não recebe nova operação comum; histórico e vínculos permanecem consultáveis conforme regra |

## Regras transversais de erro e concorrência

- `401`: sessão ausente ou expirada; conservar apenas a intenção de navegação não sensível.
- `403`: usuário autenticado sem entitlement, permissão ou escopo; não revelar a existência de recurso inacessível.
- `404`: recurso inexistente ou deliberadamente ocultado por fronteira de acesso.
- `409`: conflito de concorrência, duplicidade, último responsável ou mudança estrutural incompatível.
- `422`: dados inválidos com mensagens associadas aos campos.
- `429`: limite de convite, reenvio ou consumo atingido.
- `5xx`: preservar correlação, não exibir payload técnico e oferecer tentativa segura quando idempotente.

Comandos de criação, convite, aceite e movimentação devem possuir proteção idempotente ou controle equivalente. Edições administrativas devem detectar versão desatualizada e evitar sobrescrita silenciosa.

## Métricas de sucesso da Sprint

- 100% das rotas administrativas verificam autorização server-side;
- 100% das tabelas novas de negócio possuem `tenant_id`, RLS forçado e policies testadas, quando aplicável;
- onboarding completo para TOP-01 e TOP-02 usando dados sintéticos;
- nenhum teste A×B retorna ou altera registros do tenant oposto;
- convite, aceite, suspensão e encerramento possuem testes de transição;
- mudança de contexto elimina dados em memória e recompõe capacidades;
- criação e movimentação de árvore impedem ciclos e referências intertenant;
- eventos críticos definidos nesta especificação aparecem na auditoria;
- fluxos prioritários atendem teclado, foco visível e leitores de tela em QA;
- tempo mediano do onboarding assistido é medido para formar baseline, sem meta comercial artificial nesta Sprint.

## Dependências

- migrations e funções de autorização da Sprint 0;
- serviço de autenticação e envio transacional para convites;
- comandos server-side para administração de usuários e operações privilegiadas;
- catálogo inicial de permissões, módulos e templates de papéis;
- definição técnica do estado retomável do onboarding;
- política de invalidação de sessão/cache após mudanças de acesso.

## Fora do escopo

- pessoas, famílias, discipulado, grupos, eventos, escalas e financeiro;
- federação funcional entre tenants e grants editáveis;
- checkout, precificação, cobrança ou alteração autônoma de plano;
- importação de dados reais do Prover;
- identidade visual definitiva ou renomeação do produto;
- suporte break-glass completo;
- aplicativo nativo.

## Definition of Done de produto

Uma história só está concluída quando regras server-side, RLS, auditoria, interface, estados vazios/erro/carregamento, acessibilidade, testes A×B, documentação e evidências de QA estiverem entregues no PR da Sprint. Demonstração visual sem proteção de dados não caracteriza conclusão.
