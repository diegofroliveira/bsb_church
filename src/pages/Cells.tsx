import React, { useEffect, useState, useMemo } from 'react';
import { supabaseReader } from '../lib/supabase';
import { Home, Users, MapPin, Search, Filter, Loader2, Shield, X, Phone, MessageSquare, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { filterOperationalCells, filterOperationalMembers } from '../lib/operationalScope';

interface CellInfo {
  id: number;
  grupo_caseiro: string;
  lider: string;
  auxiliar: string;
  setor: string;
  bairro: string;
  cidade: string;
  status: string;
  limite_de_pessoas: number;
  memberCount: number;
  avgDistance: number | null;
}

export const Cells: React.FC = () => {
  const [cells, setCells] = useState<CellInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSetor, setSelectedSetor] = useState<string>('Todos');

  const [selectedCell, setSelectedCell] = useState<CellInfo | null>(null);
  const [cellMembers, setCellMembers] = useState<any[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [activeDiscipuladores, setActiveDiscipuladores] = useState<Set<string>>(new Set());

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [celulasRes, membrosRes, discipuladoRes] = await Promise.all([
          supabaseReader.from('celulas').select('*'),
          supabaseReader.from('membros').select('grupos_caseiros, latitude, longitude').eq('status', 'Ativo'),
          supabaseReader.from('discipulado').select('discipulador')
        ]);

        const celulas = filterOperationalCells(celulasRes.data || []);
        const membros = filterOperationalMembers(membrosRes.data || []);
        const discipuladoData = discipuladoRes.data || [];

        const discNames = new Set<string>();
        discipuladoData.forEach(d => {
          if (d.discipulador) discNames.add(d.discipulador.trim().toUpperCase());
        });
        setActiveDiscipuladores(discNames);

        // Agrupar membros e coordenadas por grupo
        const groupMembers: Record<string, { lat: number, lng: number }[]> = {};
        membros.forEach(m => {
          if (!m.grupos_caseiros) return;
          const groupName = m.grupos_caseiros.trim().replace(/\s+/g, ' ').toUpperCase();
          if (!groupMembers[groupName]) groupMembers[groupName] = [];
          if (m.latitude && m.longitude) {
            groupMembers[groupName].push({ lat: m.latitude, lng: m.longitude });
          }
        });

        const mappedCells: CellInfo[] = celulas.map(c => {
          const groupNameNormalized = (c.grupo_caseiro || '').trim().replace(/\s+/g, ' ').toUpperCase();
          const membersInGroup = groupMembers[groupNameNormalized] || [];
          
          let totalDist = 0;
          let countDist = 0;

          if (c.latitude && c.longitude && membersInGroup.length > 0) {
            membersInGroup.forEach(m => {
              const dist = calculateDistance(c.latitude, c.longitude, m.lat, m.lng);
              // Ignore outliers (>100km) which are likely geocoding errors (e.g., center of Brazil)
              if (dist !== null && dist < 100) {
                totalDist += dist;
                countDist++;
              }
            });
          }

          // Combine auxiliaries and remove duplicates
          const auxiliariesJoined = Array.from(
            new Set([c.auxiliar, c.auxiliar_1, c.auxiliar_2].map(a => a?.trim()).filter(Boolean))
          ).join(', ');

          return {
            id: c.id,
            grupo_caseiro: c.grupo_caseiro,
            lider: c.lider || 'Sem líder',
            auxiliar: auxiliariesJoined,
            setor: c.setor || 'Sem Setor',
            bairro: c.bairro || 'Não informado',
            cidade: c.cidade || '',
            status: c.status || 'Desconhecido',
            limite_de_pessoas: parseFloat(c.limite_de_pessoas || '0'),
            memberCount: membersInGroup.length || 0,
            avgDistance: countDist > 0 ? totalDist / countDist : null
          };
        });

        // Ordenar por Setor e depois por nome do grupo
        mappedCells.sort((a, b) => {
          if (a.setor < b.setor) return -1;
          if (a.setor > b.setor) return 1;
          return a.grupo_caseiro.localeCompare(b.grupo_caseiro);
        });

        setCells(mappedCells);
      } catch (error) {
        console.error('Error fetching cells data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const setores = useMemo(() => {
    const s = new Set(cells.map(c => c.setor).filter(Boolean));
    return ['Todos', ...Array.from(s).sort()];
  }, [cells]);

  const filteredCells = useMemo(() => {
    return cells.filter(c => {
      const matchesSearch = c.grupo_caseiro.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            c.lider.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSetor = selectedSetor === 'Todos' || c.setor === selectedSetor;
      return matchesSearch && matchesSetor;
    });
  }, [cells, searchTerm, selectedSetor]);

  const totalMembersInCells = useMemo(() => filteredCells.reduce((acc, c) => acc + c.memberCount, 0), [filteredCells]);

  const handleCellClick = async (cell: CellInfo) => {
    setSelectedCell(cell);
    setIsMembersLoading(true);
    setMemberSearchTerm('');
    try {
      const { data, error } = await supabaseReader
        .from('membros')
        .select('id, nome, sexo, nascimento, celular_principal_sms, tipo_cadastro, tipo_de_pessoa')
        .eq('status', 'Ativo')
        .ilike('grupos_caseiros', `%${cell.grupo_caseiro}%`);

      if (error) throw error;
      setCellMembers(data || []);
    } catch (err) {
      console.error('Error fetching cell members:', err);
    } finally {
      setIsMembersLoading(false);
    }
  };

  const filteredMembers = useMemo(() => {
    if (!cellMembers) return [];
    return cellMembers.filter(m => 
      m.nome.toLowerCase().includes(memberSearchTerm.toLowerCase())
    );
  }, [cellMembers, memberSearchTerm]);

  const getMemberRole = (mName: string, cell: CellInfo): 'Líder' | 'Auxiliar' | 'Discipulador' | 'Membro' => {
    const nameUpper = mName.trim().toUpperCase();
    
    // Check leaders of this cell
    const leaders = (cell.lider || '').split(',').map(l => l.trim().toUpperCase());
    if (leaders.includes(nameUpper)) return 'Líder';

    // Check discipuladores
    if (activeDiscipuladores.has(nameUpper)) return 'Discipulador';

    // Check auxiliaries of this cell
    const auxiliaries = (cell.auxiliar || '').split(',').map(a => a.trim().toUpperCase());
    if (auxiliaries.includes(nameUpper)) return 'Auxiliar';

    return 'Membro';
  };

  const getAge = (birthDateStr: string | null | undefined): string => {
    if (!birthDateStr) return '—';
    try {
      const birthDate = new Date(birthDateStr);
      if (isNaN(birthDate.getTime())) return '—';
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const mDiff = today.getMonth() - birthDate.getMonth();
      if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return `${age} anos`;
    } catch (_) {
      return '—';
    }
  };

  const formatPhone = (phoneStr: string | null | undefined): string => {
    if (!phoneStr) return '—';
    const cleaned = phoneStr.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
    }
    return phoneStr;
  };

  const getWhatsAppLink = (phoneStr: string | null | undefined): string | null => {
    if (!phoneStr) return null;
    let cleaned = phoneStr.replace(/\D/g, '');
    if (cleaned.length === 0) return null;
    if (cleaned.length === 11 || cleaned.length === 10) {
      cleaned = '55' + cleaned;
    }
    return `https://wa.me/${cleaned}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto pb-12">
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">GCs & Localidades</h1>
          <p className="mt-2 text-sm text-gray-500 max-w-2xl">
            Acompanhe a saúde, métricas geográficas e engajamento de todos os grupos da igreja.
          </p>
        </div>
        
        {!isLoading && (
           <div className="flex gap-4">
             <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
               <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                 <Home className="text-blue-600 w-5 h-5" />
               </div>
               <div>
                 <p className="text-sm text-gray-500 font-medium">Grupos Listados</p>
                 <p className="text-xl font-bold text-gray-900">{filteredCells.length}</p>
               </div>
             </div>
             <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4 hidden sm:flex">
               <div className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center border border-green-100">
                 <Users className="text-green-600 w-5 h-5" />
               </div>
               <div>
                 <p className="text-sm text-gray-500 font-medium">Membros Ativos</p>
                 <p className="text-xl font-bold text-gray-900">{totalMembersInCells}</p>
               </div>
             </div>
           </div>
        )}
      </header>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar grupo ou líder..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
        <div className="relative min-w-[200px]">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <select
            value={selectedSetor}
            onChange={(e) => setSelectedSetor(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none appearance-none bg-white"
          >
            {setores.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="h-10 w-10 animate-spin text-primary-600 mb-4" />
          <p className="text-gray-500 font-medium">Processando métricas geográficas...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCells.map((cell) => {
            const healthColor = cell.memberCount >= (cell.limite_de_pessoas || 15) * 0.8 
              ? 'text-green-600 bg-green-50 border-green-200' 
              : cell.memberCount < 5 
                ? 'text-red-600 bg-red-50 border-red-200'
                : 'text-blue-600 bg-blue-50 border-blue-200';

            const distColor = !cell.avgDistance ? 'text-gray-400 bg-gray-50' :
                             cell.avgDistance < 10 ? 'text-blue-600 bg-blue-50 border-blue-100' :
                             cell.avgDistance < 20 ? 'text-orange-600 bg-orange-50 border-orange-100' :
                             'text-red-600 bg-red-50 border-red-100';

            return (
              <div 
                key={cell.id} 
                onClick={() => handleCellClick(cell)}
                className="bg-white rounded-xl shadow-sm border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all p-5 flex flex-col cursor-pointer"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                      <Home className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 line-clamp-1" title={cell.grupo_caseiro}>{cell.grupo_caseiro}</h3>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{cell.setor}</p>
                    </div>
                  </div>
                  <span className={clsx("px-2.5 py-1 text-xs font-bold rounded-full border", cell.status === 'Ativo' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200')}>
                    {cell.status}
                  </span>
                </div>

                <div className="space-y-3 flex-1">
                  <div className="flex items-start gap-2 text-sm">
                    <Shield className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-gray-900 font-medium">{cell.lider}</p>
                      {cell.auxiliar && <p className="text-gray-500 text-xs">Aux: {cell.auxiliar}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="line-clamp-1">{cell.bairro} {cell.cidade && `- ${cell.cidade}`}</span>
                  </div>

                  {cell.avgDistance !== null && (
                    <div className={clsx("mt-2 p-2 rounded-lg border flex items-center justify-between", distColor)}>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-bold uppercase tracking-tight">Média de Distância</span>
                      </div>
                      <span className="text-sm font-black">{cell.avgDistance.toFixed(1)} km</span>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-600">Membros:</span>
                  </div>
                  <div className={clsx("px-3 py-1 rounded-full text-sm font-bold border", healthColor)}>
                    {cell.memberCount} {cell.limite_de_pessoas > 0 && <span className="opacity-75 font-normal text-xs">/ {cell.limite_de_pessoas}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedCell && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" onClick={() => setSelectedCell(null)} />
          
          <div className="relative flex w-full max-w-4xl flex-col bg-white rounded-2xl shadow-2xl overflow-hidden m-4 animate-in zoom-in-95 duration-200 border border-gray-100 max-h-[85vh]">
            
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                  <Home className="w-5 h-5 text-primary-600 shrink-0" />
                  {selectedCell.grupo_caseiro}
                </h3>
                <p className="text-xs text-gray-500 mt-1 font-medium">
                  Setor: {selectedCell.setor} • {selectedCell.bairro}
                </p>
              </div>
              <button 
                onClick={() => setSelectedCell(null)} 
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Membros no GC</p>
                  <p className="text-xl font-extrabold text-gray-900 mt-0.5">{selectedCell.memberCount}</p>
                </div>
                <div className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Líder do GC</p>
                  <p className="text-sm font-bold text-gray-900 mt-1 truncate" title={selectedCell.lider}>{selectedCell.lider}</p>
                </div>
                <div className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Auxiliar(es)</p>
                  <p className="text-sm font-bold text-gray-900 mt-1 truncate" title={selectedCell.auxiliar || 'Nenhum'}>
                    {selectedCell.auxiliar || 'Nenhum'}
                  </p>
                </div>
                <div className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Distância Média</p>
                  <p className="text-xl font-extrabold text-gray-900 mt-0.5">
                    {selectedCell.avgDistance !== null ? `${selectedCell.avgDistance.toFixed(1)} km` : '—'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h4 className="text-base font-bold text-gray-900">Membros Vinculados</h4>
                  
                  <div className="relative max-w-xs w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Filtrar por nome..."
                      value={memberSearchTerm}
                      onChange={(e) => setMemberSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    />
                  </div>
                </div>

                {isMembersLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary-600 mb-2" />
                    <p className="text-gray-500 text-xs font-medium">Carregando membros do grupo...</p>
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
                    <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm font-medium">Nenhum membro encontrado</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200 text-left">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Nome</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Função</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Idade</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Sexo</th>
                          <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Contato</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {filteredMembers.map((m: any) => {
                          const role = getMemberRole(m.nome, selectedCell);
                          const whatsLink = getWhatsAppLink(m.celular_principal_sms);
                          
                          const roleColors = 
                            role === 'Líder' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                            role === 'Auxiliar' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                            role === 'Discipulador' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            'bg-gray-50 text-gray-600 border-gray-100';

                          return (
                            <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                                <a 
                                  href={`/membro/${encodeURIComponent(m.nome)}`}
                                  className="text-primary-600 hover:text-primary-800 hover:underline flex items-center gap-1 shrink-0"
                                >
                                  {m.nome}
                                  <ExternalLink className="w-3.5 h-3.5 opacity-55" />
                                </a>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className={clsx("px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase border", roleColors)}>
                                  {role}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                  {m.tipo_cadastro || 'MEMBRO'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-600">
                                {getAge(m.nascimento)}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className={clsx(
                                  "px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border", 
                                  m.sexo === 'Masculino' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                                  m.sexo === 'Feminino' ? 'bg-pink-50 text-pink-700 border-pink-100' : 
                                  'bg-gray-50 text-gray-600 border-gray-100'
                                )}>
                                  {m.sexo === 'Masculino' ? 'Masc' : m.sexo === 'Feminino' ? 'Fem' : '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {m.celular_principal_sms ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-700 font-medium text-xs font-mono">
                                      {formatPhone(m.celular_principal_sms)}
                                    </span>
                                    {whatsLink && (
                                      <a 
                                        href={whatsLink} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                        title="Chamar no WhatsApp"
                                      >
                                        <MessageSquare className="w-4 h-4 shrink-0" />
                                      </a>
                                    )}
                                    <a 
                                      href={`tel:${m.celular_principal_sms}`}
                                      className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                      title="Ligar"
                                    >
                                      <Phone className="w-4 h-4 shrink-0" />
                                    </a>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
