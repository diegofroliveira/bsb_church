import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { UserCog, Plus, Save, X, Loader2, Check, Shield, Eye, EyeOff, Trash2, Lock, Cloud, CloudLightning, AlertCircle, CheckCircle2, Database } from 'lucide-react';
import clsx from 'clsx';
import { filterOperationalCells } from '../lib/operationalScope';

// UUID especial para armazenar a configuração global de perfis
const SPECIAL_CONFIG_ID = '00000000-0000-0000-0000-000000000000';

const AVAILABLE_MODULES = [
  { id: 'Dashboard',       label: 'Dashboard',       path: '/' },
  { id: 'Mapa',            label: 'Mapa',            path: '/georeferencing' },
  { id: 'Membros',         label: 'Membros',         path: '/members' },
  { id: 'Famílias',        label: 'Famílias',        path: '/families' },
  { id: 'Aniversariantes', label: 'Aniversariantes', path: '/birthdays' },
  { id: 'GCs/Localidades', label: 'GCs/Localidades', path: '/cells' },
  { id: 'Setores',         label: 'Setores',         path: '/sectors' },
  { id: 'Discipulado',     label: 'Discipulado',     path: '/discipleship' },
  { id: 'Rede',            label: 'Rede',            path: '/network' },
  { id: 'Simulações',      label: 'Simulações',      path: '/simulations' },
  { id: 'Relatórios',      label: 'Relatórios',      path: '/reports' },
  { id: 'QA',              label: 'QA',              path: '/qa' },
  { id: 'Financeiro',      label: 'Financeiro',      path: '/finance' },
  { id: 'Consultor IA',    label: 'Consultor IA',    path: '/ai-consultant' },
  { id: 'Insights IA',     label: 'Insights IA',     path: '/ai-insights' },
  { id: 'Configurações',   label: 'Configurações',   path: '/admin/users' },
  { id: 'Companheirismo',   label: 'Companheirismo',   path: '/companionship' },
  { id: 'Lab: Visão da Plenitude', label: 'Lab: Visão da Plenitude', path: '/lab/vision' },
  { id: 'Lab: Gestão de Visitas', label: 'Lab: Gestão de Visitas', path: '/lab/visits' },
  { id: 'Lab: Consultas & Estudos', label: 'Lab: Consultas & Estudos', path: '/lab/queries' },
];

const DEFAULT_ROLES: Record<string, { label: string; modules: string[] }> = {
  admin: { label: 'Administrador', modules: ['Dashboard', 'Mapa', 'Membros', 'Famílias', 'Aniversariantes', 'GCs/Localidades', 'Setores', 'Discipulado', 'Rede', 'Simulações', 'Relatórios', 'QA', 'Financeiro', 'Consultor IA', 'Insights IA', 'Configurações', 'Companheirismo', 'Lab: Visão da Plenitude', 'Lab: Gestão de Visitas', 'Lab: Consultas & Estudos'] },
  pastor: { label: 'Pastor', modules: ['Dashboard', 'Mapa', 'Membros', 'Famílias', 'Aniversariantes', 'GCs/Localidades', 'Setores', 'Discipulado', 'Rede', 'Simulações', 'Relatórios', 'QA', 'Financeiro', 'Consultor IA', 'Insights IA', 'Companheirismo', 'Lab: Visão da Plenitude', 'Lab: Gestão de Visitas', 'Lab: Consultas & Estudos'] },
  secretaria: { label: 'Secretaria', modules: ['Dashboard', 'Membros', 'GCs/Localidades', 'Discipulado', 'Rede', 'Relatórios', 'QA', 'Consultor IA'] },
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
  assigned_sector?: string;
}

export const AdminUsers: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'system'>('users');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Dynamic Roles State
  const [dynamicRoles, setDynamicRoles] = useState<Record<string, { label: string; modules: string[] }>>(DEFAULT_ROLES);
  const [isSavingRoles, setIsSavingRoles] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [selectedRoleForEdit, setSelectedRoleForEdit] = useState<string>('admin');
  const [optionsGC, setOptionsGC] = useState<string[]>([]);
  const sectorOptions = ['BSB_NORTE', 'BSB_CENTRAL', 'BSB_SUL', 'BSB_ÁGUAS CLARAS'];
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit User State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<string>('secretaria');
  const [editName, setEditName] = useState('');
  const [editAssignedGC, setEditAssignedGC] = useState('');
  const [editAssignedSector, setEditAssignedSector] = useState('');
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
  const [newAssignedSector, setNewAssignedSector] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Cloud Sync State
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [syncProgress, setSyncProgress] = useState(0);
  const [currentStepText, setCurrentStepText] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<string>('Buscando...');

  useEffect(() => {
    let interval: any;
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
          fetchLastSyncTime();
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
        const gcs = Array.from(new Set(filterOperationalCells(data).map(d => d.grupo_caseiro).filter(Boolean))) as string[];
        setOptionsGC(gcs.sort());
      }
    } catch (error) {
      console.error('Error fetching GCs:', error);
    }
  };

  const fetchLastSyncTime = async () => {
    try {
      const { data, error } = await supabase
        .from('membros')
        .select('data_atualizacao')
        .order('data_atualizacao', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0 && data[0].data_atualizacao) {
        const dateStr = data[0].data_atualizacao;
        const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
        if (match) {
          const [_, y, m, d, hr, min] = match;
          const now = new Date();
          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const dbDateOnly = `${y}-${m}-${d}`;
          
          if (dbDateOnly === todayStr) {
            setLastSyncTime(`Hoje, às ${hr}:${min}`);
          } else {
            const yesterday = new Date();
            yesterday.setDate(now.getDate() - 1);
            const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
            
            if (dbDateOnly === yesterdayStr) {
              setLastSyncTime(`Ontem, às ${hr}:${min}`);
            } else {
              setLastSyncTime(`${d}/${m}/${y} às ${hr}:${min}`);
            }
          }
        } else {
          setLastSyncTime(dateStr);
        }
      } else {
        setLastSyncTime('Sem dados');
      }
    } catch (err) {
      console.error('Erro ao buscar última sincronia:', err);
      setLastSyncTime('Não disponível');
    }
  };

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
    };
  };

  const parseApiResponse = async (response: Response) => {
    const text = await response.text();
    let body: any = {};
    if (text.trim()) {
      try { body = JSON.parse(text); }
      catch { body = { error: text.slice(0, 300) }; }
    }
    if (!response.ok) throw new Error(body.error || `Erro HTTP ${response.status}`);
    return body;
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/list-users', { headers: await getAuthHeaders() });
      const json = await parseApiResponse(res);
      setUsers(json.users || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      alert(`Erro ao carregar usuários: ${(error as Error).message}`);
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

      // Busca dados sincronizados na nuvem
      const { data } = await supabase
        .from('profiles')
        .select('avatar')
        .eq('role', 'admin');

      if (data && data.length > 0) {
        const rowWithConfig = data.find(r => r.avatar && r.avatar.startsWith('{"'));
        if (rowWithConfig && rowWithConfig.avatar) {
          const parsed = JSON.parse(rowWithConfig.avatar);
          setDynamicRoles(parsed);
          localStorage.setItem('church_dynamic_roles', rowWithConfig.avatar);
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
    fetchLastSyncTime();
  }, []);

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza absoluta que deseja EXCLUIR permanentemente o perfil do usuário "${userName}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    setDeletingId(userId);
    try {
      const res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ userId })
      });
      
      await parseApiResponse(res);
      setUsers(prev => prev.filter(u => u.id !== userId));
      alert('Usuário excluído com sucesso!');
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
        id: currentUser?.id,
        avatar: JSON.stringify(updatedRoles),
        email: currentUser?.email,
        name: currentUser?.name,
        role: currentUser?.role,
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
        headers: await getAuthHeaders(),
        body: JSON.stringify({ userId, password: pass })
      });

      await parseApiResponse(response);

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
      const res = await fetch('/api/update-user', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ userId, name: editName, role: editRole, assigned_gc: editAssignedGC, assigned_sector: editAssignedSector })
      });
      await parseApiResponse(res);

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, name: editName, role: editRole, assigned_gc: editAssignedGC, assigned_sector: editAssignedSector } : u));
      setSavedId(userId); setTimeout(() => setSavedId(null), 2000);
      
      if (userId === currentUser?.id) {
        await supabase.auth.refreshSession();
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
        headers: await getAuthHeaders(),
        body: JSON.stringify({ email: newEmail, password: newPassword, name: newName, role: newRole, assigned_gc: newAssignedGC, assigned_sector: newAssignedSector })
      });
      await parseApiResponse(response);

      const createdEmail = newEmail;
      const createdPassword = newPassword;
      fetchUsers();
      setShowNewForm(false); setNewEmail(''); setNewPassword(''); setNewName(''); setNewRole('secretaria'); setNewAssignedGC(''); setNewAssignedSector('');

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(createdPassword);
        alert(`Usuário ${newName} criado!\n\n📧 ${createdEmail}\n🔑 ${createdPassword}\n\nA senha já foi COPIADA para a área de transferência. Nenhum e-mail é enviado automaticamente — envie essas credenciais para o usuário por fora (WhatsApp, etc). Ele será obrigado a trocar a senha no primeiro acesso.`);
      } else {
        alert(`Usuário ${newName} criado!\n\n📧 ${createdEmail}\n🔑 ${createdPassword}\n\nNenhum e-mail é enviado automaticamente — envie essas credenciais para o usuário por fora (WhatsApp, etc). Ele será obrigado a trocar a senha no primeiro acesso.`);
      }
    } catch (err: any) {
      setCreateError(err.message || 'Falha ao criar usuário.');
    } finally { setCreating(false); }
  };

  const handleTriggerSync = async () => {
    setIsSyncingCloud(true);
    setSyncStatus('idle');
    setSyncMessage('');
    
    try {
      const apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'https://bsb-church.vercel.app/api/trigger-sync'
        : '/api/trigger-sync';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: await getAuthHeaders(),
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
      setIsSyncingCloud(false);
    }
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
        <button 
          onClick={() => setActiveTab('system')}
          className={clsx("pb-4 font-bold text-sm border-b-2 transition-all", activeTab === 'system' ? "border-primary-600 text-primary-600" : "border-transparent text-gray-400 hover:text-gray-600")}
        >
          Sistema & Sincronização
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vincular Setor</label>
                  <select value={newAssignedSector} onChange={e => setNewAssignedSector(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white font-medium">
                    <option value="">Acesso geral (sem setor)</option>
                    {sectorOptions.map(sector => <option key={sector} value={sector}>{sector}</option>)}
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">Autoriza a visão restrita do setor selecionado.</p>
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
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Setor autorizado</div>
                              <select value={editAssignedSector} onChange={e => setEditAssignedSector(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white shadow-sm font-medium">
                                <option value="">Acesso geral (sem setor)</option>
                                {sectorOptions.map(sector => <option key={sector} value={sector}>{sector}</option>)}
                              </select>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <div className="font-medium text-gray-900 text-sm">{u.name || u.email.split('@')[0]}</div>
                              <div className="text-xs text-gray-400">{u.email}</div>
                              {u.assigned_gc && <div className="text-[10px] text-purple-600 font-bold bg-purple-50 border border-purple-100 rounded px-1.5 py-0.5 mt-1 w-max">GC: {u.assigned_gc}</div>}
                              {u.assigned_sector && <div className="text-[10px] text-indigo-600 font-bold bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 mt-1 w-max">Setor: {u.assigned_sector}</div>}
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
                                    setEditAssignedSector(u.assigned_sector || '');
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
      ) : activeTab === 'roles' ? (
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
      ) : (
        /* System tab */
        <div className="space-y-6 animate-in fade-in duration-300">
           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                 <div className="flex gap-5">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl h-max shadow-inner">
                       <CloudLightning className="w-8 h-8"/>
                    </div>
                    <div>
                       <h3 className="text-xl font-bold text-gray-900">Automação de Dados (Nuvem)</h3>
                       <p className="text-sm text-gray-500 max-w-2xl mt-2 leading-relaxed">
                          Este processo aciona os robôs de sincronização na nuvem (GitHub Actions) para buscar os dados mais recentes do Sistema Prover e atualizá-los no Supabase.
                          <br/><br/>
                          <span className="font-semibold text-gray-700">Atenção:</span> Use este recurso apenas quando houver mudanças urgentes que não podem esperar pela sincronização automática programada.
                       </p>
                       
                       {syncStatus !== 'idle' && (
                          <div className={clsx(
                             "mt-6 flex items-center gap-3 p-4 rounded-xl border animate-in zoom-in-95 duration-300",
                             syncStatus === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'
                          )}>
                             {syncStatus === 'success' ? <CheckCircle2 className="w-5 h-5"/> : <AlertCircle className="w-5 h-5"/>}
                             <span className="font-semibold text-sm">{syncMessage}</span>
                          </div>
                       )}

                        {syncStatus === 'success' && (
                           <div className="mt-4 p-5 bg-gray-50 border border-gray-100 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                              <div className="flex justify-between items-center mb-2">
                                 <span className="text-sm font-semibold text-gray-700 animate-pulse">{currentStepText}</span>
                                 <span className="text-sm font-bold text-blue-600">{Math.round(syncProgress)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
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
                    disabled={isSyncingCloud}
                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-blue-100 group"
                 >
                    {isSyncingCloud ? <Loader2 className="w-5 h-5 animate-spin"/> : <Cloud className="w-5 h-5 group-hover:scale-110 transition-transform"/>}
                    {isSyncingCloud ? 'Processando...' : 'Forçar Atualização na Nuvem'}
                 </button>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                 <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Database className="w-5 h-5"/></div>
                    <h4 className="font-bold text-gray-900">Status da Base</h4>
                 </div>
                 <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                       <span className="text-gray-500">Última Sincronia</span>
                        <span className={clsx("font-medium transition-colors duration-500", syncProgress === 100 ? "text-green-600 font-bold" : "text-gray-900")}>
                           {syncProgress === 100 ? 'Agora mesmo' : lastSyncTime}
                        </span>
                     </div>
                     <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Próxima Agendada</span>
                        <span className="font-medium text-gray-900">Domingo, 03:00</span>
                     </div>
                     <div className="w-full bg-gray-100 rounded-full h-2 mt-4 overflow-hidden">
                        <div className={clsx("h-full rounded-full transition-all duration-500", syncProgress === 100 ? "bg-green-500 w-full animate-pulse" : "bg-green-500 w-full")}></div>
                     </div>
                     <p className={clsx("text-[10px] text-center uppercase font-black tracking-widest mt-2 transition-all duration-500", syncProgress === 100 ? "text-green-600 animate-bounce" : "text-gray-400")}>
                        {syncProgress === 100 ? 'Base Atualizada' : 'Sistema Operante'}</p>
                 </div>
              </div>
              
              <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                 <div className="relative z-10">
                    <h4 className="font-bold text-lg mb-2">Dica de Segurança</h4>
                    <p className="text-indigo-100 text-sm leading-relaxed">
                       A atualização forçada consome créditos de processamento em nuvem. Evite clicar várias vezes seguidas. Após o comando, aguarde alguns minutos para os dados aparecerem no Dashboard.
                    </p>
                 </div>
                 <Cloud className="absolute -right-4 -bottom-4 w-24 h-24 text-indigo-500 opacity-20" />
              </div>
           </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Regra de Segurança:</strong> O perfil `Administrador` possui acesso irrevogável a todas as telas para evitar bloqueios acidentais no sistema.
      </div>
    </div>
  );
};
