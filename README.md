# ⛪ IgrejaPro Dashboard

Sistema inteligente de BI e Gestão para Igrejas, integrado ao Sistema Prover e Supabase.

## 🚀 Como começar no novo ambiente

Se você acabou de clonar este repositório para uma nova pasta ou drive (ex: Google Drive), siga estes passos:

### 1. Configurar Backend (Python)
Os scripts de extração e importação precisam de um ambiente virtual:
```powershell
python -m venv venv
.\venv\Scripts\activate
pip install playwright pandas openpyxl supabase httpx beautifulsoup4
playwright install chromium
```

### 2. Configurar Frontend (React)
Instale as dependências do Node.js:
```powershell
npm install
```

### 3. Variáveis de Ambiente
Crie um arquivo `.env.local` na raiz do projeto com as suas chaves do Supabase:
```text
VITE_SUPABASE_URL=https://vadufkgbluisdamgkbln.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY_AQUI
```

---

## 🔄 Sincronização de Dados

Para atualizar os dados do dashboard com as informações mais recentes do Sistema Prover, basta rodar o comando:
```powershell
.\venv\Scripts\python.exe run_sync.py
```
Este comando executa automaticamente:
1.  **Extração:** Faz login via Playwright no Prover e baixa os CSVs.
2.  **Importação:** Lê os CSVs, remove duplicatas e faz o UPSERT no Supabase.

---

## 🛠 Estrutura do Banco (Supabase)

Para o sistema funcionar, as tabelas abaixo devem existir no seu Supabase. Rode estes scripts no **SQL Editor**:

<details>
<summary>Clique para ver os Scripts SQL</summary>

```sql
-- Tabelas Principais (Membros, Celulas, Financeiro, Eventos, Discipulado)
-- Nota: O importador ajusta as colunas automaticamente.

CREATE TABLE membros (id BIGINT PRIMARY KEY, nome TEXT, status TEXT, tipo_cadastro TEXT);
CREATE TABLE celulas (id BIGINT PRIMARY KEY, grupo_caseiro TEXT, lider TEXT);
CREATE TABLE financeiro (id BIGINT PRIMARY KEY, valor TEXT, tipo TEXT, data DATE);
CREATE TABLE eventos (id_serial BIGSERIAL PRIMARY KEY, pessoa TEXT, localidade TEXT);
CREATE TABLE discipulado (id_serial BIGSERIAL PRIMARY KEY, mestre TEXT, discipulo TEXT, status TEXT);

-- Tabela de Perfis de Usuário (Auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  role TEXT DEFAULT 'pastor',
  group_id TEXT,
  avatar TEXT
);

-- Trigger para criar perfil automático
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (new.id, new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'role');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```
</details>

---

## ☁️ Deploy (Vercel)

Para colocar o sistema online e acessível de qualquer lugar:
1.  Instale a Vercel CLI: `npm install -g vercel`
2.  Execute `vercel` para configurar o projeto.
3.  Adicione as chaves: `vercel env add VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4.  Execute o deploy final: `vercel --prod`

---

## 📦 Tecnologias Utilizadas
*   **Frontend:** React, TypeScript, Vite, TailwindCSS, Recharts, Lucide Icons.
*   **Banco de Dados & Auth:** Supabase.
*   **Automação:** Python, Playwright, Pandas.
*   **Hospedagem:** Vercel.
