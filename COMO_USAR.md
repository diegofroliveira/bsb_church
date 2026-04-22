# 🏠 Painel da Igreja — Guia Completo de Configuração

## Arquivos entregues
| Arquivo | O que faz |
|---|---|
| `dashboard.html` | Dashboard completo com login e 4 perfis de acesso |
| `extrator_prover.py` | Script que extrai dados do Sistema Prover automaticamente |
| `COMO_USAR.md` | Este guia |

---

## PASSO 1 — Testar o dashboard agora (dados demo)

1. Abra o arquivo `dashboard.html` no Chrome/Edge
2. Use um dos logins de demonstração abaixo:

| Perfil | Usuário | Senha |
|---|---|---|
| 🕊 Pastor | `pastor.diego` | `prover2024` |
| 💰 Financeiro | `fin.ana` | `fin2024` |
| 📋 Secretaria | `sec.maria` | `sec2024` |
| 👥 Líder (Esperança) | `lider.joao` | `lid2024` |
| 👥 Líder (Família) | `lider.claudia` | `lid2024` |

---

## PASSO 2 — Extrair dados reais do Sistema Prover

### Instalar dependências
```bash
pip install requests beautifulsoup4 pandas openpyxl
```

### Rodar o extrator
```bash
python extrator_prover.py
```

O script vai:
- Fazer login no sis.sistemaprover.com.br
- Tentar exportar Membros, Células, Financeiro e Eventos
- Salvar CSVs na pasta `dados_exportados/`
- Salvar o HTML da página de exportação para análise

> **⚠ Primeira execução:** O script vai tentar vários endpoints automaticamente.
> Se algum módulo não for encontrado, abra `dados_exportados/pagina_exportacao.html`
> no navegador para ver os botões de exportação disponíveis e me informe as URLs.

---

## PASSO 3 — Conectar dados reais ao dashboard

### Opção A: Google Sheets (Recomendado)

1. Crie uma planilha no Google Sheets com as abas:
   - `Membros`, `Financeiro`, `Celulas`, `Eventos`

2. Cole os dados exportados em cada aba

3. Vá em **Arquivo → Publicar na web → CSV** para cada aba e copie as URLs

4. No `dashboard.html`, localize e preencha no início do `<script>`:
```javascript
const GOOGLE_SHEET_ID = "SEU_ID_AQUI";
const GOOGLE_API_KEY  = "SUA_API_KEY_AQUI";
```

**Como obter a API Key:**
- Acesse console.cloud.google.com
- Crie projeto → Ative "Google Sheets API"
- Credenciais → Criar chave de API

**Como obter o Sheet ID:**
- É o código longo na URL da planilha
- Ex: `docs.google.com/spreadsheets/d/**SEU_ID_AQUI**/edit`

### Opção B: Atualização automática via extrator

Configure o extrator para subir para Google Sheets automaticamente:

1. Crie uma Service Account no Google Cloud Console
2. Baixe o JSON de credenciais
3. No `extrator_prover.py`, preencha:
```python
GOOGLE_CREDENTIALS_JSON = "credentials.json"
GOOGLE_SHEET_ID = "SEU_ID_AQUI"
```
4. Instale: `pip install gspread google-auth`

---

## PASSO 4 — Configurar usuários reais

No `dashboard.html`, localize a seção `USERS` e edite:
```javascript
const USERS = {
  "pastor.nome":  { senha: "senha_segura", role: "pastor",     nome: "Pr. Nome",     celula: null },
  "lider.nome":   { senha: "senha_segura", role: "lider",      nome: "Nome (Líder)", celula: "Nome Exato da Célula" },
  // ...
};
```

> **Importante para Líderes:** O campo `celula` deve ter o nome **exatamente igual**
> ao que aparece na coluna "Célula" da planilha de membros.

---

## PASSO 5 — Publicar o dashboard online (opcional)

### GitHub Pages (gratuito)
1. Crie um repositório privado no GitHub
2. Faça upload do `dashboard.html`
3. Vá em Settings → Pages → Deploy from branch
4. URL será: `https://seuusuario.github.io/nome-repo/dashboard.html`

### Netlify (gratuito)
1. Acesse netlify.com
2. Arraste a pasta `prover-dashboard` para o site
3. URL permanente gerada automaticamente

---

## PASSO 6 — Agendar extração automática

### Windows (Task Scheduler)
1. Abra "Agendador de Tarefas"
2. Nova tarefa básica → Diariamente às 6h
3. Ação: `python C:\caminho\extrator_prover.py`

### Mac/Linux (crontab)
```bash
crontab -e
# Adicione:
0 6 * * * /usr/bin/python3 /caminho/extrator_prover.py
```

---

## Níveis de Acesso — Resumo

| Perfil | O que vê |
|---|---|
| 🕊 **Pastor** | Tudo: membros, células, financeiro, eventos, relatórios |
| 📋 **Secretaria** | Membros, células, eventos (sem financeiro) |
| 💰 **Financeiro** | Apenas módulo financeiro e relatórios |
| 👥 **Líder** | Apenas sua célula e seus membros + registro de presença |

---

## Próximos passos sugeridos

- [ ] Rodar `extrator_prover.py` e verificar os dados exportados
- [ ] Preencher nomes reais dos usuários no dashboard
- [ ] Conectar ao Google Sheets com dados reais
- [ ] Publicar online via Netlify ou GitHub Pages
- [ ] Agendar extração automática diária

---

*Qualquer dúvida, me envie o arquivo `dados_exportados/pagina_exportacao.html`
ou a estrutura dos CSV exportados e ajusto o extrator e o dashboard.*
