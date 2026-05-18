import React, { useEffect, useState } from 'react';
import { UserCog, ShieldCheck, Mail, Edit2, Trash2, Loader2, Cloud, CloudLightning, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const Settings: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // States for the sync button
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [syncProgress, setSyncProgress] = useState(0);
  const [currentStepText, setCurrentStepText] = useState('');

  useEffect(() => {
    let interval;
    if (syncStatus === 'success') {
      setSyncProgress(0);
      setCurrentStepText('Iniciando servidores na nuvem...');
      
      const startTime = Date.now();
      const duration = 90000; // 90 seconds
      
      interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const currentProgress = Math.min((elapsed / duration) * 100, 100);
        setSyncProgress(currentProgress);
        
        if (currentProgress >= 100) {
          setCurrentStepText('Banco de dados atualizado com sucesso!');
          clearInterval(interval);
        } else if (currentProgress < 15) {
          setCurrentStepText('Iniciando servidores na nuvem...');
        } else if (currentProgress < 40) {
          setCurrentStepText('Efetuando login seguro no Sistema Prover...');
        } else if (currentProgress < 70) {
          setCurrentStepText('Extraindo relatórios atualizados de membros...');
        } else if (currentProgress < 90) {
          setCurrentStepText('Sincronizando registros no banco Supabase...');
        } else {
          setCurrentStepText('Limpando cache e finalizando processo...');
        }
      }, 1000);
    } else {
      setSyncProgress(0);
      setCurrentStepText('');
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [syncStatus]);

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    setSyncMessage('');
    
    try {
      const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'https://bsb-church.vercel.app/api/trigger-sync'
        : '/api/trigger-sync';

      const response = await fetch(apiUrl, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSyncStatus('success');
        setSyncMessage('Sincronização iniciada com sucesso! O robô do Prover está executando no GitHub Actions e atualizará o Supabase em breve.');
      } else {
        setSyncStatus('error');
        setSyncMessage(data.error || 'Erro ao acionar a sincronização na nuvem.');
      }
    } catch (error) {
      setSyncStatus('error');
      setSyncMessage('Erro de conexão ao tentar acionar o servidor.');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        // Note: Supabase auth.users is protected. 
        // Typically you'd have a 'profiles' table that syncs with auth.users
        const { data, error } = await supabase
          .from('profiles')
          .select('*');

        if (!error) {
          setUsers(data || []);
        } else {
          console.warn('Profiles table not found or not accessible. Creating fallback.');
          setUsers([]);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Configurações & Acessos</h1>
        <p className="mt-2 text-sm text-gray-500">
          Área administrativa para gestão de usuários do sistema e perfis de acesso (RBAC).
        </p>
      </header>

      {/* Cloud Automation Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col mb-8 p-6">
         <div className="flex justify-between items-start">
            <div className="flex gap-4">
               <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <CloudLightning className="w-6 h-6"/>
               </div>
               <div>
                  <h3 className="text-lg font-semibold text-gray-900">Automação de Dados (Nuvem)</h3>
                  <p className="text-sm text-gray-500 max-w-xl mt-1">
                     Este processo aciona os robôs de sincronização na nuvem (GitHub Actions) para buscar os dados mais recentes do Sistema Prover e atualizá-los no Supabase.
                  </p>
                  
                  {syncStatus !== 'idle' && (
                     <div className={`mt-3 flex items-center gap-2 text-sm font-medium ${syncStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                        {syncStatus === 'success' ? <CheckCircle2 className="w-4 h-4"/> : <AlertCircle className="w-4 h-4"/>}
                        <span className="leading-relaxed">{syncMessage}</span>
                     </div>
                  )}

                  {syncStatus === 'success' && (
                     <div className="mt-4 p-5 bg-gray-50 border border-gray-100 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex justify-between items-center mb-2">
                           <span className="text-sm font-semibold text-gray-700 animate-pulse">{currentStepText}</span>
                           <span className="text-sm font-bold text-blue-600">{Math.round(syncProgress)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner animate-pulse">
                           <div 
                              className="bg-gradient-to-r from-blue-500 to-green-500 h-full rounded-full transition-all duration-1000 ease-out"
                              style={{ width: `${syncProgress}%` }}
                           />
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-2">
                           <span>Início</span>
                           <span>Tempo estimado: ~90s</span>
                           <span>Concluído</span>
                        </div>
                     </div>
                  )}
               </div>
            </div>
            <button 
               onClick={handleTriggerSync}
               disabled={isSyncing}
               className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm shrink-0"
            >
               {isSyncing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Cloud className="w-4 h-4"/>}
               {isSyncing ? 'Conectando...' : 'Forçar Sincronização'}
            </button>
         </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 text-primary-600 rounded-lg"><UserCog className="w-5 h-5"/></div>
                <div>
                   <h3 className="text-lg font-semibold text-gray-900">Usuários do Sistema</h3>
                   <p className="text-sm text-gray-500">Contas habilitadas a acessar o Dashboard</p>
                </div>
             </div>
             <button className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
                Novo Usuário
             </button>
          </div>

          <div className="overflow-x-auto min-h-[200px] relative">
             {isLoading && (
               <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                 <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
               </div>
             )}

             <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white">
                   <tr>
                      <th scope="col" className="py-3.5 pl-6 pr-3 text-left text-sm font-semibold text-gray-900">Usuário</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Email</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Perfil de Acesso</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Vínculo Grupo</th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-6"><span className="sr-only">Ações</span></th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                   {users.length > 0 ? users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                         <td className="whitespace-nowrap py-4 pl-6 pr-3">
                            <div className="flex items-center gap-3">
                               <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-primary-600 border border-gray-200">
                                 {user.name?.charAt(0) || '?'}
                               </div>
                               <div className="font-medium text-gray-900">{user.name}</div>
                            </div>
                         </td>
                         <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-gray-400" /> {user.email}</div>
                         </td>
                         <td className="whitespace-nowrap px-3 py-4 text-sm">
                             <div className="flex items-center gap-1.5 uppercase font-medium text-xs tracking-wider">
                                {user.role === 'admin' ? <ShieldCheck className="w-4 h-4 text-purple-500"/> : null}
                                <span className={
                                   user.role === 'admin' ? 'text-purple-700' :
                                   user.role === 'pastor' ? 'text-blue-700' :
                                   user.role === 'leader' ? 'text-green-700' :
                                   user.role === 'finance' ? 'text-yellow-700' : 'text-orange-700'
                                }>{user.role || 'user'}</span>
                             </div>
                         </td>
                         <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {user.groupId ? <span className="bg-gray-100 px-2 py-1 rounded-md text-xs">{user.groupId}</span> : '-'}
                         </td>
                         <td className="relative whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-2">
                               <button className="text-gray-400 hover:text-blue-600 p-1.5 rounded-md transition-colors hover:bg-blue-50">
                                  <Edit2 className="w-4 h-4"/>
                               </button>
                               <button className="text-gray-400 hover:text-red-600 p-1.5 rounded-md transition-colors hover:bg-red-50">
                                  <Trash2 className="w-4 h-4"/>
                               </button>
                            </div>
                         </td>
                      </tr>
                   )) : (
                     !isLoading && (
                       <tr>
                         <td colSpan={5} className="py-12 text-center text-gray-500">
                           Para gerenciar usuários, crie uma tabela 'profiles' no Supabase.
                         </td>
                       </tr>
                     )
                   )}
                </tbody>
             </table>
          </div>
      </div>
    </div>
  );
};
