import os
import re
import unicodedata

import httpx
import pandas as pd


SUPABASE_URL = "https://vadufkgbluisdamgkbln.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhZHVma2dibHVpc2RhbWdrYmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NjE2NDksImV4cCI6MjA5MjQzNzY0OX0.40XwaADEKukkhuLqcQQnNpx-6a1ipKnz_4Fy8DJdrao"
INPUT_DIR = "dados_exportados"

MAP_TABELAS = {
    "membros.csv": "membros",
    "celulas.csv": "celulas",
    "financeiro.csv": "financeiro",
    "eventos.csv": "eventos",
    "discipulado.csv": "discipulado",
    "orcamento.csv": "orcamento",
    "pessoas_familiares.csv": "pessoas_familiares",
    "pessoas_historico.csv": "pessoas_historico",
}


def remove_accents(input_str):
    nfkd_form = unicodedata.normalize("NFKD", str(input_str or ""))
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)])


def get_administrative_region(bairro):
    if not bairro or not isinstance(bairro, str):
        return 'NÃO INFORMADO'
    
    nfkd = unicodedata.normalize("NFKD", str(bairro))
    norm = "".join([c for c in nfkd if not unicodedata.combining(c)]).upper().strip()
    
    if 'NUCLEO BANDEIRANTE' in norm or 'NB' in norm: return 'NUCLEO BANDEIRANTE'
    if 'COLONIA AGRICOLA SAMAMBAIA' in norm or 'COL. AGR. SAMAMBAIA' in norm: return 'COLONIA AGRICOLA SAMAMBAIA'
    if 'VICENTE PIRES' in norm or 'JOQUEI' in norm: return 'VICENTE PIRES'
    if 'TAGUATINGA' in norm or 'TAGUA' in norm: return 'TAGUATINGA'
    if 'ARNIQUEIRA' in norm: return 'ARNIQUEIRA'
    if 'AGUAS CLARAS' in norm or 'AREAL' in norm: return 'AGUAS CLARAS'
    if 'GUARA' in norm or 'LUCIO COSTA' in norm: return 'GUARA'
    if 'ASA SUL' in norm: return 'ASA SUL'
    if 'ASA NORTE' in norm or 'HABITACOES INDIVIDUAIS NORTE' in norm: return 'ASA NORTE'
    if 'CEILANDIA' in norm: return 'CEILANDIA'
    if 'SAMAMBAIA' in norm: return 'SAMAMBAIA'
    if 'RECANTO DAS EMAS' in norm or 'RECANTO' in norm or 'ENTORNO' in norm: return 'RECANTO-ENTORNO'
    if 'SOBRADINHO' in norm: return 'SOBRADINHO'
    if 'RIACHO FUNDO' in norm: return 'RIACHO FUNDO'
    if 'GAMA' in norm: return 'GAMA'
    if 'SANTA MARIA' in norm: return 'SANTA MARIA'
    if 'LAGO NORTE' in norm or 'SHIN' in norm: return 'LAGO NORTE'
    if 'NOROESTE' in norm: return 'NOROESTE'
    if 'JARDIM BOTANICO' in norm or 'MANGUEIRAL' in norm: return 'JARDIM BOTANICO'
    if 'SUDOESTE' in norm: return 'SUDOESTE'
    if 'CRUZEIRO' in norm: return 'CRUZEIRO'
    if 'OCTOGONAL' in norm: return 'OCTOGONAL'
    if 'ITAPOA' in norm: return 'ITAPOA'
    
    return norm


def get_sector_by_residence(bairro, cidade, estado):
    ra = get_administrative_region(bairro)
    
    def clean_str(s):
        nfkd = unicodedata.normalize("NFKD", str(s or ""))
        return "".join([c for c in nfkd if not unicodedata.combining(c)]).upper().strip()

    norm_ra = clean_str(ra)
    norm_cidade = clean_str(cidade)
    norm_estado = clean_str(estado)
    
    # 1. Setor Central
    if norm_ra in ['VICENTE PIRES', 'GUARA', 'NUCLEO BANDEIRANTE', 'COLONIA AGRICOLA SAMAMBAIA']:
        return 'Setor Central'
        
    # 2. Setor Águas Claras
    if norm_ra in ['AGUAS CLARAS', 'ARNIQUEIRA']:
        return 'Setor Águas Claras'
        
    # 3. Setor Norte
    if norm_ra in ['ASA NORTE', 'ASA SUL', 'NOROESTE', 'LAGO NORTE', 'SOBRADINHO', 'JARDIM BOTANICO', 'SUDOESTE', 'CRUZEIRO', 'OCTOGONAL', 'ITAPOA']:
        return 'Setor Norte'
        
    # 4. Setor Sul
    if norm_ra in ['TAGUATINGA', 'SAMAMBAIA', 'CEILANDIA', 'RECANTO-ENTORNO', 'RIACHO FUNDO', 'GAMA', 'SANTA MARIA']:
        return 'Setor Sul'
        
    # Check fallback by City
    if 'SOBRADINHO' in norm_cidade: return 'Setor Norte'
    if 'PLANALTINA' in norm_cidade:
        if 'GO' in norm_estado or 'GOIAS' in norm_estado:
            return 'Setor Sul'
        return 'Setor Norte'
        
    if 'TAGUATINGA' in norm_cidade or 'SAMAMBAIA' in norm_cidade or 'CEILANDIA' in norm_cidade or 'GAMA' in norm_cidade: return 'Setor Sul'
    if 'GUARA' in norm_cidade or 'VICENTE PIRES' in norm_cidade: return 'Setor Central'
    if 'AGUAS CLARAS' in norm_cidade or 'ARNIQUEIRA' in norm_cidade: return 'Setor Águas Claras'

    # Official RIDE / Entorno (33 municipalities)
    ride_cities = [
        'ABADIANIA', 'AGUA FRIA', 'AGUAS LINDAS', 'ALEXANIA', 'ALTO PARAISO', 'ALVORADA DO NORTE',
        'BARRO ALTO', 'CABECEIRAS', 'CAVALCANTE', 'OCIDENTAL', 'COCALZINHO', 'CORUMBA',
        'CRISTALINA', 'FLORES DE GOIAS', 'FORMOSA', 'GOIANESIA', 'LUZIANIA', 'MIMOSO',
        'NIQUELANDIA', 'NOVO GAMA', 'PADRE BERNARDO', 'PIRENOPOLIS', 'PLANALTINA DE GOIAS',
        'DESCOBERTO', 'SAO JOAO', 'SIMOLANDIA', 'VALPARAISO', 'VILA BOA', 'VILA PROPICIO',
        'ARINOS', 'BURITIS', 'CABECEIRA GRANDE', 'UNAI'
    ]
    
    if any(city in norm_cidade for city in ride_cities) or any(city in norm_ra for city in ride_cities):
        return 'Setor Sul'
        
    return 'Sem Setor'


def clean_column_name(col):
    col = col.lower().strip()
    col = remove_accents(col)
    col = re.sub(r"[^\w\s]", "", col)
    col = re.sub(r"\s+", "_", col)
    if col == "google_":
        col = "google_plus"
    if col == "esposoa":
        col = "esposo_a"
    return col


def normalize_key(value):
    value = remove_accents(str(value or "")).lower().strip()
    return re.sub(r"\s+", " ", value)


def read_csv_with_fallback(path):
    try:
        return pd.read_csv(path, encoding="utf-8-sig", sep=None, engine="python")
    except Exception:
        return pd.read_csv(path, encoding="latin1", sep=";")


def sync_discipulado_table(client, path, url):
    print("  [discipulado] Applying dedicated sync...")

    df = read_csv_with_fallback(path)
    df.columns = [clean_column_name(c) for c in df.columns]
    df = df.fillna("")

    required_columns = {"discipulo", "discipulador"}
    if not required_columns.issubset(df.columns):
        print(f"  [error] Missing required columns in discipulado: {required_columns - set(df.columns)}")
        return

    if "id" in df.columns:
        df["_source_order"] = pd.to_numeric(df["id"], errors="coerce")
        df = df.sort_values(by="_source_order", kind="stable")

    df["discipulo"] = df["discipulo"].astype(str).str.strip()
    df["discipulador"] = df["discipulador"].astype(str).str.strip()
    df = df[df["discipulo"] != ""].copy()

    source_count = len(df)
    df = df.drop_duplicates(subset=["discipulo"], keep="last")
    print(f"  [discipulado] Consolidated {source_count} source rows into {len(df)} unique disciples.")

    existing_rows = {}
    offset = 0
    page_size = 1000

    while True:
        response = client.get(
            url,
            params={
                "select": "id_serial,discipulo",
                "order": "id_serial.asc",
                "limit": page_size,
                "offset": offset,
            },
        )

        if response.status_code != 200:
            print(f"  [error] Unable to read current discipulado data: {response.status_code} - {response.text}")
            return

        data = response.json()
        if not data:
            break

        for item in data:
            key = normalize_key(item.get("discipulo"))
            if key and key not in existing_rows:
                existing_rows[key] = item.get("id_serial")

        if len(data) < page_size:
            break

        offset += page_size

    updated = 0
    created = 0

    for _, row in df.iterrows():
        discipulo = row.get("discipulo", "").strip()
        discipulador = row.get("discipulador", "").strip()

        payload = {
            "discipulo": discipulo,
            "discipulador": discipulador or None,
            "status": row.get("status", "") or "",
            "observacao": row.get("observacao", "") or "",
            "data_inicio": row.get("data", "") or None,
        }

        existing_id = existing_rows.get(normalize_key(discipulo))
        if existing_id:
            response = client.patch(
                f"{url}?id_serial=eq.{existing_id}",
                json=payload,
                headers={"Prefer": "return=minimal"},
            )
            if response.status_code not in [200, 204]:
                print(f"  [error] Failed to update discipulado for {discipulo}: {response.status_code} - {response.text}")
                continue
            updated += 1
        else:
            response = client.post(
                url,
                json=payload,
                headers={"Prefer": "return=minimal"},
            )
            if response.status_code not in [200, 201]:
                print(f"  [error] Failed to create discipulado for {discipulo}: {response.status_code} - {response.text}")
                continue
            created += 1

    print(f"  [ok] Discipulado synced. Updated: {updated} | Created: {created}")


def main():
    print("Starting importer with automatic column discovery...")

    with httpx.Client(
        verify=False,
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
    ) as client:
        for file_name, table_name in MAP_TABELAS.items():
            path = os.path.join(INPUT_DIR, file_name)
            if not os.path.exists(path):
                continue

            print(f"\nAnalyzing {file_name} -> table '{table_name}'...")
            url = f"{SUPABASE_URL}/rest/v1/{table_name}"

            try:
                if table_name == "discipulado":
                    sync_discipulado_table(client, path, url)
                    continue

                df = read_csv_with_fallback(path)
                df.columns = [clean_column_name(c) for c in df.columns]
                df = df.fillna("")

                if table_name == "membros":
                    celulas_path = os.path.join(INPUT_DIR, "celulas.csv")
                    cell_leaders = {}
                    if os.path.exists(celulas_path):
                        try:
                            df_cel = read_csv_with_fallback(celulas_path)
                            df_cel.columns = [clean_column_name(c) for c in df_cel.columns]
                            for _, row_cel in df_cel.iterrows():
                                lid = str(row_cel.get("lider", "")).strip().upper()
                                aux = str(row_cel.get("auxiliar", "")).strip().upper()
                                sec = str(row_cel.get("setor", "")).strip()
                                
                                if lid:
                                    cell_leaders[lid] = sec
                                if aux:
                                    cell_leaders[aux] = sec
                        except Exception as e:
                            print(f"  [warn] Failed to read celulas for override: {e}")

                    def calculate_membro_setor(row_m):
                        nome_m = str(row_m.get("nome", "")).strip().upper()
                        if nome_m in cell_leaders:
                            db_sec = cell_leaders[nome_m]
                            norm_db = db_sec.strip().upper()
                            if "NORTE" in norm_db: return "BSB_NORTE"
                            if "CENTRAL" in norm_db: return "BSB_CENTRAL"
                            if "AGUAS CLARAS" in norm_db or "ÁGUAS CLARAS" in norm_db: return "BSB ÁGUAS CLARAS"
                            if "SUL" in norm_db: return "BSB_SUL"
                            return db_sec

                        bairro = row_m.get("bairro", "")
                        cidade = row_m.get("cidade", "")
                        estado = row_m.get("estado", "")
                        
                        res_sec = get_sector_by_residence(bairro, cidade, estado)
                        
                        if res_sec == "Setor Norte": return "BSB_NORTE"
                        if res_sec == "Setor Central": return "BSB_CENTRAL"
                        if res_sec == "Setor Águas Claras": return "BSB ÁGUAS CLARAS"
                        if res_sec == "Setor Sul": return "BSB_SUL"
                        return ""

                    if "setores" in df.columns:
                        df["setor_eclesiastico"] = df["setores"].astype(str).str.strip().replace("nan", "")
                    else:
                        df["setor_eclesiastico"] = ""

                    df["setor_residencial"] = df.apply(calculate_membro_setor, axis=1)
                    
                    if "setores" in df.columns:
                        df = df.drop(columns=["setores"])
                        
                    print(f"  [membros] Dynamic sectors calculated: eclesiastico & residencial for {len(df)} members.")

                if "id" in df.columns:
                    before = len(df)
                    df = df.drop_duplicates(subset=["id"], keep="first")
                    after = len(df)
                    if before != after:
                        print(f"  [info] Removed {before - after} duplicate IDs from the file.")

                if table_name == "pessoas_familiares" and "id_pessoa_a" in df.columns and "id_pessoa_b" in df.columns:
                    before = len(df)
                    df = df.drop_duplicates(subset=["id_pessoa_a", "id_pessoa_b"], keep="first")
                    after = len(df)
                    if before != after:
                        print(f"  [info] Removed {before - after} duplicate relationships from the file.")

                if table_name == "eventos" and "id_serial" in df.columns:
                    df = df.drop(columns=["id_serial"])

                records = df.to_dict(orient="records")
                batch_size = 100
                invalid_columns = set()

                i = 0
                while i < len(records):
                    batch = records[i : i + batch_size]
                    filtered_batch = []

                    for record in batch:
                        cleaned = {}
                        for key, value in record.items():
                            if key in invalid_columns:
                                continue
                            # Convert empty string to None/null to prevent Postgres cast errors for DATE/BIGINT
                            cleaned[key] = None if value == "" else value
                        filtered_batch.append(cleaned)

                    response = client.post(
                        url,
                        json=filtered_batch,
                        headers={"Prefer": "resolution=merge-duplicates"},
                    )

                    if response.status_code in [200, 201]:
                        print(f"  [ok] Batch {i // batch_size + 1} sent.")
                        i += batch_size
                    elif response.status_code == 400:
                        try:
                            message = response.json().get("message", "")
                        except Exception:
                            message = response.text

                        print(f"  [warn] Error message: {message}")

                        match = re.search(r"the '(.*?)' column", message)
                        if not match:
                            match = re.search(r'the "(.*?)" column', message)
                        if not match:
                            match = re.search(r"find the (.*?) column", message)

                        if match:
                            bad_column = match.group(1).replace("'", "").replace('"', "").strip()
                            print(f"  [info] Removing missing column: '{bad_column}'")
                            invalid_columns.add(bad_column)
                        else:
                            print("  [error] Could not identify the missing column from the error.")
                            break
                    else:
                        print(f"  [error] Unexpected error: {response.status_code} - {response.text}")
                        break
            except Exception as error:
                print(f"  [error] Failed to process file: {error}")

    print("\nImport process finished.")


if __name__ == "__main__":
    main()
