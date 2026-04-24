import os
import pandas as pd
import httpx
from geopy.geocoders import Nominatim
from geopy.extra.rate_limiter import RateLimiter
import time

# Configurações do Supabase
SUPABASE_URL = "https://vadufkgbluisdamgkbln.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhZHVma2dibHVpc2RhbWdrYmxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NjE2NDksImV4cCI6MjA5MjQzNzY0OX0.40XwaADEKukkhuLqcQQnNpx-6a1ipKnz_4Fy8DJdrao"

def main():
    print("INFO: INICIANDO GEOCODIFICADOR DE MEMBROS ATIVOS")
    
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

    # 1. Buscar membros ativos que não têm latitude/longitude
    print("INFO: Buscando membros ativos no Supabase...")
    with httpx.Client(verify=False) as client:
        res = client.get(
            f"{SUPABASE_URL}/rest/v1/membros",
            params={
                "status": "eq.Ativo",
                "latitude": "is.null",
                "select": "nome,logradouro,bairro,cidade,estado"
            },
            headers=headers
        )
        
        if res.status_code != 200:
            print(f"ERRO: Erro ao buscar membros: {res.text}")
            return
        
        membros = res.json()
        print(f"INFO: Encontrados {len(membros)} membros ativos para geocodificar.")

        if not membros:
            print("OK: Todos os membros ativos ja possuem coordenadas!")
            return

        # 2. Configurar Geocoder (Nominatim - OpenStreetMap)
        geolocator = Nominatim(user_agent="igreja_pro_geocoder", timeout=10)
        geocode = RateLimiter(geolocator.geocode, min_delay_seconds=1.5) # Aumentado um pouco o delay por segurança

        for m in membros:
            try:
                # Montar endereço completo
                endereco = f"{m.get('logradouro', '')}, {m.get('bairro', '')}, {m.get('cidade', '')} - {m.get('estado', '')}, Brazil"
                print(f"INFO: Geocodificando: {m['nome']} -> {endereco}")
                
                location = geocode(endereco)
                
                if location:
                    print(f"   OK: Encontrado: {location.latitude}, {location.longitude}")
                    
                    # Atualizar no Supabase
                    update_res = client.patch(
                        f"{SUPABASE_URL}/rest/v1/membros",
                        params={"nome": f"eq.{m['nome']}"},
                        json={
                            "latitude": location.latitude,
                            "longitude": location.longitude
                        },
                        headers=headers
                    )
                    
                    if update_res.status_code not in [200, 204]:
                        print(f"   AVISO: Erro ao atualizar: {update_res.text}")
                else:
                    print("   AVISO: Endereco nao encontrado.")
                
            except Exception as e:
                print(f"   ERRO processando {m['nome']}: {e}")
                time.sleep(2)

    print("\nOK: PROCESSO DE GEOCODIFICACAO FINALIZADO")

if __name__ == "__main__":
    main()
