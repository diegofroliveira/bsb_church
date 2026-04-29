import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Home, DollarSign, Settings, LogOut,
  Menu, BookOpen, FileText, Network, AlertTriangle, MapPin,
  Brain
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import clsx from 'clsx';

const DEFAULT_ROLES: Record<string, string[]> = {
  admin: ['Dashboard', 'Mapa', 'Membros', 'GCs/Localidades', 'Discipulado', 'Rede', 'Relatórios', 'QA', 'Financeiro', 'Consultor IA', 'Insights IA', 'Configurações'],
  pastor: ['Dashboard', 'Mapa', 'Membros', 'GCs/Localidades', 'Discipulado', 'Rede', 'Relatórios', 'QA', 'Financeiro', 'Consultor IA', 'Insights IA'],
  secretaria: ['Dashboard', 'Membros', 'GCs/Localidades', 'Discipulado', 'Rede', 'Relatórios', 'QA', 'Consultor IA'],
  financeiro: ['Dashboard', 'Financeiro']
};

export const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [allowedModules, setAllowedModules] = useState<string[]>([]);

  useEffect(() => {
    if (user?.forcePasswordReset) {
      navigate('/reset-password');
    }
  }, [user, navigate]);

  useEffect(() => {
    const fetchAllowedModules = async () => {
      const userRole = user?.role || 'guest';
      try {
        const stored = localStorage.getItem('church_dynamic_roles');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed[userRole]) {
            setAllowedModules(parsed[userRole].modules);
          }
        }

        // Busca a configuração global do Supabase para sincronia em tempo real
        const { data } = await supabase
          .from('profiles')
          .select('avatar')
          .eq('id', '00000000-0000-0000-0000-000000000000');

        if (data && data.length > 0 && data[0].avatar) {
          const parsed = JSON.parse(data[0].avatar);
          if (parsed[userRole]) {
            setAllowedModules(parsed[userRole].modules);
            localStorage.setItem('church_dynamic_roles', data[0].avatar);
            return;
          }
        } else {
          // Fallback: busca em admins antigos
          const { data: adminData } = await supabase
            .from('profiles')
            .select('avatar')
            .eq('role', 'admin');

          if (adminData && adminData.length > 0) {
            const rowWithConfig = adminData.find(r => r.avatar && r.avatar.startsWith('{"'));
            if (rowWithConfig && rowWithConfig.avatar) {
              const parsed = JSON.parse(rowWithConfig.avatar);
              if (parsed[userRole]) {
                setAllowedModules(parsed[userRole].modules);
                localStorage.setItem('church_dynamic_roles', rowWithConfig.avatar);
                return;
              }
            }
          }
        }
      } catch (_) {}

      // Fallback para os perfis padrão do sistema
      setAllowedModules(DEFAULT_ROLES[userRole] || ['Dashboard']);
    };

    if (user) {
      fetchAllowedModules();
    }
  }, [user]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const navItems = [
    { id: 'Dashboard',       name: 'Dashboard',       path: '/',             icon: LayoutDashboard },
    { id: 'Mapa',            name: 'Mapa',            path: '/georeferencing', icon: MapPin },
    { id: 'Membros',         name: 'Membros',         path: '/members',      icon: Users },
    { id: 'GCs/Localidades', name: 'GCs/Localidades', path: '/cells',        icon: Home },
    { id: 'Discipulado',     name: 'Discipulado',     path: '/discipleship', icon: BookOpen },
    { id: 'Rede',            name: 'Rede',            path: '/network',      icon: Network },
    { id: 'Relatórios',      name: 'Relatórios',      path: '/reports',      icon: FileText },
    { id: 'QA',              name: 'QA',              path: '/qa',           icon: AlertTriangle },
    { id: 'Financeiro',      name: 'Financeiro',      path: '/finance',      icon: DollarSign },
    { id: 'Consultor IA',    name: 'IA',              path: '/ai-consultant', icon: Brain },
    { id: 'Configurações',   name: 'Configurações',   path: '/admin/users',  icon: Settings },
  ];

  const authorizedNavItems = navItems.filter(item => allowedModules.includes(item.id));

  const FamilyLogo = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* Estrela Guia */}
      <path d="M32 4 L33.5 10 L39 11.5 L33.5 13 L32 19 L30.5 13 L25 11.5 L30.5 10 Z" fill="currentColor" stroke="none" className="animate-pulse" />
      
      {/* Figura Central (Jesus) */}
      <circle cx="32" cy="28" r="4" /> {/* Cabeça */}
      <path d="M32 32 L32 52" /> {/* Corpo */}
      <path d="M32 36 C24 36 18 42 16 46" /> {/* Braço Esquerdo Aberto */}
      <path d="M32 36 C40 36 46 42 48 46" /> {/* Braço Direito Aberto */}
      <path d="M28 32 Q32 30 36 32" strokeWidth="1" /> {/* Detalhe Manto */}

      {/* Círculo de Pessoas (Multidão) */}
      {/* Topo / Laterais */}
      <circle cx="20" cy="22" r="2.5" /> <path d="M17 28 Q20 26 23 28" />
      <circle cx="44" cy="22" r="2.5" /> <path d="M41 28 Q44 26 47 28" />
      
      {/* Meio */}
      <circle cx="14" cy="36" r="2" /> <path d="M12 42 Q14 40 16 42" />
      <circle cx="50" cy="36" r="2" /> <path d="M48 42 Q50 40 52 42" />
      
      {/* Base (Crianças e Adultos) */}
      <circle cx="18" cy="50" r="2.2" /> <path d="M15 56 Q18 54 21 56" />
      <circle cx="46" cy="50" r="2.2" /> <path d="M43 56 Q46 54 49 56" />
      <circle cx="26" cy="58" r="1.8" /> <path d="M24 62 Q26 61 28 62" />
      <circle cx="38" cy="58" r="1.8" /> <path d="M36 62 Q38 61 40 62" />
      
      {/* Pequenos pontos de brilho extras */}
      <circle cx="32" cy="32" r="15" strokeDasharray="2 6" opacity="0.3" />
    </svg>
  );

  const SidebarContent = () => (
    <>
      <div className="flex h-20 shrink-0 items-center px-6 border-b border-gray-100 bg-white">
        <FamilyLogo className="h-11 w-11 text-primary-600 mr-3" />
        <span className="text-2xl font-bold text-gray-900 tracking-tight">Igreja<span className="text-blue-600">Pro</span></span>
      </div>
      <nav className="flex flex-1 flex-col px-4 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {authorizedNavItems.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => clsx(
                  isActive ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  'group flex gap-x-3 rounded-md p-2 text-sm leading-6 transition-all duration-200'
                )}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {item.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-gray-100 p-4">
          <div className="text-sm font-semibold text-gray-900 truncate">{user?.name}</div>
          <div className="text-xs text-primary-600 font-medium capitalize">{user?.role}</div>
        <button onClick={handleLogout}
          className="mt-4 flex w-full items-center gap-x-3 rounded-md p-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
          <LogOut className="h-5 w-5 shrink-0" /> Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50/50">
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-gray-900/80 transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white shadow-2xl animate-in slide-in-from-left duration-300">
            <SidebarContent />
          </div>
        </div>
      )}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-gray-200 lg:bg-white lg:shadow-sm">
        <SidebarContent />
      </div>
      <div className="lg:pl-72 flex flex-col min-h-screen">
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white/80 backdrop-blur-md px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:hidden">
          <button type="button" className="-m-2.5 p-2.5 text-gray-700" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
          <div className="flex-1 text-base font-bold leading-6 text-gray-900 flex items-center ml-2">
            <FamilyLogo className="h-8 w-8 text-primary-600 mr-2" /> Igreja<span className="text-blue-600">Pro</span>
          </div>
        </div>
        <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
