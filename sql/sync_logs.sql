-- =========================================================================
-- Script SQL para Supabase: Tabela de Auditoria e Limites de Sincronização
-- =========================================================================
-- Execute este script no SQL Editor do Supabase para criar a tabela oficial
-- de auditoria de sincronizações da base de dados.
-- (Observação: O backend possui fallback automático no profiles caso este
-- script ainda não tenha sido executado, mas a criação desta tabela é a
-- boa prática recomendada).
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    user_name TEXT,
    user_email TEXT,
    role TEXT NOT NULL,
    status TEXT DEFAULT 'success',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para buscas rápidas por data e perfil
CREATE INDEX IF NOT EXISTS idx_sync_logs_role_created_at ON public.sync_logs (role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON public.sync_logs (created_at DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- 1. Qualquer usuário autenticado pode ler os logs de sincronização
CREATE POLICY "Permitir leitura para autenticados" ON public.sync_logs
    FOR SELECT TO authenticated
    USING (true);

-- 2. Qualquer usuário autenticado (admin ou secretaria) pode inserir log ao sincronizar
CREATE POLICY "Permitir inserção para autenticados" ON public.sync_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- 3. Apenas administradores podem deletar logs (para resetar limites se necessário)
CREATE POLICY "Permitir exclusão para administradores" ON public.sync_logs
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() 
              AND lower(coalesce(p.role, '')) IN ('admin', 'administrador')
        )
    );
