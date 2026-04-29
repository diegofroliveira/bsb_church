# Controle de Acesso e Perfis (RBAC)

O IgrejaPro utiliza um robusto sistema de permissões baseado em níveis de acesso (Role-Based Access Control). O bloqueio ocorre tanto em nível visual (Frontend) quanto no nível do banco de dados via RLS (Row Level Security) no Supabase.

## Níveis de Acesso

1. **`admin` ou `pastor`**: Visão completa da igreja. Tem acesso a todos os módulos, dados de todos os membros, gestão de todos os líderes e visão total da parte financeira.
2. **`secretaria`**: Acesso de gestão administrativa. Pode visualizar tudo relacionado a Membros, Eventos, Células e Discipuladores, porém **não** possui acesso ao módulo Financeiro.
3. **`financeiro`**: Acesso restrito e exclusivo aos painéis e relatórios de finanças. A página principal dele esconde indicadores de células/membros e prioriza as métricas financeiras.
4. **`lider`**: O acesso mais granular do sistema. Líderes de célula ou discipuladores só conseguem visualizar os membros que estão cadastrados exatamente no seu respectivo grupo/célula. Eles utilizam o sistema principalmente para realizar chamadas (presença) e consultar dados básicos do seu pequeno grupo.

---

## Como Criar e Gerenciar Usuários

Os usuários são criados diretamente no painel do Supabase, no módulo **Authentication**.

### Fluxo de Criação Automática (Triggers)
Sempre que você cria um usuário no `auth.users` do Supabase, uma **Trigger SQL** (programada durante o setup inicial) escuta esse evento e automaticamente gera um registro complementar na tabela pública `profiles`.

```sql
-- Resumo do comportamento da Trigger:
INSERT INTO public.profiles (id, name, role)
VALUES (new.id, new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'role');
```

Para definir o nível de acesso (Role) durante a criação do usuário no painel do Supabase, você precisa enviar o dado meta-data. 
Mas caso tenha criado sem enviar os metadados, basta:
1. Ir no Supabase > Table Editor.
2. Abrir a tabela `profiles`.
3. Editar a coluna `role` do usuário para um dos 4 níveis acima (em texto minúsculo).
4. Para líderes, preencher também a coluna `group_id` com o nome exato da célula que ele lidera.

---

## Proteção no Frontend (React)

No frontend, a verificação é feita utilizando o componente `ProtectedRoute.tsx` junto com o contexto de Autenticação (`AuthContext.tsx`).

Se um líder tentar acessar uma URL proibida (como `/finance`), o componente de rota identifica a role no `Profile` recém-buscado do banco e bloqueia o acesso, redirecionando o usuário devolta para o `Dashboard`.
