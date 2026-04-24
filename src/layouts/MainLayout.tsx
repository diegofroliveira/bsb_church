import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Heart, 
  DollarSign, 
  Settings, 
  LogOut,
  Menu,
  Church,
  BookOpen,
  FileText,
  Network,
  AlertTriangle,
  Home
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';

export const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Define navigation based on roles
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['admin', 'pastor', 'leader', 'secretary'] },
    { name: 'Membros', path: '/members', icon: Users, roles: ['admin', 'pastor', 'secretary'] },
    { name: 'Células', path: '/cells', icon: Home, roles: ['admin', 'pastor', 'secretary'] },
    { name: 'Relatórios', path: '/reports', icon: FileText, roles: ['admin', 'pastor', 'secretary'] },
    { name: 'QA', path: '/qa', icon: AlertTriangle, roles: ['admin', 'pastor', 'secretary'] },
    { name: 'Meu Grupo', path: '/my-group', icon: Heart, roles: ['leader'] },
    { name: 'Discipulado', path: '/discipleship', icon: BookOpen, roles: ['admin', 'pastor', 'leader'] },
    { name: 'Rede', path: '/network', icon: Network, roles: ['admin', 'pastor', 'leader'] },
    { name: 'Financeiro', path: '/finance', icon: DollarSign, roles: ['admin', 'pastor', 'finance'] },
    { name: 'Configurações', path: '/settings', icon: Settings, roles: ['admin'] },
  ];

  const authorizedNavItems = navItems.filter(item => item.roles.includes(user?.role || ''));

  const SidebarContent = () => (
    <>
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-gray-100">
        <Church className="h-8 w-8 text-primary-600 mr-2" />
        <span className="text-xl font-bold text-gray-900 tracking-tight">Igreja<span className="text-primary-600">Pro</span></span>
      </div>
      <nav className="flex flex-1 flex-col px-4 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {authorizedNavItems.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  clsx(
                    isActive
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                    'group flex gap-x-3 rounded-md p-2 text-sm leading-6 transition-all duration-200'
                  )
                }
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {item.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      
      {/* User Profile in Sidebar Bottom */}
      <div className="border-t border-gray-100 p-4">
        <div className="flex items-center gap-x-3">
          <img
            className="h-10 w-10 rounded-full bg-gray-50 border border-gray-200"
            src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`}
            alt=""
          />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-900">{user?.name}</span>
            <span className="text-xs text-gray-500 capitalize">{user?.role}</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-4 flex w-full items-center gap-x-3 rounded-md p-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-gray-900/80 transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white shadow-2xl animate-in slide-in-from-left duration-300">
             <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col lg:border-r lg:border-gray-200 lg:bg-white lg:shadow-sm">
        <SidebarContent />
      </div>

      {/* Main Content */}
      <div className="lg:pl-72 flex flex-col min-h-screen">
        {/* Top Header for Mobile */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white/80 backdrop-blur-md px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:hidden">
          <button type="button" className="-m-2.5 p-2.5 text-gray-700" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>
          <div className="flex-1 text-sm font-semibold leading-6 text-gray-900 flex items-center">
             <Church className="h-6 w-6 text-primary-600 mr-2" /> IgrejaPro
          </div>
        </div>

        <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
