import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Eye, UserPlus, X, FlaskConical, Database, Compass } from 'lucide-react';

interface LabLauncherProps {
  onClose: () => void;
  allowedModules: string[];
}

const LAB_ITEMS = [
  {
    id: 'Lab: Visão da Plenitude',
    path: '/lab/vision',
    icon: Eye,
    label: 'Visão da Plenitude',
    desc: 'Como nossa igreja se encaixa na visão de Ef 1:23',
    color: 'from-amber-400 to-orange-500',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    textColor: 'text-amber-700',
  },
  {
    id: 'Lab: Gestão de Visitas',
    path: '/lab/visits',
    icon: UserPlus,
    label: 'Gestão de Visitas',
    desc: 'Módulo em desenvolvimento — acompanhamento de visitantes',
    color: 'from-teal-400 to-cyan-500',
    bg: 'bg-teal-50',
    border: 'border-teal-100',
    textColor: 'text-teal-700',
  },
  {
    id: 'Lab: Consultas & Estudos',
    path: '/lab/queries',
    icon: Database,
    label: 'Consultas & Estudos',
    desc: 'Pesquisas ad-hoc e filtros de vínculo de membros',
    color: 'from-indigo-400 to-violet-500',
    bg: 'bg-indigo-50',
    border: 'border-indigo-100',
    textColor: 'text-indigo-700',
  },
];

export const LabLauncher: React.FC<LabLauncherProps> = ({ onClose, allowedModules }) => {
  const navigate = useNavigate();

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleNavigate = (path: string) => {
    onClose();
    navigate(path);
  };

  const visibleItems = LAB_ITEMS.filter(item => allowedModules.includes(item.id));

  return (
    <>
      {/* Backdrop — semi-transparente, clicando fecha */}
      <div
        className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Painel do launcher — posicionado no canto inferior direito, longe do menu */}
      <div className="fixed bottom-6 right-6 z-[9999] w-80 animate-in slide-in-from-bottom-4 fade-in duration-300">
        {/* Header do lab */}
        <div className="bg-gray-900 rounded-t-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <FlaskConical className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-white text-xs font-bold">LAB MODE</p>
              <p className="text-gray-500 text-[9px]">Acesso restrito · Perfis autorizados</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Items */}
        <div className="bg-white rounded-b-2xl shadow-2xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
          {visibleItems.map(item => (
            <button
              key={item.path}
              onClick={() => handleNavigate(item.path)}
              className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left group"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br shrink-0 ${item.color} shadow-sm`}>
                <item.icon className="h-4.5 w-4.5 text-white h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 group-hover:text-gray-700">{item.label}</p>
                <p className="text-[10px] text-gray-400 leading-tight truncate">{item.desc}</p>
              </div>
              <Sparkles className="h-4 w-4 text-gray-200 group-hover:text-amber-400 transition-colors shrink-0" />
            </button>
          ))}
          {visibleItems.length === 0 && (
            <div className="p-6 text-center text-xs text-gray-400 italic">
              Nenhum módulo de laboratório liberado para o seu perfil.
            </div>
          )}
        </div>

        {/* Hint de como fechar */}
        <p className="text-center text-[9px] text-gray-400 mt-2">
          Pressione <kbd className="bg-gray-200 text-gray-600 px-1 py-0.5 rounded text-[9px] font-mono">Esc</kbd> ou clique fora para fechar
        </p>
      </div>
    </>
  );
};
