import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Users, CalendarCheck2, MessageCircleHeart, Loader2 } from 'lucide-react';

export const MyGroup: React.FC = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const groupName = user?.groupId || "Meu Grupo";

  useEffect(() => {
    const fetchGroupMembers = async () => {
      if (!user?.groupId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('membros')
          .select('*')
          .ilike('grupos_caseiros', `%${user.groupId}%`);

        if (error) throw error;
        setMembers(data || []);
      } catch (error) {
        console.error('Error fetching group members:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroupMembers();
  }, [user?.groupId]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{groupName}</h1>
        <p className="mt-2 text-sm text-gray-500">
          Visão exclusiva para o líder. Acompanhe a saúde e os membros do seu grupo.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Users className="w-6 h-6"/></div>
            <div>
               <p className="text-sm font-medium text-gray-500">Membros</p>
               <p className="text-2xl font-bold text-gray-900">{members.length}</p>
            </div>
         </div>
         <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center"><CalendarCheck2 className="w-6 h-6"/></div>
            <div>
               <p className="text-sm font-medium text-gray-500">Média de Presença</p>
               <p className="text-2xl font-bold text-gray-900">--%</p>
            </div>
         </div>
         <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center"><MessageCircleHeart className="w-6 h-6"/></div>
            <div>
               <p className="text-sm font-medium text-gray-500">Acompanhamentos</p>
               <p className="text-2xl font-bold text-gray-900">0 <span className="text-sm font-normal text-gray-400">pendentes</span></p>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
         <h3 className="text-lg font-semibold leading-6 text-gray-900 mb-4">Lista de Participantes</h3>
         <p className="text-sm text-gray-500 mb-6">Lista oficial extraída da base de dados.</p>
         
         {members.length > 0 ? (
           <ul className="divide-y divide-gray-100">
              {members.map((member, i) => (
                 <li key={i} className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center font-medium text-primary-600 overflow-hidden border border-primary-100">
                         {member.foto ? <img src={member.foto} className="w-full h-full object-cover" /> : member.nome?.charAt(0)}
                       </div>
                       <div>
                          <p className="text-sm font-medium text-gray-900">{member.nome}</p>
                          <p className="text-xs text-gray-500">{member.tipo_cadastro} • {member.status}</p>
                       </div>
                    </div>
                    <button className="px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-md transition-colors">
                       Ver Detalhes
                    </button>
                 </li>
              ))}
           </ul>
         ) : (
           <div className="text-center py-12 text-gray-500">Nenhum membro vinculado a este grupo foi encontrado na base.</div>
         )}
      </div>
    </div>
  );
};
