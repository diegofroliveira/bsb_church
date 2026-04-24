import os
import httpx
import time
import random

# Configurações do Supabase
SUPABASE_URL = "https://vadufkgbluisdamgkbln.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhZHVma2dibHVpc2RhbWdrYmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NjE2NDksImV4cCI6MjA5MjQzNzY0OX0.40XwaADEKukkhuLqcQQnNpx-6a1ipKnz_4Fy8DJdrao"

def geocode_address_arcgis(client, address):
    # Usando a API gratuita do ArcGIS (mais permissiva que o Nominatim)
    url = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates"
    params = {
        "f": "json",
        "singleLine": address,
        "maxLocations": 1
    }
    
    try:
        response = client.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            if data.get("candidates"):
                loc = data["candidates"][0]["location"]
                return loc["y"], loc["x"]
        elif response.status_code == 429:
            print("   AVISO: Limite atingido no ArcGIS. Dormindo 30s...", flush=True)
            time.sleep(30)
    except Exception as e:
        print(f"   ERRO na API: {e}", flush=True)
    return None, None

def main():
    print("INFO: INICIANDO GEOCODIFICADOR VERSAO 5 (ARCGIS ENGINE)", flush=True)
    
    headers_sb = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

    with httpx.Client(verify=False) as client_sb, httpx.Client(verify=False, timeout=30.0) as client_geo:
        res = client_sb.get(
            f"{SUPABASE_URL}/rest/v1/membros",
            params={
                "status": "eq.Ativo",
                "latitude": "is.null",
                "select": "nome,logradouro,bairro,cidade"
            },
            headers=headers_sb
        )
        
        membros = res.json()
        print(f"INFO: Encontrados {len(membros)} membros para processar.", flush=True)

        for m in membros:
            logradouro = (m.get('logradouro') or '').strip()
            bairro = (m.get('bairro') or '').strip()
            cidade = (m.get('cidade') or '').strip()
            
            if not logradouro or len(logradouro) < 3:
                continue
            
            # Endereço completo para o ArcGIS
            endereco = f"{logradouro}, {bairro}, {cidade}, DF, Brazil"
            print(f"INFO: Localizando: {m['nome']} -> {endereco}", flush=True)
            
            lat, lon = geocode_address_arcgis(client_geo, endereco)
            
            if lat and lon:
                print(f"   OK: {lat}, {lon}", flush=True)
                client_sb.patch(
                    f"{SUPABASE_URL}/rest/v1/membros",
                    params={"nome": f"eq.{m['nome']}"},
                    json={"latitude": lat, "longitude": lon},
                    headers=headers_sb
                )
                # Espera curta entre sucessos
                time.sleep(1)
            else:
                print("   AVISO: Nao encontrado.", flush=True)
                time.sleep(2)

    print("\nOK: PROCESSO FINALIZADO", flush=True)

if __name__ == "__main__":
    main()
