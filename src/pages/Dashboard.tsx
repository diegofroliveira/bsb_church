import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabaseReader } from '../lib/supabase';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { Users, UserPlus, Home, TrendingUp, Loader2, X, Search, Layers, UserCheck, MapPin, SlidersHorizontal } from 'lucide-react';
import clsx from 'clsx';
import { getSectorByResidence } from '../lib/geoUtils';
import { filterOperationalCells, filterOperationalMembers } from '../lib/operationalScope';

const normalizePersonType = (value: unknown): string => String(value || '')
  .trim()
  .toUpperCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[-_]+/g, ' ')
  .replace(/\s+/g, ' ');

const LOCALITY_EXCLUDED_TYPES = new Set([
  'CONTADOR',
  'EXTERNO',
  'EXTRA LOCAL',
  'FUNCIONARIO',
  'VISITANTE',
  'APOSTOLO'
]);

const isLocalMember = (member: any): boolean =>
  member.status === 'Ativo' && !LOCALITY_EXCLUDED_TYPES.has(normalizePersonType(member.tipo_de_pessoa));

const isLinkedMember = (member: any): boolean =>
  isLocalMember(member) && !['AGREGADO', 'AGREGADOS'].includes(normalizePersonType(member.tipo_de_pessoa));

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [modalType, setModalType] = useState<any>(null);
  const [modalTitle, setModalTitle] = useState('');
  const [modalItems, setModalItems] = useState<any[]>([]);

  
  const [filterGender, setFilterGender] = useState('Todos');
  const [filterGroup, setFilterGroup] = useState('Todos');
  const [filterDisc, setFilterDisc] = useState('Todos');
  const [filterSector, setFilterSector] = useState('Todos');
  const [filterSectorEcl, setFilterSectorEcl] = useState('Todos');
  const [sectorViewMode, setSectorViewMode] = useState<'residencial' | 'eclesiastico'>('residencial');
  const [filterMinAge, setFilterMinAge] = useState<number>(0);
  const [filterMaxAge, setFilterMaxAge] = useState<number>(120);
  const [filterMaritalStatus, setFilterMaritalStatus] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [isTypesOpen, setIsTypesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [selectedCellRoles, setSelectedCellRoles] = useState<string[]>([]);
  const [filterIsDiscipulador, setFilterIsDiscipulador] = useState<string>('Todos');
  const [populationMode, setPopulationMode] = useState<'todos' | 'local' | 'vinculado'>('todos');
  const [isRolesOpen, setIsRolesOpen] = useState(false);
  const rolesDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsTypesOpen(false);
      }
      if (rolesDropdownRef.current && !rolesDropdownRef.current.contains(event.target as Node)) {
        setIsRolesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [rawMembros, setRawMembros] = useState<any[]>([]);
  const [rawCelulas, setRawCelulas] = useState<any[]>([]);
  const [rawDiscipulado, setRawDiscipulado] = useState<any[]>([]);
  const [rawFuncoes, setRawFuncoes] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        let membrosQuery = supabaseReader.from('membros').select('nome, status, tipo_cadastro, nascimento, grupos_caseiros, sexo, bairro, cidade, estado, tipo_de_pessoa, data_de_cadastro, data_atualizacao, estado_civil, setor_eclesiastico, setor_residencial');
        let celulasQuery = supabaseReader.from('celulas').select('grupo_caseiro, lider, auxiliar, auxiliar_1, auxiliar_2, setor');

        if (user?.assigned_gc) {
          membrosQuery = membrosQuery.ilike('grupos_caseiros', `%${user.assigned_gc}%`);
          celulasQuery = celulasQuery.ilike('grupo_caseiro', `%${user.assigned_gc}%`);
        }

        const [membrosRes, celulasRes, discRes, funcoesRes] = await Promise.all([
          membrosQuery,
          celulasQuery,
          supabaseReader.from('discipulado').select('discipulador, discipulo, status'),
          fetch('/data/pessoas_funcoes.json').then(r => r.ok ? r.json() : []).catch(() => [])
        ]);

        setRawMembros(filterOperationalMembers(membrosRes.data || []));
        setRawCelulas(filterOperationalCells(celulasRes.data || []));
        const uniqueDiscipulado = Array.from(new Map(
          (discRes.data || [])
            .filter((d: any) => d.discipulador?.trim() && d.discipulo?.trim())
            .map((d: any) => [
              `${d.discipulador.trim().replace(/\s+/g, ' ').toUpperCase()}->${d.discipulo.trim().replace(/\s+/g, ' ').toUpperCase()}`,
              d
            ])
        ).values());
        setRawDiscipulado(uniqueDiscipulado);
        setRawFuncoes(funcoesRes);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboardData();
  }, [user]);

  const uniqueTypes = useMemo(() => {
    const types = rawMembros.map(m => m.tipo_de_pessoa?.trim()).filter(Boolean);
    return Array.from(new Set(types)).sort() as string[];
  }, [rawMembros]);



  const dashboardData = useMemo(() => {
    if (isLoading || rawMembros.length === 0) return null;

    const discSet = new Set<string>();
    const discNameMap = new Map<string, string>();
    rawDiscipulado.forEach(d => {
      if (d.discipulador) {
        const upper = d.discipulador.trim().toUpperCase();
        discSet.add(upper);
        discNameMap.set(upper, d.discipulador.trim());
      }
    });

    const liderSet = new Set<string>();
    const auxiliarSet = new Set<string>();
    rawCelulas.forEach(c => {
      if (c.lider) {
        c.lider.split(',').forEach((l: string) => {
          const cleaned = l.trim().toUpperCase();
          if (cleaned) liderSet.add(cleaned);
        });
      }
      const auxiliares = [c.auxiliar, c.auxiliar_1, c.auxiliar_2].filter(Boolean).join(',');
      if (auxiliares) {
        auxiliares.split(',').forEach((aux: string) => {
          const cleaned = aux.trim().toUpperCase();
          if (cleaned) auxiliarSet.add(cleaned);
        });
      }
    });
    const discipuladoMap = new Map();
    rawDiscipulado.forEach(d => {
      const disc = d.discipulo?.trim().toUpperCase();
      if (!discipuladoMap.has(disc)) discipuladoMap.set(disc, []);
      discipuladoMap.get(disc).push(d.discipulador);
    });

    const getNormalizedSectorName = (dbSector: string | null | undefined): string => {
      if (!dbSector) return 'Sem Setor';
      const norm = dbSector.trim().toUpperCase();
      if (norm.includes('NORTE')) return 'Setor Norte';
      if (norm.includes('CENTRAL')) return 'Setor Central';
      if (norm.includes('AGUAS CLARAS') || norm.includes('ÁGUAS CLARAS')) return 'Setor Águas Claras';
      if (norm.includes('SUL')) return 'Setor Sul';
      return 'Sem Setor';
    };

    const getMemberSector = (m: any): string => {
      // Use pre-calculated resident sector from Supabase if available
      if (m.setor_residencial) {
        return getNormalizedSectorName(m.setor_residencial);
      }

      // Leader/Auxiliar Sector Override fallback
      const matchingCell = rawCelulas.find(c => {
        const leaders = (c.lider || '').split(',').map((l: string) => l.trim().toUpperCase());
        const auxiliaries = [c.auxiliar, c.auxiliar_1, c.auxiliar_2].filter(Boolean).join(',').split(',').map((a: string) => a.trim().toUpperCase());
        const mName = m.nome?.trim().toUpperCase();
        return leaders.includes(mName) || auxiliaries.includes(mName);
      });
      if (matchingCell) {
        return getNormalizedSectorName(matchingCell.setor);
      }
      return getSectorByResidence(m.bairro, m.cidade, m.estado);
    };

    const now = new Date();
    const parseSafeDate = (dateVal: any) => {
        if (!dateVal) return null;
        try {
            if (dateVal instanceof Date) return dateVal;
            const s = String(dateVal);
            if (s.includes('/')) {
                const parts = s.split('/');
                if (parts.length === 3) {
                    const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                    return isNaN(d.getTime()) ? null : d;
                }
            }
            const d = new Date(s);
            return isNaN(d.getTime()) ? null : d;
        } catch (e) {
            return null;
        }
    };

    const getAge = (birth: any) => {
        const b = parseSafeDate(birth);
        if (!b) return 35;
        let age = now.getFullYear() - b.getFullYear();
        if (isNaN(age)) return 35;
        return age;
    };

    const getDetailedCategory = (m: any) => {
        const age = getAge(m.nascimento);
        if (age <= 3) return 'Bebês';
        if (age <= 12) return 'Crianças';
        if (age >= 60) return 'Idosos';
        const estCivil = (m.estado_civil || '').trim().toLowerCase();
        if (estCivil.includes('solteir')) return 'Solteiros';
        if (estCivil.includes('casad')) return 'Casados';
        if (estCivil.includes('viuv')) return 'Viúvos';
        return 'Outros';
    };

    const filteredMembros = rawMembros.filter(m => {
        const matchGender = filterGender === 'Todos' || m.sexo === filterGender;
        const matchGroup = filterGroup === 'Todos' || m.grupos_caseiros === filterGroup;
        const matchDisc = filterDisc === 'Todos' || (discipuladoMap.get(m.nome?.trim().toUpperCase()) || []).includes(filterDisc);
        const age = getAge(m.nascimento);
        const matchAge = (age >= filterMinAge && age <= filterMaxAge);
        const matchMarital = filterMaritalStatus === 'Todos' || m.estado_civil === filterMaritalStatus;
        const matchStatus = filterStatus === 'Todos' || m.status === filterStatus;
        const matchType = selectedTypes.length === 0 || selectedTypes.includes(m.tipo_de_pessoa?.trim() || '');
        const residentSector = getMemberSector(m);
        const matchSector = filterSector === 'Todos' || residentSector === filterSector;
        
        const rawEcl = m.setor_eclesiastico || (m.grupos_caseiros ? (rawCelulas.find(c => c.grupo_caseiro === m.grupos_caseiros)?.setor || '') : '');
        const eclSector = getNormalizedSectorName(rawEcl);
        const matchSectorEcl = filterSectorEcl === 'Todos' || eclSector === filterSectorEcl;

        const nameUpper = m.nome?.trim().toUpperCase();
        const t = (m.tipo_de_pessoa || '').trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const mIsLider = liderSet.has(nameUpper);
        const mIsAuxiliar = auxiliarSet.has(nameUpper) && !mIsLider;
        const mIsDiscipulador = discSet.has(nameUpper);

        const matchCellRole = selectedCellRoles.length === 0 || selectedCellRoles.some(role => {
          if (role === 'Líder') return mIsLider;
          if (role === 'Auxiliar de Liderança') return mIsAuxiliar;
          if (role === 'Membro Comum') return !mIsLider && !mIsAuxiliar;
          return false;
        });

        const matchIsDiscipulador = filterIsDiscipulador === 'Todos' || (
          filterIsDiscipulador === 'Sim' ? mIsDiscipulador : !mIsDiscipulador
        );
        const matchPopulation = populationMode === 'todos' ||
          (populationMode === 'local' ? isLocalMember(m) : isLinkedMember(m));
        
        return matchGender && matchGroup && matchDisc && matchAge && matchMarital && matchStatus && matchType && matchSector && matchSectorEcl && matchCellRole && matchIsDiscipulador && matchPopulation;
    });

    const ativosOnly = filteredMembros.filter(m => m.status === 'Ativo');
    const totalMembros = filteredMembros.length;
    const ativos = filteredMembros.filter(m => m.status === 'Ativo').length;
    const visitantes = filteredMembros.filter(m =>
      normalizePersonType(m.tipo_cadastro) === 'VISITANTE' ||
      normalizePersonType(m.tipo_de_pessoa) === 'VISITANTE'
    ).length;
    const filteredNames = new Set(filteredMembros.map(m => m.nome?.trim().toUpperCase()).filter(Boolean));
    const totalDiscipuladores = Array.from(discSet).filter(name => filteredNames.has(name)).length;
    const totalLideres = Array.from(liderSet).filter(name => filteredNames.has(name)).length;
    
    const membrosLocalidade = filteredMembros.filter(isLocalMember).length;
    const membrosLocalidadeVinculados = filteredMembros.filter(isLinkedMember).length;

    const growthData: any[] = [];
    const monthsNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mMonth = d.getMonth();
        const mYear = d.getFullYear();
        const label = `${monthsNames[mMonth]}/${mYear.toString().slice(-2)}`;
        const entries = filteredMembros.filter(m => {
            const md = parseSafeDate(m.data_de_cadastro);
            return md && md.getMonth() === mMonth && md.getFullYear() === mYear;
        }).length;
        const exits = filteredMembros.filter(m => {
            const md = parseSafeDate(m.data_atualizacao);
            return m.status === 'Inativo' && md && md.getMonth() === mMonth && md.getFullYear() === mYear;
        }).length;
        growthData.push({ name: label, entradas: entries, saidas: exits });
    }

    const demoCounts: Record<string, number> = {};
    ativosOnly.forEach(m => {
      const cat = getDetailedCategory(m);
      demoCounts[cat] = (demoCounts[cat] || 0) + 1;
    });

    const demoColors: Record<string, string> = {
        'Bebês': '#60a5fa', 'Crianças': '#3b82f6', 'Solteiros': '#10b981', 
        'Casados': '#f59e0b', 'Divorciados': '#ef4444', 'Viúvos': '#6366f1', 
        'Separados': '#8b5cf6', 'Idosos': '#a855f7', 'Outros': '#9ca3af'
    };

    const pyramidRanges = ['0-10', '11-20', '21-30', '31-40', '41-50', '51-60', '61-70', '71+'];
    const pyramidMap: Record<string, { name: string, masc: number, fem: number }> = {};
    pyramidRanges.forEach(r => pyramidMap[r] = { name: r, masc: 0, fem: 0 });
    ativosOnly.forEach(m => {
        const age = getAge(m.nascimento);
        let range = '71+';
        if (age <= 10) range = '0-10';
        else if (age <= 20) range = '11-20';
        else if (age <= 30) range = '21-30';
        else if (age <= 40) range = '31-40';
        else if (age <= 50) range = '41-50';
        else if (age <= 60) range = '51-60';
        else if (age <= 70) range = '61-70';
        const isMasc = m.sexo === 'Masculino' || m.sexo === 'M';
        if (isMasc) pyramidMap[range].masc++; else pyramidMap[range].fem++;
    });

    const grupoCounts: any = {};
    const grupoLinkedCounts: any = {};
    filteredMembros.forEach(m => {
      if (!m.grupos_caseiros) return;
      grupoCounts[m.grupos_caseiros] = (grupoCounts[m.grupos_caseiros] || 0) + 1;
      if (isLinkedMember(m)) grupoLinkedCounts[m.grupos_caseiros] = (grupoLinkedCounts[m.grupos_caseiros] || 0) + 1;
    });
    const visibleGroupNames = new Set(Object.keys(grupoCounts));
    const totalCelulas = rawCelulas.filter(c => visibleGroupNames.has(c.grupo_caseiro)).length;
    const groupsList = rawCelulas.map(c => ({
      nome: c.grupo_caseiro, lider: c.lider || 'Sem Lider', setor: c.setor || 'Sem Setor', membros: grupoCounts[c.grupo_caseiro] || 0, vinculados: grupoLinkedCounts[c.grupo_caseiro] || 0
    })).filter(group => group.membros > 0).sort((a, b) => b.membros - a.membros);

    const sectorCounts: Record<string, { nome: string, grupos: number, membros: number, vinculados: number }> = {
      'Setor Norte': { nome: 'Setor Norte', grupos: 0, membros: 0, vinculados: 0 },
      'Setor Central': { nome: 'Setor Central', grupos: 0, membros: 0, vinculados: 0 },
      'Setor Águas Claras': { nome: 'Setor Águas Claras', grupos: 0, membros: 0, vinculados: 0 },
      'Setor Sul': { nome: 'Setor Sul', grupos: 0, membros: 0, vinculados: 0 },
      'Sem Setor': { nome: 'Sem Setor', grupos: 0, membros: 0, vinculados: 0 }
    };

    filteredMembros.forEach(m => {
      const sec = sectorViewMode === 'eclesiastico'
        ? (m.setor_eclesiastico ? getNormalizedSectorName(m.setor_eclesiastico) : (m.grupos_caseiros ? getNormalizedSectorName(rawCelulas.find(c => c.grupo_caseiro === m.grupos_caseiros)?.setor) : 'Sem Setor'))
        : getMemberSector(m);
      if (sectorCounts[sec]) {
        sectorCounts[sec].membros += 1;
        if (isLinkedMember(m)) sectorCounts[sec].vinculados += 1;
      }
    });

    rawCelulas.forEach(c => {
      const sec = getNormalizedSectorName(c.setor);
      if (sectorCounts[sec] && visibleGroupNames.has(c.grupo_caseiro)) {
        sectorCounts[sec].grupos += 1;
      }
    });

    const mestreCounts: any = {};
    discNameMap.forEach((originalName, upperName) => {
      mestreCounts[originalName] = 0;
    });

    rawDiscipulado.forEach(d => {
      if (d.discipulador) {
        const upper = d.discipulador.trim().toUpperCase();
        if (discSet.has(upper) && filteredNames.has(upper)) {
          const original = discNameMap.get(upper) || d.discipulador.trim();
          mestreCounts[original] = (mestreCounts[original] || 0) + 1;
        }
      }
    });

    const discList = Object.keys(mestreCounts)
      .map(k => ({ nome: k, discipulos: mestreCounts[k] }))
      .sort((a, b) => b.discipulos - a.discipulos);

    return {
        stats: { totalMembros, ativos, visitantes, totalCelulas, totalDiscipuladores, totalLideres, membrosLocalidade, membrosLocalidadeVinculados },
        charts: {
            growth: growthData,
            demographics: Object.entries(demoCounts).map(([name, value]) => ({ 
                name, value, percent: ((value / (ativos || 1)) * 100).toFixed(1), fill: demoColors[name] || '#9ca3af' 
            })).sort((a, b) => b.value - a.value),
            pyramid: Object.values(pyramidMap),
            groups: groupsList,
            sectors: Object.values(sectorCounts).sort((a: any, b: any) => b.membros - a.membros),
            discipuladores: discList
        }
    };
  }, [isLoading, rawMembros, rawCelulas, rawDiscipulado, rawFuncoes, filterGender, filterGroup, filterDisc, filterSector, filterSectorEcl, sectorViewMode, filterMinAge, filterMaxAge, filterMaritalStatus, filterStatus, selectedTypes, selectedCellRoles, filterIsDiscipulador, populationMode]);

  const handleOpenModal = async (type: 'grupo' | 'setor' | 'discipulador', title: string) => {
    setModalType(type); setModalTitle(title); setIsModalLoading(true);
    try {
      let dataResp: any[] = [];
      const localDiscSet = new Set<string>();
      if (rawFuncoes && rawFuncoes.length > 0) {
        rawFuncoes.forEach(f => {
          const func = (f.funcao || '').toUpperCase();
          if (func.includes('DISCIPULADOR') && f.pessoa) {
            localDiscSet.add(f.pessoa.trim().toUpperCase());
          }
        });
      } else {
        rawDiscipulado.forEach(d => {
          if (d.discipulador) localDiscSet.add(d.discipulador.trim().toUpperCase());
        });
      }
      if (type === 'grupo') {
        const { data } = await supabaseReader.from('membros').select('nome, sexo, nascimento, tipo_cadastro').eq('grupos_caseiros', title);
        const cell = rawCelulas.find(c => c.grupo_caseiro === title);
        dataResp = (data || []).map(d => {
          const age = d.nascimento ? new Date().getFullYear() - new Date(d.nascimento).getFullYear() : '-';
          let role = 'Participante';
          const nameUpper = d.nome?.trim().toUpperCase();
          const leaders = (cell?.lider || '').split(',').map((l: string) => l.trim().toUpperCase());
          const auxiliaries = [cell?.auxiliar, cell?.auxiliar_1, cell?.auxiliar_2].filter(Boolean).join(',').split(',').map((a: string) => a.trim().toUpperCase());
          if (leaders.includes(nameUpper)) role = 'Líder';
          else if (auxiliaries.includes(nameUpper)) role = 'Auxiliar';
          return { col1: d.nome, col2: d.sexo || '-', col3: age, col4: role, col5: localDiscSet.has(d.nome?.trim().toUpperCase()) ? 'Sim' : 'Não' };
        });
      } else if (type === 'setor') {
        const getNormalizedSectorName = (dbSector: string | null | undefined): string => {
          if (!dbSector) return 'Sem Setor';
          const norm = dbSector.trim().toUpperCase();
          if (norm.includes('NORTE')) return 'Setor Norte';
          if (norm.includes('CENTRAL')) return 'Setor Central';
          if (norm.includes('AGUAS CLARAS') || norm.includes('ÁGUAS CLARAS')) return 'Setor Águas Claras';
          if (norm.includes('SUL')) return 'Setor Sul';
          return 'Sem Setor';
        };
        const sectorCells = rawCelulas.filter(c => getNormalizedSectorName(c.setor) === title);
        dataResp = sectorCells.map(d => ({ col1: d.grupo_caseiro, col2: d.lider || 'Sem Líder', col3: 'Grupo Caseiro', col4: 'Detalhar', isAction: true }));
      } else if (type === 'discipulador') {
        const { data } = await supabaseReader.from('discipulado').select('discipulo, discipulador, status, tipo').eq('discipulador', title);
        const uniqueDiscipulos = Array.from(new Map(
          (data || []).filter(d => d.discipulo).map(d => [d.discipulo.trim().replace(/\s+/g, ' ').toUpperCase(), d])
        ).values());
        dataResp = uniqueDiscipulos.map(d => ({ col1: d.discipulo, col2: d.status || 'Ativo', col3: d.tipo || '-', col4: '-', col5: '-' }));
      }
      setModalItems(dataResp);
    } catch (e) { console.error(e); } finally { setIsModalLoading(false); }
  };

  const isPastorOrAdmin = ['pastor', 'admin', 'secretaria'].includes(user?.role || '');

  if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="mb-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1445] via-[#1a237e] to-[#283593] p-6 text-white shadow-xl">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/20 rounded-full translate-x-1/3 -translate-y-1/3 blur-2xl" />
            <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-indigo-300/10 rounded-full blur-2xl" />
          </div>
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest mb-1">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <h1 className="text-2xl font-black tracking-tight">
                Olá, <span className="text-blue-200">{user?.name?.split(' ')[0]}</span> 👋
              </h1>
              <p className="text-blue-300 text-sm mt-1">
                Aqui está a visão geral da Igreja BSB — dados atualizados em tempo real.
              </p>
            </div>
            <div className="flex gap-4 shrink-0">
              {[
                { label: 'Sua Função', value: user?.role || '—' },
              ].map(s => (
                <div key={s.label} className="bg-white/10 rounded-xl px-4 py-2 border border-white/10 text-center">
                  <p className="text-white font-bold capitalize text-sm">{s.value}</p>
                  <p className="text-blue-300 text-[10px] font-semibold uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 space-y-4">
        {/* Basic Filters (Always Visible) */}
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2 text-gray-400 mr-2">
              <Search className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Filtros:</span>
            </div>
            
            {/* Primary Filter 1: Resident Sector */}
            <select 
              value={filterSector} 
              onChange={e => setFilterSector(e.target.value)} 
              className="text-sm border-gray-200 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-gray-50/50"
            >
              <option value="Todos">Setor de Residência (Todos)</option>
              <option value="Setor Norte">Setor Norte</option>
              <option value="Setor Central">Setor Central</option>
              <option value="Setor Águas Claras">Setor Águas Claras</option>
              <option value="Setor Sul">Setor Sul</option>
              <option value="Sem Setor">Sem Setor</option>
            </select>

            {/* Primary Filter 2: Member Status */}
            <select 
              value={filterStatus} 
              onChange={e => setFilterStatus(e.target.value)} 
              className="text-sm border-gray-200 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-gray-50/50"
            >
              <option value="Todos">Todos os Status</option>
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            {/* Toggle Button for Advanced Filters */}
            <button
              type="button"
              onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
              className={clsx(
                "flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-xl border transition-all cursor-pointer",
                isAdvancedFiltersOpen 
                  ? "bg-primary-50 border-primary-200 text-primary-700 shadow-sm"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filtros Avançados
              {(filterSectorEcl !== 'Todos' || filterGender !== 'Todos' || filterGroup !== 'Todos' || filterDisc !== 'Todos' || filterMaritalStatus !== 'Todos' || selectedTypes.length > 0 || selectedCellRoles.length > 0 || filterIsDiscipulador !== 'Todos' || filterMinAge !== 0 || filterMaxAge !== 120 || populationMode !== 'todos') && (
                <span className="ml-1 px-1.5 py-0.2 bg-primary-600 text-white rounded-full text-[9px] font-black animate-pulse">
                  !
                </span>
              )}
            </button>

            {/* Clear All Filters Button */}
            {(filterGender !== 'Todos' || filterGroup !== 'Todos' || filterDisc !== 'Todos' || filterSector !== 'Todos' || filterSectorEcl !== 'Todos' || filterMinAge !== 0 || filterMaxAge !== 120 || filterMaritalStatus !== 'Todos' || filterStatus !== 'Todos' || selectedTypes.length > 0 || selectedCellRoles.length > 0 || filterIsDiscipulador !== 'Todos') && (
              <button 
                onClick={() => { 
                  setFilterGender('Todos'); 
                  setFilterGroup('Todos'); 
                  setFilterDisc('Todos'); 
                  setFilterSector('Todos');
                  setFilterSectorEcl('Todos');
                  setFilterMinAge(0); 
                  setFilterMaxAge(120); 
                  setFilterMaritalStatus('Todos'); 
                  setFilterStatus('Todos'); 
                  setSelectedTypes([]); 
                  setSelectedCellRoles([]);
                  setFilterIsDiscipulador('Todos');
                  setPopulationMode('todos');
                }} 
                className="text-xs text-red-600 font-bold hover:underline cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filters (Collapsible Section) */}
        {isAdvancedFiltersOpen && (
          <div className="pt-4 border-t border-gray-50 flex flex-wrap gap-4 items-center animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">População:</span>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={populationMode === 'local'}
                  onChange={() => setPopulationMode(populationMode === 'local' ? 'todos' : 'local')}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Somente local
              </label>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={populationMode === 'vinculado'}
                  onChange={() => setPopulationMode(populationMode === 'vinculado' ? 'todos' : 'vinculado')}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Somente vinculado
              </label>
            </div>
            {/* Sector of GC */}
            <select value={filterSectorEcl} onChange={e => setFilterSectorEcl(e.target.value)} className="text-sm border-gray-200 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-gray-50/50">
              <option value="Todos">Setor do GC (Todos)</option>
              <option value="Setor Norte">Setor Norte</option>
              <option value="Setor Central">Setor Central</option>
              <option value="Setor Águas Claras">Setor Águas Claras</option>
              <option value="Setor Sul">Setor Sul</option>
              <option value="Sem Setor">Sem Setor</option>
            </select>

            {/* Gender */}
            <select value={filterGender} onChange={e => setFilterGender(e.target.value)} className="text-sm border-gray-200 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-gray-50/50">
              <option value="Todos">Todos os Sexos</option>
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
            </select>

            {/* GC Group */}
            <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} className="text-sm border-gray-200 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-gray-50/50 max-w-[200px]">
              <option value="Todos">Todos os GCs</option>
              {rawCelulas.map(c => <option key={c.grupo_caseiro} value={c.grupo_caseiro}>{c.grupo_caseiro}</option>)}
            </select>

            {/* Discipler */}
            <select value={filterDisc} onChange={e => setFilterDisc(e.target.value)} className="text-sm border-gray-200 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-gray-50/50 max-w-[200px]">
              <option value="Todos">Todos os Discipuladores</option>
              {Array.from(new Set(rawDiscipulado.map(d => d.discipulador))).sort().map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            {/* Marital Status */}
            <select value={filterMaritalStatus} onChange={e => setFilterMaritalStatus(e.target.value)} className="text-sm border-gray-200 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-gray-50/50 max-w-[150px]">
              <option value="Todos">Estado Civil</option>
              {Array.from(new Set(rawMembros.map(m => m.estado_civil).filter(Boolean))).sort().map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            
            {/* Checkbox Multiselect Dropdown for Types */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsTypesOpen(!isTypesOpen)}
                className="flex items-center justify-between gap-2 text-sm border border-gray-200 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-gray-50/50 px-3 py-2 text-gray-700 hover:bg-gray-150 transition-colors cursor-pointer"
              >
                <span>{selectedTypes.length === 0 ? 'Todos os Tipos' : `${selectedTypes.length} Tipo(s)`}</span>
                <span className="text-xs text-gray-400">▼</span>
              </button>

              {isTypesOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Tipos de Pessoa</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedTypes([])}
                        className="text-[10px] text-red-500 hover:underline font-bold"
                      >
                        Limpar
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTypes(uniqueTypes)}
                        className="text-[10px] text-primary-600 hover:underline font-bold"
                      >
                        Todos
                      </button>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 py-1 pr-1 scrollbar-thin">
                    {uniqueTypes.length === 0 ? (
                      <span className="text-xs text-gray-400 block text-center">Nenhum tipo disponível</span>
                    ) : (
                      uniqueTypes.map(type => (
                        <label key={type} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={selectedTypes.includes(type)}
                            onChange={() => {
                              setSelectedTypes(prev =>
                                prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
                              );
                            }}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-3.5 h-3.5"
                          />
                          <span className="font-medium truncate">{type}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Checkbox Multiselect Dropdown for GC Roles */}
            <div className="relative" ref={rolesDropdownRef}>
              <button
                type="button"
                onClick={() => setIsRolesOpen(!isRolesOpen)}
                className="flex items-center justify-between gap-2 text-sm border border-gray-200 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-gray-50/50 px-3 py-2 text-gray-700 hover:bg-gray-150 transition-colors cursor-pointer"
              >
                <span>{selectedCellRoles.length === 0 ? 'Todos os Cargos no GC' : `${selectedCellRoles.length} Cargo(s) no GC`}</span>
                <span className="text-xs text-gray-400">▼</span>
              </button>

              {isRolesOpen && (
                <div className="absolute left-0 mt-2 w-64 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Cargos no GC</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedCellRoles([])}
                        className="text-[10px] text-red-500 hover:underline font-bold"
                      >
                        Limpar
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCellRoles(['Líder', 'Auxiliar de Liderança', 'Membro Comum'])}
                        className="text-[10px] text-primary-600 hover:underline font-bold"
                      >
                        Todos
                      </button>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 py-1 pr-1 scrollbar-thin">
                    {['Líder', 'Auxiliar de Liderança', 'Membro Comum'].map(role => (
                      <label key={role} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={selectedCellRoles.includes(role)}
                          onChange={() => {
                            setSelectedCellRoles(prev =>
                              prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
                            );
                          }}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-3.5 h-3.5"
                        />
                        <span className="font-medium truncate">{role}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Discipulador Boolean Filter */}
            <select
              value={filterIsDiscipulador}
              onChange={e => setFilterIsDiscipulador(e.target.value)}
              className="text-sm border-gray-200 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-gray-50/50"
            >
              <option value="Todos">É Discipulador (Todos)</option>
              <option value="Sim">Sim (Apenas Discipulador)</option>
              <option value="Não">Não (Não Discipulador)</option>
            </select>

            {/* Age Range */}
            <div className="flex items-center gap-2 bg-gray-50/50 border border-gray-200 rounded-lg px-3 py-1">
               <span className="text-[10px] font-bold text-gray-400 uppercase">Idade:</span>
               <input type="number" value={filterMinAge} onChange={e => setFilterMinAge(parseInt(e.target.value) || 0)} className="w-12 bg-transparent text-sm font-semibold outline-none border-b border-transparent focus:border-primary-500" placeholder="Min" />
               <span className="text-gray-300">/</span>
               <input type="number" value={filterMaxAge} onChange={e => setFilterMaxAge(parseInt(e.target.value) || 120)} className="w-12 bg-transparent text-sm font-semibold outline-none border-b border-transparent focus:border-primary-500" placeholder="Max" />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {[
          { label: 'Total de Cadastros', value: dashboardData?.stats.totalMembros, icon: Users, color: 'text-slate-700', bg: 'bg-slate-100/70' },
          { label: 'Membros Ativos Globais', value: dashboardData?.stats.ativos, sub: 'Status: Ativo', icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Membros Localidade', value: dashboardData?.stats.membrosLocalidade, icon: MapPin, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Membros Localidade Vinculados', value: dashboardData?.stats.membrosLocalidadeVinculados, icon: MapPin, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Visitantes', value: dashboardData?.stats.visitantes, icon: UserPlus, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Grupos Caseiros', value: dashboardData?.stats.totalCelulas, icon: Home, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Discipuladores', value: dashboardData?.stats.totalDiscipuladores, icon: UserCheck, color: 'text-teal-600', bg: 'bg-teal-50' },
          { label: 'Líderes', value: dashboardData?.stats.totalLideres, icon: Users, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map((kpi, idx) => {
          const Icon = kpi.icon || Users;
          return (
            <div key={idx} className="relative min-w-0 overflow-hidden rounded-2xl bg-white/70 backdrop-blur-md p-3.5 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-110", kpi.bg)}><Icon className={clsx("h-4 w-4", kpi.color)} /></div>
                <div className="min-w-0"><p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide leading-tight">{kpi.label}</p><div className="flex items-baseline gap-2 mt-0.5"><p className="text-xl font-bold text-gray-900">{kpi.value}</p></div>{kpi.sub && <p className="text-[9px] text-gray-400 mt-0.5 truncate">{kpi.sub}</p>}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col"><div className="pb-4 mb-4 border-b border-gray-100 flex justify-between items-center"><h3 className="text-lg font-semibold leading-6 text-gray-900">Evolução da Base</h3></div><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={dashboardData?.charts.growth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><defs><linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient><linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} /><Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} /><Legend verticalAlign="top" height={36} iconType="circle" /><Area type="monotone" dataKey="entradas" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorEntradas)" name="Entradas" /><Area type="monotone" dataKey="saidas" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorSaidas)" name="Saídas" /></AreaChart></ResponsiveContainer></div></div>
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col"><div className="pb-4 mb-4 border-b border-gray-100"><h3 className="text-lg font-semibold leading-6 text-gray-900">Demografia (Perfil)</h3></div><div className="flex-1 flex flex-col justify-center items-center relative"><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={dashboardData?.charts.demographics} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">{dashboardData?.charts.demographics.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={entry.fill} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-12"><span className="text-2xl font-bold text-gray-900">{dashboardData?.stats.ativos}</span></div><div className="grid grid-cols-2 gap-2 w-full mt-4">{dashboardData?.charts.demographics.map((item: any, i: number) => (<div key={i} className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }}></div><span className="text-[10px] font-medium text-gray-600 truncate">{item.name} ({item.percent}%)</span></div>))}</div></div></div>
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col"><div className="pb-4 mb-4 border-b border-gray-100"><h3 className="text-lg font-semibold leading-6 text-gray-900">Pirâmide Etária por Sexo</h3></div><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={dashboardData?.charts.pyramid} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} /><XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} /><YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} /><Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius:'12px', border:'none'}} /><Legend /><Bar dataKey="masc" fill="#3b82f6" name="Masc" radius={[0, 4, 4, 0]} /><Bar dataKey="fem" fill="#ec4899" name="Fem" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></div>
      </div>

      {isPastorOrAdmin && (
        <div className="grid grid-cols-1 gap-6 mt-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col">
            <div className="pb-4 border-b border-gray-100"><h3 className="text-lg font-semibold leading-6 text-gray-900 flex items-center gap-2"><Home className="h-5 w-5 text-primary-500" /> Grupos Caseiros Ativos</h3><p className="mt-1 text-sm text-gray-500">Membros totais e membros vinculados por grupo</p></div>
            <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 mt-4"><thead className="bg-gray-50/50"><tr><th className="py-3 pl-4 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grupo Caseiro</th><th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Líder</th><th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Membros</th><th className="px-3 py-3 text-center text-xs font-medium text-emerald-600 uppercase tracking-wider">Vinculados</th><th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th></tr></thead><tbody className="divide-y divide-gray-100 bg-white">{dashboardData?.charts.groups.slice(0, 10).map((group: any, idx: number) => (<tr key={idx} className="hover:bg-gray-50/50 transition-colors"><td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-medium text-gray-900">{group.nome}</td><td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500">{group.lider}</td><td className="whitespace-nowrap px-3 py-3 text-sm text-center font-bold text-gray-700"><span className="bg-primary-50 text-primary-700 py-1 px-3 rounded-full">{group.membros}</span></td><td className="whitespace-nowrap px-3 py-3 text-sm text-center font-bold text-emerald-700"><span className="bg-emerald-50 py-1 px-3 rounded-full">{group.vinculados}</span></td><td className="whitespace-nowrap px-3 py-3 text-sm text-right"><button onClick={() => handleOpenModal('grupo', group.nome)} className="text-primary-600 font-medium hover:underline text-xs outline-none">Ver Detalhes</button></td></tr>))}</tbody></table></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col">
              <div className="pb-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold leading-6 text-gray-900 flex items-center gap-2">
                    <Layers className="h-5 w-5 text-indigo-500" /> Setores
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {sectorViewMode === 'eclesiastico' ? 'Membros agrupados por Setor do GC' : 'Membros agrupados por Setor de Residência'}
                  </p>
                </div>
                <div className="flex bg-gray-100 p-0.5 rounded-lg shrink-0">
                  <button 
                    type="button"
                    onClick={() => setSectorViewMode('residencial')}
                    className={clsx("px-2.5 py-1 text-xs font-bold rounded-md transition-colors", sectorViewMode === 'residencial' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}
                  >
                    Residência
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSectorViewMode('eclesiastico')}
                    className={clsx("px-2.5 py-1 text-xs font-bold rounded-md transition-colors", sectorViewMode === 'eclesiastico' ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}
                  >
                    Célula (GC)
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 mt-4">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="py-3 pl-4 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Setor</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">GCs</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Membros</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-emerald-600 uppercase tracking-wider">Vinculados</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {dashboardData?.charts.sectors.map((setor: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-medium text-gray-900">{setor.nome}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-center">
                          <span className="bg-gray-100 text-gray-600 py-1 px-2 rounded-md font-bold">{setor.grupos}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-center">
                          <span className="bg-indigo-50 text-indigo-600 py-1 px-2 rounded-md font-bold">{setor.membros}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-center">
                          <span className="bg-emerald-50 text-emerald-700 py-1 px-2 rounded-md font-bold">{setor.vinculados}</span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-sm text-right">
                          <button onClick={() => handleOpenModal('setor', setor.nome)} className="text-indigo-600 font-medium hover:underline text-xs">Acessar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col"><div className="pb-4 border-b border-gray-100"><h3 className="text-lg font-semibold leading-6 text-gray-900 flex items-center gap-2"><UserCheck className="h-5 w-5 text-emerald-500" /> Discipuladores Cadastrados</h3><p className="mt-1 text-sm text-gray-500">Rede de Discipulado Ativa</p></div><div className="overflow-x-auto max-h-[300px]"><table className="min-w-full divide-y divide-gray-200 mt-4"><thead className="bg-gray-50/50 sticky top-0"><tr><th className="py-3 pl-4 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discipulador</th><th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Discípulos</th><th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th></tr></thead><tbody className="divide-y divide-gray-100 bg-white">{dashboardData?.charts.discipuladores.slice(0, 15).map((disc: any, idx: number) => (<tr key={idx} className="hover:bg-gray-50/50"><td className="whitespace-nowrap py-3 pl-4 pr-3 text-sm font-medium text-gray-900">{disc.nome}</td><td className="whitespace-nowrap px-3 py-3 text-sm text-center"><span className="bg-emerald-50 text-emerald-600 py-1 px-2 rounded-md font-bold">{disc.discipulos}</span></td><td className="whitespace-nowrap px-3 py-3 text-sm text-right"><button onClick={() => handleOpenModal('discipulador', disc.nome)} className="text-emerald-600 font-medium hover:underline text-xs">Exibir Vidas</button></td></tr>))}</tbody></table></div></div>
          </div>
        </div>
      )}

      {modalType && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setModalType(null)} />
          <div className="relative flex w-full max-w-2xl flex-col bg-white rounded-2xl shadow-2xl overflow-hidden m-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50"><div><h3 className="text-lg font-semibold text-gray-900">{modalTitle}</h3><p className="text-xs text-gray-500 mt-1">{modalItems.length} registros listados</p></div><button onClick={() => setModalType(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
            <div className="p-0 overflow-y-auto max-h-[60vh]">
              {isModalLoading ? (<div className="flex flex-col items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>) : modalItems.length === 0 ? (<div className="flex flex-col items-center justify-center p-12 text-center"><Search className="h-10 w-10 text-gray-300 mb-3" /><p className="text-gray-500 text-sm">Nenhum registro encontrado para {modalTitle}.</p></div>) : (
                <table className="min-w-full divide-y divide-gray-100"><thead className="bg-white sticky top-0"><tr><th className="py-3 pl-6 pr-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{modalType === 'setor' ? 'Grupo Caseiro' : 'Nome'}</th><th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{modalType === 'grupo' ? 'Sexo' : modalType === 'setor' ? 'Líder' : 'Status'}</th><th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">{modalType === 'grupo' ? 'Idade' : 'Info'}</th>{modalType === 'grupo' && (<><th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Função</th><th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Disc.</th></>)}{modalType === 'setor' && <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Ação</th>}</tr></thead><tbody className="divide-y divide-gray-50">{modalItems.map((m, idx) => (<tr key={idx} className="hover:bg-gray-50/50"><td className="whitespace-nowrap py-3 pl-6 pr-3 text-sm font-medium text-gray-900">{m.col1}</td><td className="whitespace-nowrap px-3 py-3 text-sm text-gray-600">{m.col2}</td><td className="whitespace-nowrap px-3 py-3 text-sm text-gray-500 font-mono text-xs">{m.col3}</td>{modalType === 'grupo' && (<><td className="whitespace-nowrap px-3 py-3 text-sm text-gray-600"><span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold uppercase", m.col4 === 'Líder' ? 'bg-primary-50 text-primary-700' : m.col4 === 'Auxiliar' ? 'bg-orange-50 text-orange-700' : 'bg-gray-50 text-gray-500')}>{m.col4}</span></td><td className="whitespace-nowrap px-3 py-3 text-sm text-gray-600"><span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold uppercase", m.col5 === 'Sim' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-500')}>{m.col5}</span></td></>)}{modalType === 'setor' && (<td className="whitespace-nowrap px-3 py-3 text-sm text-right"><button onClick={() => handleOpenModal('grupo', m.col1)} className="text-primary-600 hover:underline text-xs font-bold uppercase tracking-tighter">Detalhar</button></td>)}</tr>))}</tbody></table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
