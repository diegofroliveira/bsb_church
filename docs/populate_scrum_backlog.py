import requests
from requests.auth import HTTPBasicAuth
import json
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

EMAIL = "diego.fjddf@gmail.com"
API_TOKEN = "ATATT3xFfGF0RKl7dKetWZ0bSZBFUjiPBX7g6ZNWP43ycoKY3bg1gg4i7DoVluHJRuBrEHo20F4kFOc9Hp4vdq0f65Ru58N5Y3IjLv2unRFLfULnTQhHr4fjrUvUVmMiJI_Wh9sGrjeHSK5SLyg83hrx7Ya1ZISGDQ332mvoA_-mN-9IQLRGfaE=01163D3B"
PROJECT_KEY = "CHC"
JIRA_URL = "https://sark-live.atlassian.net"
ACCOUNT_ID = "70121:cc3fee71-9441-4291-b9f6-da340eddbfe2"

auth = HTTPBasicAuth(EMAIL, API_TOKEN)
headers = {
    "Accept": "application/json",
    "Content-Type": "application/json"
}

# Histórias completas de ponta a ponta
backlog = [
    # Epic 1: Discovery & PoC
    {"title": "[Discovery] Pesquisa de Viabilidade Técnica (Extração vs API)", "desc": "Analisar as rotas do Sistema Prover. Conclusão: não há API aberta, precisaremos fazer Web Scraping usando uma linguagem robusta."},
    {"title": "[Discovery] Desenvolvimento do script PoC com Python", "desc": "Criar a prova de conceito em Python usando BeautifulSoup/Requests para tentar baixar as planilhas CSV do Prover."},
    {"title": "[Discovery] Identificação do bloqueio e adoção do Playwright", "desc": "A rota do Prover usa carregamento dinâmico. Foi necessário pivotar de Requests para Playwright (Headless Browser) para renderizar a página antes da extração."},
    
    # Epic 2: Engenharia de Dados
    {"title": "[Engenharia] Criação do ambiente Supabase e Modelagem de Dados", "desc": "Setup inicial do Supabase, criação das tabelas Membros, Células, Eventos, Financeiro, e Auth Profiles."},
    {"title": "[Engenharia] Script de Limpeza com Pandas", "desc": "Desenvolver script para converter datas do formato DD/MM/AAAA (Brasil) para ISO, e remover duplicatas dos CSVs baixados pelo Playwright."},
    {"title": "[Engenharia] Rotina de Sincronização e UPSERT automático", "desc": "Implementação da técnica de UPSERT via `supabase-py` para atualizar dados existentes sem criar duplicatas fantasmas."},
    
    # Epic 3: Frontend e Visualização
    {"title": "[Frontend] Setup do ecossistema React, Vite e TailwindCSS", "desc": "Inicialização do projeto `prover-dashboard` usando React e estilização moderna via Tailwind."},
    {"title": "[Frontend] Dashboard Executivo", "desc": "Criação dos KPIs em tela: Número de membros ativos, GCs em andamento, e painel financeiro sumariado."},
    {"title": "[Frontend] Módulo de Relatórios (Secretaria)", "desc": "Aba restrita para secretários que mostra tabelas e exporta dados formatados limpos via CSV no navegador."},
    {"title": "[Frontend] Módulo de QA & Auditoria de Dados", "desc": "Filtro avançado para que pastores/líderes verifiquem quais membros estão com cadastros faltantes e precisando de correção no Prover original."},
    
    # Epic 4: Segurança, Acessos e Implantação
    {"title": "[Segurança] Controle de Acesso Baseado em Perfis (RBAC)", "desc": "Criação da lógica de segurança com 4 roles principais: Admin/Pastor, Secretaria, Financeiro e Líder de Célula."},
    {"title": "[Segurança] Proteção de Rotas (React) e RLS (Banco)", "desc": "Bloquear navegação indevida no Frontend e aplicar regras de Row Level Security no Supabase para garantir isolamento de dados."},
    {"title": "[Deploy] Configuração e Lançamento na Vercel", "desc": "Realizar o build de produção via Vite e hospedar a aplicação web na plataforma de borda da Vercel para acesso rápido."},
]

def create_issue(title, description):
    url = f"{JIRA_URL}/rest/api/2/issue"
    payload = json.dumps({
        "fields": {
            "project": {"key": PROJECT_KEY},
            "summary": title,
            "description": description,
            "issuetype": {"name": "Task"},
            "assignee": {"accountId": ACCOUNT_ID}
        }
    })
    res = requests.post(url, data=payload, headers=headers, auth=auth, verify=False)
    if res.status_code == 201:
        return res.json()["key"]
    else:
        print(f"[ERRO] Falha ao criar {title}: {res.text}")
        return None

def transition_to_done(issue_key):
    url_trans = f"{JIRA_URL}/rest/api/2/issue/{issue_key}/transitions"
    res = requests.get(url_trans, headers=headers, auth=auth, verify=False)
    if res.status_code == 200:
        transitions = res.json().get("transitions", [])
        done_id = None
        for t in transitions:
            # Procura transições que significam conclusão
            name = t["name"].lower()
            to_name = t["to"]["name"].lower()
            if "conclu" in name or "done" in name or "conclu" in to_name or "done" in to_name:
                done_id = t["id"]
                break
        
        # Se não achar por nome exato, pega a última que costuma ser Done
        if not done_id and transitions:
            done_id = transitions[-1]["id"]
            
        if done_id:
            payload = json.dumps({"transition": {"id": done_id}})
            res_post = requests.post(url_trans, data=payload, headers=headers, auth=auth, verify=False)
            if res_post.status_code == 204:
                return True
    return False

def main():
    print("Iniciando a criação do Backlog de PO/SM...")
    for idx, item in enumerate(backlog):
        print(f"[{idx+1}/{len(backlog)}] Criando: {item['title']}")
        issue_key = create_issue(item['title'], item['desc'])
        if issue_key:
            print(f"    -> Ticket {issue_key} criado. Atribuído a Diego.")
            if transition_to_done(issue_key):
                print(f"    -> Ticket {issue_key} movido para Concluído (Done).")
            else:
                print(f"    -> Aviso: Não foi possível mover para Concluído.")
                
    print("\n[SUCESSO] Todo o backlog histórico foi populado, atribuído e fechado!")

if __name__ == "__main__":
    main()
