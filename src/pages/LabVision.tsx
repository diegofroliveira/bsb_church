import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Crown, Flame, MessageSquare, BookMarked, HandHeart,
  Eye, Sparkles, ArrowDown, Users, AlertTriangle,
  CheckCircle2, Circle, Shield, Star, Wifi, ChevronRight,
  ChevronDown, TrendingUp, Info, GitMerge, Network
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
  role: string; eddy: string; apostle: string;
}> = {
  apostolo: {
    label: 'Apóstolo', emoji: '🏛️', Icon: Crown,
    gradient: 'from-violet-500 to-purple-700',
    light: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700',
    role: 'Lança fundações, envia e define a visão',
    eddy: 'O arquiteto do corpo — garante que tudo seja construído sobre Cristo',
    apostle: 'Ossos — sustenta e dá estrutura ao corpo',
  },
  profeta: {
    label: 'Profeta', emoji: '🔥', Icon: Flame,
    gradient: 'from-amber-400 to-orange-600',
    light: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700',
    role: 'Revela, discerne, alerta e edifica',
    eddy: 'A consciência do corpo — mantém a Igreja conectada à voz de Deus',
    apostle: 'Sistema nervoso — transmite sinais vitais ao corpo',
  },
  evangelista: {
    label: 'Evangelista', emoji: '🌍', Icon: MessageSquare,
    gradient: 'from-emerald-400 to-teal-600',
    light: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700',
    role: 'Alcança os perdidos, colhe e integra ao corpo',
    eddy: 'Os pés do corpo — sem ele, o corpo perde a mobilidade',
    apostle: 'Pés — em movimento constante em direção ao mundo',
  },
  pastor: {
    label: 'Pastor', emoji: '🕊️', Icon: HandHeart,
    gradient: 'from-blue-400 to-blue-700',
    light: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700',
    role: 'Cuida, restaura, protege e reúne',
    eddy: 'O coração do corpo — sem ele, os membros se sentem sem pertencimento',
    apostle: 'Coração — bombeia vida a cada parte do corpo',
  },
  mestre: {
    label: 'Mestre', emoji: '📖', Icon: BookMarked,
    gradient: 'from-rose-400 to-pink-700',
    light: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700',
    role: 'Ensina, equipa e forma discípulos',
    eddy: 'A mente do corpo — dá direção e profundidade na Palavra',
    apostle: 'Mente — dá direção e coerência ao que o corpo faz',
  },
};

const MIN_KEYS: MinistryKey[] = ['apostolo', 'profeta', 'evangelista', 'pastor', 'mestre'];

// ─────────────────────────────────────────────────────────
// PRESBÍTÉRIO (Fixo)
// ─────────────────────────────────────────────────────────
const PRESB_CONFIG: Array<{
  nameKey: string; displayName: string;
  ministries: MinistryKey[]; note?: string; external?: boolean;
}> = [
  { nameKey: 'VINCI DO REGO BARROS', displayName: 'Vinci do Rego Barros', ministries: ['apostolo'], external: true, note: 'Cobertura apostólica externa' },
  { nameKey: 'WAGNER DE LIMA OLIVEIRA', displayName: 'Wagner de Lima Oliveira', ministries: ['apostolo', 'mestre'], note: 'Apóstolo + Mestre' },
  { nameKey: 'WANDERLEY CLODOALDO LIMA DE FREITAS', displayName: 'Wanderley C. L. de Freitas', ministries: ['apostolo', 'mestre'], note: 'Apóstolo + Mestre' },
  { nameKey: 'CARLOS ALBERTO RIBEIRO DO NASCIMENTO', displayName: 'Carlos Alberto R. do Nascimento', ministries: ['profeta'], note: 'Profeta' },
  { nameKey: 'MARCELO BRAGA SILVA', displayName: 'Marcelo Braga Silva', ministries: ['evangelista'], note: 'Evangelista' },
];

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

function hashMin(nome: string): MinistryKey {
  const h = nome.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return MIN_KEYS[h % 5];
}

function assignMin(m: Member): MinistryKey[] {
  const presbyExact = PRESB_CONFIG.find(p => p.nameKey.split(' ').every(part => m.nome.trim().toUpperCase().includes(part)));
  if (presbyExact) return presbyExact.ministries;

  const tipo = normalizeType(m.tipo_de_pessoa);
  if (tipo === 'PASTOR') return ['pastor'];
  if (tipo === 'LÍDER') return ['mestre'];
  if (tipo === 'DIÁCONO') return [hashMin(m.nome)];
  return [hashMin(m.nome)];
}

// ─────────────────────────────────────────────────────────
// CÉLULAS IDEAIS (Visão Indonésia / Eddy Leo)
// ─────────────────────────────────────────────────────────
interface CellMember {
  member: Member;
  ministry: MinistryKey;
}

interface IdealCell {
  index: number;
  score: number;
  coverage: number;
  lideranca: CellMember[];     // Micro-presbitério local
  ligamentos: CellMember[];    // Juntas e ligamentos
  corpo: CellMember[];         // Corpo
}

function formIdealCells(pool: Member[], targetSize = 12): IdealCell[] {
  const shuffled = [...pool].sort((a, b) => {
    const ma = assignMin(a)[0];
    const mb = assignMin(b)[0];
    return MIN_KEYS.indexOf(ma) - MIN_KEYS.indexOf(mb);
  });

  const numCells = Math.ceil(pool.length / targetSize);
  if (numCells === 0) return [];

  const cells: IdealCell[] = Array.from({ length: numCells }, (_, i) => ({
    index: i + 1, score: 0, coverage: 0, lideranca: [], ligamentos: [], corpo: []
  }));

  shuffled.forEach((m, i) => {
    const cell = cells[i % numCells];
    const min = assignMin(m)[0];
    const tipo = normalizeType(m.tipo_de_pessoa);
    
    // Distribuir nos 3 níveis estruturais da Visão Indonésia:
    // 1. Liderança: Líderes, Pastores ou quem tiver dom de ensino/pastoreio forte (limite ~3)
    if ((tipo === 'LÍDER' || tipo === 'PASTOR') && cell.lideranca.length < 3) {
      cell.lideranca.push({ member: m, ministry: min });
    } 
    // 2. Juntas/Ligamentos: Diáconos ou pessoas chave de apoio (limite ~3)
    else if ((tipo === 'DIÁCONO' || cell.ligamentos.length < 3) && cell.ligamentos.length < 4 && cell.lideranca.length > 0) {
      cell.ligamentos.push({ member: m, ministry: min });
    } 
    // 3. Corpo: O restante
    else {
      cell.corpo.push({ member: m, ministry: min });
    }
  });

  // Calcular cobertura
  cells.forEach(c => {
    // Fallback caso falte liderança
    if (c.lideranca.length === 0 && c.ligamentos.length > 0) {
      c.lideranca.push(c.ligamentos.shift()!);
    }
    
    const allMins = new Set([...c.lideranca, ...c.ligamentos, ...c.corpo].map(m => m.ministry));
    c.coverage = allMins.size;
    c.score = Math.round((c.coverage / 5) * 100);
  });

  return cells;
}

// ─────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────
export const LabVision: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCell, setExpandedCell] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('membros')
      .select('id, nome, tipo_de_pessoa, grupos_caseiros, discipulador_nome, status, sexo')
      .limit(10000)
      .then(({ data, error }) => { 
        if (error) {
          console.error("Supabase error:", error);
          setFetchError(error.message);
        }
        setMembers(data || []); 
        setLoading(false); 
      })
      .catch(err => {
        console.error("Fetch exception:", err);
        setFetchError(err.message);
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

  const presbyNames = PRESB_CONFIG.map(p => p.nameKey);
  const nonPresb = useMemo(() =>
    bodyPool.filter(m => !presbyNames.some(key => m.nome && m.nome.toUpperCase().includes(key.split(' ')[0]))),
    [bodyPool, presbyNames]);

  const idealCells = useMemo(() => formIdealCells(nonPresb, 12), [nonPresb]);

  const renderCellMember = (cm: CellMember) => {
    const minConfig = MIN[cm.ministry];
    const Icon = minConfig.Icon;
    const isLider = normalizeType(cm.member.tipo_de_pessoa) === 'LÍDER' || normalizeType(cm.member.tipo_de_pessoa) === 'PASTOR';
    const shortName = cm.member.nome ? cm.member.nome.split(' ')[0] : 'Desconhecido';
    
    return (
      <div key={cm.member.id} className={clsx('flex flex-col items-center p-2 rounded-xl border relative group transition-all', minConfig.bg, minConfig.border, 'bg-white shadow-sm hover:shadow-md')}>
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
        
        <p className="text-[10px] font-black text-gray-900 w-full text-center truncate px-1">
          {shortName}
        </p>
        <p className={clsx('text-[8px] font-bold uppercase tracking-widest mt-0.5', minConfig.text)}>
          {minConfig.label}
        </p>
      </div>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="relative w-20 h-20 mx-auto mb-4">
          <div className="absolute inset-0 border-2 border-violet-400 rounded-full animate-ping" />
          <div className="absolute inset-0 flex items-center justify-center"><Crown className="h-8 w-8 text-violet-400" /></div>
        </div>
        <p className="text-gray-400 text-sm">Construindo o corpo a nível de pessoa...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl bg-[#080810] p-10 text-white">
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-violet-400/10 text-violet-300 px-3 py-1.5 rounded-full text-xs font-bold mb-6 border border-violet-400/20">
            <Eye className="h-3 w-3" /> LAB · Visão Indonésia (Eddy Leo)
          </div>
          <h1 className="text-5xl font-black tracking-tight leading-[1.05] mb-4">
            Simulação a Nível de <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 via-amber-300 to-rose-400">
              Pessoa e Dom
            </span>
          </h1>
          <p className="text-gray-400 leading-relaxed max-w-2xl">
            Baseado no estudo de Havruta/Águas Claras. Cada célula não tem apenas um líder, mas um 
            <strong className="text-gray-200"> Micro-Presbitério</strong>, apoiado por 
            <strong className="text-gray-200"> Juntas e Ligamentos</strong>, exercendo os 5 dons no 
            <strong className="text-gray-200"> Corpo</strong>.
          </p>
        </div>
      </div>
      
      {/* ERROR / DEBUG BANNER */}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
          <p className="font-bold">Erro ao carregar dados do Supabase:</p>
          <p className="text-sm font-mono mt-1">{fetchError}</p>
        </div>
      )}
      {(members.length === 0 && !fetchError) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 p-4 rounded-xl">
          <p className="font-bold">Nenhum membro retornado do banco (Total: {members.length}).</p>
        </div>
      )}


      {/* CÉLULAS SIMULADAS */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <Network className="h-6 w-6 text-violet-500" />
          <h2 className="text-xl font-black text-gray-900">Estrutura Orgânica das Células</h2>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Células Formadas', value: idealCells.length },
            { label: 'Cobertura 5/5', value: idealCells.filter(c => c.score === 100).length },
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
                      <p className="font-black text-gray-900">Micro Célula {cell.index}</p>
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
                  <div className="border-t border-gray-100 bg-[#FAFAFA] p-6">
                    
                    {/* CAMADA 1: Micro-Presbitério */}
                    <div className="mb-6 relative">
                      <div className="absolute -left-2 top-0 bottom-0 w-1 bg-violet-500 rounded-full" />
                      <h3 className="text-xs font-black text-violet-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Crown className="w-4 h-4" /> Liderança / Micro-Presbitério
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        {cell.lideranca.map(renderCellMember)}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2 font-medium italic">Responsáveis pela fundação, ensino e pastoreio da célula.</p>
                    </div>

                    {/* CAMADA 2: Juntas e Ligamentos */}
                    <div className="mb-6 relative">
                      <div className="absolute -left-2 top-0 bottom-0 w-1 bg-amber-500 rounded-full" />
                      <h3 className="text-xs font-black text-amber-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <GitMerge className="w-4 h-4" /> Juntas e Ligamentos
                      </h3>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {cell.ligamentos.map(renderCellMember)}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-2 font-medium italic">Conectam o corpo, promovem relacionamento e exercem dons de serviço/profético.</p>
                    </div>

                    {/* CAMADA 3: O Corpo */}
                    <div className="relative">
                      <div className="absolute -left-2 top-0 bottom-0 w-1 bg-blue-500 rounded-full" />
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
      <div className="bg-gray-900 rounded-3xl p-8 border border-gray-800">
        <div className="flex gap-4">
          <Info className="h-6 w-6 text-amber-400 shrink-0" />
          <div>
            <h3 className="text-white font-black mb-2">Visão Panorama (Águas Claras)</h3>
            <ul className="text-gray-400 text-sm space-y-2 list-disc list-inside">
              <li>Melhor distribuição das cargas e acompanhamento do corpo (sem 1 único líder sobrecarregado).</li>
              <li>Foco em exercitar os dons (Efésios 4:16) em vez de "relatos personificados".</li>
              <li>O Ensino deve ser muito bem acompanhado (Mestres) para evitar desvios durante a transição.</li>
            </ul>
          </div>
        </div>
      </div>

    </div>
  );
};
