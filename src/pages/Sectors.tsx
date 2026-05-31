import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Compass, Users, Home, MapPin, Search, Filter, 
  Layers, CheckCircle2, ChevronRight, AlertCircle, 
  Map, BarChart2, ShieldCheck, UserCheck, Flame, Baby
} from 'lucide-react';
import clsx from 'clsx';

interface Member {
  id: any;
  nome: string;
  tipo_de_pessoa?: string;
  grupos_caseiros?: string;
  status?: string;
  sexo?: string;
  bairro?: string;
  nascimento?: string | null;
  estado_civil?: string;
  e_dizimista?: string;
  setor_eclesiastico?: string | null;
  setor_residencial?: string | null;
}

interface Cell {
  grupo_caseiro: string;
  lider?: string;
  auxiliar?: string;
  setor?: string;
}

interface SectorSummary {
  name: string;
  dbKey: string;
  color: string;
  glow: string;
  borderGlow: string;
  textColor: string;
  bgGradient: string;
  gcsCount: number;
  membersCount: number;
  leadersCount: number;
  tithersCount: number;
  childrenCount: number;
  percentage: number;
  topNeighborhoods: string[];
}

// Age calculator helper relative to system base date 2026-05-30
const getAge = (birthdayStr: string | null | undefined): number | null => {
  if (!birthdayStr) return null;
  try {
    const birthDate = new Date(birthdayStr);
    const currentDate = new Date('2026-05-30');
    let age = currentDate.getFullYear() - birthDate.getFullYear();
    const m = currentDate.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && currentDate.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  } catch (_) {
    return null;
  }
};

export const Sectors: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Route security & allowed modules
  const allowedModules = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') {
      return ['Dashboard', 'Setores', 'Membros', 'GCs/Localidades', 'Configurações']; // Admin has access to all
    }
    try {
      const stored = localStorage.getItem('church_dynamic_roles');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed[user.role]) {
          return parsed[user.role].modules || [];
        }
      }
    } catch (_) {}
    
    if (user.role === 'pastor') {
      return ['Dashboard', 'Setores', 'Membros', 'GCs/Localidades'];
    }
    return [];
  }, [user]);

  const [members, setMembers] = useState<Member[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter and View State
  const [viewMode, setViewMode] = useState<'eclesiastico' | 'residencial'>('eclesiastico');
  const [selectedSectorName, setSelectedSectorName] = useState<string>('Setor Norte');
  const [detailsTab, setDetailsTab] = useState<'gcs' | 'members' | 'mismatches'>('gcs');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('Todos');
  const [titherFilter, setTitherFilter] = useState('Todos');
  const [notifiedMembers, setNotifiedMembers] = useState<Record<any, boolean>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [membersRes, cellsRes] = await Promise.all([
          supabase
            .from('membros')
            .select('id, nome, tipo_de_pessoa, grupos_caseiros, status, sexo, bairro, nascimento, estado_civil, e_dizimista, setor_eclesiastico, setor_residencial')
            .limit(10000),
          supabase
            .from('celulas')
            .select('grupo_caseiro, lider, auxiliar, setor')
            .limit(1000)
        ]);

        if (membersRes.error) throw membersRes.error;
        if (cellsRes.error) throw cellsRes.error;

        setMembers(membersRes.data || []);
        setCells(cellsRes.data || []);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar dados do Supabase');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const activeMembers = useMemo(() => 
    members.filter(m => m.status && m.status.trim().toUpperCase() === 'ATIVO'),
    [members]
  );

  // Normalization helper (matches Dashboard and Reports)
  const getNormalizedSectorName = (dbSector: string | null | undefined): string => {
    if (!dbSector) return 'Sem Setor';
    const norm = dbSector.trim().toUpperCase();
    if (norm.includes('NORTE')) return 'Setor Norte';
    if (norm.includes('CENTRAL')) return 'Setor Central';
    if (norm.includes('AGUAS CLARAS') || norm.includes('ÁGUAS CLARAS')) return 'Setor Águas Claras';
    if (norm.includes('SUL')) return 'Setor Sul';
    return 'Sem Setor';
  };

  // Build sector summaries
  const sectorSummaries = useMemo<SectorSummary[]>(() => {
    const sectorsMeta = [
      { name: 'Setor Central', dbKey: 'BSB_CENTRAL', color: 'from-blue-600 to-indigo-700', glow: 'shadow-blue-500/20', borderGlow: 'hover:border-blue-500/30', textColor: 'text-blue-600', bgGradient: 'from-blue-500/5 to-indigo-500/5' },
      { name: 'Setor Norte', dbKey: 'BSB_NORTE', color: 'from-emerald-600 to-teal-700', glow: 'shadow-emerald-500/20', borderGlow: 'hover:border-emerald-500/30', textColor: 'text-emerald-600', bgGradient: 'from-emerald-500/5 to-teal-500/5' },
      { name: 'Setor Águas Claras', dbKey: 'BSB ÁGUAS CLARAS', color: 'from-amber-500 to-orange-600', glow: 'shadow-amber-500/20', borderGlow: 'hover:border-amber-500/30', textColor: 'text-amber-600', bgGradient: 'from-amber-500/5 to-orange-500/5' },
      { name: 'Setor Sul', dbKey: 'BSB_SUL', color: 'from-violet-600 to-purple-700', glow: 'shadow-violet-500/20', borderGlow: 'hover:border-violet-500/30', textColor: 'text-violet-600', bgGradient: 'from-violet-500/5 to-purple-500/5' },
      { name: 'Sem Setor', dbKey: 'Sem Setor', color: 'from-slate-500 to-slate-700', glow: 'shadow-slate-500/20', borderGlow: 'hover:border-slate-500/30', textColor: 'text-slate-600', bgGradient: 'from-slate-500/5 to-slate-700/5' }
    ];

    return sectorsMeta.map(meta => {
      // Find cells under this sector
      const sectorCells = cells.filter(c => getNormalizedSectorName(c.setor) === meta.name);
      const cellNames = new Set(sectorCells.map(c => c.grupo_caseiro));

      // Find members under this sector based on viewMode
      const sectorMembers = activeMembers.filter(m => {
        if (viewMode === 'residencial') {
          // Residential logic
          if (m.setor_residencial) {
            return getNormalizedSectorName(m.setor_residencial) === meta.name;
          }
          // Fallback to cells
          if (m.grupos_caseiros) {
            const matchingCell = cells.find(c => c.grupo_caseiro === m.grupos_caseiros);
            return getNormalizedSectorName(matchingCell?.setor) === meta.name;
          }
          return meta.name === 'Sem Setor';
        } else {
          // Ecclesiastical logic (Setor do GC)
          if (m.setor_eclesiastico) {
            return getNormalizedSectorName(m.setor_eclesiastico) === meta.name;
          }
          if (m.grupos_caseiros) {
            const matchingCell = cells.find(c => c.grupo_caseiro === m.grupos_caseiros);
            return getNormalizedSectorName(matchingCell?.setor) === meta.name;
          }
          return meta.name === 'Sem Setor';
        }
      });

      const leadersCount = sectorMembers.filter(m => 
        ['APÓSTOLO', 'PRESBÍTERO', 'DIÁCONO', 'LÍDER'].includes((m.tipo_de_pessoa || '').toUpperCase())
      ).length;

      const tithersCount = sectorMembers.filter(m => m.e_dizimista === 'Sim').length;

      // Children under 8 count
      const childrenCount = sectorMembers.filter(m => {
        if (!m.nascimento) return false;
        const age = getAge(m.nascimento);
        return age !== null && age < 8;
      }).length;

      // Calculate top neighborhoods
      const neighborhoodsCounts: Record<string, number> = {};
      sectorMembers.forEach(m => {
        if (m.bairro) {
          neighborhoodsCounts[m.bairro] = (neighborhoodsCounts[m.bairro] || 0) + 1;
        }
      });
      const topNeighborhoods = Object.entries(neighborhoodsCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);

      const totalActive = activeMembers.length;
      const percentage = totalActive > 0 ? Math.round((sectorMembers.length / totalActive) * 100) : 0;

      return {
        name: meta.name,
        dbKey: meta.dbKey,
        color: meta.color,
        glow: meta.glow,
        borderGlow: meta.borderGlow,
        textColor: meta.textColor,
        bgGradient: meta.bgGradient,
        gcsCount: meta.name === 'Sem Setor' ? cells.filter(c => !c.setor).length : sectorCells.length,
        membersCount: sectorMembers.length,
        leadersCount,
        tithersCount,
        childrenCount,
        percentage,
        topNeighborhoods
      };
    });
  }, [activeMembers, cells, viewMode]);

  // Selected Sector Details
  const selectedSectorMeta = useMemo(() => 
    sectorSummaries.find(s => s.name === selectedSectorName) || sectorSummaries[0],
    [sectorSummaries, selectedSectorName]
  );

  const selectedSectorCells = useMemo(() => {
    if (selectedSectorName === 'Sem Setor') {
      return cells.filter(c => !c.setor);
    }
    return cells.filter(c => getNormalizedSectorName(c.setor) === selectedSectorName);
  }, [cells, selectedSectorName]);

  const selectedSectorMembers = useMemo(() => {
    return activeMembers.filter(m => {
      const isEcclesiastical = viewMode === 'eclesiastico';
      const sectorField = isEcclesiastical ? m.setor_eclesiastico : m.setor_residencial;
      
      let memberSector = 'Sem Setor';
      if (sectorField) {
        memberSector = getNormalizedSectorName(sectorField);
      } else if (m.grupos_caseiros) {
        const matchingCell = cells.find(c => c.grupo_caseiro === m.grupos_caseiros);
        memberSector = getNormalizedSectorName(matchingCell?.setor);
      }

      return memberSector === selectedSectorName;
    });
  }, [activeMembers, cells, selectedSectorName, viewMode]);

  // Find all members in the selected sector that have a sector mismatch (Territorial Inconsistency)
  const mismatchedMembers = useMemo(() => {
    return selectedSectorMembers.filter(m => {
      if (!m.grupos_caseiros) return false;
      
      const eclSec = getNormalizedSectorName(
        m.setor_eclesiastico || cells.find(c => c.grupo_caseiro === m.grupos_caseiros)?.setor
      );
      
      const resSec = getNormalizedSectorName(
        m.setor_residencial || cells.find(c => c.grupo_caseiro === m.grupos_caseiros)?.setor
      );

      // Mismatch if ecclesiastical sector is different from residential sector
      return eclSec !== 'Sem Setor' && resSec !== 'Sem Setor' && eclSec !== resSec;
    });
  }, [selectedSectorMembers, cells]);

  // Count active members per cell in selected sector
  const membersPerCellCount = useMemo(() => {
    const counts: Record<string, number> = {};
    activeMembers.forEach(m => {
      if (m.grupos_caseiros) {
        counts[m.grupos_caseiros] = (counts[m.grupos_caseiros] || 0) + 1;
      }
    });
    return counts;
  }, [activeMembers]);

  // Filtered members in selected sector
  const filteredMembers = useMemo(() => {
    return selectedSectorMembers.filter(m => {
      const matchesSearch = !searchTerm || m.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (m.bairro || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.grupos_caseiros || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesRole = roleFilter === 'Todos' || (m.tipo_de_pessoa || '').toUpperCase() === roleFilter.toUpperCase();
      const matchesTither = titherFilter === 'Todos' || m.e_dizimista === titherFilter;

      return matchesSearch && matchesRole && matchesTither;
    });
  }, [selectedSectorMembers, searchTerm, roleFilter, titherFilter]);

  // Filtered GCs in selected sector
  const filteredCells = useMemo(() => {
    return selectedSectorCells.filter(c => {
      return !searchTerm || c.grupo_caseiro.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.lider || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.auxiliar || '').toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [selectedSectorCells, searchTerm]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center space-y-3">
          <Compass className="h-10 w-10 animate-spin text-blue-600 mx-auto" />
          <p className="text-gray-500 text-sm font-medium animate-pulse">Carregando setores da congregação...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center bg-red-50 border border-red-200 rounded-2xl max-w-md mx-auto mt-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-red-900 mb-2">Erro de Conexão</h3>
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-bold">Tentar Novamente</button>
      </div>
    );
  }

  // Verification if module is allowed
  if (user?.role !== 'admin' && !allowedModules.includes('Setores')) {
    return (
      <div className="p-8 text-center bg-red-50 border border-red-200 rounded-2xl max-w-md mx-auto mt-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-red-900 mb-2">Acesso Restrito</h3>
        <p className="text-sm text-red-600 mb-4">Seu perfil de acesso atual não possui permissão para visualizar a gestão de setores.</p>
        <button onClick={() => navigate('/')} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-bold">Voltar ao Dashboard</button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20">
      
      {/* Header Banner */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-8 text-white shadow-xl border border-blue-500/10">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-600 rounded-full -translate-x-1/3 translate-y-1/3 blur-3xl" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-300 px-3 py-1 rounded-full text-xs font-bold mb-2 border border-blue-500/20 backdrop-blur-md">
              <Compass className="h-3 w-3 text-blue-400" /> ANÁLISE GEOGRÁFICA & PRESBITÉRIO
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Gestão & Divisão de Setores
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl">
              Compare e acompanhe a evolução geográfica dos setores eclesiásticos (localidade dos GCs) e setores residenciais (onde a igreja fisicamente reside em Brasília).
            </p>
          </div>
          
          <div className="flex bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/80 shrink-0 self-start md:self-center">
            <button 
              onClick={() => setViewMode('eclesiastico')}
              className={clsx(
                "px-5 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer",
                viewMode === 'eclesiastico' ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/10" : "text-slate-400 hover:text-slate-200"
              )}
            >
              Visão Eclesiástica (GCs)
            </button>
            <button 
              onClick={() => setViewMode('residencial')}
              className={clsx(
                "px-5 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer",
                viewMode === 'residencial' ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-md shadow-blue-500/10" : "text-slate-400 hover:text-slate-200"
              )}
            >
              Visão Residencial (Moradia)
            </button>
          </div>
        </div>
      </header>

      {/* Global Sector Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl"><Layers className="w-6 h-6" /></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Setores Ativos</p>
            <h3 className="text-xl font-black text-slate-800">4 Regiões + Avulsos</h3>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl"><Users className="w-6 h-6" /></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Total de Membros Ativos</p>
            <h3 className="text-xl font-black text-slate-800">{activeMembers.length} pessoas</h3>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl"><Home className="w-6 h-6" /></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Total de GCs Registrados</p>
            <h3 className="text-xl font-black text-slate-800">{cells.length} células</h3>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-violet-50 text-violet-600 rounded-2xl"><MapPin className="w-6 h-6" /></div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase">Densidade Média por GC</p>
            <h3 className="text-xl font-black text-slate-800">
              {cells.length > 0 ? (activeMembers.length / cells.length).toFixed(1) : 0} membros
            </h3>
          </div>
        </div>
      </div>

      {/* Grid of Sector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
        {sectorSummaries.map((sector) => {
          const isSelected = selectedSectorName === sector.name;
          return (
            <div 
              key={sector.name}
              onClick={() => setSelectedSectorName(sector.name)}
              className={clsx(
                "relative rounded-2xl border p-5 cursor-pointer transition-all duration-300 flex flex-col justify-between overflow-hidden group",
                isSelected 
                  ? "bg-slate-900 border-slate-850 text-white shadow-lg ring-1 ring-slate-800" 
                  : "bg-white border-slate-100 hover:border-slate-200 text-slate-800 shadow-sm"
              )}
            >
              {/* Highlight bar with gradient */}
              <div className={clsx(
                "absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r",
                sector.color
              )} />
              
              {/* Glow overlay */}
              {isSelected && (
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                  <div className={clsx("absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl bg-gradient-to-br", sector.color)} />
                </div>
              )}

              <div className="space-y-4 relative z-10">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className={clsx(
                      "text-xs font-black uppercase tracking-wider",
                      isSelected ? "text-slate-400" : "text-slate-400"
                    )}>{viewMode === 'residencial' ? 'Setor Físico' : 'Setor Eclesiástico'}</h3>
                    <h2 className="text-base font-black leading-tight mt-0.5">{sector.name}</h2>
                  </div>
                  <span className={clsx(
                    "text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0",
                    isSelected 
                      ? "bg-slate-800/80 border-slate-700 text-slate-300" 
                      : "bg-slate-50 border-slate-200 text-slate-500"
                  )}>
                    {sector.percentage}%
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1 pt-2 border-t border-dashed border-slate-200/20">
                  <div className="text-left">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Membros</span>
                    <span className="text-base font-black">{sector.membersCount}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">GCs</span>
                    <span className="text-base font-black">{sector.gcsCount}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-amber-500 block uppercase flex items-center justify-end gap-0.5">
                      <Baby className="w-2.5 h-2.5" /> Cria.
                    </span>
                    <span className="text-base font-black text-amber-500">{sector.childrenCount}</span>
                  </div>
                </div>

                {sector.topNeighborhoods.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">Bairros Principais</span>
                    <div className="flex flex-wrap gap-1">
                      {sector.topNeighborhoods.map(b => (
                        <span 
                          key={b} 
                          className={clsx(
                            "text-[8px] font-extrabold px-1.5 py-0.2 rounded truncate max-w-[80px]",
                            isSelected ? "bg-slate-800 text-slate-300 border border-slate-750" : "bg-slate-100 text-slate-650"
                          )}
                          title={b}
                        >
                          {b.split(' (')[0]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100/10 flex items-center justify-between text-[10px] relative z-10">
                <span className={isSelected ? "text-slate-400" : "text-slate-400"}>
                  Líderes: <strong className={isSelected ? "text-slate-200" : "text-slate-700"}>{sector.leadersCount}</strong>
                </span>
                <span className={isSelected ? "text-slate-400" : "text-slate-400"}>
                  Dizimistas: <strong className={isSelected ? "text-slate-200" : "text-slate-700"}>{sector.tithersCount}</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Details Container */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 space-y-6">
        
        {/* Detail Header & Action Panel */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className={clsx(
              "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md",
              "bg-gradient-to-br " + selectedSectorMeta.color
            )}>
              <Compass className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">{selectedSectorMeta.name}</h2>
              <p className="text-xs text-slate-500">
                Exibindo detalhes e lista de liderança do {selectedSectorMeta.name.toLowerCase()} no formato {viewMode === 'residencial' ? 'residencial (moradores)' : 'eclesiástico (membros de GC)'}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            {/* Tabs Trigger */}
            <div className="bg-slate-50 border border-slate-100 p-1 rounded-xl flex flex-wrap gap-1">
              <button 
                onClick={() => setDetailsTab('gcs')}
                className={clsx(
                  "px-3 py-1.5 rounded-lg font-bold text-xs uppercase transition-all cursor-pointer",
                  detailsTab === 'gcs' ? "bg-white text-slate-900 shadow-sm font-black" : "text-slate-500 hover:text-slate-800"
                )}
              >
                Células ({selectedSectorMeta.gcsCount})
              </button>
              <button 
                onClick={() => setDetailsTab('members')}
                className={clsx(
                  "px-3 py-1.5 rounded-lg font-bold text-xs uppercase transition-all cursor-pointer",
                  detailsTab === 'members' ? "bg-white text-slate-900 shadow-sm font-black" : "text-slate-500 hover:text-slate-800"
                )}
              >
                Membros ({selectedSectorMeta.membersCount})
              </button>
              <button 
                onClick={() => setDetailsTab('mismatches')}
                className={clsx(
                  "px-3 py-1.5 rounded-lg font-bold text-xs uppercase transition-all cursor-pointer flex items-center gap-1.5",
                  detailsTab === 'mismatches' ? "bg-white text-slate-900 shadow-sm font-black animate-pulse" : "text-slate-500 hover:text-slate-800"
                )}
              >
                Inconsistências ({mismatchedMembers.length})
                {mismatchedMembers.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder={detailsTab === 'gcs' ? "Buscar GC, líder ou auxiliar..." : detailsTab === 'mismatches' ? "Buscar por nome ou bairro..." : "Buscar membro, bairro ou GC..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-100 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium focus:ring-1 focus:ring-blue-100 transition-all outline-none"
            />
          </div>

          {detailsTab === 'members' && (
            <div className="flex flex-wrap gap-2.5">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Filtros:</span>
              </div>
              
              <select 
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-bold uppercase text-slate-650 transition-all outline-none"
              >
                <option value="Todos">Cargo (Todos)</option>
                <option value="APÓSTOLO">Apóstolo</option>
                <option value="PRESBÍTERO">Presbítero</option>
                <option value="DIÁCONO">Diácono</option>
                <option value="LÍDER">Líder</option>
                <option value="MEMBRO">Membro Comum</option>
                <option value="AGREGADO">Agregado</option>
              </select>

              <select 
                value={titherFilter}
                onChange={(e) => setTitherFilter(e.target.value)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-bold uppercase text-slate-650 transition-all outline-none"
              >
                <option value="Todos">Dizimista (Todos)</option>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
              </select>
            </div>
          )}
        </div>

        {/* Tab content rendering */}
        {detailsTab === 'gcs' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {filteredCells.map((cell) => {
                const count = membersPerCellCount[cell.grupo_caseiro] || 0;
                return (
                  <div key={cell.grupo_caseiro} className="bg-slate-50/20 border border-slate-100 rounded-2xl p-5 hover:border-slate-200 hover:shadow-md transition-all flex flex-col justify-between h-[160px]">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-extrabold text-sm text-slate-900 truncate">{cell.grupo_caseiro}</h3>
                        <span className="text-[9px] font-black uppercase bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 shrink-0">
                          {count} membros
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">{selectedSectorMeta.name}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-semibold">Líder:</span>
                        <strong className="text-slate-700 font-bold truncate max-w-[150px]">{cell.lider || 'Sem Líder'}</strong>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-semibold">Auxiliar:</span>
                        <strong className="text-slate-600 truncate max-w-[150px]">{cell.auxiliar || 'Sem Auxiliar'}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredCells.length === 0 && (
                <div className="col-span-full text-center py-12 bg-slate-50 rounded-2xl border border-slate-100 border-dashed text-slate-400 text-xs italic">
                  Nenhuma célula encontrada para a busca "{searchTerm}" no {selectedSectorName}.
                </div>
              )}
            </div>
          </div>
        )}

        {detailsTab === 'members' && (
          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="min-w-full divide-y divide-slate-100 text-left">
              <thead className="bg-slate-50/60 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                <tr>
                  <th className="px-6 py-4">Membro</th>
                  <th className="px-6 py-4">Cargo / Função</th>
                  <th className="px-6 py-4">Grupo Caseiro (GC)</th>
                  <th className="px-6 py-4">Localidade (Bairro)</th>
                  <th className="px-6 py-4">Dizimista</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-650 bg-white">
                {filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700">
                          {m.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-slate-900 truncate max-w-[200px]">{m.nome}</p>
                          <p className="text-[10px] text-slate-400 capitalize">{m.estado_civil || 'Não inf.'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        "text-[9px] font-black uppercase px-2 py-0.5 rounded border",
                        ['APÓSTOLO', 'PRESBÍTERO', 'DIÁCONO', 'LÍDER'].includes((m.tipo_de_pessoa || '').toUpperCase())
                          ? "bg-amber-50 text-amber-700 border-amber-100"
                          : "bg-slate-50 text-slate-500 border-slate-150"
                      )}>
                        {m.tipo_de_pessoa}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {m.grupos_caseiros || <span className="text-slate-400 italic">Sem GC</span>}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-500">
                      {m.bairro || <span className="text-slate-400 italic">Sem Bairro</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        "text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded",
                        m.e_dizimista === 'Sim' ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                      )}>
                        {m.e_dizimista || 'Não'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => navigate(`/crm/${m.nome}`)}
                        className="text-slate-400 hover:text-blue-600 transition-colors inline-flex items-center gap-1 font-bold text-[10px] uppercase cursor-pointer"
                      >
                        Perfil <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredMembers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 italic bg-slate-50/50">
                      Nenhum membro encontrado correspondente aos filtros no {selectedSectorName}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {detailsTab === 'mismatches' && (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 flex items-start gap-3 text-xs leading-relaxed">
              <AlertCircle className="w-5 h-5 text-amber-650 shrink-0 mt-0.5" />
              <div>
                <strong className="font-extrabold block text-sm mb-1 text-amber-950">Alerta de Inconsistência de Setor</strong>
                Identificamos membros cujo setor de residência física difere do setor eclesiástico de seu Grupo Caseiro (GC). 
                É importante que os membros frequentem células próximas de onde residem para permitir visitas pastorais eficazes e fortalecer a comunhão física de bairro.
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
              <table className="min-w-full divide-y divide-slate-100 text-left font-sans">
                <thead className="bg-slate-50/60 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Membro</th>
                    <th className="px-6 py-4">Setor Eclesiástico (GC)</th>
                    <th className="px-6 py-4">Setor Residencial (Moradia)</th>
                    <th className="px-6 py-4">Diagnóstico / Recomendação</th>
                    <th className="px-6 py-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-650 bg-white">
                  {mismatchedMembers.filter(m => {
                    return !searchTerm || m.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      (m.bairro || '').toLowerCase().includes(searchTerm.toLowerCase());
                  }).map((m) => {
                    const eclSec = getNormalizedSectorName(
                      m.setor_eclesiastico || cells.find(c => c.grupo_caseiro === m.grupos_caseiros)?.setor
                    );
                    const resSec = getNormalizedSectorName(
                      m.setor_residencial || cells.find(c => c.grupo_caseiro === m.grupos_caseiros)?.setor
                    );

                    const isNotified = !!notifiedMembers[m.id];

                    // Check for Entorno case
                    const isEntorno = (m.bairro || '').toLowerCase().includes('entorno') || 
                      (m.bairro || '').toLowerCase().includes('valparaiso') || 
                      (m.bairro || '').toLowerCase().includes('ocidental') || 
                      (m.bairro || '').toLowerCase().includes('ceu azul') ||
                      resSec === 'Sem Setor';

                    let diagnosis = `Reside no ${resSec} (${m.bairro || 'Sem Bairro'}), mas congrega no ${eclSec} (${m.grupos_caseiros}).`;
                    let recommendation = `Sugerir transferência para uma célula do ${resSec} para facilitar visitas e comunhão local.`;

                    if (isEntorno && eclSec === 'Setor Central') {
                      diagnosis = `Residente no Entorno Sul (${m.bairro || 'Entorno'}), mas congrega no Setor Central (${m.grupos_caseiros}).`;
                      recommendation = `Sugerir migração para o Setor Sul (onde se concentram as células do entorno sul).`;
                    }

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700">
                              {m.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                            </div>
                            <div>
                              <p className="font-extrabold text-slate-900">{m.nome}</p>
                              <p className="text-[10px] text-slate-400">Cargo: {m.tipo_de_pessoa}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                            {eclSec}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                            {resSec}
                          </span>
                        </td>
                        <td className="px-6 py-4 max-w-[320px]">
                          <p className="font-bold text-slate-800">{diagnosis}</p>
                          <p className="text-[10px] text-red-500 font-bold mt-0.5 leading-snug">{recommendation}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setNotifiedMembers(prev => ({ ...prev, [m.id]: !isNotified }))}
                            className={clsx(
                              "px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all border cursor-pointer",
                              isNotified 
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-black" 
                                : "bg-slate-900 border-slate-900 text-white hover:bg-slate-800"
                            )}
                          >
                            {isNotified ? 'Notificado! ✅' : 'Avisar Líder'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {mismatchedMembers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-400 italic bg-slate-50/50">
                        Nenhuma inconsistência territorial identificada no {selectedSectorName}! Excelente alinhamento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
