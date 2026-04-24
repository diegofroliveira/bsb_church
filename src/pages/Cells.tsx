import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Home, Users, MapPin, Search, Filter, Loader2, Shield } from 'lucide-react';
import clsx from 'clsx';

interface CellInfo {
  id: number;
  grupo_caseiro: string;
  lider: string;
  auxiliar: string;
  setor: string;
  bairro: string;
  cidade: string;
  status: string;
  limite_de_pessoas: number;
  memberCount: number;
}

export const Cells: React.FC = () => {
  const [cells, setCells] = useState<CellInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSetor, setSelectedSetor] = useState<string>('Todos');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [celulasRes, membrosRes] = await Promise.all([
          supabase.from('celulas').select('*'),
          supabase.from('membros').select('grupos_caseiros').eq('status', 'Ativo')
        ]);

        const celulas = celulasRes.data || [];
        const membros = membrosRes.data || [];

        // Contar membros ativos por grupo
        const groupCounts: Record<string, number> = {};
        membros.forEach(m => {
          if (!m.grupos_caseiros) return;
          const groupName = m.grupos_caseiros.trim().replace(/\s+/g, ' ').toUpperCase();
          groupCounts[groupName] = (groupCounts[groupName] || 0) + 1;
        });

        const mappedCells: CellInfo[] = celulas.map(c => {
          const groupNameNormalized = (c.grupo_caseiro || '').trim().replace(/\s+/g, ' ').toUpperCase();
          return {
            id: c.id,
            grupo_caseiro: c.grupo_caseiro,
            lider: c.lider || 'Sem líder',
            auxiliar: c.auxiliar || '',
            setor: c.setor || 'Sem Setor',
            bairro: c.bairro || 'Não informado',
            cidade: c.cidade || '',
            status: c.status || 'Desconhecido',
            limite_de_pessoas: parseFloat(c.limite_de_pessoas || '0'),
            memberCount: groupCounts[groupNameNormalized] || 0
          };
        });

        // Ordenar por Setor e depois por nome do grupo
        mappedCells.sort((a, b) => {
          if (a.setor < b.setor) return -1;
          if (a.setor > b.setor) return 1;
          return a.grupo_caseiro.localeCompare(b.grupo_caseiro);
        });

        setCells(mappedCells);
      } catch (error) {
        console.error('Error fetching cells data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const setores = useMemo(() => {
    const s = new Set(cells.map(c => c.setor).filter(Boolean));
    return ['Todos', ...Array.from(s).sort()];
  }, [cells]);

  const filteredCells = useMemo(() => {
    return cells.filter(c => {
      const matchesSearch = c.grupo_caseiro.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            c.lider.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSetor = selectedSetor === 'Todos' || c.setor === selectedSetor;
      return matchesSearch && matchesSetor;
    });
  }, [cells, searchTerm, selectedSetor]);

  const totalMembersInCells = useMemo(() => filteredCells.reduce((acc, c) => acc + c.memberCount, 0), [filteredCells]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto pb-12">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Módulo de Células</h1>
          <p className="mt-2 text-sm text-gray-500 max-w-2xl">
            Acompanhe a saúde, frequência e métricas de todos os Pequenos Grupos e Células da igreja.
          </p>
        </div>
        
        {!isLoading && (
           <div className="flex gap-4">
             <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
               <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                 <Home className="text-blue-600 w-5 h-5" />
               </div>
               <div>
                 <p className="text-sm text-gray-500 font-medium">Células Listadas</p>
                 <p className="text-xl font-bold text-gray-900">{filteredCells.length}</p>
               </div>
             </div>
             <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 hidden sm:flex">
               <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center border border-green-100">
                 <Users className="text-green-600 w-5 h-5" />
               </div>
               <div>
                 <p className="text-sm text-gray-500 font-medium">Membros Engajados</p>
                 <p className="text-xl font-bold text-gray-900">{totalMembersInCells}</p>
               </div>
             </div>
           </div>
        )}
      </header>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar célula ou líder..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
        <div className="relative min-w-[200px]">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <select
            value={selectedSetor}
            onChange={(e) => setSelectedSetor(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none appearance-none bg-white"
          >
            {setores.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="h-10 w-10 animate-spin text-primary-600 mb-4" />
          <p className="text-gray-500 font-medium">Carregando métricas dos grupos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCells.map((cell) => {
            const healthColor = cell.memberCount >= (cell.limite_de_pessoas || 15) * 0.8 
              ? 'text-green-600 bg-green-50 border-green-200' 
              : cell.memberCount < 5 
                ? 'text-red-600 bg-red-50 border-red-200'
                : 'text-blue-600 bg-blue-50 border-blue-200';

            return (
              <div key={cell.id} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all p-5 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                      <Home className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 line-clamp-1" title={cell.grupo_caseiro}>{cell.grupo_caseiro}</h3>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{cell.setor}</p>
                    </div>
                  </div>
                  <span className={clsx("px-2.5 py-1 text-xs font-bold rounded-full border", cell.status === 'Ativo' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200')}>
                    {cell.status}
                  </span>
                </div>

                <div className="space-y-3 flex-1">
                  <div className="flex items-start gap-2 text-sm">
                    <Shield className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-gray-900 font-medium">{cell.lider}</p>
                      {cell.auxiliar && <p className="text-gray-500 text-xs">Aux: {cell.auxiliar}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="line-clamp-1">{cell.bairro} {cell.cidade && `- ${cell.cidade}`}</span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-600">Membros:</span>
                  </div>
                  <div className={clsx("px-3 py-1 rounded-full text-sm font-bold border", healthColor)}>
                    {cell.memberCount} {cell.limite_de_pessoas > 0 && <span className="opacity-75 font-normal text-xs">/ {cell.limite_de_pessoas}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
