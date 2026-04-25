import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { UserCog, Plus, Save, X, Loader2, Check, Shield } from 'lucide-react';
import clsx from 'clsx';

type Role = 'admin' | 'pastor' | 'secretaria' | 'financeiro';

const ROLES: { value: Role; label: string; desc: string; color: string }[] = [
  { value: 'admin',      label: 'Administrador', desc: 'Acesso total, incluindo gestão de usuários', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'pastor',     label: 'Pastor',        desc: 'Acesso a todos os módulos exceto gestão de usuários', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'secretaria', label: 'Secretaria',    desc: 'Membros, Células, Relatórios, QA, Discipulado e Rede — sem Financeiro', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'financeiro', label: 'Financeiro',    desc: 'Somente Dashboard e Financeiro', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
];

interface AppUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatar?: string;
  created_at: string;
}

export const AdminUsers: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<Role>('secretaria');
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<Role>('secretaria');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (!error && data) { 
        setUsers(data.map(u => ({ ...u, avatar: u.avatar || u.foto }))); 
        setIsLoading(false); 
        return; 
      }
    } catch (_) {}
    if (currentUser) {
      setUsers([{ id: currentUser.id, email: currentUser.email, name: currentUser.name, role: currentUser.role as Role, avatar: currentUser.avatar, created_at: new Date().toISOString() }]);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const saveProfile = async (userId: string) => {
    setSavingId(userId);
    try {
      const isCurrent = userId === currentUser?.id;

      // 1. Atualizar Metadados no Auth
      if (isCurrent) {
        await supabase.auth.updateUser({ 
          data: { name: editName, role: editRole, avatar: editAvatar } 
        });
      } else {
        await supabase.auth.admin.updateUserById(userId, { 
          user_metadata: { name: editName, role: editRole, avatar: editAvatar } 
        }).catch(() => console.log('Admin API restrita, atualizando apenas tabela pública...'));
      }

      // 2. Atualizar Tabela Pública de Perfis
      const { error } = await supabase.from('profiles').upsert({
        id: userId,
        email: users.find(u => u.id === userId)?.email,
        name: editName,
        role: editRole,
        updated_at: new Date().toISOString()
      });

      if (error) throw error;

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, name: editName, role: editRole, avatar: editAvatar } : u));
      setSavedId(userId); setTimeout(() => setSavedId(null), 2000);
      
      if (userId === currentUser?.id) {
        // Recarregar para atualizar avatar/nome no Sidebar
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
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          name: newName,
          role: newRole
        })
      });

      const result = await response.json();

      if (!response.ok) {
        // Se o erro for falta de chave no servidor, tentamos o Plano B (SignUp público)
        if (result.error?.includes('SUPABASE_SERVICE_ROLE_KEY')) {
           console.log('Tentando Plano B: SignUp público...');
           const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
             email: newEmail,
             password: newPassword,
             options: {
               data: { name: newName, role: newRole },
               emailRedirectTo: window.location.origin
             }
           });
           
           if (signUpError) throw signUpError;

           // Criar perfil na tabela pública imediatamente
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
           alert('Usuário cadastrado via Plano B. \n\nIMPORTANTE: Ele deve confirmar o e-mail ' + newEmail + '. Ele já aparecerá na lista.');
           return;
        }
        throw new Error(result.error || 'Falha ao criar usuário');
      }

      // Sucesso na API Normal:
      fetchUsers();
      setShowNewForm(false); setNewEmail(''); setNewPassword(''); setNewName(''); setNewRole('secretaria');
      alert('Usuário ' + newName + ' criado com sucesso!');
    } catch (err: any) {
      console.error('Erro na criação:', err);
      setCreateError(err.message || 'Falha ao criar usuário. Verifique se o e-mail já existe ou se a chave de serviço está configurada.');
    } finally { setCreating(false); }
  };

  const roleInfo = (role: string) => ROLES.find(r => r.value === role) || ROLES[2];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto pb-12">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-sm font-semibold mb-3 border border-purple-100">
            <Shield className="w-4 h-4" /> Administração
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Configurações de Acesso</h1>
          <p className="mt-2 text-sm text-gray-500">Gerencie perfis de acesso e usuários do IgrejaPro.</p>
        </div>
        <button onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Novo Usuário
        </button>
      </header>

      {/* Role legend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {ROLES.map(r => (
          <div key={r.value} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-full border', r.color)}>{r.label}</span>
            <p className="text-xs text-gray-500 mt-2">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* New user form */}
      {showNewForm && (
        <div className="bg-white rounded-xl border border-primary-200 ring-1 ring-primary-50 p-6 mb-4 shadow-sm">
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha inicial</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Mínimo 6 caracteres" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Perfil de acesso</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value as Role)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
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
                const ri = roleInfo(u.role);
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
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <div className="font-medium text-gray-900 text-sm">{u.name || u.email.split('@')[0]}</div>
                            <div className="text-xs text-gray-400">{u.email}</div>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-4 align-top">
                      <span className={clsx('text-xs font-semibold px-2 py-1 rounded-full border', ri.color)}>{ri.label}</span>
                      {isCurrent && <div className="mt-1 text-[10px] text-primary-500 font-bold uppercase tracking-tighter">(Você)</div>}
                    </td>
                    <td className="px-3 py-4 align-top">
                      {isEditing ? (
                        <select value={editRole} onChange={e => setEditRole(e.target.value as Role)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white shadow-sm">
                          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
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
                        <button onClick={() => { 
                          setEditingId(u.id); 
                          setEditRole(u.role); 
                          setEditName(u.name || ''); 
                          setEditAvatar(u.avatar || ''); 
                        }}
                          className="text-xs text-primary-600 hover:text-primary-800 font-bold border border-primary-100 px-3 py-1.5 rounded-lg bg-primary-50/30 hover:bg-primary-50 transition-all">
                          Editar perfil
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Nota:</strong> A criação e edição de senhas de usuários requer acesso ao painel do Supabase (Authentication → Users). 
        O perfil de acesso (role) é gerenciado aqui e salvo nos metadados do usuário.
      </div>
    </div>
  );
};
