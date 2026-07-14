import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Baby, Link2, Loader2, Network, Users, UserCheck } from 'lucide-react';

type ViewMode = 'group' | 'sector';
type Member = {
  id: number | string;
  nome: string;
  sexo?: string | null;
  nascimento?: string | null;
  status?: string | null;
  tipo_de_pessoa?: string | null;
  grupos_caseiros?: string | null;
  cargo_gc?: string | null;
  discipulador?: string | null;
  data_de_cadastro?: string | null;
};
type Link = { discipulo: string; discipulador: string; status?: string | null };
type Cell = { grupo_caseiro: string; lider?: string | null; setor?: string | null };
type Snapshot = { scope?: { group?: string; sector?: string }; members: Member[]; links: Link[]; cells: Cell[] };

const ageOf = (date?: string | null): number | null => {
  if (!date) return null;
  const birth = new Date(date);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--;
  return age;
};

const activeLinked = (member: Member): boolean => {
  const type = String(member.tipo_de_pessoa || '').trim().toUpperCase();
  return member.status === 'Ativo' && type !== 'AGREGADO' && type !== 'AGREGADOS';
};

const Stat: React.FC<{ label: string; value: number; icon: React.ElementType }> = ({ label, value, icon: Icon }) => (
  <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon className="h-5 w-5" /></div>
    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</p>
    <p className="mt-1 text-3xl font-black text-gray-900">{value}</p>
  </div>
);

export const LeaderViews: React.FC = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState<ViewMode>('group');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      const functionName = mode === 'group' ? 'get_leader_group_view' : 'get_leader_sector_view';
      const { data, error: rpcError } = await supabase.rpc(functionName);
      if (cancelled) return;
      if (rpcError) {
        setError(rpcError.message.includes('does not exist')
          ? 'A política de acesso ainda não foi publicada no Supabase.'
          : rpcError.message);
        setSnapshot(null);
      } else {
        setSnapshot(data as Snapshot);
      }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [mode]);

  const allMembers = useMemo(() => (snapshot?.members || []).filter(member => member.status === 'Ativo'), [snapshot]);
  const members = useMemo(() => allMembers.filter(activeLinked), [allMembers]);
  const children = allMembers.filter(member => {
    const age = ageOf(member.nascimento);
    return age !== null && age < 18;
  });
  const disciplerNames = new Set((snapshot?.links || []).map(link => link.discipulador.trim().toUpperCase()));
  const disciplesByName = new Map<string, string[]>();
  (snapshot?.links || []).forEach(link => {
    const key = link.discipulador.trim().toUpperCase();
    disciplesByName.set(key, [...(disciplesByName.get(key) || []), link.discipulo]);
  });
  const title = mode === 'group' ? snapshot?.scope?.group || user?.assigned_gc || 'Meu Grupo' : snapshot?.scope?.sector || user?.assigned_sector || 'Meu Setor';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <p className="text-xs font-black uppercase tracking-widest text-indigo-500">Visões de Liderança</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">Dados operacionais limitados ao escopo autorizado para este usuário.</p>
      </header>

      <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        <button onClick={() => setMode('group')} className={`rounded-lg px-4 py-2 text-sm font-bold ${mode === 'group' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>Meu grupo</button>
        <button onClick={() => setMode('sector')} className={`rounded-lg px-4 py-2 text-sm font-bold ${mode === 'sector' ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>Meu setor</button>
      </div>

      {loading ? <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div> : error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Membros vinculados" value={members.length} icon={Users} />
            <Stat label="Crianças e adolescentes" value={children.length} icon={Baby} />
            <Stat label="Discipuladores" value={disciplerNames.size} icon={UserCheck} />
            <Stat label="Vínculos ativos" value={snapshot?.links?.length || 0} icon={Link2} />
          </div>

          {mode === 'sector' && <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"><h2 className="font-bold text-gray-900">Grupos do setor</h2><div className="mt-3 flex flex-wrap gap-2">{(snapshot?.cells || []).map(cell => <span key={cell.grupo_caseiro} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{cell.grupo_caseiro}</span>)}</div></div>}

          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-gray-100 p-5"><Network className="h-5 w-5 text-indigo-600" /><h2 className="font-bold text-gray-900">Pessoas e discipulado</h2></div>
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-400"><tr><th className="px-5 py-3">Pessoa</th><th className="px-5 py-3">Tipo</th><th className="px-5 py-3">Sexo</th><th className="px-5 py-3">Idade</th><th className="px-5 py-3">Função</th><th className="px-5 py-3">Discipulador</th><th className="px-5 py-3">Discipula</th></tr></thead><tbody className="divide-y divide-gray-50">{allMembers.map(member => { const linked = disciplesByName.get(member.nome.trim().toUpperCase()) || []; return <tr key={member.id}><td className="px-5 py-3 font-semibold text-gray-900">{member.nome}</td><td className="px-5 py-3 text-gray-500">{member.tipo_de_pessoa || '-'}</td><td className="px-5 py-3 text-gray-500">{member.sexo || '-'}</td><td className="px-5 py-3 text-gray-500">{ageOf(member.nascimento) ?? '-'}</td><td className="px-5 py-3 text-gray-500">{member.cargo_gc || '-'}</td><td className="px-5 py-3 text-gray-600">{member.discipulador || (linked.length ? 'Discipulador' : 'Sem vínculo')}</td><td className="px-5 py-3 text-gray-600">{linked.length ? linked.join(', ') : '-'}</td></tr>; })}</tbody></table></div>
          </div>
        </>
      )}
    </div>
  );
};
