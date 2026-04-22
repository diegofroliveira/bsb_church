import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { type User as SupabaseUser } from '@supabase/supabase-js';

export type Role = 'admin' | 'pastor' | 'leader' | 'finance' | 'secretary';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  groupId?: string; 
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<void>;
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
      role: (sbUser.user_metadata?.role as Role) || 'pastor', // Default role if not set
      avatar: sbUser.user_metadata?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sbUser.id}`,
      groupId: sbUser.user_metadata?.groupId,
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

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: password || '123456', // Default password if not provided for ease of testing
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
