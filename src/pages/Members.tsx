import React, { useState, useEffect } from 'react';
import { Search, Filter, Mail, Phone, MoreVertical, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const Members: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const fetchMembers = async () => {
      setIsLoading(true);
      try {
        // Fetch page data and total count in parallel
        const [pageRes, countRes] = await Promise.all([
          supabase
            .from('membros')
            .select('id, nome, tipo_cadastro, grupos_caseiros, email, celular_principal_sms, status, foto')
            .ilike('nome', searchTerm ? `%${searchTerm}%` : '%')
            .order('nome', { ascending: true })
            .range((page - 1) * pageSize, page * pageSize - 1),
          supabase
            .from('membros')
            .select('id', { count: 'exact', head: true })
            .ilike('nome', searchTerm ? `%${searchTerm}%` : '%')
        ]);

        if (pageRes.error) throw pageRes.error;
        if (countRes.error) throw countRes.error;

        setMembers(pageRes.data || []);
        setTotalCount(countRes.count || 0);
      } catch (error) {
        console.error('Error fetching members:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchMembers();
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [searchTerm, page]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-gray-900">Membros & Visitantes</h1>
           <p className="mt-2 text-sm text-gray-500">
             Gestao completa do cadastro de pessoas da igreja.
           </p>
        </div>
        <button className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm text-center">
            + Novo Cadastro
        </button>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-gray-50/50 rounded-t-2xl">
             <div className="relative w-full sm:w-96">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                   <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                   type="text"
                   className="block w-full rounded-lg border-0 py-2 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6"
                   placeholder="Buscar por nome..."
                   value={searchTerm}
                   onChange={(e) => {
                     setSearchTerm(e.target.value);
                     setPage(1);
                   }}
                />
             </div>
             <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors w-full sm:w-auto justify-center">
                <Filter className="h-4 w-4" /> Filtros
             </button>
          </div>

          <div className="overflow-x-auto min-h-[400px] relative">
             {isLoading && (
               <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                 <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
               </div>
             )}
             
             <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white">
                   <tr>
                      <th scope="col" className="py-3.5 pl-6 pr-3 text-left text-sm font-semibold text-gray-900">Nome</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tipo</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Grupo Caseiro</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Contato</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-6"><span className="sr-only">Ações</span></th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                   {members.map((person) => (
                      <tr key={person.id} className="hover:bg-gray-50 transition-colors group">
                         <td className="whitespace-nowrap py-4 pl-6 pr-3">
                            <div className="flex items-center gap-3">
                               <div className="h-10 w-10 flex-shrink-0 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold border border-primary-200 overflow-hidden">
                                  {person.foto ? (
                                    <img src={person.foto} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    person.nome?.charAt(0) || '?'
                                  )}
                               </div>
                               <div className="font-medium text-gray-900">{person.nome}</div>
                            </div>
                         </td>
                         <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{person.tipo_cadastro}</td>
                         <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{person.grupos_caseiros || '-'}</td>
                         <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            <div className="flex flex-col gap-1">
                               {person.email && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" /> {person.email}</div>}
                               {person.celular_principal_sms && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" /> {person.celular_principal_sms}</div>}
                            </div>
                         </td>
                         <td className="whitespace-nowrap px-3 py-4 text-sm">
                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset 
                               ${person.status === 'Ativo' ? 'bg-green-50 text-green-700 ring-green-600/20' : 
                                 person.status === 'Inativo' ? 'bg-red-50 text-red-700 ring-red-600/20' : 
                                 'bg-yellow-50 text-yellow-800 ring-yellow-600/20'}`}>
                               {person.status}
                            </span>
                         </td>
                         <td className="relative whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                            <button className="text-gray-400 hover:text-gray-900 p-1 rounded-md transition-colors opacity-0 group-hover:opacity-100">
                               <MoreVertical className="w-5 h-5"/>
                            </button>
                         </td>
                      </tr>
                   ))}
                   {members.length === 0 && !isLoading && (
                     <tr>
                       <td colSpan={6} className="text-center py-12 text-gray-500">Nenhum membro encontrado.</td>
                     </tr>
                   )}
                </tbody>
             </table>
          </div>
          
          {/* Pagination */}
          <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between">
             <p className="text-sm text-gray-500">
               Mostrando <span className="font-medium">{(page - 1) * pageSize + 1}</span> a <span className="font-medium">{Math.min(page * pageSize, totalCount)}</span> de <span className="font-medium">{totalCount}</span> resultados
             </p>
             <div className="flex gap-2">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button 
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * pageSize >= totalCount}
                  className="px-3 py-1 border border-gray-200 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  Próxima
                </button>
             </div>
          </div>
      </div>
    </div>
  );
};
