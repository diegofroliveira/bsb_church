import React, { useEffect, useMemo, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

type DiscipleshipEntry = {
  id?: number | string;
  discipulador?: string;
  mestre?: string;
  discipulo?: string;
  status?: string;
  data_inicio?: string;
};

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const compareText = (left: string, right: string) =>
  left.localeCompare(right, 'pt-BR', { sensitivity: 'base' });

export const Discipleship: React.FC = () => {
  const [data, setData] = useState<DiscipleshipEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);

      try {
        const { data: results, error } = await supabase.from('discipulado').select('*').limit(10000);
        if (error) throw error;

        setData(results || []);
      } catch (error) {
        console.error('Error fetching discipleship data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, []);

  const filteredData = useMemo(() => {
    const query = normalizeText(searchTerm);

    return data
      .filter((item) => {
        if (!query) return true;

        const discipulador = normalizeText(item.discipulador || item.mestre);
        const discipulo = normalizeText(item.discipulo);
        return discipulador.includes(query) || discipulo.includes(query);
      })
      .sort((left, right) =>
        compareText(
          String(left.discipulador || left.mestre || ''),
          String(right.discipulador || right.mestre || ''),
        ),
      );
  }, [data, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Discipulado</h1>
        <p className="mt-2 text-sm text-gray-500">
          Acompanhamento de vínculos e crescimento espiritual.
        </p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
          <div className="relative w-full sm:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full rounded-lg border-0 py-2 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
              placeholder="Buscar discipulador ou discípulo..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px] relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          )}

          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="py-3.5 pl-6 pr-3 text-left text-sm font-semibold text-gray-900">
                  Discipulador
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Discípulo
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Início
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredData.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-medium text-gray-900">
                    {item.discipulador || item.mestre}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700">
                    {item.discipulo}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {item.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {item.data_inicio}
                  </td>
                </tr>
              ))}

              {filteredData.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-500">
                    Nenhum vínculo de discipulado encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
