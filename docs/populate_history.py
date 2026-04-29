import requests
from requests.auth import HTTPBasicAuth
import json
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

EMAIL = "diego.fjddf@gmail.com"
API_TOKEN = "SEU_TOKEN_AQUI"
PROJECT_KEY = "CHC"
SPACE_KEY = "IP"
JIRA_URL = "https://sark-live.atlassian.net"

auth = HTTPBasicAuth(EMAIL, API_TOKEN)
headers = {
    "Accept": "application/json",
    "Content-Type": "application/json"
}

historico_jira = [
    {
        "title": "[Feature] Integração e Banco de Dados (Supabase + Python)",
        "desc": "Migração da base de dados para Supabase (PostgreSQL). Criação de scripts em Python usando Playwright para extração headless do sistema Prover, além de rotinas ETL com Pandas para tratar duplicações e padronizar o schema para UPSERT automático."
    },
    {
        "title": "[Feature] Módulo de Relatórios (Secretaria)",
        "desc": "Desenvolvimento do módulo de relatórios focado na Secretaria da igreja. Permite visualizar lista completa de membros ativos/inativos, células, e exportação precisa de planilhas CSV prontas para impressão ou análise no Excel."
    },
    {
        "title": "[Feature] Controle de Acesso e Segurança (RBAC)",
        "desc": "Implementação do sistema de permissões baseadas em Role (Admin, Pastor, Secretaria, Financeiro e Líder de Célula). Integração com o middleware React para bloquear rotas proibidas (ex: acesso financeiro oculto para secretárias) e triggers no banco para auto-associação de perfil."
    },
    {
        "title": "[Feature] Módulo de QA & Auditoria de Dados",
        "desc": "Construção do módulo interno de QA, capaz de varrer a base de membros extraída buscando inconsistências de cadastro (ex: células sem líder, CPFs inválidos, etc.) gerando relatórios de correção."
    },
    {
        "title": "[Feature] Dashboard Interativo e Widgets em Tempo Real",
        "desc": "Refinamento visual do Dashboard principal. Criação dos widgets de 'Discipuladores' e 'Setores' extraindo dados em tempo real. Correção da funcionalidade de 'Ver Detalhes' para os Pequenos Grupos (GCs)."
    },
    {
        "title": "[Bugfix] Integridade de Dados e Leitura de Datas",
        "desc": "Resolução de um bug crônico na leitura do formato de datas brasileiro (DD/MM/AAAA) vindas do sistema Prover que causava corrupção de dados ao tentar converter para ISO. Além disso, foi resolvida a inconsistência na paginação das tabelas React."
    }
]

release_notes_html = """
<h1>Release Notes v1.0 - Lançamento IgrejaPro</h1>
<p>Nesta primeira versão major do IgrejaPro, estabilizamos a gestão e visualização de dados da igreja ao integrar profundamente o painel legado (Prover) com uma stack moderna em Nuvem.</p>
<hr/>
<h2>✨ Novidades e Funcionalidades</h2>
<ul>
<li><strong>Dashboards Interativos:</strong> Indicadores ao vivo de Membros, Visitantes, Financeiro e Saúde de Células.</li>
<li><strong>Automação Completa (Robô de Extração):</strong> Scripts Python extraindo dados automaticamente e fazendo a higienização com Pandas para o banco de dados.</li>
<li><strong>Controle de Acesso (RBAC):</strong> Níveis granulares de proteção para Pastor, Admin, Secretaria, Financeiro e Líder de Célula.</li>
<li><strong>Módulo QA e Auditoria:</strong> Ferramenta para gestores encontrarem facilmente membros com cadastro faltante ou inconsistente.</li>
<li><strong>Relatórios Otimizados:</strong> Exportações rápidas em CSV refletindo perfeitamente a estrutura de liderança.</li>
</ul>
<hr/>
<h2>🐛 Correções e Estabilizações</h2>
<ul>
<li>Resolvido problema de paginação nas tabelas grandes.</li>
<li>Resolvido corrompimento de datas devido ao timezone do Brasil e formato DD/MM/AAAA.</li>
<li>Corrigido a função "Ver Detalhes" para listagem correta de membros dos Grupos de Crescimento.</li>
</ul>
<p><em>Este sistema representa um salto imenso na agilidade e segurança da informação para a liderança.</em></p>
"""

def create_jira_issue(title, description):
    url = f"{JIRA_URL}/rest/api/2/issue"
    payload = json.dumps({
        "fields": {
            "project": {"key": PROJECT_KEY},
            "summary": title,
            "description": description,
            "issuetype": {"name": "Task"}
        }
    })
    response = requests.post(url, data=payload, headers=headers, auth=auth, verify=False)
    if response.status_code == 201:
        print(f"[OK] Ticket Histórico criado: {title}")
    else:
        print(f"[ERRO] Falha ao criar ticket: {response.text}")

def create_confluence_page(title, body_html):
    url = f"{JIRA_URL}/wiki/rest/api/content"
    payload = json.dumps({
        "type": "page",
        "title": title,
        "space": {"key": SPACE_KEY},
        "body": {
            "storage": {
                "value": body_html,
                "representation": "storage"
            }
        }
    })
    response = requests.post(url, data=payload, headers=headers, auth=auth, verify=False)
    if response.status_code == 200:
        print(f"[OK] Página de Release Notes criada: {title}")
    else:
        print(f"[ERRO] Falha ao criar página: {response.text}")

def main():
    print("Enviando backlog histórico para o Jira...")
    for item in historico_jira:
        create_jira_issue(item['title'], item['desc'])
        
    print("\nEnviando Release Notes para o Confluence...")
    create_confluence_page("Release Notes v1.0 - IgrejaPro", release_notes_html)
    print("\n[SUCESSO] Operação finalizada!")

if __name__ == "__main__":
    main()
