import subprocess
import sys
import time

def run_step(name, command):
    print(f"\n{'='*60}")
    print(f"INICIANDO: {name}")
    print(f"{'='*60}")
    
    # Usa o executável do venv
    python_exe = ".\\venv\\Scripts\\python.exe"
    
    try:
        process = subprocess.Popen([python_exe] + command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8')
        
        for line in process.stdout:
            print(line, end='')
            
        process.wait()
        
        if process.returncode == 0:
            print(f"\nOK: {name} CONCLUIDO COM SUCESSO!")
            return True
        else:
            print(f"\nERRO: {name} FALHOU (Codigo {process.returncode})")
            return False
            
    except Exception as e:
        print(f"\nERRO ao executar {name}: {e}")
        return False

def main():
    start_time = time.time()
    
    # Passo 1: Extrair do Prover
    if not run_step("Extracao Prover (Playwright)", ["extrator_prover.py"]):
        sys.exit(1)
        
    # Passo 2: Importar para o Supabase
    if not run_step("Importacao Supabase (UPSERT)", ["importador_supabase.py"]):
        sys.exit(1)
    
    duration = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"PIPELINE FINALIZADO EM {duration:.1f}s")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
