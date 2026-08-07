import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { type User as SupabaseUser } from '@supabase/supabase-js';

export type Role = 'admin' | 'pastor' | 'leader' | 'financeiro' | 'secretaria' | 'member';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  groupId?: string; 
  assigned_gc?: string;
  assigned_sector?: string;
  forcePasswordReset?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const mapSupabaseUser = (sbUser: SupabaseUser | null): User | null => {
    if (!sbUser) return null;
    
    return {
      id: sbUser.id,
      email: sbUser.email || '',
      name: sbUser.user_metadata?.name || sbUser.email?.split('@')[0] || 'Usuário',
      // Metadados ainda são usados apenas na camada legada de apresentação.
      // A autorização v2 é calculada no banco; o fallback deve ser não privilegiado.
      role: (sbUser.user_metadata?.role as Role) || 'member',
      avatar: sbUser.user_metadata?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sbUser.id}`,
      groupId: sbUser.user_metadata?.groupId,
      assigned_gc: sbUser.user_metadata?.assigned_gc,
      assigned_sector: sbUser.user_metadata?.assigned_sector,
      forcePasswordReset: Boolean(sbUser.user_metadata?.force_password_reset),
    };
  };

  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      try {
        console.log("Iniciando verificação de sessão...");
        const { data: { session } } = await supabase.auth.getSession();
        setUser(mapSupabaseUser(session?.user || null));
        console.log("Sessão carregada com sucesso.");
      } catch (err) {
        console.error("Erro crítico na inicialização do Auth:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(mapSupabaseUser(session?.user || null));
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
    } catch (err: any) {
      setIsLoading(false);
      throw new Error(err.message || 'Erro ao realizar login');
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  useEffect(() => {
    if (!user) return;

    let timeoutId: any;

    const handleAutoLogout = async () => {
      console.log("Auto-logging out due to inactivity...");
      await logout();
      window.location.href = '/login?reason=inactivity';
    };

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(handleAutoLogout, 15 * 60 * 1000); // 15 mins
    };

    const activityEvents = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];

    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
