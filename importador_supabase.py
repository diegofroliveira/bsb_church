import os
import pandas as pd
import re
import httpx
import unicodedata

# ─────────────────────────────────────────────
#  CONFIGURAÇÕES DO SUPABASE
# ─────────────────────────────────────────────
SUPABASE_URL = "https://vadufkgbluisdamgkbln.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhZHVma2dibHVpc2RhbWdrYmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NjE2NDksImV4cCI6MjA5MjQzNzY0OX0.40XwaADEKukkhuLqcQQnNpx-6a1ipKnz_4Fy8DJdrao"
INPUT_DIR = "dados_exportados"

MAP_TABELAS = {
    "membros.csv": "membros",
    "celulas.csv": "celulas",
    "financeiro.csv": "financeiro",
    "eventos.csv": "eventos",
    "discipulado.csv": "discipulado",
    "orcamento.csv": "orcamento"
}

def remove_accents(input_str):
    nfkd_form = unicodedata.normalize('NFKD', input_str)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)])

def clean_column_name(col):
    col = col.lower().strip()
    col = remove_accents(col)
    col = re.sub(r'[^\w\s]', '', col)
    col = re.sub(r'\s+', '_', col)
    if col == "google_": col = "google_plus"
    if col == "esposoa": col = "esposo_a"
    return col

def main():
    print("🚀 Iniciando importador Inteligente (Auto-discovery de colunas)...")
    
    with httpx.Client(verify=False, headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}) as client:
        
        for file_name, table_name in MAP_TABELAS.items():
            path = os.path.join(INPUT_DIR, file_name)
            if not os.path.exists(path): continue
            
            print(f"\n📊 Analisando {file_name} -> Tabela '{table_name}'...")
            
            # 1. Descobrir quais colunas existem de fato no Supabase para esta tabela
            # Fazemos uma chamada OPTIONS para pegar a definição da tabela
            url = f"{SUPABASE_URL}/rest/v1/{table_name}"
            res_info = client.options(url)
            
            # Se o OPTIONS não retornar o que queremos, tentamos pegar um registro vazio
            # mas vamos usar a estratégia de erro controlada se o OPTIONS falhar
            colunas_no_banco = []
            if res_info.status_code == 200:
                try:
                    # O PostgREST retorna a estrutura no corpo ou headers as vezes
                    # Vamos tentar simplificar: Se der erro de coluna, removemos a coluna e tentamos de novo
                    pass
                except: pass

            try:
                try:
                    df = pd.read_csv(path, encoding="utf-8-sig", sep=None, engine="python")
                except:
                    df = pd.read_csv(path, encoding="latin1", sep=";")
                
                df.columns = [clean_column_name(c) for c in df.columns]
                df = df.fillna("")
                
                # REMOVE DUPLICADOS DE ID (Causa erro 500 no UPSERT se o lote tiver o mesmo ID duas vezes)
                if "id" in df.columns:
                    antes = len(df)
                    df = df.drop_duplicates(subset=["id"], keep="first")
                    depois = len(df)
                    if antes != depois:
                        print(f"  ♻ Removidos {antes - depois} IDs duplicados do arquivo.")

                # DEDUPLICAÇÃO ESPECIAL PARA DISCIPULADO
                # Como o Prover gera novos id_serial a cada exportação, usamos
                # a chave natural (discipulador, discipulo) para evitar duplicatas
                if table_name == "discipulado":
                    chave_natural = [c for c in ["discipulador", "discipulo"] if c in df.columns]
                    if chave_natural:
                        antes = len(df)
                        df = df.drop_duplicates(subset=chave_natural, keep="first")
                        depois = len(df)
                        if antes != depois:
                            print(f"  ♻ Removidos {antes - depois} vínculos duplicados de discipulado.")
                        # Remove id_serial para evitar conflito de chave no UPSERT
                        if "id_serial" in df.columns:
                            df = df.drop(columns=["id_serial"])
                            print(f"  ✂ Removendo id_serial do discipulado (será gerado pelo banco).")

                if table_name == "eventos":
                    if "id_serial" in df.columns: df = df.drop(columns=["id_serial"])

                # Estratégia de "Auto-Cura": 
                # Começamos com todas as colunas. Se o Supabase reclamar de uma, 
                # a gente remove e tenta de novo o lote.
                
                registros = df.to_dict(orient="records")
                batch_size = 100
                
                colunas_invalidas = set()
                
                # ESTRATÉGIA ESPECIAL PARA DISCIPULADO: apaga tudo e reinseere
                # Isso garante que o banco sempre reflita exatamente o que veio do Prover
                if table_name == "discipulado":
                    print("  🗑 Limpando tabela discipulado antes de reinserir...")
                    client.delete(
                        url,
                        params={"id_serial": "gt.0"},  # PostgREST precisa de um filtro
                        headers={"Prefer": "return=minimal"}
                    )

                i = 0
                while i < len(registros):
                    batch = registros[i:i+batch_size]
                    
                    # Filtra apenas colunas que não marcaram como inválidas
                    batch_filtrado = []
                    for reg in batch:
                        batch_filtrado.append({k: v for k, v in reg.items() if k not in colunas_invalidas})

                    res = client.post(
                        url, 
                        json=batch_filtrado, 
                        headers={"Prefer": "resolution=merge-duplicates"}
                    )
                    
                    if res.status_code in [200, 201]:
                        print(f"  ✓ Lote {i//batch_size + 1} enviado.")
                        i += batch_size
                    elif res.status_code == 400:
                        try:
                            err_json = res.json()
                            msg = err_json.get("message", "")
                        except:
                            msg = res.text
                        
                        print(f"  ⚠ Mensagem de erro: {msg}")
                        
                        # O PostgREST costuma retornar: Could not find the 'coluna' column...
                        # Tentativa 1: Entre aspas simples
                        match = re.search(r"the '(.*?)' column", msg)
                        # Tentativa 2: Entre aspas duplas
                        if not match: match = re.search(r"the \"(.*?)\" column", msg)
                        # Tentativa 3: Qualquer coisa antes da palavra 'column'
                        if not match: match = re.search(r"find the (.*?) column", msg)
                        
                        if match:
                            col_ruim = match.group(1).replace("'", "").replace('"', "").strip()
                            print(f"  ✂ Removendo coluna inexistente: '{col_ruim}'")
                            colunas_invalidas.add(col_ruim)
                        else:
                            print(f"  ✗ Não consegui identificar a coluna no erro.")
                            break
                    else:
                        print(f"  ✗ Erro inesperado: {res.status_code} - {res.text}")
                        break
                        
            except Exception as e:
                print(f"  ✗ Erro ao processar arquivo: {e}")

    print("\n✅ PROCESSO DE IMPORTAÇÃO FINALIZADO")

if __name__ == "__main__":
    main()
