"""
=============================================================
  EXTRATOR DE DADOS - SISTEMA PROVER (PLAYWRIGHT VERSION)
  Igreja → Google Sheets → Dashboard
=============================================================
  Refatorado para usar Playwright (contorna WAF/403)
=============================================================
"""

import os
import sys
import io
import time
import json
import pandas as pd
from datetime import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

# Garante saída UTF-8 para evitar erros de encoding no console Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# ─────────────────────────────────────────────
#  CONFIGURAÇÕES — edite aqui
# ─────────────────────────────────────────────
PROVER_EMAIL = "diego.fjddf@gmail.com"
PROVER_SENHA = "07011988"
PROVER_BASE_URL = "https://sis.sistemaprover.com.br"

# Pasta onde os CSVs serão salvos localmente
OUTPUT_DIR = "dados_exportados"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# URLs de Login e Exportação
BASE_LOGIN = f"{PROVER_BASE_URL}/login/"
EXPORT_URL = f"{PROVER_BASE_URL}/consolidado/exportacao"

# Mapeamento de módulos para termos de busca ou URLs diretas
MODULOS_EXPORT = {
    "membros": ["/backend/exportar-dados/pessoas", "cadastro de pessoas", "membros"],
    "celulas": ["/backend/exportar-dados/grupos", "grupo caseiro", "celulas"],
    "financeiro": ["/backend/exportar-dados/lancamentos", "financeiro", "lançamentos financeiros", "caixa"],
    "eventos": ["/backend/exportar-dados/ministerios-participantes", "eventos", "participantes"],
    "discipulado": ["/backend/exportar-dados/mda", "discipulado", "mda"],
    "orcamento": ["/backend/exportar-dados/orcamento", "orçamento", "budget"],
}

# ─────────────────────────────────────────────
#  FUNÇÕES AUXILIARES
# ─────────────────────────────────────────────

def fazer_login(page):
    print(f"LOGIN: Acessando pagina de login: {BASE_LOGIN}")
    page.goto(BASE_LOGIN, wait_until="networkidle")

    # Tenta preencher o e-mail/usuário
    try:
        if page.locator('input[type="email"]').is_visible():
            page.fill('input[type="email"]', PROVER_EMAIL)
        elif page.locator('input[name="username"]').is_visible():
            page.fill('input[name="username"]', PROVER_EMAIL)
        else:
            page.fill('input[name="login"]', PROVER_EMAIL)
    except:
        page.locator('input[type="text"]').first.fill(PROVER_EMAIL)

    # Preenche a senha
    page.fill('input[type="password"]', PROVER_SENHA)

    print("LOGIN: Clicando no botao de entrar...")
    page.click('button[type="submit"]')

    # Aguarda a navegação pós-login
    try:
        page.wait_for_url(lambda url: "login" not in url.lower(), timeout=15000)
        print(f"  OK: Login realizado com sucesso! URL atual: {page.url}")
        
        # Tenta fechar possíveis modais de aviso que bloqueiam a tela
        page.wait_for_timeout(3000)
        modais = page.locator('.modal-header .close, .modal-footer button, .close, .btn-close').all()
        for modal_close in modais:
            try:
                if modal_close.is_visible():
                    modal_close.click(timeout=2000)
                    print("  INFO: Modal de aviso fechado.")
            except:
                pass
        
        return True
    except PlaywrightTimeoutError:
        print("  ERRO: O login demorou muito ou falhou. Verifique as credenciais.")
        return False

def baixar_modulo(page, nome_modulo, termos):
    print(f"\nMODULO: Tentando baixar modulo: {nome_modulo.upper()}")
    
    target_url = None
    
    # 1. Tenta ver se o primeiro termo já é uma URL direta (começa com /)
    if termos[0].startswith("/"):
        target_url = PROVER_BASE_URL + termos[0]
        print(f"  URL: Usando URL direta: {target_url}")
    else:
        # 2. Caso contrário, procura na página de exportação
        page.goto(EXPORT_URL, wait_until="networkidle")
        page.wait_for_timeout(2000)
        links = page.locator("a").all()
        for link in links:
            try:
                href = link.get_attribute("href") or ""
                text = link.inner_text().strip().lower()
                if any(termo.lower() in text or (not termo.startswith("/") and termo.lower() in href.lower()) for termo in termos):
                    if any(kw in href.lower() for kw in ["export", "csv", "excel", "xlsx", "download", "dados"]):
                        if not href.startswith("http") and href:
                            target_url = PROVER_BASE_URL + href if href.startswith("/") else f"{PROVER_BASE_URL}/consolidado/{href}"
                        else:
                            target_url = href
                        print(f"  URL: Encontrado na pagina: '{text}' -> {target_url}")
                        break
            except: continue

    if target_url:
        try:
            print(f"  INFO: Baixando arquivo...")
            response = page.context.request.get(target_url)
            
            if response.status == 200:
                content_disposition = response.headers.get("content-disposition", "")
                ext = ".csv"
                if "filename=" in content_disposition.lower():
                    filename = content_disposition.lower().split("filename=")[1].strip("\"'")
                    if filename.endswith(".xlsx"): ext = ".xlsx"
                    elif filename.endswith(".xls"): ext = ".xls"
                elif ".xlsx" in target_url.lower():
                    ext = ".xlsx"
                
                path = os.path.join(OUTPUT_DIR, f"{nome_modulo}{ext}")
                with open(path, "wb") as f:
                    f.write(response.body())
                
                print(f"  OK: {nome_modulo} salvo em: {path}")
                
                # Validação
                try:
                    if ext == ".csv":
                        try:
                            df = pd.read_csv(path, encoding="utf-8-sig", sep=None, engine="python")
                        except:
                            df = pd.read_csv(path, encoding="latin1", sep=";")
                    else:
                        df = pd.read_excel(path)
                    print(f"  INFO: {len(df)} registros extraidos.")
                    return df
                except Exception as e_parse:
                    print(f"  AVISO: Arquivo baixado ({len(response.body())} bytes) mas erro ao ler: {e_parse}")
                    return pd.DataFrame()
            else:
                print(f"  ERRO no download (Status: {response.status})")
                # Se falhou a URL direta, tenta procurar na página (caso não tenha tentado ainda)
                if termos[0].startswith("/") and len(termos) > 1:
                    print("  RETRY: Tentando buscar link alternativo na página...")
                    return baixar_modulo(page, nome_modulo, termos[1:])
        except Exception as e:
            print(f"  ERRO ao processar: {e}")
    
    return None

def salvar_estrutura_json(dados: dict):
    estrutura = {}
    for modulo, df in dados.items():
        estrutura[modulo] = {
            "colunas": df.columns.tolist(),
            "total_registros": len(df),
            "amostra": df.head(3).fillna("").to_dict(orient="records"),
        }
    path = f"{OUTPUT_DIR}/estrutura_dados.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(estrutura, f, ensure_ascii=False, indent=2)
    print(f"\nINFO: Estrutura salva em {path}")

def main():
    print("=" * 60)
    print("  EXTRATOR SISTEMA PROVER (PLAYWRIGHT)")
    print(f"  {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print("=" * 60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 720}
        )
        page = context.new_page()

        try:
            if not fazer_login(page):
                browser.close()
                sys.exit(1)

            dados_finais = {}
            for modulo, termos in MODULOS_EXPORT.items():
                df = baixar_modulo(page, modulo, termos)
                if df is not None:
                    dados_finais[modulo] = df

            if dados_finais:
                salvar_estrutura_json(dados_finais)
                print("\nOK: Extracao concluida com sucesso!")
            else:
                print("\nAVISO: Nenhum dado foi baixado.")
        finally:
            browser.close()

    print("\n" + "=" * 60)
    print("OK: PROCESSO FINALIZADO")
    print("=" * 60)

if __name__ == "__main__":
    main()
