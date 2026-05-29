import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Crown, Flame, MessageSquare, BookMarked, HandHeart,
  Eye, Sparkles, ArrowDown, Users, AlertTriangle,
  CheckCircle2, Shield, Star, Wifi, ChevronRight,
  ChevronDown, GitMerge
} from 'lucide-react';
import clsx from 'clsx';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────
interface Member {
  id: any;
  nome: string;
  tipo_de_pessoa?: string;
  grupos_caseiros?: string;
  discipulador_nome?: string;
  status?: string;
  sexo?: string;
}

type MinistryKey = 'apostolo' | 'profeta' | 'evangelista' | 'pastor' | 'mestre';

// ─────────────────────────────────────────────────────────
// 5 MINISTÉRIOS — EF 4:11
// ─────────────────────────────────────────────────────────
const MIN: Record<MinistryKey, {
  label: string; emoji: string; Icon: React.FC<any>;
  gradient: string; light: string; border: string; text: string;
  role: string;   // o que faz no corpo
  eddy: string;   // como Eddy Leo descreveria
  apostle: string; // o "pai" (ação que a metáfora física representa)
}> = {
  apostolo: {
    label: 'Apóstolo', emoji: '🏛️', Icon: Crown,
    gradient: 'from-violet-500 to-purple-700',
    light: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700',
    role: 'Lança fundações, envia e define a visão',
    eddy: 'O arquiteto do corpo — garante que tudo seja construído sobre Cristo e não sobre tradições humanas',
    apostle: 'Ossos — sustenta e dá estrutura ao corpo',
  },
  profeta: {
    label: 'Profeta', emoji: '🔥', Icon: Flame,
    gradient: 'from-amber-400 to-orange-600',
    light: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700',
    role: 'Revela, discerne, alerta e edifica',
    eddy: 'A consciência do corpo — mantém a Igreja conectada à voz de Deus e expõe o que precisa ser purificado',
    apostle: 'Sistema nervoso — transmite sinais vitais ao corpo',
  },
  evangelista: {
    label: 'Evangelista', emoji: '🌍', Icon: MessageSquare,
    gradient: 'from-emerald-400 to-teal-600',
    light: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700',
    role: 'Alcança os perdidos, colhe e integra ao corpo',
    eddy: 'Os pés do corpo — sem ele, o corpo perde a mobilidade e para de crescer numericamente',
    apostle: 'Pés — em movimento constante em direção ao mundo',
  },
  pastor: {
    label: 'Pastor', emoji: '🕊️', Icon: HandHeart,
    gradient: 'from-blue-400 to-blue-700',
    light: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700',
    role: 'Cuida, restaura, protege e reúne',
    eddy: 'O coração do corpo — sem ele, os membros se sentem sem pertencimento e o corpo sangra',
    apostle: 'Coração — bombeia vida a cada parte do corpo',
  },
  mestre: {
    label: 'Mestre', emoji: '📖', Icon: BookMarked,
    gradient: 'from-rose-400 to-pink-700',
    light: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700',
    role: 'Ensina, equipa e forma discípulos',
    eddy: 'A mente do corpo — sem ele, o corpo age mas não sabe por quê, e se torna ativista sem profundidade',
    apostle: 'Mente — dá direção e coerência ao que o corpo faz',
  },
};

const MIN_KEYS: MinistryKey[] = ['apostolo', 'profeta', 'evangelista', 'pastor', 'mestre'];

// ─────────────────────────────────────────────────────────
// PRESBÍTÉRIO — ATRIBUIÇÕES MANUAIS
// ─────────────────────────────────────────────────────────
const PRESB_CONFIG: Array<{
  nameKey: string; displayName: string;
  ministries: MinistryKey[]; note?: string; external?: boolean;
}> = [
  { nameKey: 'VINCI DO REGO BARROS', displayName: 'Vinci do Rego Barros',
    ministries: ['apostolo'], external: true,
    note: 'Cobertura apostólica externa — não reside em BSB, mas sustenta a fundação' },
  { nameKey: 'WAGNER DE LIMA OLIVEIRA', displayName: 'Wagner de Lima Oliveira',
    ministries: ['apostolo', 'mestre'],
    note: 'Apóstolo + Mestre — arquiteto e professor do corpo local' },
  { nameKey: 'WANDERLEY CLODOALDO LIMA DE FREITAS', displayName: 'Wanderley C. L. de Freitas',
    ministries: ['pastor', 'mestre'],
    note: 'Pastor + Mestre — pastoreio local do corpo, consolidando o ensino na Palavra' },
  { nameKey: 'CARLOS ALBERTO RIBEIRO DO NASCIMENTO', displayName: 'Carlos Alberto R. do Nascimento',
    ministries: ['profeta'],
    note: 'Profeta — discernimento e direção profética para o corpo' },
  { nameKey: 'MARCELO BRAGA SILVA', displayName: 'Marcelo Braga Silva',
    ministries: ['evangelista'],
    note: 'Evangelista — paixão pelas almas, mobiliza o corpo para o alcance' },
];

// ─────────────────────────────────────────────────────────
// FILTER: tipos válidos para a visão do corpo
// ─────────────────────────────────────────────────────────
function normalizeType(t?: string): string {
  const u = (t || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (u.includes('PRESB')) return 'PRESBÍTERO';
  if (u.includes('APOSTOL')) return 'APÓSTOLO';
  if (u.includes('LIDER')) return 'LÍDER';
  if (u.includes('DIAC')) return 'DIÁCONO';
  if (u.includes('PASTOR')) return 'PASTOR';
  if (u.includes('MEMBRO')) return 'MEMBRO';
  return u;
}

const VALID_TIPOS = ['PRESBÍTERO', 'APÓSTOLO', 'LÍDER', 'DIÁCONO', 'PASTOR', 'MEMBRO'];

// ─────────────────────────────────────────────────────────
// MINISTRY ASSIGNMENT (simulação)
// ─────────────────────────────────────────────────────────
function hashMin(nome: string): MinistryKey {
  const h = nome.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return MIN_KEYS[h % 5];
}

function assignMin(m: Member): MinistryKey[] {
  const presbyExact = PRESB_CONFIG.find(p =>
    p.nameKey.split(' ').every(part => m.nome.trim().toUpperCase().includes(part))
  );
  if (presbyExact) return presbyExact.ministries;

  const tipo = normalizeType(m.tipo_de_pessoa);
  if (tipo === 'PASTOR') return ['pastor'];
  if (tipo === 'LÍDER') return ['mestre', 'pastor'];
  if (tipo === 'DIÁCONO') return [hashMin(m.nome)];
  return [hashMin(m.nome)];
}

// ─────────────────────────────────────────────────────────
// IDEAL CELL FORMATION (Visão Indonésia / Eddy Leo)
// ─────────────────────────────────────────────────────────
interface CellMember {
  member: Member;
  ministry: MinistryKey;
}

interface IdealCell {
  index: number;
  score: number;
  coverage: number;
  lideranca: CellMember[];
  ligamentos: CellMember[];
  corpo: CellMember[];
  regionName?: string;
}

function getMacroRegion(gc: string): string {
  const g = (gc || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (g.includes('AGUAS CLARAS') || g.includes('CLARAS')) return 'Águas Claras';
  if (g.includes('TAGUA')) return 'Taguatinga';
  if (g.includes('GUARA')) return 'Guará';
  if (g.includes('ASA') || g.includes('PLANO')) return 'Plano Piloto';
  if (g.includes('VICENTE')) return 'Vicente Pires';
  if (g.includes('RECANTO')) return 'Recanto das Emas';
  if (g.includes('SAMAMBAIA')) return 'Samambaia';
  if (g.includes('CEILANDIA')) return 'Ceilândia';
  if (g.includes('SOBRADINHO')) return 'Sobradinho';
  if (g.includes('VIX') || g.includes('VITORIA')) return 'Vitória (VIX)';
  return 'Sem Célula / Outros';
}

function formIdealCells(pool: Member[], targetSize = 12): IdealCell[] {
  const getLastName = (nome: string) => {
    const parts = nome.trim().toUpperCase().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : '';
  };
  
  // 1. Group into Family Units (Couples & same last-name members in the same GC)
  const familyUnits: Array<{
    members: Member[];
    gc: string;
    macro: string;
    lastName: string;
  }> = [];
  const visited = new Set<string>();

  pool.forEach(m => {
    if (visited.has(m.id)) return;
    const gc = m.grupos_caseiros || '';
    const macro = getMacroRegion(gc);
    const lastName = getLastName(m.nome);
    
    const familyMembers = pool.filter(o => {
      if (visited.has(o.id)) return false;
      if ((o.grupos_caseiros || '') !== gc) return false;
      if (lastName && getLastName(o.nome) === lastName) return true;
      return false;
    });
    
    familyMembers.forEach(f => visited.add(f.id));
    familyUnits.push({
      members: familyMembers,
      gc,
      macro,
      lastName
    });
  });

  const regionMap: Record<string, typeof familyUnits> = {};
  familyUnits.forEach(u => {
    regionMap[u.macro] = regionMap[u.macro] || [];
    regionMap[u.macro].push(u);
  });

  const cells: IdealCell[] = [];
  let cellIndex = 1;

  Object.entries(regionMap).forEach(([region, units]) => {
    const totalPeople = units.reduce((acc, u) => acc + u.members.length, 0);
    if (totalPeople === 0) return;
    
    const sortedUnits = [...units].sort((a, b) => {
      const getPriority = (u: typeof a) => {
        if (u.members.some(m => normalizeType(m.tipo_de_pessoa) === 'PASTOR')) return 3;
        if (u.members.some(m => normalizeType(m.tipo_de_pessoa) === 'LÍDER')) return 2;
        if (u.members.some(m => normalizeType(m.tipo_de_pessoa) === 'DIÁCONO')) return 1;
        return 0;
      };
      return getPriority(b) - getPriority(a);
    });

    const numCellsInRegion = Math.max(1, Math.round(totalPeople / targetSize));
    
    const regionCells: IdealCell[] = Array.from({ length: numCellsInRegion }, (_, i) => ({
      index: cellIndex++,
      score: 0,
      coverage: 0,
      lideranca: [],
      ligamentos: [],
      corpo: [],
      regionName: region
    }));

    // 1. Separar unidades com líderes masculinos das unidades normais
    const leaderUnits = sortedUnits.filter(u => 
      u.members.some(m => {
        const tipo = normalizeType(m.tipo_de_pessoa);
        const isMale = (m.sexo || '').toUpperCase().trim().startsWith('M');
        return isMale && (tipo === 'LÍDER' || tipo === 'PASTOR');
      })
    );
    const regularUnits = sortedUnits.filter(u => !leaderUnits.includes(u));

    // 2. Distribuir primeiro as unidades de liderança de forma rotativa (round-robin)
    // Isso garante que os líderes disponíveis sejam espalhados de forma equilibrada pelas células da região!
    leaderUnits.forEach((u, i) => {
      const targetCell = regionCells[i % numCellsInRegion];
      u.members.forEach(m => {
        const min = assignMin(m)[0];
        const tipo = normalizeType(m.tipo_de_pessoa);
        const isMale = (m.sexo || '').toUpperCase().trim().startsWith('M');
        
        if (isMale && (tipo === 'LÍDER' || tipo === 'PASTOR') && targetCell.lideranca.length < 3) {
          targetCell.lideranca.push({ member: m, ministry: min });
        } else if ((tipo === 'DIÁCONO' || tipo === 'LÍDER' || tipo === 'PASTOR' || targetCell.ligamentos.length < 3) && targetCell.ligamentos.length < 4 && targetCell.lideranca.length > 0) {
          targetCell.ligamentos.push({ member: m, ministry: min });
        } else {
          targetCell.corpo.push({ member: m, ministry: min });
        }
      });
    });

    // 3. Preencher o restante das células com as unidades normais buscando manter os tamanhos equilibrados
    regularUnits.forEach(u => {
      const targetCell = regionCells.reduce((prev, curr) => {
        const prevSize = prev.lideranca.length + prev.ligamentos.length + prev.corpo.length;
        const currSize = curr.lideranca.length + curr.ligamentos.length + curr.corpo.length;
        return prevSize <= currSize ? prev : curr;
      });

      u.members.forEach(m => {
        const min = assignMin(m)[0];
        const tipo = normalizeType(m.tipo_de_pessoa);
        const isMale = (m.sexo || '').toUpperCase().trim().startsWith('M');
        
        if (isMale && (tipo === 'LÍDER' || tipo === 'PASTOR') && targetCell.lideranca.length < 3) {
          targetCell.lideranca.push({ member: m, ministry: min });
        } else if ((tipo === 'DIÁCONO' || tipo === 'LÍDER' || tipo === 'PASTOR' || targetCell.ligamentos.length < 3) && targetCell.ligamentos.length < 4 && targetCell.lideranca.length > 0) {
          targetCell.ligamentos.push({ member: m, ministry: min });
        } else {
          targetCell.corpo.push({ member: m, ministry: min });
        }
      });
    });

    // Post-process region cells
    regionCells.forEach(c => {
      const totalMembers = c.lideranca.length + c.ligamentos.length + c.corpo.length;
      if (totalMembers === 0) return;

      // Sem promover neófitos/novinhos à liderança! Se a célula não tem um líder masculino ordenado,
      // ela permanece sob supervisão direta do presbitério local para respeitar 1 Timóteo 3:6.
      
      const allMins = new Set([...c.lideranca, ...c.ligamentos, ...c.corpo].map(m => m.ministry));
      c.coverage = allMins.size;
      c.score = Math.round((c.coverage / 5) * 100);
      
      cells.push(c);
    });
  });

  // Re-index cells sequentially
  cells.forEach((c, idx) => {
    c.index = idx + 1;
  });

  return cells;
}

// ─────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────
export const LabVision: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCell, setExpandedCell] = useState<number | null>(null);
  const [hoveredMin, setHoveredMin] = useState<MinistryKey | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('membros')
      .select('id, nome, tipo_de_pessoa, grupos_caseiros, status, sexo')
      .limit(10000)
      .then(({ data, error }) => { 
        if (error) setFetchError(error.message);
        setMembers(data || []); 
        setLoading(false); 
      });
  }, []);

  const bodyPool = useMemo(() =>
    members.filter(m => {
      if (!m.status || m.status.trim().toLowerCase() !== 'ativo') return false;
      const tipo = normalizeType(m.tipo_de_pessoa);
      if (!VALID_TIPOS.includes(tipo)) return false;
      if (m.nome && m.nome.toUpperCase().includes('VINCI')) return false;
      return true;
    }), [members]);

  const renderCellMember = (cm: CellMember) => {
    const minConfig = MIN[cm.ministry];
    const Icon = minConfig.Icon;
    const isLider = normalizeType(cm.member.tipo_de_pessoa) === 'LÍDER' || normalizeType(cm.member.tipo_de_pessoa) === 'PASTOR';
    const shortName = cm.member.nome ? cm.member.nome.split(' ')[0] : 'Desconhecido';
    return (
      <div key={cm.member.id} className={clsx('flex flex-col items-center p-2 rounded-xl border relative group transition-all', minConfig.light, minConfig.border, 'bg-white shadow-sm hover:shadow-md')}>
        <div className={clsx('absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white bg-gradient-to-br shadow-sm', minConfig.gradient)}>
          <Icon className="w-2.5 h-2.5 text-white" />
        </div>
        {isLider && (
          <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-gray-900 flex items-center justify-center border-2 border-white shadow-sm" title="Cargo Liderança">
            <Star className="w-2.5 h-2.5 text-amber-400" />
          </div>
        )}
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-1 text-gray-500 font-black text-sm uppercase border border-gray-200">
          {shortName.substring(0, 2)}
        </div>
        <p className="text-[10px] font-black text-gray-900 w-full text-center truncate px-1">{shortName}</p>
        <p className={clsx('text-[8px] font-bold uppercase tracking-widest mt-0.5', minConfig.text)}>{minConfig.label}</p>
      </div>
    );
  };

  const localPresbytery = useMemo(() =>
    PRESB_CONFIG.filter(p => !p.external).map(p => ({
      ...p,
      member: members.find(m => p.nameKey.split(' ').every(part => m.nome.toUpperCase().includes(part))),
    })), [members]);

  const vinciConfig = PRESB_CONFIG.find(p => p.external)!;

  // Pool excluding presbytery for the body layers
  const presbyNames = PRESB_CONFIG.map(p => p.nameKey);
  const nonPresb = useMemo(() =>
    bodyPool.filter(m => !presbyNames.some(key => key.split(' ').every(part => m.nome.toUpperCase().includes(part)))),
    [bodyPool]);

  const pastors  = useMemo(() => nonPresb.filter(m => normalizeType(m.tipo_de_pessoa) === 'PASTOR'), [nonPresb]);
  const deacons  = useMemo(() => nonPresb.filter(m => normalizeType(m.tipo_de_pessoa) === 'DIÁCONO'), [nonPresb]);
  const leaders  = useMemo(() => nonPresb.filter(m => normalizeType(m.tipo_de_pessoa) === 'LÍDER'), [nonPresb]);
  const regular  = useMemo(() => nonPresb.filter(m => normalizeType(m.tipo_de_pessoa) === 'MEMBRO'), [nonPresb]);

  // Ministry distribution
  const minDist = useMemo(() => {
    const c: Record<MinistryKey, number> = { apostolo: 0, profeta: 0, evangelista: 0, pastor: 0, mestre: 0 };
    bodyPool.forEach(m => assignMin(m).forEach(k => c[k]++));
    return c;
  }, [bodyPool]);

  const totalMinCounts = useMemo(() => Object.values(minDist).reduce((a, b) => a + b, 0), [minDist]);

  // Ideal cells formed from the NON-presbytery body
  const idealCells = useMemo(() => formIdealCells(nonPresb, 12), [nonPresb]);

  // Gap analysis
  const presidGap = useMemo(() => {
    const covered = new Set(PRESB_CONFIG.filter(p => !p.external).flatMap(p => p.ministries));
    return MIN_KEYS.filter(k => !covered.has(k));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="relative w-20 h-20 mx-auto mb-4">
          {[0,1,2].map(i => (
            <div key={i} className="absolute inset-0 border-2 border-violet-400 rounded-full animate-ping"
              style={{ animationDelay: `${i*350}ms`, animationDuration:'1.8s', opacity: 0.5-i*0.15 }} />
          ))}
          <div className="absolute inset-0 flex items-center justify-center"><Crown className="h-8 w-8 text-violet-400" /></div>
        </div>
        <p className="text-gray-400 text-sm">Construindo a visão do zero...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Dynamic Tabs Navigation inside Lab Pages */}
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-1">
        {[
          { path: '/lab/vision', label: '🏛️ Visão de Efésios 4' },
          { path: '/lab/visits', label: '🏠 Gestão de Visitas' },
          { path: '/lab/queries', label: '📊 Consultas & Estudos' }
        ].map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={clsx(
                "px-4 py-2 text-xs font-black uppercase tracking-wider rounded-t-xl transition-all border-b-2 cursor-pointer",
                isActive 
                  ? "bg-slate-900 text-white border-indigo-500" 
                  : "bg-slate-50 text-slate-500 border-transparent hover:bg-slate-100/80 hover:text-slate-700"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl bg-[#080810] p-10 text-white">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Concentric rings */}
          {[500, 400, 300, 200, 120].map((s, i) => (
            <div key={i} className="absolute border border-white/[0.04] rounded-full"
              style={{ width: s, height: s, bottom: -s/2, right: -s/4 }} />
          ))}
          <div className="absolute top-0 left-0 w-80 h-80 bg-violet-600/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
          <div className="absolute bottom-0 right-1/3 w-60 h-60 bg-amber-500/8 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-violet-400/10 text-violet-300 px-3 py-1.5 rounded-full text-xs font-bold mb-6 border border-violet-400/20">
            <Eye className="h-3 w-3" /> LAB · Como Eddy Leo construiria do zero
          </div>
          <h1 className="text-5xl font-black tracking-tight leading-[1.05] mb-4">
            Simulação da<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-amber-300 to-rose-400">
              Igreja da Plenitude
            </span>
          </h1>
          <p className="text-gray-400 leading-relaxed max-w-2xl">
            Esqueça a estrutura atual. Partindo apenas das <strong className="text-gray-200">{bodyPool.length} pessoas ativas</strong> com
            papel no corpo (Pastor, Líder, Diácono, Membro), como <strong className="text-gray-200">Eddy Leo</strong> as organizaria
            para que Cristo se expresse em plenitude — segundo <strong className="text-gray-200">Ef 4:11-16</strong>?
          </p>
        </div>
      </div>

      {/* PASSO 1 — OS 5 MINISTÉRIOS */}
      <section>
        <div className="flex items-center gap-3 mb-1">
          <span className="w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-black flex items-center justify-center shrink-0">1</span>
          <h2 className="text-xl font-black text-gray-900">Os 5 Ministérios: a anatomia do corpo</h2>
        </div>
        <p className="text-sm text-gray-400 ml-10 mb-5">
          Eddy Leo começa por aqui — antes de qualquer estrutura, os 5 ministérios são a anatomia que o corpo precisa ter.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {MIN_KEYS.map(key => {
            const m = MIN[key];
            const isH = hoveredMin === key;
            const Icon = m.Icon;
            return (
              <div key={key}
                onMouseEnter={() => setHoveredMin(key)}
                onMouseLeave={() => setHoveredMin(null)}
                className={clsx(
                  'rounded-2xl border p-5 transition-all duration-300 cursor-default',
                  isH ? `${m.light} ${m.border} -translate-y-1 shadow-xl` : 'bg-white border-gray-100 shadow-sm'
                )}>
                <div className={clsx('w-11 h-11 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br transition-all', m.gradient, isH && 'scale-110 shadow-lg')}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <p className={clsx('text-lg font-black transition-colors', isH ? m.text : 'text-gray-900')}>{m.emoji} {m.label}</p>
                <p className="text-[11px] text-gray-400 mt-1 leading-snug">{isH ? m.apostle : m.role}</p>
                {isH && (
                  <div className={clsx('mt-3 p-3 rounded-xl border text-[10px] leading-relaxed', m.light, m.border, m.text)}>
                    <span className="font-bold">Eddy Leo:</span> {m.eddy}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* PASSO 2 — O GOVERNO: PRESBÍTÉRIO */}
      <section>
        <div className="flex items-center gap-3 mb-1">
          <span className="w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-black flex items-center justify-center shrink-0">2</span>
          <h2 className="text-xl font-black text-gray-900">O Governo: Presbítério com os 5 Ministérios</h2>
        </div>
        <p className="text-sm text-gray-400 ml-10 mb-5">
          Eddy Leo estabelece o governo primeiro. O Presbítério precisa cobrir todos os 5 ministérios — sem isso, o corpo cresce torto.
        </p>

        {/* Cobertura Externa */}
        <div className="mb-4 bg-gradient-to-r from-violet-950 to-purple-900 rounded-2xl p-5 border border-violet-800/50 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center shrink-0 shadow-lg">
            <Wifi className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-black text-violet-300 uppercase tracking-widest bg-violet-900/50 px-2 py-0.5 rounded-full border border-violet-700">Cobertura Apostólica Externa</span>
              <span className="text-xs font-bold text-violet-200">🏛️ Apóstolo</span>
            </div>
            <p className="text-white font-black text-base">Vinci do Rego Barros</p>
            <p className="text-violet-300 text-xs mt-1">{vinciConfig.note}</p>
          </div>
          <div className="hidden md:block text-right shrink-0">
            <p className="text-violet-400 text-[10px] font-semibold">Eddy Leo diria:</p>
            <p className="text-violet-300 text-[10px] max-w-48 text-right leading-relaxed mt-1">
              "Toda Igreja local precisa de cobertura apostólica — mesmo que o apóstolo não more aqui."
            </p>
          </div>
        </div>

        {/* Presbítério Local */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {localPresbytery.map(p => (
            <div key={p.nameKey} className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
              <div className="flex flex-wrap gap-1.5 mb-3">
                {p.ministries.map(key => {
                  const mc = MIN[key];
                  const Icon = mc.Icon;
                  return (
                    <span key={key} className={clsx('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full text-white bg-gradient-to-r', mc.gradient)}>
                      <Icon className="h-3 w-3" /> {mc.label}
                    </span>
                  );
                })}
              </div>
              <p className="text-white font-black text-sm leading-tight">{p.displayName.split(' ').slice(0,2).join(' ')}</p>
              <p className="text-gray-600 text-[10px] mt-0.5">{p.displayName.split(' ').slice(2).join(' ')}</p>
              <p className="text-gray-500 text-[10px] mt-3 leading-relaxed border-t border-gray-800 pt-3">{p.note}</p>
            </div>
          ))}
        </div>

        {/* GAP ANALYSIS */}
        {presidGap.length > 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
            <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-amber-900 text-sm">Lacuna identificada no Presbítério Local</p>
              <p className="text-amber-700 text-xs mt-1 leading-relaxed">
                Os ministérios de <strong>{presidGap.map(k => MIN[k].label).join(' e ')}</strong> não estão cobertos no governo local.{' '}
                {presidGap.includes('pastor') && (
                  <>Eddy Leo diria que um corpo sem <strong>Pastor sênior</strong> no Presbítério vai sangrar — 
                  os membros se sentirão sem cuidado, sem pertencimento. Esta é a lacuna mais urgente a ser preenchida.</>
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <p className="text-emerald-700 text-sm font-semibold">Presbítério cobre todos os 5 ministérios ✓</p>
          </div>
        )}
      </section>

      {/* PASSO 3 — FLUXO MINISTERIAL */}
      <section>
        <div className="flex items-center gap-3 mb-1">
          <span className="w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-black flex items-center justify-center shrink-0">3</span>
          <h2 className="text-xl font-black text-gray-900">Como o fluxo ministerial desce para o corpo</h2>
        </div>
        <p className="text-sm text-gray-400 ml-10 mb-5">
          Eddy Leo não cria hierarquias — cria <em>fluxos de equipamento</em>. Cada camada equipa a próxima (Ef 4:12).
        </p>

        <div className="bg-gray-950 rounded-3xl p-8 space-y-0">
          {[
            {
              tag: 'GOVERNO', icon: Crown,
              title: 'Presbítério — Apostólico, Profético, Evangelístico, Pastoral, Mestre',
              sub: 'Definem a visão, lançam fundações, cobrem os 5 ministérios',
              count: localPresbytery.length,
              gradient: 'from-violet-500 to-purple-700',
            },
            {
              tag: 'SERVIÇO', icon: Shield,
              title: 'Diáconos — Libertam os ministros para oração e Palavra (At 6:2-4)',
              sub: `${deacons.length} pessoas que servem ao corpo, removendo obstáculos práticos`,
              count: deacons.length,
              gradient: 'from-slate-400 to-slate-600',
            },
            {
              tag: 'LIDERANÇA LOCAL', icon: BookMarked,
              title: 'Líderes — Ensinam e pastoreiam na unidade básica',
              sub: `${leaders.length} líderes, cada um equipando sua célula com Ensino + Cuidado Pastoral`,
              count: leaders.length,
              gradient: 'from-rose-400 to-pink-600',
            },
            {
              tag: 'O CORPO', icon: Users,
              title: 'Membros — Cada um com um dom para edificar',
              sub: `${regular.length} membros — o corpo de Cristo, cada um com um ministério`,
              count: regular.length,
              gradient: 'from-blue-400 to-blue-700',
            },
          ].map((layer, i, arr) => {
            const Icon = layer.icon;
            const widthPct = Math.max(20, 100 - i * 18);
            return (
              <div key={layer.tag}>
                <div className="flex justify-center">
                  <div style={{ width: `${widthPct}%` }}
                    className="relative rounded-2xl overflow-hidden group transition-all">
                    <div className={clsx('absolute inset-0 bg-gradient-to-r opacity-20', layer.gradient)} />
                    <div className="relative flex items-center gap-4 px-6 py-4 border border-white/10 rounded-2xl">
                      <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br shrink-0', layer.gradient)}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{layer.tag}</span>
                          <span className="text-[9px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded font-bold">{layer.count} pessoas</span>
                        </div>
                        <p className="text-white text-xs font-bold truncate">{layer.title}</p>
                        <p className="text-gray-500 text-[10px] mt-0.5 truncate">{layer.sub}</p>
                      </div>
                    </div>
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <div className="flex justify-center py-2">
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-px h-4 bg-white/10" />
                      <ArrowDown className="h-3 w-3 text-gray-700" />
                      <p className="text-[9px] text-gray-600 font-semibold">EQUIPA</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* PASSO 4 — DISTRIBUIÇÃO DOS DONS */}
      <section>
        <div className="flex items-center gap-3 mb-1">
          <span className="w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-black flex items-center justify-center shrink-0">4</span>
          <h2 className="text-xl font-black text-gray-900">Distribuição dos dons no corpo</h2>
        </div>
        <p className="text-sm text-gray-400 ml-10 mb-5">
          Simulação dos {bodyPool.length} membros distribuídos pelos 5 ministérios — base para a formação das células ideais.
          <span className="ml-1 text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">
            Presbíteros por designação · Líderes = Mestre+Pastor · Diáconos e Membros por dom simulado
          </span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {MIN_KEYS.map(key => {
            const mc = MIN[key];
            const count = minDist[key];
            const pct = totalMinCounts > 0 ? Math.round((count / totalMinCounts) * 100) : 0;
            const Icon = mc.Icon;
            return (
              <div key={key} className={clsx('rounded-2xl border p-5', mc.light, mc.border)}>
                <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-gradient-to-br shadow-sm', mc.gradient)}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <p className={clsx('text-xs font-black uppercase tracking-wide', mc.text)}>{mc.label}</p>
                <p className="text-3xl font-black text-gray-900 mt-1">{count}</p>
                <div className="flex items-center gap-1 mt-2">
                  <div className="flex-1 h-1.5 bg-white/60 rounded-full overflow-hidden">
                    <div className={clsx('h-full rounded-full bg-gradient-to-r', mc.gradient)} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={clsx('text-[10px] font-black', mc.text)}>{pct}%</span>
                </div>
                <p className={clsx('text-[10px] mt-2 leading-tight', mc.text)}>do corpo</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* PASSO 5 — CÉLULAS IDEAIS (Visão Indonésia / Havruta) */}
      <section>
        <div className="flex items-center gap-3 mb-1">
          <span className="w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-black flex items-center justify-center shrink-0">5</span>
          <h2 className="text-xl font-black text-gray-900">Células ideais — Visão Indonésia (Havruta)</h2>
        </div>
        <p className="text-sm text-gray-400 ml-10 mb-5">
          Simulação das células formadas organicamente, distribuindo os membros em seus 3 níveis estruturais: Liderança/Micro-Presbitério, Juntas e Ligamentos, e Corpo.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Células Formadas', value: idealCells.length },
            { label: 'Cobertura 5/5', value: idealCells.filter(c => c.coverage === 5).length },
            { label: 'Pessoas Distribuídas', value: nonPresb.length },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-2xl font-black text-gray-900">{s.value}</p>
              <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {idealCells.map(cell => {
            const isExpanded = expandedCell === cell.index;
            return (
              <div key={cell.index} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all">
                {/* HEADER DA CÉLULA */}
                <button
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedCell(isExpanded ? null : cell.index)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center font-black text-lg">
                      {cell.index}
                    </div>
                    <div className="text-left">
                      <p className="font-black text-gray-900 flex items-center gap-2">
                        Micro Célula {cell.index}
                        {cell.regionName && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-100/60 uppercase tracking-wider">
                            {cell.regionName}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 font-medium">
                        {cell.lideranca.length + cell.ligamentos.length + cell.corpo.length} membros · {cell.coverage}/5 Dons Presentes
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Indicador de Saúde */}
                    <div className="hidden md:flex gap-1">
                      {MIN_KEYS.map(key => {
                        const hasIt = [...cell.lideranca, ...cell.ligamentos, ...cell.corpo].some(m => m.ministry === key);
                        const mc = MIN[key];
                        return (
                          <div key={key} title={mc.label}
                            className={clsx('w-6 h-6 rounded-md flex items-center justify-center text-[10px]',
                              hasIt ? `bg-gradient-to-br ${mc.gradient} text-white` : 'bg-gray-100 text-gray-300 opacity-50')}>
                            {mc.emoji}
                          </div>
                        );
                      })}
                    </div>
                    {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                  </div>
                </button>

                {/* DETALHAMENTO INDONÉSIA */}
                {isExpanded && (
                  <div className="border-t border-gray-100 bg-[#FAFAFA] p-6 space-y-6">
                    
                    {/* CAMADA 1: Micro-Presbitério */}
                    <div className="relative pl-4">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 rounded-full" />
                      <h3 className="text-xs font-black text-violet-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Crown className="w-4 h-4" /> Liderança / Micro-Presbitério
                      </h3>
                      {cell.lideranca.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                          {cell.lideranca.map(renderCellMember)}
                        </div>
                      ) : (
                        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 max-w-xl shadow-sm">
                          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-black text-amber-800 uppercase tracking-wide">Supervisão Pastoral Temporária (1 Tm 3:6)</p>
                            <p className="text-[10px] text-amber-700 mt-1 leading-relaxed">
                              Esta célula não possui um líder local ordenado para evitar a nomeação precipitada de novos convertidos (*"não seja neófito..."*). Ela está sob supervisão e mentoria direta do Presbitério local.
                            </p>
                          </div>
                        </div>
                      )}
                      <p className="text-[10px] text-gray-400 mt-2 font-medium italic">Responsáveis pela fundação, ensino e pastoreio da célula.</p>
                    </div>

                    {/* CAMADA 2: Juntas e Ligamentos */}
                    <div className="relative pl-4">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-full" />
                      <h3 className="text-xs font-black text-amber-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <GitMerge className="w-4 h-4" /> Juntas e Ligamentos
                      </h3>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {cell.ligamentos.map(renderCellMember)}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2 font-medium italic">Conectam o corpo, promovem relacionamento e exercem dons de serviço/profético.</p>
                    </div>

                    {/* CAMADA 3: O Corpo */}
                    <div className="relative pl-4">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-full" />
                      <h3 className="text-xs font-black text-blue-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Users className="w-4 h-4" /> Membros do Corpo
                      </h3>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
                        {cell.corpo.map(renderCellMember)}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2 font-medium italic">A plenitude de Cristo expressa através da diversidade dos dons diários.</p>
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* CONCLUSÃO */}
      <div className="relative overflow-hidden rounded-3xl bg-gray-950 p-8">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-3 mb-5">
            <Sparkles className="h-6 w-6 text-amber-400" />
            <h2 className="text-white font-black text-base">O que Eddy Leo concluiria sobre BSB</h2>
          </div>
          <div className="space-y-3">
            {[
              { icon: '✅', text: `Cobertura apostólica forte (Wagner) — fundação sólida e visão bem delineadas` },
              { icon: '✅', text: `Presença profética (Carlos Alberto) e evangelística (Marcelo Braga) no governo — corpo com voz e missão` },
              { icon: '✅', text: `Vinci como cobertura apostólica externa — conexão com o corpo maior de Cristo` },
              { icon: presidGap.includes('pastor') ? '⚠️' : '✅', text: presidGap.includes('pastor') ? `LACUNA CRÍTICA: Ministério Pastoral sênior ausente no Presbítério — prioridade número 1 para resolver` : `Pastoral coberto no Presbítério ✓` },
              { icon: '📌', text: `Com ${bodyPool.length} pessoas, BSB pode formar ${idealCells.length} células equilibradas — mas a formação por dom (não por bairro) maximiza a saúde de cada grupo` },
              { icon: '📌', text: `O próximo passo prático: mapeamento real dos dons motivacionais (Rm 12) de cada membro — isso tornaria a simulação real` },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-white/5 rounded-xl p-4 border border-white/5">
                <span className="text-lg shrink-0">{item.icon}</span>
                <p className="text-gray-300 text-sm leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 bg-white/5 rounded-2xl p-5 border border-white/10">
            <p className="text-gray-400 text-xs leading-relaxed italic text-center">
              "A Igreja, que é o seu corpo, a plenitude daquele que tudo enche em todos."
            </p>
            <p className="text-gray-600 text-[10px] mt-2 text-center font-semibold">Efésios 1:23 · LAB BSB — Simulação Experimental</p>
          </div>
        </div>
      </div>

    </div>
  );
};
