-- ============================================================
-- BSB CHURCH LAB — SQL Console Setup
-- Execute este script no Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vadufkgbluisdamgkbln/sql/new
-- ============================================================

-- Função que executa SQL dinâmico de leitura (SELECT only)
-- e retorna os resultados como JSON.
-- Restringe execução a queries de apenas leitura (SELECT).
CREATE OR REPLACE FUNCTION execute_lab_query(sql_text text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  normalized text;
BEGIN
  -- Normaliza e verifica que é uma query de leitura
  normalized := TRIM(UPPER(regexp_replace(sql_text, '\s+', ' ', 'g')));

  IF normalized NOT LIKE 'SELECT%' THEN
    RAISE EXCEPTION 'Apenas queries SELECT são permitidas no Lab Console.';
  END IF;

  -- Bloqueia palavras perigosas de modificação
  IF normalized ~ '\m(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|COPY|EXECUTE)\M' THEN
    RAISE EXCEPTION 'Operações de escrita não são permitidas. Apenas SELECT.';
  END IF;

  -- Executa e retorna como JSON
  EXECUTE format('SELECT json_agg(row_to_json(q)) FROM (%s) q', sql_text) INTO result;
  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Permissão para o role anon usar a função
GRANT EXECUTE ON FUNCTION execute_lab_query(text) TO anon;
GRANT EXECUTE ON FUNCTION execute_lab_query(text) TO authenticated;

-- ============================================================
-- Teste rápido:
-- SELECT execute_lab_query('SELECT nome, status FROM membros LIMIT 5');
-- ============================================================
