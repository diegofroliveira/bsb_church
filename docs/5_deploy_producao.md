# Deploy e Produção

O IgrejaPro utiliza uma arquitetura descentralizada. O banco de dados fica no **Supabase** (que é SaaS e não requer manutenção local) e o Frontend fica hospedado na **Vercel** (ideal para aplicações construídas com Vite/React).

Este guia detalha os passos para colocar e manter o painel web no ar.

## 1. Preparando o Projeto para o Vercel

A Vercel suporta o deploy automático via Github ou via linha de comando (`Vercel CLI`).

Recomendamos o deploy usando a CLI pela simplicidade e integração direta:

1. No terminal do seu computador, instale a Vercel CLI globalmente:
   ```bash
   npm install -g vercel
   ```
2. Logue com a sua conta da Vercel:
   ```bash
   vercel login
   ```

## 2. Realizando o Primeiro Deploy

1. Navegue até a raiz do seu projeto `prover-dashboard`:
   ```bash
   cd prover-dashboard
   ```
2. Inicie o processo de configuração executando:
   ```bash
   vercel
   ```
   A CLI fará as seguintes perguntas:
   - *Set up and deploy?* (Yes)
   - *Which scope do you want to deploy to?* (Selecione o seu usuário)
   - *Link to existing project?* (No)
   - *What's your project's name?* (igrejapro-dashboard ou prover-dashboard)
   - *In which directory is your code located?* (Pressione Enter para a raiz `./`)
   - *Want to override the settings?* (No. Ele já detectará que é um projeto Vite e configurará automaticamente `npm run build` e a pasta de saída `dist`).

## 3. Inserindo as Variáveis de Ambiente na Vercel

O painel no ar precisa se comunicar com o Supabase. Você precisa adicionar as variáveis que estão no seu `.env.local` também lá na Vercel.

Você pode fazer isso pela interface do site da Vercel (Settings > Environment Variables) ou direto pelo terminal executando:
```bash
vercel env add VITE_SUPABASE_URL
```
*(Cole o link)*

```bash
vercel env add VITE_SUPABASE_ANON_KEY
```
*(Cole a chave anônima)*

## 4. Deploy Final de Produção

Sempre que você fizer alterações no código do projeto local, para mandar essas alterações "pro ar", execute o comando de produção:

```bash
vercel --prod
```

Após o término da compilação e upload (em torno de 1-2 minutos), a CLI retornará o link de produção definitivo. O IgrejaPro estará acessível de qualquer navegador ou celular!
