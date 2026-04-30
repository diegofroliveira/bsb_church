import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { UserCog, Plus, Save, X, Loader2, Check, Shield, Eye, EyeOff, Trash2, Lock, Cloud, CloudLightning, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import clsx from 'clsx';

// UUID especial para armazenar a configuração global de perfis
const SPECIAL_CONFIG_ID = '00000000-0000-0000-0000-000000000000';

const AVAILABLE_MODULES = [
  { id: 'Dashboard',       label: 'Dashboard',       path: '/' },
  { id: 'Mapa',            label: 'Mapa',            path: '/georeferencing' },
  { id: 'Membros',         label: 'Membros',         path: '/members' },
  { id: 'GCs/Localidades', label: 'GCs/Localidades', path: '/cells' },
  { id: 'Discipulado',     label: 'Discipulado',     path: '/discipleship' },
  { id: 'Rede',            label: 'Rede',            path: '/network' },
  { id: 'Relatórios',      label: 'Relatórios',      path: '/reports' },
  { id: 'QA',              label: 'QA',              path: '/qa' },
  { id: 'Financeiro',      label: 'Financeiro',      path: '/finance' },
  { id: 'Consultor IA',    label: 'Consultor IA',    path: '/ai-consultant' },
  { id: 'Insights IA',     label: 'Insights IA',     path: '/ai-insights' },
  { id: 'Aniversariantes', label: 'Aniversariantes', path: '/birthdays' },
  { id: 'Configurações',   label: 'Configurações',   path: '/admin/users' },
];

const DEFAULT_ROLES: Record<string, { label: string; modules: string[] }> = {
  admin: { label: 'Administrador', modules: ['Dashboard', 'Mapa', 'Membros', 'GCs/Localidades', 'Discipulado', 'Rede', 'Relatórios', 'QA', 'Financeiro', 'Consultor IA', 'Insights IA', 'Aniversariantes', 'Configurações'] },
  pastor: { label: 'Pastor', modules: ['Dashboard', 'Mapa', 'Membros', 'GCs/Localidades', 'Discipulado', 'Rede', 'Relatórios', 'QA', 'Financeiro', 'Consultor IA', 'Insights IA', 'Aniversariantes'] },
  secretaria: { label: 'Secretaria', modules: ['Dashboard', 'Membros', 'GCs/Localidades', 'Discipulado', 'Rede', 'Relatórios', 'QA', 'Consultor IA', 'Aniversariantes'] },
  financeiro: { label: 'Financeiro', modules: ['Dashboard', 'Financeiro'] }
};

interface AppUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string;
  created_at: string;
  assigned_gc?: string;
}

export const AdminUsers: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // States for the sync button
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [cloudRuns, setCloudRuns] = useState<any[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [progress, setProgress] = useState(0);

  const latestRun = cloudRuns[0] || null;

  const fetchCloudStatus = async () => {
    try {
      const res = await fetch('/api/trigger-sync');
      if (res.ok) {
        const data = await res.json();
        setCloudRuns(data.runs || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchCloudStatus();
    const interval = setInterval(fetchCloudStatus, 10000); // Polling 10s
    return () => clearInterval(interval);
  }, []);

  // Efeito da barra de progresso artificial
  useEffect(() => {
    let timer: any;
    if (latestRun && (latestRun.status === 'in_progress' || latestRun.status === 'queued')) {
      setProgress(5);
      timer = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) return 95; // Trava em 95% até terminar
          return prev + Math.floor(Math.random() * 5) + 1; // Incrementos aleatórios
        });
      }, 5000);
    } else {
      setProgress(100);
      const clearTimer = setTimeout(() => setProgress(0), 4000);
      return () => {
         clearInterval(timer);
         clearTimeout(clearTimer);
      };
    }
    return () => clearInterval(timer);
  }, [latestRun?.status]);

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    setSyncMessage('');
    
    try {
      const response = await fetch('/api/trigger-sync', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSyncStatus('success');
        setSyncMessage('Automação iniciada! Os dados serão atualizados em 1-2 minutos.');
      } else {
        setSyncStatus('error');
        setSyncMessage(data.error || 'Erro ao acionar a nuvem.');
      }
    } catch (error) {
      setSyncStatus('error');
      setSyncMessage('Erro de conexão com o servidor.');
    } finally {
      setIsSyncing(false);
      
      // Limpar a mensagem de sucesso depois de um tempo
      if (syncStatus === 'success') {
         setTimeout(() => setSyncStatus('idle'), 8000);
      }
    }
  };
  
  // Dynamic Roles State
  const [dynamicRoles, setDynamicRoles] = useState<Record<string, { label: string; modules: string[] }>>(DEFAULT_ROLES);
  const [isSavingRoles, setIsSavingRoles] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [selectedRoleForEdit, setSelectedRoleForEdit] = useState<string>('admin');
  const [optionsGC, setOptionsGC] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit User State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>('secretaria');
  const [editName, setEditName] = useState('');
  const [editAssignedGC, setEditAssignedGC] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  // New User State
  const [showNewForm, setShowNewForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<string>('secretaria');
  const [newAssignedGC, setNewAssignedGC] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const generateRandomPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#";
    let pass = "";
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pass);
  };

  const fetchGCs = async () => {
    try {
      const { data } = await supabase.from('celulas').select('grupo_caseiro');
      if (data) {
        const gcs = Array.from(new Set(data.map(d => d.grupo_caseiro).filter(Boolean))) as string[];
        setOptionsGC(gcs.sort());
      }
    } catch (error) {
      console.error('Error fetching GCs:', error);
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/list-users');
      if (res.ok) {
        const json = await res.json();
        setUsers(json.users || []);
      } else {
        const { data, error } = await supabase.from('profiles').select('*');
        if (!error && data) {
          const realUsers = data.filter(u => u.id !== SPECIAL_CONFIG_ID);
          setUsers(realUsers.map(u => ({ ...u, avatar: u.avatar || u.foto })));
        }
      }
    } catch (_) {
      try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (!error && data) {
          const realUsers = data.filter(u => u.id !== SPECIAL_CONFIG_ID);
          setUsers(realUsers.map(u => ({ ...u, avatar: u.avatar || u.foto })));
        }
      } catch (__) {}
    }
    setIsLoading(false);
  };

  const fetchRolesConfig = async () => {
    try {
      const stored = localStorage.getItem('church_dynamic_roles');
      if (stored) {
        const parsed = JSON.parse(stored);
        setDynamicRoles(parsed);
      }

      // Busca dados sincronizados na nuvem usando o ID especial
      const { data } = await supabase
        .from('profiles')
        .select('avatar')
        .eq('id', SPECIAL_CONFIG_ID);

      if (data && data.length > 0 && data[0].avatar) {
        const parsed = JSON.parse(data[0].avatar);
        setDynamicRoles(parsed);
        localStorage.setItem('church_dynamic_roles', data[0].avatar);
      } else {
        // Fallback: busca em admins caso a transição ainda não tenha ocorrido
        const { data: adminData } = await supabase
          .from('profiles')
          .select('avatar')
          .eq('role', 'admin');

        if (adminData && adminData.length > 0) {
          const rowWithConfig = adminData.find(r => r.avatar && r.avatar.startsWith('{"'));
          if (rowWithConfig && rowWithConfig.avatar) {
            const parsed = JSON.parse(rowWithConfig.avatar);
            setDynamicRoles(parsed);
            localStorage.setItem('church_dynamic_roles', rowWithConfig.avatar);
          }
        }
      }
    } catch (_) {
      console.log('Usando perfis padrão.');
    }
  };

  useEffect(() => { 
    fetchUsers(); 
    fetchRolesConfig();
    fetchGCs();
  }, []);

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza absoluta que deseja EXCLUIR permanentemente o perfil do usuário "${userName}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    setDeletingId(userId);
    try {
      const res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== userId));
        alert('Usuário excluído com sucesso!');
      } else {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Erro na exclusão');
      }
    } catch (err: any) {
      alert(`Erro ao excluir usuário: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const saveRolesConfig = async (updatedRoles: typeof dynamicRoles) => {
    setIsSavingRoles(true);
    try {
      localStorage.setItem('church_dynamic_roles', JSON.stringify(updatedRoles));
      
      const { error } = await supabase.from('profiles').upsert({
        id: SPECIAL_CONFIG_ID,
        avatar: JSON.stringify(updatedRoles),
        email: 'config@system.internal',
        name: 'Configuração Global de Perfis',
        role: 'system',
        updated_at: new Date().toISOString()
      });

      if (error) throw error;

      setDynamicRoles(updatedRoles);
      alert('Perfis e Permissões salvos com sucesso na nuvem!');
    } catch (err: any) {
      alert('Erro ao salvar permissões na nuvem: ' + err.message);
    } finally {
      setIsSavingRoles(false);
    }
  };

  const handleAdminResetPassword = async (userId: string) => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#";
    let pass = "";
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    if (!confirm(`Deseja resetar a senha deste usuário para uma senha temporária aleatória?\n\nNova senha proposta: ${pass}`)) {
      return;
    }

    setResettingId(userId);
    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password: pass })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro na requisição');
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(pass);
        alert(`Senha resetada com sucesso!\n\n🔑 ${pass}\n\nA senha já foi COPIADA automaticamente para a sua área de transferência! Cole onde precisar.\n\nO usuário será obrigado a alterá-la no primeiro acesso.`);
      } else {
        alert(`Senha resetada com sucesso!\n\nForneça a nova senha para o usuário:\n🔑 ${pass}\n\nO usuário será obrigado a alterá-la no primeiro acesso.`);
      }
    } catch (error: any) {
      alert('Erro ao resetar senha: ' + error.message);
    } finally {
      setResettingId(null);
    }
  };

  const saveProfile = async (userId: string) => {
    setSavingId(userId);
    try {
      const isCurrent = userId === currentUser?.id;

      if (isCurrent) {
        await supabase.auth.updateUser({ 
          data: { name: editName, role: editRole, assigned_gc: editAssignedGC } 
        });
      } else {
        const res = await fetch('/api/update-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, name: editName, role: editRole, assigned_gc: editAssignedGC })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Erro ao salvar perfil');
        }
      }

      const existingUser = users.find(u => u.id === userId);
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        email: existingUser?.email,
        name: editName,
        role: editRole,
        avatar: existingUser?.avatar || null,
        updated_at: new Date().toISOString()
      });

      if (error) throw error;

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, name: editName, role: editRole, assigned_gc: editAssignedGC } : u));
      setSavedId(userId); setTimeout(() => setSavedId(null), 2000);
      
      if (userId === currentUser?.id) {
        window.location.reload();
      }
    } catch (err: any) {
      alert('Erro ao salvar perfil: ' + err.message);
    } finally {
      setSavingId(null); setEditingId(null);
    }
  };

  const createUser = async () => {
    if (!newEmail || !newPassword || !newName) { setCreateError('Preencha todos os campos.'); return; }
    setCreating(true); setCreateError('');
    try {
      const response = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, password: newPassword, name: newName, role: newRole, assigned_gc: newAssignedGC })
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.error?.includes('SUPABASE_SERVICE_ROLE_KEY')) {
           const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
             email: newEmail,
             password: newPassword,
             options: {
               data: { name: newName, role: newRole, assigned_gc: newAssignedGC },
               emailRedirectTo: window.location.origin
             }
           });
           
           if (signUpError) throw signUpError;

           if (signUpData.user) {
              await supabase.from('profiles').insert({
                 id: signUpData.user.id,
                 email: newEmail,
                 name: newName,
                 role: newRole,
                 avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${newName}`
              });
           }
           
           setShowNewForm(false); setNewEmail(''); setNewPassword(''); setNewName(''); setNewRole('secretaria');
           fetchUsers();
           alert('Usuário cadastrado. IMPORTANTE: Ele deve confirmar o e-mail.');
           return;
        }
        throw new Error(result.error || 'Falha ao criar usuário');
      }

      fetchUsers();
      setShowNewForm(false); setNewEmail(''); setNewPassword(''); setNewName(''); setNewRole('secretaria'); setNewAssignedGC('');
      alert('Usuário ' + newName + ' criado!');
    } catch (err: any) {
      setCreateError(err.message || 'Falha ao criar usuário.');
    } finally { setCreating(false); }
  };

  const handleToggleModule = (roleKey: string, moduleId: string) => {
    const currentModules = dynamicRoles[roleKey]?.modules || [];
    const updatedModules = currentModules.includes(moduleId)
      ? currentModules.filter(m => m !== moduleId)
      : [...currentModules, moduleId];

    const updatedRoles = {
      ...dynamicRoles,
      [roleKey]: {
        ...dynamicRoles[roleKey],
        modules: updatedModules
      }
    };
    
    setDynamicRoles(updatedRoles);
  };

  const handleAddRole = () => {
    if (!newRoleName.trim()) return;
    const key = newRoleName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
    if (dynamicRoles[key]) { alert('Este perfil já existe!'); return; }

    const updatedRoles = {
      ...dynamicRoles,
      [key]: {
        label: newRoleName,
        modules: ['Dashboard']
      }
    };

    setDynamicRoles(updatedRoles);
    setSelectedRoleForEdit(key);
    setNewRoleName('');
  };

  const handleDeleteRole = (keyToDelete: string) => {
    if (['admin', 'pastor', 'secretaria', 'financeiro'].includes(keyToDelete)) {
      alert('Perfis padrão do sistema não podem ser excluídos.');
      return;
    }
    const { [keyToDelete]: _, ...remainingRoles } = dynamicRoles;
    setDynamicRoles(remainingRoles);
    setSelectedRoleForEdit('admin');
  };

  return (
    // Cache-busting comment to force Vercel to redeploy a fresh version.
    <div className="space-y-6 animate-in fade-in duration-700 max-w-5xl mx-auto pb-12 px-4">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-sm font-semibold mb-3 border border-purple-100">
            <Shield className="w-4 h-4" /> Administração
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Configurações de Acesso</h1>
          <p className="mt-2 text-sm text-gray-500">Gerencie perfis de acesso e usuários do IgrejaPro.</p>
        </div>
        {activeTab === 'users' && (
          <button onClick={() => { setShowNewForm(true); generateRandomPassword(); }}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Novo Usuário
          </button>
        )}
      </header>

      {/* Cloud Automation Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col mb-8 p-6">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex gap-4 items-start">
               <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                  <CloudLightning className="w-6 h-6"/>
               </div>
               <div>
                  <h3 className="text-lg font-semibold text-gray-900">Automação de Dados (Nuvem)</h3>
                  <p className="text-sm text-gray-500 max-w-xl mt-1">
                     A base de dados é atualizada automaticamente todo Domingo às 03:00. 
                     Caso você precise forçar uma atualização agora mesmo, clique no botão ao lado.
                  </p>
                  
                  {latestRun && (
                     <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200/50 flex flex-col gap-3 max-w-md">
                        <div className="flex justify-between items-center">
                           <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                              <span className={`w-2 h-2 rounded-full ${
                                 latestRun.status === 'in_progress' || latestRun.status === 'queued'
                                 ? 'bg-amber-500 animate-pulse' 
                                 : latestRun.conclusion === 'success' 
                                 ? 'bg-green-500' 
                                 : 'bg-red-500'
                              }`}/>
                              Robô: {
                                 latestRun.status === 'in_progress' || latestRun.status === 'queued' 
                                 ? 'Atualizando dados...' 
                                 : latestRun.conclusion === 'success' 
                                 ? 'Atualização finalizada' 
                                 : 'Falha na última execução'
                              }
                           </div>
                           
                           <button 
                              onClick={() => setShowHistoryModal(true)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline flex items-center gap-1"
                           >
                              <Clock className="w-3 h-3"/> Ver Histórico
                           </button>
                        </div>

                        {/* Artificial Progress Bar */}
                        {(latestRun.status === 'in_progress' || latestRun.status === 'queued' || progress > 0) && (
                           <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden mt-1">
                              <div 
                                 className="bg-blue-600 h-full transition-all duration-500 ease-out rounded-full" 
                                 style={{ width: `${progress}%` }}
                              />
                           </div>
                        )}
                        
                        {latestRun.updated_at && (
                           <div className="text-xs text-gray-400">
                              Última sincronia completa: {new Date(latestRun.updated_at).toLocaleString('pt-BR', {
                                 day: '2-digit',
                                 month: '2-digit',
                                 year: 'numeric',
                                 hour: '2-digit',
                                 minute: '2-digit'
                              })}
                           </div>
                        )}
                     </div>
                  )}

                  {syncStatus !== 'idle' && (
                     <div className={`mt-3 flex items-center gap-2 text-sm font-medium ${syncStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                        {syncStatus === 'success' ? <CheckCircle2 className="w-4 h-4"/> : <AlertCircle className="w-4 h-4"/>}
                        {syncMessage}
                     </div>
                  )}
               </div>
            </div>
            <button 
               onClick={handleTriggerSync}
               disabled={isSyncing}
               className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm shrink-0 w-full sm:w-auto"
            >
               {isSyncing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Cloud className="w-4 h-4"/>}
               {isSyncing ? 'Conectando...' : 'Forçar Atualização'}
            </button>
         </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 mb-6 gap-6">
        <button 
          onClick={() => setActiveTab('users')}
          className={clsx("pb-4 font-bold text-sm border-b-2 transition-all", activeTab === 'users' ? "border-primary-600 text-primary-600" : "border-transparent text-gray-400 hover:text-gray-600")}
        >
          Usuários Cadastrados
        </button>
        <button 
          onClick={() => setActiveTab('roles')}
          className={clsx("pb-4 font-bold text-sm border-b-2 transition-all", activeTab === 'roles' ? "border-primary-600 text-primary-600" : "border-transparent text-gray-400 hover:text-gray-600")}
        >
          Gerenciamento de Perfis (RBAC)
        </button>
      </div>

      {activeTab === 'users' ? (
        <>
          {/* New user form */}
          {showNewForm && (
            <div className="bg-white rounded-xl border border-primary-200 ring-1 ring-primary-50 p-6 mb-4 shadow-sm animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2"><UserCog className="w-5 h-5 text-primary-600" /> Novo Usuário</h3>
                <button onClick={() => setShowNewForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
                  <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Ex: Ana Silva" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="email@igreja.com" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">Senha temporária</label>
                    <button type="button" onClick={generateRandomPassword} className="text-xs font-bold text-primary-600 hover:text-primary-500">Gerar nova</button>
                  </div>
                  <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none font-mono font-semibold bg-gray-50/50" placeholder="Mínimo 6 caracteres" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Perfil de acesso</label>
                  <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white font-medium">
                    {Object.entries(dynamicRoles).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vincular Grupo Caseiro (GC)</label>
                  <select 
                    value={newAssignedGC} 
                    onChange={e => setNewAssignedGC(e.target.value)} 
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white font-medium"
                  >
                    <option value="">Acesso Geral (Sem restrição)</option>
                    {optionsGC.map(gc => (
                      <option key={gc} value={gc}>{gc}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">Isola o acesso deste usuário para ver apenas os dados deste GC.</p>
                </div>
              </div>
              {createError && <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">{createError}</p>}
              <div className="flex gap-3 mt-4">
                <button onClick={createUser} disabled={creating}
                  className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Criar Usuário
                </button>
                <button onClick={() => setShowNewForm(false)} className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2 border border-gray-200 rounded-lg">Cancelar</button>
              </div>
            </div>
          )}

          {/* Users list */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h2 className="font-semibold text-gray-900">Usuários cadastrados ({users.length})</h2>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-white">
                  <tr>
                    <th className="py-3 pl-6 pr-3 text-left text-xs font-semibold text-gray-500 uppercase">Usuário</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Perfil atual</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Alterar para</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map(u => {
                    const ri = dynamicRoles[u.role] || { label: u.role, modules: [] };
                    const isEditing = editingId === u.id;
                    const isCurrent = u.id === currentUser?.id;
                    return (
                      <tr key={u.id} className="hover:bg-gray-50/50">
                        <td className="py-4 pl-6 pr-3">
                          {isEditing ? (
                            <div className="flex flex-col gap-2">
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Nome de exibição</div>
                              <input 
                                value={editName} 
                                onChange={e => setEditName(e.target.value)} 
                                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white shadow-sm" 
                                placeholder="Ex: Diego" 
                              />
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Grupo Caseiro (GC)</div>
                              <select 
                                value={editAssignedGC} 
                                onChange={e => setEditAssignedGC(e.target.value)} 
                                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white shadow-sm font-medium"
                              >
                                <option value="">Acesso Geral (Sem restrição)</option>
                                {optionsGC.map(gc => (
                                  <option key={gc} value={gc}>{gc}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <div className="font-medium text-gray-900 text-sm">{u.name || u.email.split('@')[0]}</div>
                              <div className="text-xs text-gray-400">{u.email}</div>
                              {u.assigned_gc && <div className="text-[10px] text-purple-600 font-bold bg-purple-50 border border-purple-100 rounded px-1.5 py-0.5 mt-1 w-max">GC: {u.assigned_gc}</div>}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-4 align-top">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-gray-50 text-gray-700 border-gray-200">{ri.label}</span>
                          {isCurrent && <div className="mt-1 text-[10px] text-primary-500 font-bold uppercase tracking-tighter">(Você)</div>}
                        </td>
                        <td className="px-3 py-4 align-top">
                          {isEditing ? (
                            <select value={editRole} onChange={e => setEditRole(e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white shadow-sm font-medium">
                              {Object.entries(dynamicRoles).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
                            </select>
                          ) : (
                            <span className="text-sm text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-4 text-right align-top">
                          {savedId === u.id ? (
                            <span className="text-green-600 text-sm flex items-center gap-1 justify-end font-bold"><Check className="w-4 h-4" /> Atualizado</span>
                          ) : isEditing ? (
                            <div className="flex flex-col gap-2 items-end">
                              <button onClick={() => saveProfile(u.id)} disabled={!!savingId}
                                className="w-full flex justify-center items-center gap-2 bg-primary-600 text-white px-4 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50 text-xs font-bold transition-all shadow-md">
                                {savingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
                              </button>
                              <button onClick={() => setEditingId(null)} className="w-full text-xs text-gray-500 border border-gray-200 px-4 py-1.5 rounded-lg hover:bg-gray-50 transition-colors bg-white">Cancelar</button>
                            </div>
                          ) : (
                                <div className="flex flex-col gap-1.5 items-end">
                                  <button onClick={() => { 
                                    setEditingId(u.id); 
                                    setEditRole(u.role); 
                                    setEditName(u.name || ''); 
                                    setEditAssignedGC(u.assigned_gc || '');
                                  }}
                                    className="text-xs text-primary-600 hover:text-primary-800 font-bold border border-primary-100 px-3 py-1.5 rounded-lg bg-primary-50/30 hover:bg-primary-50 transition-all w-full text-center">
                                    Editar perfil
                                  </button>
                                  {!isCurrent && (
                                    <>
                                      <button onClick={() => handleAdminResetPassword(u.id)} disabled={resettingId === u.id}
                                        className="text-xs text-amber-600 hover:text-amber-800 font-bold border border-amber-100 px-3 py-1.5 rounded-lg bg-amber-50/30 hover:bg-amber-50 transition-all w-full flex items-center justify-center gap-1 disabled:opacity-50">
                                        {resettingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lock className="w-3 h-3" />} Resetar senha
                                      </button>
                                      <button onClick={() => handleDeleteUser(u.id, u.name || u.email)} disabled={deletingId === u.id}
                                        className="text-xs text-red-600 hover:text-red-800 font-bold border border-red-100 px-3 py-1.5 rounded-lg bg-red-50/30 hover:bg-red-50 transition-all w-full flex items-center justify-center gap-1 disabled:opacity-50">
                                        {deletingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Excluir perfil
                                      </button>
                                    </>
                                  )}
                                </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        /* RBAC Roles and Permissions Screen */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          
          {/* Left Column: Role List */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-primary-600" /> Perfis Ativos</h3>
              
              <div className="space-y-2">
                {Object.entries(dynamicRoles).map(([key, r]) => (
                  <div 
                    key={key} 
                    onClick={() => setSelectedRoleForEdit(key)}
                    className={clsx(
                      "flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all",
                      selectedRoleForEdit === key 
                        ? "border-primary-500 bg-primary-50/30 ring-1 ring-primary-100" 
                        : "border-gray-100 hover:border-gray-200 bg-gray-50/10"
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900 text-sm">{r.label}</span>
                      <span className="text-[10px] text-gray-400 font-semibold uppercase">{r.modules.length} módulos liberados</span>
                    </div>
                    {selectedRoleForEdit === key && <Check className="w-4 h-4 text-primary-600" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Add New Role Input */}
            <div className="mt-6 pt-4 border-t border-gray-100 space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Criar Novo Perfil</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newRoleName} 
                  onChange={e => setNewRoleName(e.target.value)}
                  placeholder="Ex: Diácono, Líder..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
                <button 
                  onClick={handleAddRole}
                  className="p-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Module Permission Selector */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
              <div>
                <h3 className="font-bold text-gray-900">Módulos permitidos para: <span className="text-primary-600">{dynamicRoles[selectedRoleForEdit]?.label}</span></h3>
                <p className="text-xs text-gray-400">Ative ou desative os menus que este perfil poderá acessar.</p>
              </div>
              {!['admin', 'pastor', 'secretaria', 'financeiro'].includes(selectedRoleForEdit) && (
                <button 
                  onClick={() => handleDeleteRole(selectedRoleForEdit)}
                  className="text-red-500 hover:text-red-600 flex items-center gap-1 text-xs font-bold border border-red-100 px-3 py-1.5 rounded-lg bg-red-50/30"
                >
                  <Trash2 className="w-3 h-3" /> Excluir Perfil
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {AVAILABLE_MODULES.map((m) => {
                const isAllowed = dynamicRoles[selectedRoleForEdit]?.modules.includes(m.id);
                // Admin não pode ter módulos removidos para não se trancar
                const disabled = selectedRoleForEdit === 'admin';

                return (
                  <div 
                    key={m.id}
                    onClick={() => !disabled && handleToggleModule(selectedRoleForEdit, m.id)}
                    className={clsx(
                      "flex items-center justify-between p-4 rounded-xl border transition-all select-none",
                      disabled ? "opacity-70 cursor-not-allowed" : "cursor-pointer",
                      isAllowed 
                        ? "border-green-200 bg-green-50/20 text-green-800" 
                        : "border-gray-100 text-gray-500 bg-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={clsx("p-2 rounded-lg", isAllowed ? "bg-green-100/50 text-green-600" : "bg-gray-100 text-gray-400")}>
                        {isAllowed ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </div>
                      <span className="font-bold text-sm tracking-tight">{m.label}</span>
                    </div>
                    <div className={clsx("w-5 h-5 rounded-md border flex items-center justify-center transition-all", isAllowed ? "bg-green-500 border-green-500 text-white" : "border-gray-300")}>
                      {isAllowed && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end">
              <button 
                onClick={() => saveRolesConfig(dynamicRoles)}
                disabled={isSavingRoles}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md disabled:opacity-50"
              >
                {isSavingRoles ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar Alterações de Perfil
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Regra de Segurança:</strong> O perfil `Administrador` possui acesso irrevogável a todas as telas para evitar bloqueios acidentais no sistema.
      </div>

      {/* History Modal Popup */}
      {showHistoryModal && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
               <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <div className="flex items-center gap-2">
                     <Clock className="w-5 h-5 text-gray-500"/>
                     <h3 className="text-lg font-bold text-gray-900">Histórico de Atualizações</h3>
                  </div>
                  <button 
                     onClick={() => setShowHistoryModal(false)}
                     className="p-1 rounded-xl bg-gray-200/50 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                  >
                     <X className="w-5 h-5"/>
                  </button>
               </div>

               <div className="p-6 flex-1 overflow-y-auto max-h-[60vh] space-y-3">
                  {cloudRuns.length === 0 ? (
                     <div className="text-center text-sm text-gray-400 py-8">
                        Nenhuma execução encontrada.
                     </div>
                  ) : (
                     cloudRuns.map((run) => (
                        <div key={run.id} className="p-4 bg-white border border-gray-100 rounded-2xl flex items-center justify-between gap-4 shadow-sm hover:border-gray-200 transition-all">
                           <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                 <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                    run.event === 'schedule' 
                                    ? 'bg-purple-100 text-purple-700' 
                                    : 'bg-blue-100 text-blue-700'
                                 }`}>
                                    {run.event === 'schedule' ? '🗓️ Agendada' : '⚡ Forçada'}
                                 </span>
                                 
                                 <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                    run.status === 'completed' 
                                       ? run.conclusion === 'success' 
                                          ? 'bg-green-100 text-green-700' 
                                          : 'bg-red-100 text-red-700'
                                       : 'bg-amber-100 text-amber-700 animate-pulse'
                                 }`}>
                                    {run.status === 'completed' 
                                       ? run.conclusion === 'success' 
                                          ? 'Sucesso' 
                                          : 'Falha'
                                       : 'Executando...'}
                                 </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1 font-medium">
                                 {new Date(run.created_at).toLocaleString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                 })}
                              </div>
                           </div>
                           
                           <div className="text-xs text-gray-400 font-mono">
                              #{String(run.id).substring(0, 8)}
                           </div>
                        </div>
                     ))
                  )}
               </div>

               <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                  <button 
                     onClick={() => setShowHistoryModal(false)}
                     className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
                  >
                     Fechar
                  </button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};
