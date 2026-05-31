import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFamilyEngine } from '../hooks/useFamilyEngine';
import type { Member, FamilyRelation } from '../hooks/useFamilyEngine';
import { getAdministrativeRegion } from '../lib/geoUtils';
import { 
  Home, Search, Users, MapPin, AlertCircle, Phone, 
  TrendingUp, Filter, CheckCircle2, MessageSquare, 
  Calendar, Sparkles, Check, Send, Heart
} from 'lucide-react';
import clsx from 'clsx';

// Interface for localStorage visit records
interface VisitRecord {
  visited: boolean;
  visitedAt: string | null;
  received: boolean;
  receivedAt: string | null;
  notes: string;
  updatedAt: string;
  receivedMembers?: Record<string, boolean>;
}

type VisitationState = Record<string, VisitRecord>;

export const LabVisits: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const allowedModules = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') {
      return ['Lab: Visão da Plenitude', 'Lab: Gestão de Visitas', 'Lab: Consultas & Estudos'];
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
      return ['Lab: Visão da Plenitude', 'Lab: Gestão de Visitas', 'Lab: Consultas & Estudos'];
    }
    return [];
  }, [user]);

  const [members, setMembers] = useState<Member[]>([]);
  const [relations, setRelations] = useState<FamilyRelation[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRA, setFilterRA] = useState('Todos');
  const [filterGC, setFilterGC] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos'); // 'Todos', 'Visited', 'Received', 'Pending', 'Pastored'
  
  // Visitation states stored locally
  const [visitationRecords, setVisitationRecords] = useState<VisitationState>({});
  
  // State for expanded notes modal or inline accordion
  const [activeNotesFamilyId, setActiveNotesFamilyId] = useState<string | null>(null);
  const [tempNotesText, setTempNotesText] = useState('');

  // 1. Fetch data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoadingData(true);
        const [membrosRes, relationsRes] = await Promise.all([
          supabase
            .from('membros')
            .select('id, nome, grupos_caseiros, status, sexo, bairro, pai, mae, logradouro, celular_principal_sms, telefone_fixo, estado_civil, nascimento, latitude, longitude')
            .eq('status', 'Ativo'),
          supabase
            .from('pessoas_familiares')
            .select('id_pessoa_a, pessoa_a, parentesco, id_pessoa_b, pessoa_b, mesmo_domicilio')
        ]);

        if (membrosRes.error) throw membrosRes.error;
        if (membrosRes.data) setMembers(membrosRes.data as Member[]);
        if (relationsRes.data) {
          setRelations(relationsRes.data as FamilyRelation[]);
        } else {
          console.warn('Could not load relations from Supabase:', relationsRes.error);
        }
      } catch (err) {
        console.error('Error fetching members for visits:', err);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, []);

  // 2. Load visitation records from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('bsb_church_visitation_records');
      if (stored) {
        setVisitationRecords(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load visitation records:', e);
    }
  }, []);

  // 3. Save visitation records helper
  const saveRecord = (familyHeadId: string, updatedRecord: Partial<VisitRecord>) => {
    const nowStr = new Date().toISOString().split('T')[0];
    const current = visitationRecords[familyHeadId] || {
      visited: false,
      visitedAt: null,
      received: false,
      receivedAt: null,
      notes: '',
      updatedAt: nowStr,
      receivedMembers: {}
    };

    const nextRecord: VisitRecord = {
      ...current,
      receivedMembers: current.receivedMembers || {},
      ...updatedRecord,
      updatedAt: nowStr
    };

    const nextState = {
      ...visitationRecords,
      [familyHeadId]: nextRecord
    };

    setVisitationRecords(nextState);
    localStorage.setItem('bsb_church_visitation_records', JSON.stringify(nextState));
  };

  // Group members into nuclear families (strictly grouped by household address and relations)
  const families = useFamilyEngine(members, relations);

  // Compute list of unique GCs and RAs for filter options
  const filterOptions = useMemo(() => {
    const gcs = new Set<string>();
    const ras = new Set<string>();

    members.forEach(m => {
      if (m.grupos_caseiros) gcs.add(m.grupos_caseiros);
      const ra = getAdministrativeRegion(m.bairro);
      if (ra && ra !== 'NÃO INFORMADO') ras.add(ra);
    });

    return {
      gcs: Array.from(gcs).sort(),
      ras: Array.from(ras).sort()
    };
  }, [members]);

  // Compute calculated statistics for the dashboard
  const statistics = useMemo(() => {
    const totalFamilies = Object.keys(families).length;
    if (totalFamilies === 0) {
      return { total: 0, visited: 0, visitedPct: 0, received: 0, receivedPct: 0, coverage: 0, coveragePct: 0 };
    }

    let visitedCount = 0;
    let receivedCount = 0;
    let reachedCount = 0;

    Object.keys(families).forEach(headId => {
      const record = visitationRecords[headId];
      const isVisited = record?.visited ?? false;
      const isReceived = record?.received ?? false;
      const hasAnyReceived = isReceived || Object.values(record?.receivedMembers || {}).some(Boolean);

      if (isVisited) visitedCount++;
      if (hasAnyReceived) receivedCount++;
      if (isVisited || hasAnyReceived) reachedCount++;
    });

    return {
      total: totalFamilies,
      visited: visitedCount,
      visitedPct: Math.round((visitedCount / totalFamilies) * 100),
      received: receivedCount,
      receivedPct: Math.round((receivedCount / totalFamilies) * 100),
      coverage: reachedCount,
      coveragePct: Math.round((reachedCount / totalFamilies) * 100)
    };
  }, [families, visitationRecords]);

  // Handle Note Editing
  const openNotesEditor = (familyHeadId: string) => {
    setActiveNotesFamilyId(familyHeadId);
    setTempNotesText(visitationRecords[familyHeadId]?.notes || '');
  };

  const saveNotes = (familyHeadId: string) => {
    saveRecord(familyHeadId, { notes: tempNotesText });
    setActiveNotesFamilyId(null);
  };

  // Handle Individual Member Received Toggle
  const toggleMemberReceived = (familyHeadId: string, memberId: string, familyMembers: Member[]) => {
    const record = visitationRecords[familyHeadId] || {
      visited: false,
      visitedAt: null,
      received: false,
      receivedAt: null,
      notes: '',
      updatedAt: new Date().toISOString().split('T')[0],
      receivedMembers: {}
    };

    const currentReceivedMembers = record.receivedMembers || {};
    const nextReceivedMembers = { ...currentReceivedMembers };

    if (record.received) {
      // If family-level is currently true, and we are untoggling an individual member:
      // We set family-level received to false, set all OTHER members to true, and this member to false.
      familyMembers.forEach(m => {
        const mId = m.id.toString();
        nextReceivedMembers[mId] = mId !== memberId;
      });
      
      saveRecord(familyHeadId, {
        received: false,
        receivedAt: null,
        receivedMembers: nextReceivedMembers
      });
    } else {
      // If family-level is false, toggle the member state
      const isCurrentlyReceived = !!nextReceivedMembers[memberId];
      nextReceivedMembers[memberId] = !isCurrentlyReceived;

      // If all members are now received, set family-level received to true
      const allReceived = familyMembers.every(m => nextReceivedMembers[m.id.toString()]);
      
      saveRecord(familyHeadId, {
        received: allReceived,
        receivedAt: allReceived ? new Date().toISOString().split('T')[0] : record.receivedAt,
        receivedMembers: nextReceivedMembers
      });
    }
  };

  // Compile final filtered list of nuclear families
  const filteredFamilyList = useMemo(() => {
    const list: any[] = [];

    Object.entries(families).forEach(([headId, fam]) => {
      const headMember = members.find(m => m.id.toString() === headId);
      if (!headMember) return;

      const familyMembers = fam.memberIds
        .map(idStr => members.find(m => m.id.toString() === idStr))
        .filter((m): m is Member => !!m);

      const record = visitationRecords[headId];
      const isVisited = record?.visited ?? false;
      const isReceived = record?.received ?? false;
      const notes = record?.notes || '';

      const receivedMembers = record?.receivedMembers || {};
      const receivedCount = familyMembers.filter(m => isReceived || !!receivedMembers[m.id.toString()]).length;
      const hasIndividualReceived = !isReceived && receivedCount > 0;

      const headRA = getAdministrativeRegion(headMember.bairro);
      const attendedGCs = Array.from(new Set(familyMembers.map(m => m.grupos_caseiros).filter(Boolean)));

      // 1. Text Search matching
      const matchesSearch = searchTerm === '' ||
        headMember.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (headMember.logradouro || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (headMember.bairro || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        familyMembers.some(m => m.nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
        notes.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. RA Filter
      const matchesRA = filterRA === 'Todos' || headRA === filterRA;

      // 3. GC Filter
      const matchesGC = filterGC === 'Todos' || familyMembers.some(m => m.grupos_caseiros === filterGC);

      // 4. Status Filter
      let matchesStatus = true;
      if (filterStatus === 'Visited') matchesStatus = isVisited;
      else if (filterStatus === 'Received') matchesStatus = isReceived || receivedCount > 0;
      else if (filterStatus === 'Pending') matchesStatus = !isVisited && !isReceived && receivedCount === 0;
      else if (filterStatus === 'Pastored') matchesStatus = isVisited || isReceived || receivedCount > 0;

      if (matchesSearch && matchesRA && matchesGC && matchesStatus) {
        list.push({
          headId,
          headName: headMember.nome,
          headRA,
          headBairro: headMember.bairro || 'Não informado',
          address: headMember.logradouro || 'Sem endereço cadastrado',
          contact: headMember.celular_principal_sms || headMember.telefone_fixo || '',
          membersCount: familyMembers.length,
          familyMembers,
          attendedGCs,
          isVisited,
          isReceived,
          notes,
          visitedAt: record?.visitedAt,
          receivedAt: record?.receivedAt,
          receivedMembers,
          receivedCount,
          hasIndividualReceived
        });
      }
    });

    // Sort: unvisited first, then by size desc, then alphabetically by head name
    return list.sort((a, b) => {
      const aDone = a.isVisited || a.isReceived || a.hasIndividualReceived;
      const bDone = b.isVisited || b.isReceived || b.hasIndividualReceived;
      if (aDone && !bDone) return 1;
      if (!aDone && bDone) return -1;
      if (b.membersCount !== a.membersCount) return b.membersCount - a.membersCount;
      return a.headName.localeCompare(b.headName);
    });
  }, [families, members, visitationRecords, searchTerm, filterRA, filterGC, filterStatus]);

  if (isLoadingData) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Heart className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20">

      {/* Dynamic Tabs Navigation inside Lab Pages */}
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-1">
        {[
          { path: '/lab/vision', label: '🏛️ Visão de Efésios 4', id: 'Lab: Visão da Plenitude' },
          { path: '/lab/visits', label: '🏠 Gestão de Visitas', id: 'Lab: Gestão de Visitas' },
          { path: '/lab/queries', label: '📊 Consultas & Estudos', id: 'Lab: Consultas & Estudos' },
          { path: '/lab/counsel', label: '🕊️ Conselho Apostólico', id: 'Lab: Conselho Apostólico' }
        ].filter(tab => user?.role === 'admin' || allowedModules.includes(tab.id)).map((tab) => {
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

      {/* Top Gradient Hero Block */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 p-8 text-white shadow-xl">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute top-0 right-0 w-96 h-96 bg-teal-400 rounded-full translate-x-1/3 -translate-y-1/3 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500 rounded-full -translate-x-1/3 translate-y-1/3 blur-3xl" />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 text-teal-300 px-3 py-1 rounded-full text-xs font-bold mb-4 border border-white/5 backdrop-blur-md">
            <Sparkles className="h-3 w-3 text-teal-400" /> LAB · GESTÃO DE VISITAS
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
            Pastoreamento &<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-cyan-300 to-indigo-300">
              Visitação de Lares
            </span>
          </h1>
          <p className="text-slate-300 max-w-xl text-xs md:text-sm leading-relaxed">
            Mapeie o pastoreio integrado da igreja. Acompanhe os núcleos familiares residenciais que você visitou ou recebeu em sua casa e salve anotações de cuidado.
          </p>
        </div>
      </header>

      {/* Modern Dashboard Stats Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Families */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lares Totais</span>
            <span className="text-2xl font-extrabold text-slate-900">{statistics.total}</span>
          </div>
        </div>

        {/* Visited Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lares Visitados</span>
                <span className="text-xl font-extrabold text-slate-900">{statistics.visited}</span>
              </div>
            </div>
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">
              {statistics.visitedPct}%
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${statistics.visitedPct}%` }} />
          </div>
        </div>

        {/* Received Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                <Home className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Recebidos em Casa</span>
                <span className="text-xl font-extrabold text-slate-900">{statistics.received}</span>
              </div>
            </div>
            <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold">
              {statistics.receivedPct}%
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${statistics.receivedPct}%` }} />
          </div>
        </div>

        {/* Coverage Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cobertura de Cuidado</span>
                <span className="text-xl font-extrabold text-slate-900">{statistics.coverage}</span>
              </div>
            </div>
            <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-bold">
              {statistics.coveragePct}%
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-teal-500 h-full rounded-full transition-all duration-500" style={{ width: `${statistics.coveragePct}%` }} />
          </div>
        </div>
      </section>

      {/* Filtering and Controls Bar */}
      <section className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por chefe de família, rua, bairro, GC ou anotações..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-sm bg-slate-50/50"
          />
        </div>

        {/* RA Selector */}
        <div className="relative w-full md:w-48 shrink-0">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <select
            value={filterRA}
            onChange={e => setFilterRA(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-xs font-semibold text-slate-600 bg-slate-50/50 cursor-pointer"
          >
            <option value="Todos">Região / RA (Todas)</option>
            {filterOptions.ras.map(ra => (
              <option key={ra} value={ra}>{ra}</option>
            ))}
          </select>
        </div>

        {/* GC Selector */}
        <div className="relative w-full md:w-48 shrink-0">
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <select
            value={filterGC}
            onChange={e => setFilterGC(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-xs font-semibold text-slate-600 bg-slate-50/50 cursor-pointer"
          >
            <option value="Todos">Grupo Caseiro (Todos)</option>
            {filterOptions.gcs.map(gc => (
              <option key={gc} value={gc}>{gc}</option>
            ))}
          </select>
        </div>

        {/* Status Selector */}
        <div className="relative w-full md:w-48 shrink-0">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-xs font-semibold text-slate-600 bg-slate-50/50 cursor-pointer"
          >
            <option value="Todos">Filtro de Visita (Todos)</option>
            <option value="Visited">✅ Apenas Visitados</option>
            <option value="Received">🏠 Apenas Recebidos</option>
            <option value="Pastored">⭐ Qualquer Interação</option>
            <option value="Pending">⏳ Lares Pendentes</option>
          </select>
        </div>
      </section>

      {/* Household Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredFamilyList.length > 0 ? (
          filteredFamilyList.map(fam => {
            const isNotesEditorOpen = activeNotesFamilyId === fam.headId;

            // Generate WhatsApp link helper
            const phoneClean = fam.contact ? fam.contact.replace(/\D/g, '') : '';
            const hasPhone = phoneClean.length >= 8;
            const waLink = hasPhone 
              ? `https://wa.me/55${phoneClean}?text=Ol%C3%A1%21%20Passando%20para%20saber%20como%20voc%C3%AAs%20est%C3%A3o%20e%20deixar%20um%20abra%C3%A7o%20pastoral.%20Deus%20aben%C3%A7oe%21`
              : null;

            return (
              <div 
                key={fam.headId}
                className={clsx(
                  "bg-white rounded-3xl border shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden relative",
                  (fam.isVisited || fam.isReceived) 
                    ? "border-emerald-100/70 bg-white" 
                    : fam.hasIndividualReceived
                    ? "border-amber-100/70 bg-white"
                    : "border-slate-100 bg-slate-50/10"
                )}
              >
                {/* Visual indicator corner */}
                {(fam.isVisited || fam.isReceived) ? (
                  <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none overflow-hidden">
                    <div className="absolute top-[-10px] right-[-10px] w-8 h-8 bg-emerald-500/10 rotate-45" />
                  </div>
                ) : fam.hasIndividualReceived ? (
                  <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none overflow-hidden">
                    <div className="absolute top-[-10px] right-[-10px] w-8 h-8 bg-amber-500/10 rotate-45" />
                  </div>
                ) : null}

                {/* Card Header */}
                <div className="p-5 border-b border-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                        Chefe da Casa
                      </span>
                      <h3 className="text-sm font-extrabold text-slate-900 leading-snug truncate">
                        Família de {fam.headName.split(' ')[0]} {fam.headName.split(' ').slice(-1)[0]}
                      </h3>
                    </div>

                    {/* Status badges */}
                    <div className="flex gap-1 shrink-0">
                      {fam.isVisited && (
                        <span className="inline-flex items-center gap-0.5 text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                          <Check className="w-2.5 h-2.5 text-emerald-600 shrink-0" /> Visitado
                        </span>
                      )}
                      {fam.isReceived && (
                        <span className="inline-flex items-center gap-0.5 text-[8px] bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                          <Home className="w-2.5 h-2.5 text-amber-600 shrink-0" /> Recebido
                        </span>
                      )}
                      {fam.hasIndividualReceived && (
                        <span className="inline-flex items-center gap-0.5 text-[8px] bg-amber-50/60 text-amber-800 border border-amber-100/50 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                          <Home className="w-2.5 h-2.5 text-amber-600 shrink-0" /> {fam.receivedCount}/{fam.membersCount} Recebidos
                        </span>
                      )}
                      {!fam.isVisited && !fam.isReceived && !fam.hasIndividualReceived && (
                        <span className="inline-flex items-center text-[8px] bg-slate-50 text-slate-500 border border-slate-150 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                          Pendente
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Administrative Region & Address */}
                  <div className="flex items-center gap-1 mt-3">
                    <span className="text-[8px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-black uppercase">
                      {fam.headRA}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate flex-1 pl-1 font-medium">
                      📍 {fam.headBairro}
                    </span>
                  </div>
                </div>

                {/* Family Members in Household */}
                <div className="p-5 flex-1 space-y-4">
                  {fam.familyMembers.map((m: Member) => {
                    const isHead = m.id.toString() === fam.headId;
                    const spouse = fam.familyMembers.find((x: Member) => x.id.toString() !== fam.headId && x.estado_civil === 'Casado(a)');
                    const isSpouse = spouse && m.id.toString() === spouse.id;

                    // Calculate age
                    let age = -1;
                    if (m.nascimento) {
                      let parts = m.nascimento.includes('/') ? m.nascimento.split('/') : m.nascimento.split('-');
                      const birth = m.nascimento.includes('/') 
                        ? new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])) 
                        : new Date(m.nascimento);
                      if (!isNaN(birth.getTime())) {
                        const now = new Date();
                        age = now.getFullYear() - birth.getFullYear();
                        if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
                      }
                    }

                    const isMemberCurrentlyReceived = fam.isReceived || !!(fam.receivedMembers?.[m.id.toString()]);

                    return (
                      <div key={m.id} className="flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={clsx(
                            "h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0",
                            m.sexo === 'Masculino' 
                              ? 'bg-blue-50 text-blue-600 border border-blue-100/50' 
                              : 'bg-pink-50 text-pink-600 border border-pink-100/50'
                          )}>
                            {m.nome.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <span className="block font-bold text-slate-800 truncate flex items-center gap-1.5 leading-tight">
                              {m.nome.split(' ')[0]} {m.nome.split(' ').slice(-1)[0]}
                              {isHead && (
                                <span className="text-[7px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-1 rounded font-black uppercase shrink-0">
                                  Titular
                                </span>
                              )}
                              {isSpouse && (
                                <span className="text-[7px] bg-pink-50 border border-pink-100 text-pink-600 px-1 rounded font-black uppercase shrink-0">
                                  Cônjuge
                                </span>
                              )}
                            </span>
                            <span className="block text-[8px] text-slate-400 font-semibold mt-0.5">
                              {age >= 0 ? `${age} anos` : 'Idade N/C'} • {m.sexo === 'Masculino' ? 'Masculino' : 'Feminino'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* GC Allocated */}
                          {m.grupos_caseiros ? (
                            <span className="text-[8px] font-black px-2 py-0.5 rounded-md border text-slate-700 bg-slate-50 border-slate-200/50 truncate max-w-[80px] shrink-0">
                              {m.grupos_caseiros}
                            </span>
                          ) : (
                            <span className="text-[8px] text-slate-400 bg-slate-50/50 border border-slate-100 px-2 py-0.5 rounded-md shrink-0 font-bold">
                              Sem GC
                            </span>
                          )}

                          {/* Individual Received Toggle Button */}
                          <button
                            onClick={() => toggleMemberReceived(fam.headId, m.id.toString(), fam.familyMembers)}
                            title={isMemberCurrentlyReceived ? "Remover marcação de recebido individual" : "Marcar como recebido individualmente"}
                            className={clsx(
                              "h-6 px-2 rounded-lg border text-[9px] font-black flex items-center gap-1 transition-all duration-200 cursor-pointer active:scale-95",
                              isMemberCurrentlyReceived
                                ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600 shadow-sm"
                                : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200"
                            )}
                          >
                            <Home className={clsx("w-3 h-3", isMemberCurrentlyReceived ? "fill-white text-white" : "")} />
                            <span>{isMemberCurrentlyReceived ? "Recebido" : "Receber"}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Pastoring Notes Box */}
                  <div className="pt-2">
                    {isNotesEditorOpen ? (
                      <div className="space-y-2 animate-in slide-in-from-top-2 duration-200 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <textarea
                          placeholder="Digite anotações pastorais (ex: pedidos de oração, data da visita, preferências...)"
                          value={tempNotesText}
                          onChange={e => setTempNotesText(e.target.value)}
                          className="w-full text-xs border-slate-200 rounded-xl focus:ring-teal-500 focus:border-teal-500 bg-white p-2 h-20 resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setActiveNotesFamilyId(null)}
                            className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => saveNotes(fam.headId)}
                            className="px-3 py-1 bg-teal-600 text-white rounded-lg text-[10px] font-black hover:bg-teal-700 cursor-pointer flex items-center gap-1 shadow-sm"
                          >
                            <Send className="w-2.5 h-2.5" /> Salvar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="group/notes relative bg-slate-50/50 hover:bg-slate-50/80 border border-slate-100 rounded-2xl p-3 text-xs transition-all">
                        {fam.notes ? (
                          <div className="space-y-1">
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Anotações Pastorais</span>
                            <p className="text-slate-600 text-[11px] leading-relaxed italic pr-6 break-words">
                              "{fam.notes}"
                            </p>
                            <button
                              onClick={() => openNotesEditor(fam.headId)}
                              className="absolute top-3 right-3 text-teal-600 hover:text-teal-800 font-bold text-[9px] cursor-pointer"
                            >
                              Editar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openNotesEditor(fam.headId)}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-teal-600 hover:border-teal-300 hover:bg-teal-50/20 text-[10px] font-bold transition-all cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Adicionar Anotações Pastorais
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tactile Visitation Action Buttons */}
                <div className="px-5 pb-5 grid grid-cols-2 gap-3">
                  {/* Visitei Button */}
                  <button
                    onClick={() => saveRecord(fam.headId, { visited: !fam.isVisited, visitedAt: !fam.isVisited ? new Date().toISOString().split('T')[0] : null })}
                    className={clsx(
                      "py-2.5 px-3 rounded-2xl text-[10px] font-black flex items-center justify-center gap-1.5 border transition-all duration-300 cursor-pointer shadow-sm active:scale-95",
                      fam.isVisited
                        ? "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600 shadow-emerald-500/10"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    )}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    {fam.isVisited ? "Visitei!" : "Visitei"}
                  </button>

                  {/* Recebi Button */}
                  <button
                    onClick={() => {
                      const willBeReceived = !fam.isReceived;
                      const nextReceivedMembers: Record<string, boolean> = {};
                      if (willBeReceived) {
                        fam.familyMembers.forEach((m: Member) => {
                          nextReceivedMembers[m.id.toString()] = true;
                        });
                      }
                      saveRecord(fam.headId, {
                        received: willBeReceived,
                        receivedAt: willBeReceived ? new Date().toISOString().split('T')[0] : null,
                        receivedMembers: nextReceivedMembers
                      });
                    }}
                    className={clsx(
                      "py-2.5 px-3 rounded-2xl text-[10px] font-black flex items-center justify-center gap-1.5 border transition-all duration-300 cursor-pointer shadow-sm active:scale-95",
                      fam.isReceived
                        ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600 shadow-amber-500/10"
                        : fam.hasIndividualReceived
                        ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:border-amber-300 shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    )}
                  >
                    <Home className="w-3.5 h-3.5 shrink-0" />
                    {fam.isReceived ? "Recebi Todos!" : fam.hasIndividualReceived ? "Recebi (Parcial)" : "Recebi em Casa"}
                  </button>
                </div>

                {/* Card Footer Details */}
                <div className="p-4 bg-slate-50/70 border-t border-slate-100/50 flex items-center justify-between text-[10px] text-slate-500">
                  <div className="min-w-0 pr-3 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate font-semibold text-slate-600">{fam.address}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Call shortcut */}
                    {fam.contact && (
                      <a 
                        href={`tel:${phoneClean}`}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                        title={`Ligar para ${fam.headName}`}
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                    )}
                    {/* WhatsApp Shortcut */}
                    {waLink && (
                      <a 
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-teal-600 hover:text-teal-800 font-black"
                        title="Enviar mensagem no WhatsApp"
                      >
                        <Send className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-semibold text-sm">Nenhum lar atende aos filtros de visita.</p>
            <p className="text-slate-400 text-xs mt-1">Tente ajustar a busca ou o seletor de status.</p>
          </div>
        )}
      </section>
    </div>
  );
};
