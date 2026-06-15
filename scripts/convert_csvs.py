import os
import re
import json
import unicodedata
import pandas as pd

def remove_accents(input_str):
    if not isinstance(input_str, str):
        input_str = str(input_str or "")
    nfkd_form = unicodedata.normalize("NFKD", input_str)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)])

def clean_column_name(col):
    col = col.lower().strip()
    col = remove_accents(col)
    col = re.sub(r"[^\w\s]", "", col)
    col = re.sub(r"\s+", "_", col)
    return col

def read_csv_with_fallback(path):
    try:
        return pd.read_csv(path, encoding="utf-8-sig")
    except Exception:
        try:
            return pd.read_csv(path, encoding="latin1", sep=";")
        except Exception:
            return pd.read_csv(path, encoding="cp1252")

def convert_file(csv_name, json_name):
    csv_path = os.path.join("dados_exportados", csv_name)
    if not os.path.exists(csv_path):
        print(f"Skipping {csv_name} (does not exist)")
        return
    
    print(f"Converting {csv_name}...")
    df = read_csv_with_fallback(csv_path)
    df.columns = [clean_column_name(c) for c in df.columns]
    
    import math
    def clean_records(obj):
        if isinstance(obj, list):
            return [clean_records(x) for x in obj]
        elif isinstance(obj, dict):
            return {k: clean_records(v) for k, v in obj.items()}
        elif isinstance(obj, float) and math.isnan(obj):
            return None
        return obj
        
    records = clean_records(df.to_dict(orient="records"))
    
    os.makedirs(os.path.join("public", "data"), exist_ok=True)
    json_path = os.path.join("public", "data", json_name)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(records)} records to {json_path}")

def main():
    convert_file("celulas_participantes.csv", "celulas_participantes.json")
    convert_file("pessoas_funcoes.csv", "pessoas_funcoes.json")
    convert_file("localidade_participantes.csv", "localidade_participantes.json")
    convert_file("eventos_inscricoes.csv", "eventos_inscricoes.json")
    print("CSV conversion complete.")

if __name__ == "__main__":
    main()
