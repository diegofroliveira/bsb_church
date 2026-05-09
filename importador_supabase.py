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
}


def remove_accents(input_str):
    nfkd_form = unicodedata.normalize("NFKD", str(input_str or ""))
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)])


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

                if "id" in df.columns:
                    before = len(df)
                    df = df.drop_duplicates(subset=["id"], keep="first")
                    after = len(df)
                    if before != after:
                        print(f"  [info] Removed {before - after} duplicate IDs from the file.")

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
                        filtered_batch.append(
                            {key: value for key, value in record.items() if key not in invalid_columns}
                        )

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
