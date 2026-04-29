import os
import requests
from requests.auth import HTTPBasicAuth
import json
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ==========================================
# CONFIGURAÇÕES - PREENCHA SEUS DADOS AQUI
# ==========================================
JIRA_URL = "https://sark-live.atlassian.net"
EMAIL = "diego.fjddf@gmail.com"
API_TOKEN = "SEU_TOKEN_AQUI"
PROJECT_KEY = "CHC"

# Confluence Space Key (geralmente é o mesmo do projeto Jira)
SPACE_KEY = "IP" 

# ==========================================

auth = HTTPBasicAuth(EMAIL, API_TOKEN)
headers = {
    "Accept": "application/json",
    "Content-Type": "application/json"
}

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
        print(f"[OK] Ticket criado no Jira: {title}")
    else:
        print(f"[ERRO] Erro ao criar no Jira: {response.text}")

def create_confluence_page(title, body):
    url = f"{JIRA_URL}/wiki/rest/api/content"
    
    # Tentaremos enviar o markdown dentro de uma macro ou corpo básico
    # A API v1 do Confluence usa o 'storage' format (HTML). 
    # Para simplificar, faremos um wrapper básico.
    html_body = f"<h1>{title}</h1><pre>{body}</pre>"

    payload = json.dumps({
        "type": "page",
        "title": title,
        "space": {"key": SPACE_KEY},
        "body": {
            "storage": {
                "value": html_body,
                "representation": "storage"
            }
        }
    })

    response = requests.post(url, data=payload, headers=headers, auth=auth, verify=False)
    
    if response.status_code == 200:
        print(f"[OK] Página criada no Confluence: {title}")
    else:
        print(f"[ERRO] Erro ao criar no Confluence: {response.text}")

def main():
    if EMAIL == "SEU_EMAIL_AQUI" or API_TOKEN == "SEU_API_TOKEN_AQUI":
        print("⚠️ ERRO: Você precisa preencher o seu EMAIL e API_TOKEN dentro deste arquivo antes de rodar!")
        return

    docs_dir = os.path.join(os.path.dirname(__file__))
    files = [f for f in os.listdir(docs_dir) if f.endswith(".md")]

    if not files:
        print("Nenhum arquivo .md encontrado na pasta atual.")
        return

    print("Iniciando a exportação...")
    for filename in files:
        filepath = os.path.join(docs_dir, filename)
        with open(filepath, "r", encoding="utf-8") as file:
            content = file.read()
            title = f"Doc: {filename.replace('.md', '').replace('_', ' ').title()}"
            
            # Criar no Jira (comentado pois já foram criados na execução anterior)
            # create_jira_issue(title, content)
            
            # Criar no Confluence
            create_confluence_page(title, content)

    print("\n[SUCESSO] Importação finalizada!")

if __name__ == "__main__":
    main()
