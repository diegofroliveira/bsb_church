import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useFamilyEngine } from '../hooks/useFamilyEngine';
import type { Member, Cell, Family, FamilyRelation } from '../hooks/useFamilyEngine';
import { 
  getAdministrativeRegion, 
  getGCRegion,
  getSectorByResidence
} from '../lib/geoUtils';
import { 
  Heart, Search, Users, MapPin, AlertCircle, Phone, 
  TrendingUp, Map as MapIcon, Filter, CheckCircle2, AlertTriangle, 
  ChevronRight, Calendar, User, Eye, Sparkles
} from 'lucide-react';
import clsx from 'clsx';

export const Families: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [cells, setCells] = useState<Cell[]>([]);
  const [relations, setRelations] = useState<FamilyRelation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSector, setFilterSector] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [activeTab, setActiveTab] = useState<'nucleos' | 'parentelas'>('nucleos');

  // Load active members, cells and family relations
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [membrosRes, celulasRes, relationsRes] = await Promise.all([
          supabase.from('membros')
            .select('id, nome, grupos_caseiros, status, sexo, bairro, pai, mae, logradouro, celular_principal_sms, telefone_fixo, estado_civil, nascimento, latitude, longitude, cidade, estado, setor_eclesiastico, setor_residencial')
            .eq('status', 'Ativo'),
          supabase.from('celulas')
            .select('grupo_caseiro, lider, auxiliar, setor'),
          supabase.from('pessoas_familiares')
            .select('id_pessoa_a, pessoa_a, parentesco, id_pessoa_b, pessoa_b, mesmo_domicilio')
        ]);

        if (membrosRes.data) setMembers(membrosRes.data as Member[]);
        if (celulasRes.data) setCells(celulasRes.data as Cell[]);
        if (relationsRes.data) {
          setRelations(relationsRes.data as FamilyRelation[]);
        } else {
          console.warn('Could not load relations from Supabase:', relationsRes.error);
        }
      } catch (err) {
        console.error('Error loading family data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Initialize high-performance disjoint-set clustering (DSU)
  const families = useFamilyEngine(members, relations);

  // Compute calculated family metrics and audit divisions
  const familyData = useMemo(() => {
    if (members.length === 0 || Object.keys(families).length === 0) {
      return {
        list: [],
        totalCount: 0,
        averageSize: 0,
        unifiedCount: 0,
        dividedCount: 0,
        uniqueRAs: []
      };
    }

    const list: any[] = [];
    let unifiedCount = 0;
    let dividedCount = 0;
    const ras = new Set<string>();

    Object.entries(families).forEach(([headId, fam]) => {
      const headMember = members.find(m => m.id.toString() === headId);
      if (!headMember) return;

      const familyMembers = fam.memberIds
        .map(idStr => members.find(m => m.id.toString() === idStr))
        .filter((m): m is Member => !!m);

      // Collect all active cell groups attended by members of this family
      const attendedGCs = new Set<string>();
      familyMembers.forEach(m => {
        if (m.grupos_caseiros) {
          attendedGCs.add(m.grupos_caseiros);
        }
      });

      // A family is split if members attend 2 or more distinct GCs
      const isDivided = attendedGCs.size > 1;
      if (isDivided) dividedCount++;
      else unifiedCount++;

      const headRA = getAdministrativeRegion(headMember.bairro);
      if (headRA && headRA !== 'NÃO INFORMADO') {
        ras.add(headRA);
      }

      list.push({
        headId,
        headName: headMember.nome,
        headRA,
        headBairro: headMember.bairro || 'Não informado',
        membersCount: familyMembers.length,
        familyMembers,
        isDivided,
        gcsAttended: Array.from(attendedGCs),
        address: headMember.logradouro || 'Sem endereço cadastrado',
        contact: headMember.celular_principal_sms || headMember.telefone_fixo || ''
      });
    });

    // Sort families (split families first, then by size desc, then alphabetically by head name)
    list.sort((a, b) => {
      if (a.isDivided && !b.isDivided) return -1;
      if (!a.isDivided && b.isDivided) return 1;
      if (b.membersCount !== a.membersCount) return b.membersCount - a.membersCount;
      return a.headName.localeCompare(b.headName);
    });

    const totalCount = list.length;
    const totalMembers = list.reduce((sum, f) => sum + f.membersCount, 0);
    const averageSize = totalCount > 0 ? parseFloat((totalMembers / totalCount).toFixed(1)) : 0;

    return {
      list,
      totalCount,
      averageSize,
      unifiedCount,
      dividedCount,
      uniqueRAs: Array.from(ras).sort()
    };
  }, [families, members]);

  // Dynamic grouping into extended lineage arrays ("Parentelas" / relatives)
  const parentelas = useMemo(() => {
    if (members.length === 0 || Object.keys(families).length === 0) return [];

    const normName = (name: string | null | undefined): string => {
      if (!name) return '';
      return name.trim().toUpperCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, ' ');
    };

    const isVal = (s: string) => s && s.length > 3 && !s.includes('INFORMADO') && !s.includes('CONSTA') && !s.includes('IGNORADO');

    // Helper to check if two nuclear families are related by parentage
    const areFamiliesRelated = (famA: any, famB: any): boolean => {
      const headA = members.find(m => m.id.toString() === famA.headId);
      const headB = members.find(m => m.id.toString() === famB.headId);
      if (!headA || !headB) return false;

      const nameA = normName(headA.nome);
      const nameB = normName(headB.nome);
      const fatherA = headA.pai ? normName(headA.pai) : '';
      const motherA = headA.mae ? normName(headA.mae) : '';
      const fatherB = headB.pai ? normName(headB.pai) : '';
      const motherB = headB.mae ? normName(headB.mae) : '';

      // 1. Parent-child link (either way)
      if (fatherA && (fatherA === nameB || nameB.includes(fatherA) || fatherA.includes(nameB))) return true;
      if (motherA && (motherA === nameB || nameB.includes(motherA) || motherA.includes(nameB))) return true;
      if (fatherB && (fatherB === nameA || nameA.includes(fatherB) || fatherB.includes(nameA))) return true;
      if (motherB && (motherB === nameA || nameA.includes(motherB) || motherB.includes(nameA))) return true;

      // 2. Sibling link (shared parents, ignoring placeholder/incomplete values)
      if (isVal(fatherA) && isVal(fatherB) && fatherA === fatherB) return true;
      if (isVal(motherA) && isVal(motherB) && motherA === motherB) return true;

      return false;
    };

    const visited = new Set<string>();
    const parentelasList: any[] = [];

    familyData.list.forEach((fam) => {
      if (visited.has(fam.headId)) return;

      // BFS to find all connected families in this relative/lineage cluster
      const component: any[] = [];
      const queue: any[] = [fam];
      visited.add(fam.headId);

      while (queue.length > 0) {
        const current = queue.shift()!;
        component.push(current);

        familyData.list.forEach((other) => {
          if (visited.has(other.headId)) return;
          if (areFamiliesRelated(current, other)) {
            visited.add(other.headId);
            queue.push(other);
          }
        });
      }

      // Only display actual parentelas (consisting of multiple nuclear families related by common father/mother)
      if (component.length > 1) {
        // Count frequencies of father and mother names across all heads in this component to find the patriarch
        const parentFreqs = new Map<string, number>();
        const parentOriginalNames = new Map<string, string>();

        component.forEach((c) => {
          const cHead = members.find(m => m.id.toString() === c.headId);
          if (!cHead) return;
          if (cHead.pai && isVal(normName(cHead.pai))) {
            const fNorm = normName(cHead.pai);
            parentFreqs.set(fNorm, (parentFreqs.get(fNorm) || 0) + 1);
            parentOriginalNames.set(fNorm, cHead.pai);
          }
          if (cHead.mae && isVal(normName(cHead.mae))) {
            const mNorm = normName(cHead.mae);
            parentFreqs.set(mNorm, (parentFreqs.get(mNorm) || 0) + 1);
            parentOriginalNames.set(mNorm, cHead.mae);
          }
        });

        // Find the most frequent parent name that is shared
        let bestParent = '';
        let maxFreq = 1;
        parentFreqs.forEach((freq, normP) => {
          if (freq > maxFreq) {
            maxFreq = freq;
            bestParent = parentOriginalNames.get(normP) || '';
          }
        });

        // Fallback to the oldest head's parent if no common parent name has frequency > 1
        if (!bestParent) {
          let oldest = component[0];
          let oldestAge = -1;
          component.forEach((c) => {
            const cHead = members.find(m => m.id.toString() === c.headId);
            if (cHead) {
              const parts = cHead.nascimento ? cHead.nascimento.split('-') : [];
              const age = parts.length > 0 ? (new Date().getFullYear() - Number(parts[0])) : -1;
              if (age > oldestAge) {
                oldestAge = age;
                oldest = c;
              }
            }
          });
          const oHead = members.find(m => m.id.toString() === oldest.headId);
          bestParent = oHead ? (oHead.pai || oHead.mae || oHead.nome) : 'Não informado';
        }

        const name = `Parentela de ${bestParent}`;

        // Collect all unique surnames
        const surnamesSet = new Set<string>();
        component.forEach((c) => {
          const cHead = members.find(m => m.id.toString() === c.headId);
          if (cHead) {
            const parts = cHead.nome.split(' ');
            if (parts.length > 1) {
              surnamesSet.add(parts[parts.length - 1]);
            }
          }
        });

        parentelasList.push({
          id: `PARENTELA:${component[0].headId}`,
          name,
          subFamilies: component,
          totalMembersCount: component.reduce((sum, f) => sum + f.membersCount, 0),
          surnames: Array.from(surnamesSet)
        });
      }
    });

    return parentelasList.sort((a, b) => b.totalMembersCount - a.totalMembersCount);
  }, [familyData, members, families]);

  // Filtering nuclear family cards
  const filteredFamilies = useMemo(() => {
    const getMemberSector = (m: Member | undefined): string => {
      if (!m) return 'Sem Setor';
      
      // Use pre-calculated resident sector from Supabase if available
      if (m.setor_residencial) {
        const norm = m.setor_residencial.trim().toUpperCase();
        if (norm.includes('NORTE')) return 'Setor Norte';
        if (norm.includes('CENTRAL')) return 'Setor Central';
        if (norm.includes('AGUAS CLARAS') || norm.includes('ÁGUAS CLARAS')) return 'Setor Águas Claras';
        if (norm.includes('SUL')) return 'Setor Sul';
        return 'Sem Setor';
      }

      const matchingCell = cells.find(c => 
        (c.lider && c.lider.trim().toUpperCase() === m.nome.trim().toUpperCase()) ||
        (c.auxiliar && c.auxiliar.trim().toUpperCase() === m.nome.trim().toUpperCase())
      );
      if (matchingCell) {
        const norm = (matchingCell.setor || '').trim().toUpperCase();
        if (norm.includes('NORTE')) return 'Setor Norte';
        if (norm.includes('CENTRAL')) return 'Setor Central';
        if (norm.includes('AGUAS CLARAS') || norm.includes('ÁGUAS CLARAS')) return 'Setor Águas Claras';
        if (norm.includes('SUL')) return 'Setor Sul';
        return 'Sem Setor';
      }
      return getSectorByResidence(m.bairro, m.cidade, m.estado);
    };

    return familyData.list.filter(fam => {
      // 1. Text search
      const matchesSearch = searchTerm === '' || 
        fam.headName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fam.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fam.headBairro.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fam.familyMembers.some((m: Member) => m.nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
        fam.gcsAttended.some((g: string) => g.toLowerCase().includes(searchTerm.toLowerCase()));

      // 2. Sector Filter
      const headMember = fam.familyMembers.find((m: Member) => m.id.toString() === fam.headId);
      const residentSector = getMemberSector(headMember);
      const matchesSector = filterSector === 'Todos' || residentSector === filterSector;

      // 3. GC Status Filter
      const matchesStatus = filterStatus === 'Todos' ||
        (filterStatus === 'Unified' && !fam.isDivided) ||
        (filterStatus === 'Divided' && fam.isDivided);

      return matchesSearch && matchesSector && matchesStatus;
    });
  }, [familyData, searchTerm, filterSector, filterStatus, cells]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Heart className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20">
      {/* Page Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-50 text-pink-700 text-xs font-bold mb-3 border border-pink-100">
            <Sparkles className="w-3 h-3 text-pink-600" /> Auditoria de Lares & Famílias
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Núcleos Familiares</h1>
          <p className="mt-1 text-sm text-gray-500">
            Pastoreamento integrado agrupando lares e analisando a unificação de GCs.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200 shrink-0">
          <button
            onClick={() => setActiveTab('nucleos')}
            className={clsx(
              "px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all duration-200 cursor-pointer",
              activeTab === 'nucleos' 
                ? "bg-white text-gray-900 shadow-sm" 
                : "text-gray-500 hover:text-gray-800"
            )}
          >
            <Users className="w-3.5 h-3.5" /> Núcleos Familiares ({filteredFamilies.length})
          </button>
          <button
            onClick={() => setActiveTab('parentelas')}
            className={clsx(
              "px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all duration-200 cursor-pointer",
              activeTab === 'parentelas' 
                ? "bg-white text-gray-900 shadow-sm" 
                : "text-gray-500 hover:text-gray-800"
            )}
          >
            <Heart className="w-3.5 h-3.5 text-pink-500" /> Parentelas Estendidas ({parentelas.length})
          </button>
        </div>
      </header>

      {/* Metrics Section */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="p-3 bg-pink-50 text-pink-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Famílias</span>
            <span className="text-2xl font-extrabold text-gray-900">{familyData.totalCount}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Média por Lar</span>
            <span className="text-2xl font-extrabold text-gray-900">{familyData.averageSize} memb</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Lares no Mesmo GC</span>
            <span className="text-2xl font-extrabold text-gray-900">{familyData.unifiedCount}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <AlertTriangle className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <span className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">Lares Divididos</span>
            <span className="text-2xl font-extrabold text-amber-600">{familyData.dividedCount}</span>
          </div>
        </div>
      </section>

      {/* Main Panel Content */}
      {activeTab === 'nucleos' ? (
        <>
          {/* Search & Filters */}
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar família por nome do chefe, membro, rua, bairro ou GC..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border-gray-200 rounded-xl focus:ring-primary-500 focus:border-primary-500 text-sm bg-gray-50/50"
              />
            </div>

            {/* Sector Filter */}
            <div className="relative w-full md:w-56 shrink-0">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <select
                value={filterSector}
                onChange={e => setFilterSector(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border-gray-200 rounded-xl focus:ring-primary-500 focus:border-primary-500 text-sm bg-gray-50/50 font-semibold text-gray-700"
              >
                <option value="Todos">Setor de Residência (Todos)</option>
                <option value="Setor Norte">Setor Norte</option>
                <option value="Setor Central">Setor Central</option>
                <option value="Setor Águas Claras">Setor Águas Claras</option>
                <option value="Setor Sul">Setor Sul</option>
                <option value="Sem Setor">Sem Setor</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative w-full md:w-48 shrink-0">
              <AlertCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border-gray-200 rounded-xl focus:ring-primary-500 focus:border-primary-500 text-sm bg-gray-50/50 font-semibold text-gray-700"
              >
                <option value="Todos">Status do Lar (Todos)</option>
                <option value="Unified">🏠 GCs Unificados</option>
                <option value="Divided">⚠️ Famílias Divididas</option>
              </select>
            </div>
          </div>

          {/* Families Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFamilies.length > 0 ? (
              filteredFamilies.map((fam) => {
                const headMember = fam.familyMembers.find((m: Member) => m.id.toString() === fam.headId);
                const spouse = fam.familyMembers.find((m: Member) => m.id.toString() !== fam.headId && m.estado_civil === 'Casado');
                const children = fam.familyMembers.filter((m: Member) => m.id.toString() !== fam.headId && m.id.toString() !== spouse?.id);

                return (
                  <div 
                    key={fam.headId}
                    className={clsx(
                      "bg-white rounded-3xl border shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden",
                      fam.isDivided 
                        ? "border-amber-100 hover:border-amber-200" 
                        : "border-gray-100 hover:border-gray-200"
                    )}
                  >
                    {/* Card Header */}
                    <div className="p-5 border-b border-gray-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">Chefe da Casa</span>
                          <h3 className="text-sm font-bold text-gray-900 truncate leading-snug">
                            Família de {fam.headName.split(' ')[0]} {fam.headName.split(' ').slice(-1)[0]}
                          </h3>
                        </div>

                        {/* Split vs Unified Badge */}
                        {fam.isDivided ? (
                          <span className="inline-flex items-center gap-1 text-[8px] bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full font-black uppercase tracking-wider animate-pulse shrink-0">
                            ⚠️ GCs Diferentes
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0">
                            🏠 Mesmo GC
                          </span>
                        )}
                      </div>

                      {/* Administrative Region & Address */}
                      <div className="flex items-center gap-1 mt-3">
                        <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-bold uppercase">
                          {fam.headRA}
                        </span>
                        <span className="text-[10px] text-gray-400 truncate flex-1 pl-1">
                          📍 {fam.headBairro}
                        </span>
                      </div>
                    </div>

                    {/* Members List */}
                    <div className="p-5 flex-1 space-y-4">
                      {fam.familyMembers.map((m: Member) => {
                        const isHead = m.id.toString() === fam.headId;
                        const isSpouse = spouse && m.id.toString() === spouse.id;

                        // Calculate age
                        let parts = m.nascimento ? (m.nascimento.includes('/') ? m.nascimento.split('/') : m.nascimento.split('-')) : [];
                        let age = -1;
                        if (m.nascimento && parts.length === 3) {
                          const birth = m.nascimento.includes('/') 
                            ? new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])) 
                            : new Date(m.nascimento);
                          if (!isNaN(birth.getTime())) {
                            const now = new Date();
                            age = now.getFullYear() - birth.getFullYear();
                            if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
                          }
                        }

                        return (
                          <div key={m.id} className="flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={clsx(
                                "h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0",
                                m.sexo === 'Masculino' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-pink-50 text-pink-600 border border-pink-100'
                              )}>
                                {m.nome.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <span className="block font-bold text-gray-800 truncate flex items-center gap-1.5 leading-snug">
                                  {m.nome.split(' ')[0]} {m.nome.split(' ').slice(-1)[0]}
                                  {isHead && (
                                    <span className="text-[8px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-1 rounded-md font-bold uppercase shrink-0">
                                      Titular
                                    </span>
                                  )}
                                  {isSpouse && (
                                    <span className="text-[8px] bg-pink-50 border border-pink-100 text-pink-600 px-1 rounded-md font-bold uppercase shrink-0">
                                      Cônjuge
                                    </span>
                                  )}
                                </span>
                                <span className="block text-[9px] text-gray-400">
                                  {age >= 0 ? `${age} anos` : 'Idade não cadastrada'} • {m.sexo === 'Masculino' ? 'M' : 'F'}
                                </span>
                              </div>
                            </div>

                            {/* Member GC allocation with color audit */}
                            {m.grupos_caseiros ? (
                              <span className={clsx(
                                "text-[9px] font-bold px-2 py-0.5 rounded-lg border max-w-[110px] truncate shrink-0",
                                fam.isDivided 
                                  ? "text-amber-700 bg-amber-50/50 border-amber-100 animate-pulse"
                                  : "text-emerald-700 bg-emerald-50/50 border-emerald-100"
                              )}>
                                {m.grupos_caseiros}
                              </span>
                            ) : (
                              <span className="text-[9px] text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg shrink-0">
                                Sem GC
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Card Footer Details */}
                    <div className="p-4 bg-gray-50/60 border-t border-gray-50 flex items-center justify-between text-[10px] text-gray-500">
                      <div className="min-w-0 pr-3">
                        <span className="block truncate font-medium">{fam.address}</span>
                      </div>
                      {fam.contact && (
                        <a 
                          href={`tel:${fam.contact.replace(/\D/g, '')}`}
                          className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800 font-bold shrink-0 hover:underline"
                        >
                          <Phone className="w-3 h-3" /> Chamar
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-gray-100">
                <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 text-sm font-semibold">Nenhuma família atende aos filtros aplicados.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Parentelas/Relatives Tab Content */
        <div className="space-y-6">
          <div className="bg-pink-50/40 border border-pink-100 rounded-3xl p-6 text-pink-950 flex items-start gap-4">
            <Heart className="w-10 h-10 text-pink-500 shrink-0" />
            <div>
              <h3 className="text-base font-bold">Mapeamento de Parentelas Estendidas</h3>
              <p className="text-xs text-pink-700/90 leading-relaxed mt-1">
                Este motor relaciona e agrupa múltiplos núcleos familiares que possuem ascendentes diretos em comum (nomes de pai ou mãe compartilhados no cadastro). Isso ajuda a mapear linhagens completas para aconselhamentos e eventos de pastoreamento familiar integrado.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {parentelas.map((p) => (
              <div key={p.id} className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-black text-gray-800 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-pink-500 shrink-0" /> {p.name}
                      </h4>
                      <span className="text-[10px] text-gray-400">
                        Sobrenomes: {p.surnames.join(', ')}
                      </span>
                    </div>
                    <span className="text-[10px] bg-pink-50 text-pink-700 border border-pink-100 font-extrabold px-2.5 py-0.5 rounded-full shrink-0">
                      {p.totalMembersCount} membros
                    </span>
                  </div>

                  {/* Nuclear family cards linked under this parentela */}
                  <div className="space-y-3">
                    {p.subFamilies.map((fam) => (
                      <div key={fam.headId} className="bg-gray-50/70 border border-gray-100 rounded-2xl p-4 flex items-center justify-between gap-4">
                        <div>
                          <span className="block text-xs font-bold text-gray-800">
                            Núcleo de {fam.headName}
                          </span>
                          <span className="block text-[9px] text-gray-400">
                            📍 {fam.headBairro} • {fam.address}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[9px] bg-white border border-gray-150 font-bold px-2 py-0.5 rounded-lg text-gray-600">
                            {fam.membersCount} memb
                          </span>
                          {fam.isDivided ? (
                            <span className="text-[8px] bg-amber-50 border border-amber-100 text-amber-700 font-bold px-1.5 py-0.2 rounded-full uppercase shrink-0">
                              GCs Diferentes
                            </span>
                          ) : (
                            <span className="text-[8px] bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold px-1.5 py-0.2 rounded-full uppercase shrink-0">
                              Mesmo GC
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center text-[10px] text-gray-400">
                  <span>Contém {p.subFamilies.length} lares nucleares</span>
                  <span className="font-semibold text-primary-600">Integração Ampliada ➔</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
