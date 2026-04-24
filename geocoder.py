import os
import pandas as pd
import httpx
import time
import random

# Configurações do Supabase
SUPABASE_URL = "https://vadufkgbluisdamgkbln.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhZHVma2dibHVpc2RhbWdrYmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NjE2NDksImV4cCI6MjA5MjQzNzY0OX0.40XwaADEKukkhuLqcQQnNpx-6a1ipKnz_4Fy8DJdrao"

def geocode_address(client, address):
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": address,
        "format": "json",
        "limit": 1
    }
    headers = {
        "User-Agent": f"ChurchPro_Mapping_Bot_{random.randint(1000, 9999)}"
    }
    
    try:
        response = client.get(url, params=params, headers=headers)
        if response.status_code == 200:
            data = response.json()
            if data:
                return float(data[0]["lat"]), float(data[0]["lon"])
        elif response.status_code == 429:
            print("   AVISO: Limite de taxa atingido. Dormindo por 30 segundos...")
            time.sleep(30)
            return geocode_address(client, address) # Tenta novamente após o descanso
    except Exception as e:
        print(f"   ERRO na API: {e}")
    return None, None

def main():
    print("INFO: INICIANDO GEOCODIFICADOR VERSAO 3 (RESILIENTE)", flush=True)
    
    headers_sb = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

    print("INFO: Buscando membros ativos sem coordenadas...", flush=True)
    with httpx.Client(verify=False) as client_sb, httpx.Client(timeout=20.0) as client_geo:
        print("DEBUG: Clientes HTTP inicializados", flush=True)
        res = client_sb.get(
            f"{SUPABASE_URL}/rest/v1/membros",
            params={
                "status": "eq.Ativo",
                "latitude": "is.null",
                "select": "nome,logradouro,bairro,cidade"
            },
            headers=headers_sb
        )
        print(f"DEBUG: Status da query Supabase: {res.status_code}", flush=True)
        
        try:
            membros = res.json()
        except Exception as e:
            print(f"ERRO: Falha ao decodificar JSON: {e}", flush=True)
            print(f"DEBUG: Body: {res.text[:200]}", flush=True)
            return

        print(f"INFO: Encontrados {len(membros)} membros para processar.", flush=True)

        for m in membros:
            # Endereço simplificado para melhor busca
            logradouro = (m.get('logradouro') or '').strip()
            bairro = (m.get('bairro') or '').strip()
            cidade = (m.get('cidade') or '').strip()
            
            if not logradouro: continue
            
            endereco = f"{logradouro}, {bairro}, {cidade}, Brazil"
            print(f"INFO: Localizando: {m['nome']} -> {endereco}")
            
            lat, lon = geocode_address(client_geo, endereco)
            
            if lat and lon:
                print(f"   OK: {lat}, {lon}")
                # Salvar no Supabase
                client_sb.patch(
                    f"{SUPABASE_URL}/rest/v1/membros",
                    params={"nome": f"eq.{m['nome']}"},
                    json={"latitude": lat, "longitude": lon},
                    headers=headers_sb
                )
            else:
                print("   ERRO: Nao encontrado.")
            
            # Espera entre 5 e 8 segundos para ser bem conservador
            time.sleep(random.uniform(5, 8))

    print("\n✅ PROCESSO FINALIZADO")

if __name__ == "__main__":
    main()
