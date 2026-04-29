# Manual de Configuração (Setup Guide)

Este guia cobre a configuração inicial do ambiente de desenvolvimento, tanto para a camada de visualização (React/Frontend) quanto para os scripts de extração de dados (Python).

## 1. Pré-requisitos
Certifique-se de ter as seguintes ferramentas instaladas em sua máquina local:
- [Node.js](https://nodejs.org/en/) (Versão 18.x ou superior)
- [Python](https://www.python.org/downloads/) (Versão 3.10 ou superior)
- Git

## 2. Configurando o Ambiente de Automação (Backend em Python)

Os scripts responsáveis por logar no sistema Prover, baixar dados, tratar e jogar para o Supabase dependem de diversas bibliotecas. Siga os passos:

1. Acesse o diretório do projeto:
   ```bash
   cd prover-dashboard
   ```
2. Crie e ative um ambiente virtual (`venv`):
   **No Windows:**
   ```powershell
   python -m venv venv
   .\venv\Scripts\activate
   ```
   **No Mac/Linux:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Instale as bibliotecas necessárias do Python:
   ```bash
   pip install playwright pandas openpyxl supabase httpx beautifulsoup4
   ```
4. Instale os navegadores do Playwright (usados na extração invisível):
   ```bash
   playwright install chromium
   ```

## 3. Configurando o Ambiente de Interface (Frontend em React)

A interface do painel precisa das suas próprias dependências do ecossistema JavaScript/Node.

1. Ainda no diretório raiz do `prover-dashboard`, instale os pacotes:
   ```bash
   npm install
   ```

## 4. Variáveis de Ambiente e Conexão Supabase

O projeto precisa se conectar ao Supabase tanto via Python (para escrita) quanto via React (para leitura e autenticação).

1. Crie um arquivo chamado `.env.local` na raiz do seu projeto.
2. Adicione as chaves que se encontram no seu painel do Supabase (Project Settings > API):
   ```text
   VITE_SUPABASE_URL=https://vadufkgbluisdamgkbln.supabase.co
   VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY_AQUI
   ```

> **Atenção:** As chaves que começam com `VITE_` são expostas para a aplicação web por necessidade de uso do cliente Supabase. Nenhuma operação crítica e destrutiva é permitida usando apenas a `ANON_KEY` sem que haja um usuário logado validado pelo RLS (Row Level Security) do banco.

## 5. Rodando o Projeto Localmente

Para iniciar o servidor local de testes e visualizar alterações no Dashboard:

```bash
npm run dev
```
O sistema estará disponível em `http://localhost:5173`. Para acessá-lo, utilize o e-mail e senha de um usuário cadastrado no painel de Auth do seu projeto no Supabase.
