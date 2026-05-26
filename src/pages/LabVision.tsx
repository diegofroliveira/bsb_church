import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Sparkles, Users, Home, ChevronRight, Eye, TrendingUp,
  CheckCircle2, AlertCircle, Clock, Zap, Heart, BookOpen,
  Star, BarChart3, ArrowUpRight
} from 'lucide-react';
import clsx from 'clsx';

interface Member {
  id: any;
  nome: string;
  tipo_de_pessoa?: string;
  grupos_caseiros?: string;
  discipulador_nome?: string;
  status?: string;
  sexo?: string;
}

// Níveis da visão da plenitude de Cristo (baseado na transcrição)
const VISION_LEVELS = [
  {
    level: 1,
    label: 'Membro Ativo',
    icon: Users,
    color: 'from-slate-400 to-slate-500',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-700',
    desc: 'Participa dos encontros, está presente',
    condition: (m: Member) => m.status === 'Ativo',
  },
  {
    level: 2,
    label: 'Conectado ao GC',
    icon: Home,
    color: 'from-blue-400 to-blue-500',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    desc: 'Pertence a um grupo caseiro ativo',
    condition: (m: Member) =>
      m.status === 'Ativo' &&
      !!m.grupos_caseiros &&
      m.grupos_caseiros.trim().toUpperCase() !== 'NENHUM' &&
      m.grupos_caseiros.trim() !== '',
  },
  {
    level: 3,
    label: 'Sendo Discipulado',
    icon: BookOpen,
    color: 'from-violet-400 to-violet-500',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    desc: 'Tem um discipulador ativo na sua vida',
    condition: (m: Member) =>
      m.status === 'Ativo' &&
      !!m.discipulador_nome &&
      m.discipulador_nome.trim().toUpperCase() !== 'NENHUM' &&
      m.discipulador_nome.trim() !== '',
  },
  {
    level: 4,
    label: 'Discipulador',
    icon: Heart,
    color: 'from-rose-400 to-pink-500',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    desc: 'Já reproduz — discipula outros',
    condition: (m: Member) =>
      m.status === 'Ativo' &&
      (m.tipo_de_pessoa?.toLowerCase().includes('discipulador') ||
        m.tipo_de_pessoa?.toLowerCase().includes('líder') ||
        m.tipo_de_pessoa?.toLowerCase().includes('lider')),
  },
  {
    level: 5,
    label: 'Plenitude em Construção',
    icon: Star,
    color: 'from-amber-400 to-orange-500',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    desc: 'Discipulando E sendo discipulado — corpo saudável',
    condition: (m: Member) => {
      const isDiscipulador =
        m.tipo_de_pessoa?.toLowerCase().includes('discipulador') ||
        m.tipo_de_pessoa?.toLowerCase().includes('líder') ||
        m.tipo_de_pessoa?.toLowerCase().includes('lider');
      const hasDiscipulador =
        !!m.discipulador_nome &&
        m.discipulador_nome.trim().toUpperCase() !== 'NENHUM' &&
        m.discipulador_nome.trim() !== '';
      return m.status === 'Ativo' && isDiscipulador && hasDiscipulador;
    },
  },
];

const MATURITY_COLORS = [
  'bg-slate-200',
  'bg-blue-300',
  'bg-violet-300',
  'bg-rose-300',
  'bg-amber-300',
];

function getMemberLevel(m: Member): number {
  for (let i = VISION_LEVELS.length - 1; i >= 0; i--) {
    if (VISION_LEVELS[i].condition(m)) return VISION_LEVELS[i].level;
  }
  return 0;
}

export const LabVision: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGC, setSelectedGC] = useState('Todos');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('membros')
        .select('id, nome, tipo_de_pessoa, grupos_caseiros, discipulador_nome, status, sexo')
        .limit(10000);
      setMembers(data || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const activeMembers = useMemo(() => members.filter(m => m.status === 'Ativo'), [members]);
  const uniqueGCs = useMemo(
    () => ['Todos', ...Array.from(new Set(activeMembers.map(m => m.grupos_caseiros || 'Sem GC'))).sort()],
    [activeMembers]
  );

  const filteredMembers = useMemo(() => {
    if (selectedGC === 'Todos') return activeMembers;
    return activeMembers.filter(m => (m.grupos_caseiros || 'Sem GC') === selectedGC);
  }, [activeMembers, selectedGC]);

  const levelCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0]; // index 0 = sem nível, 1-5 = levels
    filteredMembers.forEach(m => {
      const lvl = getMemberLevel(m);
      counts[lvl]++;
    });
    return counts;
  }, [filteredMembers]);

  const total = filteredMembers.length;
  const level5pct = total > 0 ? Math.round((levelCounts[5] / total) * 100) : 0;
  const level4pct = total > 0 ? Math.round(((levelCounts[4] + levelCounts[5]) / total) * 100) : 0;

  const topGCs = useMemo(() => {
    const gcMap: Record<string, { total: number; level5: number; level4: number }> = {};
    activeMembers.forEach(m => {
      const gc = m.grupos_caseiros?.trim() || 'Sem GC';
      if (!gcMap[gc]) gcMap[gc] = { total: 0, level5: 0, level4: 0 };
      gcMap[gc].total++;
      const lvl = getMemberLevel(m);
      if (lvl >= 5) gcMap[gc].level5++;
      if (lvl >= 4) gcMap[gc].level4++;
    });
    return Object.entries(gcMap)
      .map(([gc, v]) => ({ gc, ...v, health: Math.round(((v.level4) / Math.max(v.total, 1)) * 100) }))
      .sort((a, b) => b.health - a.health)
      .slice(0, 10);
  }, [activeMembers]);

  // Funil visual
  const funnelLevels = [5, 4, 3, 2, 1];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Carregando visão...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header secreto */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 p-8 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-amber-400 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-violet-400 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />
        </div>
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-white/10 text-amber-300 px-3 py-1 rounded-full text-xs font-bold mb-4 border border-white/10">
            <Eye className="h-3 w-3" /> LAB · VISÃO EXPERIMENTAL
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-2">
            A Igreja da<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400">Plenitude de Cristo</span>
          </h1>
          <p className="text-gray-400 max-w-xl text-sm leading-relaxed">
            E como seria se implementássemos essa visão com base nos nossos dados?
            Cada membro mapeado em seu nível de maturidade — do simples participante ao multiplicador do corpo.
          </p>
          <p className="text-gray-600 text-xs mt-3 italic">
            "A igreja, que é o seu corpo, a plenitude daquele que tudo enche em todos." — Ef 1:23
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Membros Ativos', value: total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Discipuladores', value: levelCounts[4] + levelCounts[5], icon: Heart, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Plenitude (nível 5)', value: levelCounts[5], icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Saúde Geral', value: `${level4pct}%`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center mb-3', kpi.bg)}>
              <kpi.icon className={clsx('h-5 w-5', kpi.color)} />
            </div>
            <p className="text-2xl font-black text-gray-900">{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Filtro GC */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Filtrar por GC:</span>
        {uniqueGCs.slice(0, 15).map(gc => (
          <button
            key={gc}
            onClick={() => setSelectedGC(gc)}
            className={clsx(
              'text-xs font-semibold px-3 py-1.5 rounded-full border transition-all',
              selectedGC === gc
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            )}
          >
            {gc}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Funil de Maturidade */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-6">
            <BarChart3 className="h-5 w-5 text-violet-500" />
            Funil da Plenitude
            {selectedGC !== 'Todos' && <span className="text-xs font-normal text-gray-400">— {selectedGC}</span>}
          </h2>
          <div className="space-y-3">
            {funnelLevels.map(lvl => {
              const info = VISION_LEVELS[lvl - 1];
              const count = levelCounts[lvl];
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const barWidth = total > 0 ? (count / filteredMembers.length) * 100 : 0;
              const Icon = info.icon;
              return (
                <div key={lvl} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={clsx('w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-to-br', info.color)}>
                        <Icon className="h-3.5 w-3.5 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-gray-700">Nível {lvl} — {info.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900">{count}</span>
                      <span className="text-xs text-gray-400">({pct}%)</span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={clsx('h-full rounded-full bg-gradient-to-r transition-all duration-700', info.color)}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5 ml-8">{info.desc}</p>
                </div>
              );
            })}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-gray-200">
                    <AlertCircle className="h-3.5 w-3.5 text-gray-500" />
                  </div>
                  <span className="text-sm font-semibold text-gray-500">Sem classificação</span>
                </div>
                <span className="text-xs font-bold text-gray-400">{levelCounts[0]}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top GCs mais saudáveis */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-6">
            <Zap className="h-5 w-5 text-amber-500" />
            GCs com Maior Saúde Espiritual
          </h2>
          <div className="space-y-3">
            {topGCs.map((gc, i) => (
              <div key={gc.gc} className="flex items-center gap-3">
                <span className="text-xs font-black text-gray-300 w-4 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-700 truncate">{gc.gc.replace(/^BSB\s*/i, 'GC ')}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs text-gray-400">{gc.total} memb.</span>
                      <span className={clsx(
                        'text-xs font-bold px-1.5 py-0.5 rounded-md',
                        gc.health >= 70 ? 'bg-emerald-100 text-emerald-700' :
                        gc.health >= 40 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      )}>{gc.health}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full',
                        gc.health >= 70 ? 'bg-emerald-400' :
                        gc.health >= 40 ? 'bg-amber-400' :
                        'bg-red-400'
                      )}
                      style={{ width: `${gc.health}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lista de membros nível 5 */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100 p-6">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-1">
          <Star className="h-5 w-5 text-amber-500" />
          Nível 5 — Corpo Saudável em Construção
          <span className="ml-auto text-xs font-normal text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
            {levelCounts[5]} pessoas · {level5pct}% do total
          </span>
        </h2>
        <p className="text-xs text-amber-700 mb-4">
          Esses são os membros que simultaneamente discipulam e são discipulados — o "corpo" funcionando como Cristo quer.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {filteredMembers
            .filter(m => getMemberLevel(m) >= 5)
            .sort((a, b) => a.nome.localeCompare(b.nome))
            .map(m => (
              <div key={m.id} className="bg-white/80 rounded-xl px-3 py-2 border border-amber-100 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-xs font-semibold text-gray-700 truncate">{m.nome.split(' ').slice(0, 2).join(' ')}</span>
              </div>
            ))}
          {levelCounts[5] === 0 && (
            <div className="col-span-full py-6 text-center text-amber-600 text-sm font-medium opacity-70">
              Nenhum membro atingiu o nível 5 ainda — há muito campo para crescer! 🌱
            </div>
          )}
        </div>
      </div>

      {/* Rodapé */}
      <div className="bg-gray-900 rounded-2xl p-5 text-center">
        <p className="text-gray-500 text-xs">
          <span className="text-gray-300 font-semibold">LAB · Modo Experimental</span> · Esta visão é baseada nos dados reais da igreja e nos critérios da transcrição "A Igreja da Plenitude de Cristo".<br />
          Os critérios podem ser refinados conforme a teologia e estratégia pastoral evoluírem.
        </p>
      </div>
    </div>
  );
};
