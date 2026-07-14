import React, { useEffect, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { supabaseReader } from '../lib/supabase';

const normalizeName = (value: unknown): string => String(value || '')
  .trim()
  .toUpperCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ');

const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
};

const formatDuration = (value?: string | null): string => {
  if (!value) return '-';
  const start = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(start.getTime()) || start > new Date()) return '-';
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) return '-';
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) return `${remainingMonths} ${remainingMonths === 1 ? 'mês' : 'meses'}`;
  if (remainingMonths === 0) return `${years} ${years === 1 ? 'ano' : 'anos'}`;
  return `${years}a ${remainingMonths}m`;
};

export const Discipleship: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [memberDates, setMemberDates] = useState<Record<string, { data_de_vinculo?: string | null; data_de_cadastro?: string | null }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        let query = supabaseReader.from('discipulado').select('*');
        
        if (searchTerm) {
          query = query.or(`discipulador.ilike.%${searchTerm}%,discipulo.ilike.%${searchTerm}%`);
        }

        const [{ data: results, error }, { data: members }] = await Promise.all([
          query.order('discipulador', { ascending: true }),
          supabaseReader.from('membros').select('nome, data_de_vinculo, data_de_cadastro')
        ]);
        if (error) throw error;
        setMemberDates(Object.fromEntries((members || []).map((member: any) => [
          normalizeName(member.nome),
          { data_de_vinculo: member.data_de_vinculo, data_de_cadastro: member.data_de_cadastro }
        ])));
        const uniqueResults = Array.from(new Map(
          (results || [])
            .filter((item: any) => item.discipulador?.trim() && item.discipulo?.trim())
            .map((item: any) => [
              `${item.discipulador.trim().replace(/\s+/g, ' ').toUpperCase()}->${item.discipulo.trim().replace(/\s+/g, ' ').toUpperCase()}`,
              item
            ])
        ).values());
        setData(uniqueResults);
      } catch (error) {
        console.error('Error fetching discipleship data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Discipulado (MDA)</h1>
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
                   onChange={(e) => setSearchTerm(e.target.value)}
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
                      <th className="py-3.5 pl-6 pr-3 text-left text-sm font-semibold text-gray-900">Discípulo</th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Discipulador</th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Início</th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tempo</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                   {data.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                         <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-medium text-gray-900">{item.discipulo}</td>
                         <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-700">{item.discipulador}</td>
                         <td className="whitespace-nowrap px-3 py-4 text-sm">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                               {item.status}
                            </span>
                         </td>
                         {(() => {
                           const dates = memberDates[normalizeName(item.discipulo)];
                           const start = item.data_inicio || dates?.data_de_vinculo || dates?.data_de_cadastro;
                           const source = item.data_inicio ? 'Discipulado' : dates?.data_de_vinculo ? 'Vínculo na igreja' : dates?.data_de_cadastro ? 'Cadastro' : 'Sem data';
                           return <>
                             <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                               <span>{formatDate(start)}</span>
                               <span className="block text-[10px] text-gray-400">{source}</span>
                             </td>
                             <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-600">{formatDuration(start)}</td>
                           </>;
                         })()}
                      </tr>
                   ))}
                   {data.length === 0 && !isLoading && (
                     <tr>
                       <td colSpan={5} className="text-center py-12 text-gray-500">Nenhum vínculo de discipulado encontrado.</td>
                     </tr>
                   )}
                </tbody>
             </table>
          </div>
      </div>
    </div>
  );
};
