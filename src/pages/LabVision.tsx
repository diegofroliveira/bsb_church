import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Sparkles, Users, Home, Eye, TrendingUp,
  CheckCircle2, AlertCircle, Zap, Heart, BookOpen,
  Star, BarChart3, ArrowRight, Circle
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

// 5 rings of spiritual maturity
const RINGS = [
  {
    level: 1,
    label: 'Presença',
    sublabel: 'Membro Ativo',
    icon: Circle,
    gradient: 'from-slate-400 to-slate-600',
    glow: 'shadow-slate-200',
    ring: 'ring-slate-200',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-700',
    desc: 'Cadastrado como Ativo na base',
    verse: '"Não deixeis de congregar-vos" — Hb 10:25',
    check: (m: Member) => m.status === 'Ativo',
  },
  {
    level: 2,
    label: 'Comunidade',
    sublabel: 'Conectado ao GC',
    icon: Home,
    gradient: 'from-blue-400 to-blue-600',
    glow: 'shadow-blue-200',
    ring: 'ring-blue-200',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    desc: 'Pertence a um Grupo Caseiro ativo',
    verse: '"Onde dois ou três estiverem reunidos em meu nome" — Mt 18:20',
    check: (m: Member) =>
      m.status === 'Ativo' &&
      !!m.grupos_caseiros &&
      m.grupos_caseiros.trim().toUpperCase() !== 'NENHUM' &&
      m.grupos_caseiros.trim() !== '',
  },
  {
    level: 3,
    label: 'Discipulado',
    sublabel: 'Sendo Transformado',
    icon: BookOpen,
    gradient: 'from-violet-400 to-violet-600',
    glow: 'shadow-violet-200',
    ring: 'ring-violet-200',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    desc: 'Tem discipulador — está sendo formado',
    verse: '"Fazei discípulos de todas as nações" — Mt 28:19',
    check: (m: Member) =>
      m.status === 'Ativo' &&
      !!m.discipulador_nome &&
      m.discipulador_nome.trim().toUpperCase() !== 'NENHUM' &&
      m.discipulador_nome.trim() !== '',
  },
  {
    level: 4,
    label: 'Multiplicação',
    sublabel: 'Discipulando Outros',
    icon: Heart,
    gradient: 'from-rose-400 to-pink-600',
    glow: 'shadow-rose-200',
    ring: 'ring-rose-200',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    desc: 'Está reproduzindo — discipula alguém',
    verse: '"O que aprendeste... ensina a outros" — 2 Tm 2:2',
    check: (m: Member) =>
      m.status === 'Ativo' &&
      (m.tipo_de_pessoa?.toLowerCase().includes('discipulador') ||
        m.tipo_de_pessoa?.toLowerCase().includes('líder') ||
        m.tipo_de_pessoa?.toLowerCase().includes('lider')),
  },
  {
    level: 5,
    label: 'Plenitude',
    sublabel: 'Corpo Saudável',
    icon: Star,
    gradient: 'from-amber-400 to-orange-500',
    glow: 'shadow-amber-200',
    ring: 'ring-amber-200',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    desc: 'Discipula E é discipulado — corpo completo',
    verse: '"A plenitude daquele que tudo enche em todos" — Ef 1:23',
    check: (m: Member) => {
      const isDisc =
        m.tipo_de_pessoa?.toLowerCase().includes('discipulador') ||
        m.tipo_de_pessoa?.toLowerCase().includes('líder') ||
        m.tipo_de_pessoa?.toLowerCase().includes('lider');
      const hasDisc =
        !!m.discipulador_nome &&
        m.discipulador_nome.trim().toUpperCase() !== 'NENHUM' &&
        m.discipulador_nome.trim() !== '';
      return m.status === 'Ativo' && isDisc && hasDisc;
    },
  },
];

function getMemberLevel(m: Member): number {
  for (let i = RINGS.length - 1; i >= 0; i--) {
    if (RINGS[i].check(m)) return RINGS[i].level;
  }
  return 0;
}

// Animated counter
function AnimatedCount({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(ease * value));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, duration]);
  return <>{display}</>;
}

export const LabVision: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGC, setSelectedGC] = useState('Todos');
  const [hoveredRing, setHoveredRing] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from('membros')
      .select('id, nome, tipo_de_pessoa, grupos_caseiros, discipulador_nome, status, sexo')
      .limit(10000)
      .then(({ data }) => {
        setMembers(data || []);
        setLoading(false);
      });
  }, []);

  const activeMembers = useMemo(() => members.filter(m => m.status === 'Ativo'), [members]);
  const uniqueGCs = useMemo(
    () => ['Todos', ...Array.from(new Set(activeMembers.map(m => m.grupos_caseiros?.trim() || 'Sem GC').filter(Boolean))).sort()],
    [activeMembers]
  );

  const filtered = useMemo(() => {
    if (selectedGC === 'Todos') return activeMembers;
    return activeMembers.filter(m => (m.grupos_caseiros?.trim() || 'Sem GC') === selectedGC);
  }, [activeMembers, selectedGC]);

  const counts = useMemo(() => {
    const c = [0, 0, 0, 0, 0, 0];
    filtered.forEach(m => { const l = getMemberLevel(m); c[l]++; });
    return c;
  }, [filtered]);

  const total = filtered.length;
  const plenitudeCount = counts[5];
  const plenitudePct = total > 0 ? Math.round((plenitudeCount / total) * 100) : 0;
  const healthScore = total > 0 ? Math.round(((counts[4] + counts[5]) / total) * 100) : 0;

  // GC ranking
  const gcRanking = useMemo(() => {
    const map: Record<string, { total: number; level4: number; level5: number }> = {};
    activeMembers.forEach(m => {
      const gc = m.grupos_caseiros?.trim() || 'Sem GC';
      if (!map[gc]) map[gc] = { total: 0, level4: 0, level5: 0 };
      map[gc].total++;
      const lvl = getMemberLevel(m);
      if (lvl >= 4) map[gc].level4++;
      if (lvl >= 5) map[gc].level5++;
    });
    return Object.entries(map)
      .map(([gc, v]) => ({
        gc: gc.replace(/^BSB[\s\-_]*/i, ''),
        total: v.total,
        level4: v.level4,
        level5: v.level5,
        health: Math.round((v.level4 / Math.max(v.total, 1)) * 100),
      }))
      .sort((a, b) => b.health - a.health)
      .slice(0, 12);
  }, [activeMembers]);

  const level5Members = useMemo(
    () => filtered.filter(m => getMemberLevel(m) >= 5).sort((a, b) => a.nome.localeCompare(b.nome)),
    [filtered]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="relative w-20 h-20 mx-auto">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="absolute inset-0 border-2 border-amber-400 rounded-full animate-ping"
                style={{ animationDelay: `${i * 300}ms`, animationDuration: '1.5s', opacity: 0.6 - i * 0.2 }}
              />
            ))}
            <div className="absolute inset-0 flex items-center justify-center">
              <Star className="h-8 w-8 text-amber-400" />
            </div>
          </div>
          <p className="text-gray-400 text-sm font-medium">Carregando visão da plenitude...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── Hero Section ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0a0a0f] via-[#0f0f1a] to-[#0a0a0f] p-10 text-white">
        {/* Background rings */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[400, 320, 240, 160].map((size, i) => (
            <div
              key={i}
              className="absolute border border-white/[0.03] rounded-full"
              style={{
                width: size,
                height: size,
                top: '50%',
                right: -size / 4,
                transform: 'translateY(-50%)',
              }}
            />
          ))}
          <div className="absolute top-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
          <div className="absolute bottom-0 right-1/3 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-amber-400/10 text-amber-300 px-3 py-1.5 rounded-full text-xs font-bold mb-6 border border-amber-400/20">
            <Eye className="h-3 w-3" /> LAB EXPERIMENTAL · Visão Restrita
          </div>
          <h1 className="text-5xl font-black tracking-tight leading-none mb-4">
            Igreja da<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400">
              Plenitude de Cristo
            </span>
          </h1>
          <p className="text-gray-400 text-base leading-relaxed max-w-lg">
            Como estaria nossa igreja se medíssemos cada membro pelos 5 anéis da maturidade espiritual?
            Baseado nos dados reais e na visão de <strong className="text-gray-300">Efésios 1:23</strong>.
          </p>

          {/* Live stats inline */}
          <div className="flex flex-wrap gap-6 mt-8">
            {[
              { label: 'Membros Ativos', value: total, color: 'text-blue-300' },
              { label: 'No Nível de Plenitude', value: plenitudeCount, color: 'text-amber-300' },
              { label: 'Índice de Saúde', value: `${healthScore}%`, color: 'text-emerald-300' },
            ].map(s => (
              <div key={s.label}>
                <p className={clsx('text-3xl font-black', s.color)}>
                  {typeof s.value === 'number' ? <AnimatedCount value={s.value} /> : s.value}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 5 Rings Visual ── */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-xl font-bold text-gray-900">Os 5 Anéis da Maturidade</h2>
          <div className="flex-1 h-px bg-gray-100" />
          {selectedGC !== 'Todos' && (
            <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium">{selectedGC}</span>
          )}
        </div>

        {/* GC Filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          {uniqueGCs.slice(0, 16).map(gc => (
            <button
              key={gc}
              onClick={() => setSelectedGC(gc)}
              className={clsx(
                'text-xs font-semibold px-3 py-1.5 rounded-full border transition-all duration-200',
                selectedGC === gc
                  ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
              )}
            >
              {gc === 'Todos' ? 'Todos os GCs' : gc.replace(/^BSB[\s\-_]*/i, 'GC ')}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {RINGS.map(ring => {
            const count = counts[ring.level];
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const isHovered = hoveredRing === ring.level;
            const Icon = ring.icon;
            return (
              <div
                key={ring.level}
                onMouseEnter={() => setHoveredRing(ring.level)}
                onMouseLeave={() => setHoveredRing(null)}
                className={clsx(
                  'relative rounded-2xl border p-5 cursor-default transition-all duration-300 group',
                  isHovered
                    ? `${ring.bg} ${ring.border} shadow-xl ${ring.glow} -translate-y-1`
                    : 'bg-white border-gray-100 shadow-sm'
                )}
              >
                {/* Level badge */}
                <div className={clsx(
                  'absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white bg-gradient-to-br transition-all',
                  ring.gradient
                )}>
                  {ring.level}
                </div>

                <div className={clsx(
                  'w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br transition-all duration-300',
                  ring.gradient,
                  isHovered ? 'shadow-lg scale-110' : ''
                )}>
                  <Icon className="h-5 w-5 text-white" />
                </div>

                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{ring.label}</p>
                <p className={clsx('text-2xl font-black mt-1 transition-colors', isHovered ? ring.text : 'text-gray-900')}>
                  <AnimatedCount value={count} />
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={clsx('h-full rounded-full bg-gradient-to-r transition-all duration-700', ring.gradient)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-gray-400">{pct}%</span>
                </div>
                <p className={clsx('text-[10px] mt-3 leading-tight transition-colors', isHovered ? ring.text : 'text-gray-400')}>
                  {isHovered ? ring.verse : ring.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Two columns: Funnel + GC Ranking ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Visual Funnel */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-6">
            <BarChart3 className="h-4 w-4 text-violet-500" /> Funil de Maturidade
          </h2>
          <div className="space-y-2">
            {[...RINGS].reverse().map(ring => {
              const count = counts[ring.level];
              const widthPct = total > 0 ? (count / total) * 100 : 0;
              const Icon = ring.icon;
              return (
                <div key={ring.level} className="flex items-center gap-3 group">
                  <div className={clsx(
                    'w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br shrink-0',
                    ring.gradient
                  )}>
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-600">{ring.sublabel}</span>
                      <span className="text-xs font-black text-gray-900">{count}</span>
                    </div>
                    <div
                      className="relative h-6 bg-gray-50 rounded-lg overflow-hidden"
                      style={{ clipPath: 'inset(0 0 0 0 round 8px)' }}
                    >
                      <div
                        className={clsx('h-full rounded-lg bg-gradient-to-r opacity-80 transition-all duration-700', ring.gradient)}
                        style={{ width: `${widthPct}%` }}
                      />
                      <div className="absolute inset-0 flex items-center px-2">
                        <span className="text-[9px] font-black text-white drop-shadow">
                          {total > 0 ? Math.round((count / total) * 100) : 0}% do total
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-gray-100 flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                <AlertCircle className="h-3.5 w-3.5 text-gray-400" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between">
                  <span className="text-xs font-semibold text-gray-400">Sem classificação</span>
                  <span className="text-xs font-black text-gray-400">{counts[0]}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* GC Ranking */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-6">
            <Zap className="h-4 w-4 text-amber-500" /> Ranking de Saúde por GC
            <span className="ml-auto text-[10px] text-gray-400 font-normal">% com discipuladores ativos</span>
          </h2>
          <div className="space-y-2.5">
            {gcRanking.map((gc, i) => {
              const emoji = gc.health >= 70 ? '🔥' : gc.health >= 40 ? '🌱' : '🌧️';
              const barColor = gc.health >= 70 ? 'bg-emerald-400' : gc.health >= 40 ? 'bg-amber-400' : 'bg-red-300';
              const badge = gc.health >= 70 ? 'bg-emerald-100 text-emerald-700' : gc.health >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
              return (
                <div key={gc.gc} className="flex items-center gap-3 group">
                  <span className="text-xs font-black text-gray-200 w-5 shrink-0 text-right">{i + 1}</span>
                  <span className="text-sm">{emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-xs font-semibold text-gray-700 truncate">{gc.gc || 'Sem GC'}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-gray-400">{gc.total} membros</span>
                        <span className={clsx('text-[10px] font-black px-1.5 py-0.5 rounded-md', badge)}>{gc.health}%</span>
                        {gc.level5 > 0 && (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">
                            ⭐{gc.level5}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full transition-all duration-700', barColor)}
                        style={{ width: `${gc.health}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Level 5: Members of Fullness ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 border border-amber-100 p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-200/30 rounded-full translate-x-1/2 -translate-y-1/2 blur-2xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200">
                  <Star className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Nível 5 — A Plenitude em Construção</h2>
              </div>
              <p className="text-xs text-amber-700 max-w-lg">
                Estes membros discipulam E são discipulados — o corpo funcionando como Cristo deseja.
                São o "núcleo duro" da multiplicação da Igreja.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-3xl font-black text-amber-600"><AnimatedCount value={plenitudeCount} /></p>
                <p className="text-[10px] text-amber-500 font-bold uppercase">Pessoas</p>
              </div>
              <div className="w-px h-10 bg-amber-200" />
              <div className="text-center">
                <p className="text-3xl font-black text-orange-600">{plenitudePct}%</p>
                <p className="text-[10px] text-orange-500 font-bold uppercase">do Total</p>
              </div>
            </div>
          </div>

          {level5Members.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {level5Members.map(m => (
                <div
                  key={m.id}
                  className="bg-white/80 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-amber-100 flex items-center gap-2 hover:border-amber-300 hover:shadow-sm transition-all"
                >
                  <CheckCircle2 className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="text-xs font-semibold text-gray-700 truncate">
                    {m.nome.split(' ').slice(0, 2).join(' ')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white/60 rounded-2xl p-8 text-center border border-amber-100">
              <Star className="h-10 w-10 text-amber-200 mx-auto mb-3" />
              <p className="text-amber-700 font-semibold text-sm">Nenhum membro atingiu o Nível 5 ainda</p>
              <p className="text-amber-500 text-xs mt-1">Há muito campo para crescer — esta é a oportunidade! 🌱</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Vision Quote ── */}
      <div className="bg-gray-900 rounded-3xl p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-48 h-48 bg-amber-400 rounded-full blur-2xl" />
          <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-violet-400 rounded-full blur-2xl" />
        </div>
        <div className="relative">
          <Sparkles className="h-8 w-8 text-amber-400 mx-auto mb-4" />
          <p className="text-white text-lg font-light leading-relaxed max-w-2xl mx-auto italic">
            "A Igreja, que é o seu corpo, a plenitude daquele que tudo enche em todos."
          </p>
          <p className="text-gray-500 text-sm mt-3 font-medium">Efésios 1:23</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <ArrowRight className="h-4 w-4 text-gray-600" />
            <p className="text-gray-500 text-xs max-w-lg text-center">
              LAB · Dados reais da Igreja BSB · Esta visão é experimental e pode ser refinada conforme a estratégia pastoral evoluir.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
