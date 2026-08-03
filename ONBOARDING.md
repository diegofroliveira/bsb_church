# 👋 Onboarding — IgrejaPro Dashboard

Bem-vindo(a) ao projeto! Este guia existe para você conseguir rodar o sistema
localmente, entender como as peças se encaixam e saber onde mexer com
segurança. Leia do início ao fim antes do primeiro PR.

---

## 1. O que é este projeto

O **IgrejaPro Dashboard** é um sistema de BI e gestão para igrejas. Ele:

- Sincroniza dados do **Sistema Prover** (plataforma de gestão eclesiástica
  usada pela igreja) para o **Supabase** (Postgres + Auth).
- Expõe um **dashboard React** com visões diferentes por papel de usuário:
  membros, células/GCs, financeiro, discipulado, aniversariantes,
  georreferenciamento, "Consultor IA", relatórios, etc.
- Tem módulos experimentais em `/lab/*` ("LAB") para visões de liderança e
  consultas ad-hoc, restritos a `admin`/`pastor`.

Fluxo geral:

```
Sistema Prover  --(Playwright, login+scrape)-->  CSVs locais
      CSVs      --(pandas, UPSERT)-->             Supabase (Postgres)
   Supabase     --(Supabase JS / REST)-->          Dashboard React (Vercel)
```

---

## 2. Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite + TailwindCSS v4 + Recharts + Leaflet |
| Roteamento | React Router v7 |
| Backend/Auth/DB | Supabase (Postgres + Auth + RLS) |
| Serverless API | Funções em `api/*.js` (rodam na Vercel) |
| Automação de dados | Python 3 + Playwright + pandas + openpyxl |
| Deploy | Vercel |
| CI | GitHub Actions (`.github/workflows/sync_prover.yml`) — roda a sincronização todo domingo às 03:00 (horário de Brasília) |

---

## 3. Estrutura de pastas

```
src/
  pages/        Uma página por rota (Dashboard, Members, Finance, ...)
  layouts/      MainLayout.tsx — shell com sidebar/menu, filtra itens por role
  components/   Componentes compartilhados (ProtectedRoute, LabLauncher, ...)
  context/      AuthContext.tsx — sessão Supabase + mapeamento de Role
  lib/          supabase.ts (clients), operationalScope.ts, populationScope.ts, geoUtils.ts
  hooks/        useFamilyEngine, useLabShortcut
api/            Funções serverless da Vercel (criação/reset de usuário, trigger de sync, etc.)
scripts/        Pipeline Python: extrator_prover.py, importador_supabase.py, convert_csvs.py
sql/            Scripts SQL para rodar manualmente no SQL Editor do Supabase
LAB/            Material de apoio e SQL dos módulos experimentais "Lab"
run_sync.py     Orquestra extração + importação (chamado localmente ou pelo GitHub Actions)
```

---

## 4. Configurando o ambiente local

### Pré-requisitos
- Node.js 20+ (o projeto foi desenvolvido com Node 22)
- Python 3.10+ (só necessário se for mexer nos scripts de sincronização)
- pnpm ou npm (há `pnpm-lock.yaml`, mas `package.json` usa scripts do npm — qualquer um funciona, prefira manter consistência com o lockfile existente)

### 4.1 Frontend
```bash
npm install
npm run dev        # inicia o Vite em modo dev
npm run build       # build de produção
npm run lint        # ESLint
```

### 4.2 Variáveis de ambiente
Crie um `.env.local` na raiz (já está no `.gitignore`, não vai ser commitado):
```
VITE_SUPABASE_URL=https://vadufkgbluisdamgkbln.supabase.co
VITE_SUPABASE_ANON_KEY=<peça a chave anon para o Diego>
```
> Nota: hoje `src/lib/supabase.ts` tem a URL e a anon key **hardcoded** no
> código-fonte como fallback, então o app funciona mesmo sem `.env.local`.
> A anon key do Supabase é destinada a ser pública (a segurança real vem do
> RLS no Postgres) — ainda assim, o ideal a médio prazo é centralizar tudo em
> variáveis de ambiente e não deixar chaves hardcoded no código.

### 4.3 Backend Python (opcional, só se for mexer na sincronização)
```bash
python -m venv venv
# Windows: .\venv\Scripts\activate | Linux/Mac: source venv/bin/activate
pip install playwright pandas openpyxl supabase httpx beautifulsoup4
playwright install chromium
python run_sync.py
```

### 4.4 Banco de dados (Supabase)
As tabelas principais (`membros`, `celulas`, `financeiro`, `eventos`,
`discipulado`, `profiles`) e o trigger de criação automática de perfil estão
documentados no `README.md` (seção "Estrutura do Banco"). Rode aqueles
scripts no SQL Editor do Supabase antes de usar o sistema com um banco novo.
O script `sql/leader_scope.sql` cria funções extras para o módulo "Visões de
Liderança" — rode-o só se for habilitar esse módulo.

---

## 5. Papéis de usuário (roles) e permissões

Definidos em `src/context/AuthContext.tsx` (tipo `Role`):
`admin | pastor | leader | financeiro | secretaria`

- O papel vem de `user_metadata.role` no Supabase Auth.
- `ProtectedRoute` (`src/components/ProtectedRoute.tsx`) recebe uma prop
  `allowedRoles` e redireciona para `/` se o usuário logado não tiver o papel
  permitido — veja exemplos em `src/App.tsx` (rotas `/finance`,
  `/admin/users`, `/simulations`, `/lab/*`).
- `MainLayout.tsx` filtra os itens do menu lateral com a mesma lógica de
  roles, então uma rota nova geralmente precisa de ajuste em dois lugares:
  a rota em `App.tsx` e o item do menu em `MainLayout.tsx`.
- Sessão expira automaticamente após 15 minutos de inatividade
  (`AuthContext.tsx`).

---

## 6. Pipeline de sincronização de dados

`run_sync.py` executa em sequência:
1. `scripts/extrator_prover.py` — login via Playwright no Sistema Prover,
   exporta CSVs para `dados_exportados/`.
2. `scripts/importador_supabase.py` — lê os CSVs, remove duplicatas e faz
   UPSERT nas tabelas do Supabase.

Roda automaticamente todo domingo via GitHub Actions
(`.github/workflows/sync_prover.yml`), ou manualmente com
`workflow_dispatch` pela aba Actions do GitHub. Diagnósticos de falha são
publicados como artifact (`sync_diagnostics/`).

> ⚠️ **Atenção de segurança:** `scripts/extrator_prover.py` tem hoje o e-mail
> e a senha reais de login do Sistema Prover escritos em texto puro no
> código-fonte, já commitados no histórico do Git. Recomendo fortemente:
> mover essas credenciais para variáveis de ambiente/GitHub Secrets e
> **trocar a senha do Prover**, já que ela ficou exposta no histórico do
> repositório (trocar a senha invalida qualquer cópia que possa ter vazado).
> `importador_supabase.py` está no `.gitignore` (não é versionado), mas o
> extrator está.

---

## 7. Deploy

Hospedado na Vercel:
```bash
npm install -g vercel
vercel                 # configura o projeto (primeira vez)
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel --prod          # deploy de produção
```
`vercel.json` reescreve todas as rotas (exceto `/api/*`) para `index.html`
(SPA). As funções em `api/*.js` rodam como serverless functions da própria
Vercel — não precisam de deploy separado.

---

## 8. Fluxo de trabalho / convenções

- Branches de feature/fix a partir de `main`.
- Mensagens de commit no padrão já usado no histórico: prefixo
  `feat:`, `fix:`, `chore:` + descrição curta e direta (`git log --oneline`
  para ver exemplos reais).
- Não commitar segredos novos: `.env*.local`, `scratch/`, `dados_exportados/`
  e scripts `check_*.py`/`get_*.py`/`inspect_*.py` já estão no `.gitignore`
  — use essas pastas/padrões para arquivos de teste locais.
- Rode `npm run lint` antes de abrir PR.

---

## 9. Por onde começar

1. Suba o frontend localmente (seção 4.1–4.2) e navegue pelo dashboard
   logado como `admin` para ver todos os módulos.
2. Leia `src/context/AuthContext.tsx` e `src/components/ProtectedRoute.tsx`
   para entender autenticação e controle de acesso.
3. Escolha uma página simples em `src/pages/` (ex.: `Birthdays.tsx`) para se
   familiarizar com o padrão de código antes de mexer em algo maior como
   `Members.tsx`, `Finance.tsx` ou no pipeline Python.
4. Dúvidas de arquitetura ou acesso a chaves/credenciais: fale com o Diego.
