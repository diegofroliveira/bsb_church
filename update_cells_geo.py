import pandas as pd
import httpx
import re
import os

# Configurações do Supabase
SUPABASE_URL = "https://vadufkgbluisdamgkbln.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhZHVma2dibHVpc2RhbWdrYmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NjE2NDksImV4cCI6MjA5MjQzNzY0OX0.40XwaADEKukkhuLqcQQnNpx-6a1ipKnz_4Fy8DJdrao"

def main():
    print("INFO: Carregando coordenadas das celulas do CSV para o Supabase...")
    
    # 1. Ler o CSV de células
    file_path = "dados_exportados/celulas.csv"
    if not os.path.exists(file_path):
        print(f"ERRO: Arquivo {file_path} nao encontrado.")
        return
        
    df = pd.read_csv(file_path, encoding='latin1', sep=';')
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

    with httpx.Client(verify=False) as client:
        count = 0
        for _, row in df.iterrows():
            nome = str(row.get('Grupo Caseiro', ''))
            lat = row.get('Latitude')
            lon = row.get('Longitude')
            
            # Limpar lat/long se forem strings com vírgula
            if isinstance(lat, str): lat = float(lat.replace(',', '.'))
            if isinstance(lon, str): lon = float(lon.replace(',', '.'))
            
            if pd.notnull(lat) and pd.notnull(lon):
                print(f"INFO: Atualizando {nome} -> {lat}, {lon}")
                res = client.patch(
                    f"{SUPABASE_URL}/rest/v1/celulas",
                    params={"grupo_caseiro": f"eq.{nome}"},
                    json={"latitude": lat, "longitude": lon},
                    headers=headers
                )
                if res.status_code in [200, 204]:
                    count += 1
                else:
                    print(f"   AVISO: Erro ao atualizar {nome}: {res.text}")
        
        print(f"OK: {count} celulas atualizadas com sucesso!")

if __name__ == "__main__":
    main()
