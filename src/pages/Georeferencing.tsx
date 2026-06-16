import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabaseReader, supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Home, Users, Navigation, Search, Filter, X, ClipboardList } from 'lucide-react';
import { differenceInYears, parseISO } from 'date-fns';
import clsx from 'clsx';

// Fix para ícones do Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const cellIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const memberIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const leaderIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const auxiliarIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const discipuladorIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});


interface LocationData {
  id: string;
  nome: string;
  latitude: number;
  longitude: number;
  tipo: 'membro' | 'grupo';
  metadata: {
    setor?: string;
    setor_eclesiastico?: string;
    grupo?: string;
    genero?: string;
    faixaEtaria?: number;
    vinculo?: string;
    lider?: string;
    status?: string;
    distanciaAteGrupo?: string;
    distanciaAteDiscipulador?: string;
    coordsGrupo?: [number, number];
    coordsDiscipulador?: [number, number];
    discipuladorNome?: string;
    enderecoCompleto?: string;
    isLider?: boolean;
    isAuxiliar?: boolean;
    isDiscipulador?: boolean;
  };
}

// Função de Haversine para distância
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c;
  return d.toFixed(2);
};

const Georeferencing: React.FC = () => {
  const { user } = useAuth();
  const [allLocations, setAllLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  
  const [filters, setFilters] = useState({
    nome: '',
    tipoVinculo: 'Todos',
    faixaEtaria: 'Todas',
    sexo: 'Todos',
    setor: 'Todos',
    grupoCaseiro: 'Todos',
    discipulador: 'Todos',
    distanciaMinima: 0
  });

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isRolesOpen, setIsRolesOpen] = useState(false);
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const rolesDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rolesDropdownRef.current && !rolesDropdownRef.current.contains(event.target as Node)) {
        setIsRolesOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [options, setOptions] = useState({
    setores: [] as string[],
    grupos: [] as string[],
    discipuladores: [] as string[],
    vinculos: [] as string[]
  });

  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [user?.assigned_gc]);

  const handleMarkerDragEnd = async (id: string, latLng: L.LatLng) => {
    try {
      const { error } = await supabase
        .from('membros')
        .update({ latitude: latLng.lat, longitude: latLng.lng })
        .eq('id', id);

      if (error) throw error;

      setAllLocations(prev => prev.map(loc => 
        loc.id === id ? { ...loc, latitude: latLng.lat, longitude: latLng.lng } : loc
      ));
      
      console.log('Posição atualizada no banco:', latLng);
    } catch (err: any) {
      console.error('Erro ao salvar nova posição:', err.message);
      alert('Erro ao salvar a nova localização. Tente novamente.');
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      let celQuery = supabaseReader.from('celulas').select('id, grupo_caseiro, latitude, longitude, lider, setor');
      let membQuery = supabaseReader.from('membros').select(`
        id, nome, latitude, longitude, grupos_caseiros, estado_civil, sexo, nascimento, tipo_de_pessoa,
        logradouro, bairro, cidade, estado, setor_eclesiastico, setor_residencial
      `).eq('status', 'Ativo');

      if (user?.assigned_gc) {
        celQuery = celQuery.ilike('grupo_caseiro', `%${user.assigned_gc}%`);
        membQuery = membQuery.ilike('grupos_caseiros', `%${user.assigned_gc}%`);
      }

      const [{ data: grupos, error: gError }, { data: fullMembros, error: mError }] = await Promise.all([
        celQuery,
        membQuery
      ]);

      if (gError) console.error('Erro ao buscar grupos:', gError.message);

      const filterMembrosByAllowedTypes = (list: any[]) => {
        return list.filter(m => {
          const t = (m.tipo_de_pessoa || '').trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return ['MEMBRO', 'LIDER', 'DISCIPULADOR', 'DIACONO', 'PASTOR', 'PRESBITERO'].includes(t);
        });
      };

      let membros: any[] = [];

      if (!mError && fullMembros) {
        membros = filterMembrosByAllowedTypes(fullMembros);
      } else {
        if (mError) console.error('Erro ao buscar membros com endereços:', mError.message);
        let fallbackQuery = supabaseReader.from('membros').select('id, nome, latitude, longitude, grupos_caseiros, estado_civil, sexo, nascimento, tipo_de_pessoa').eq('status', 'Ativo');
        if (user?.assigned_gc) {
          fallbackQuery = fallbackQuery.ilike('grupos_caseiros', `%${user.assigned_gc}%`);
        }
        const { data: fallbackMembros } = await fallbackQuery;
        membros = filterMembrosByAllowedTypes(fallbackMembros || []);
      }

      // 3. Buscar Discipulado
      const { data: discipulados, error: dError } = await supabaseReader
        .from('discipulado')
        .select('discipulador, discipulo');

      if (dError) console.warn('Discipulado não disponível:', dError.message);

      // Fetch pessoas_funcoes.json
      let funcoes: any[] = [];
      try {
        const res = await fetch('/data/pessoas_funcoes.json');
        if (res.ok) funcoes = await res.json();
      } catch (err) {
        console.warn('Erro ao buscar pessoas_funcoes.json:', err);
      }

      // Processamento de Mapas Auxiliares
      const setorPorGrupo: Record<string, string> = {};
      const coordsPorGrupo: Record<string, [number, number]> = {};
      (grupos || []).forEach(g => {
        if (g.grupo_caseiro) {
          if (g.setor) setorPorGrupo[g.grupo_caseiro] = g.setor;
          if (g.latitude && g.longitude) coordsPorGrupo[g.grupo_caseiro] = [g.latitude, g.longitude];
        }
      });

      const discipuladorDe: Record<string, string> = {};
      (discipulados || []).forEach(d => {
        if (d.discipulo && d.discipulador) discipuladorDe[d.discipulo] = d.discipulador;
      });

      const coordsPorMembro: Record<string, [number, number]> = {};
      (membros || []).forEach(m => {
        if (m.latitude && m.longitude) coordsPorMembro[m.nome] = [m.latitude, m.longitude];
      });

      const geoMembros = (membros || []).filter(m => m.latitude && m.longitude);
      const geoGrupos = (grupos || []).filter(g => g.latitude && g.longitude);

      const getNormalizedSectorName = (dbSector: string | null | undefined): string => {
        if (!dbSector) return 'Sem Setor';
        const norm = dbSector.trim().toUpperCase();
        if (norm.includes('NORTE')) return 'Setor Norte';
        if (norm.includes('CENTRAL')) return 'Setor Central';
        if (norm.includes('AGUAS CLARAS') || norm.includes('ÁGUAS CLARAS')) return 'Setor Águas Claras';
        if (norm.includes('SUL')) return 'Setor Sul';
        return 'Sem Setor';
      };

      const lideresSet = new Set((grupos || []).map(g => g.lider?.trim().toUpperCase()).filter(Boolean));
      const auxiliaresSet = new Set((grupos || []).map(g => g.auxiliar?.trim().toUpperCase()).filter(Boolean));
      const discipuladoresSet = new Set<string>();
      if (funcoes && funcoes.length > 0) {
        funcoes.forEach((f: any) => {
          const func = (f.funcao || '').toUpperCase();
          if (func.includes('DISCIPULADOR') && f.pessoa) {
            discipuladoresSet.add(f.pessoa.trim().toUpperCase());
          }
        });
      } else {
        (discipulados || []).forEach(d => {
          if (d.discipulador) discipuladoresSet.add(d.discipulador.trim().toUpperCase());
        });
      }

      const formattedLocations: LocationData[] = [
        ...geoMembros.map(m => {
          let idade = 0;
          if (m.nascimento) {
            try {
              idade = differenceInYears(new Date(), parseISO(m.nascimento));
            } catch (e) {}
          }
          
          const coordsGrupo = m.grupos_caseiros ? coordsPorGrupo[m.grupos_caseiros] : null;
          const distGrupo = coordsGrupo ? calculateDistance(m.latitude, m.longitude, coordsGrupo[0], coordsGrupo[1]) : null;

          const discNome = discipuladorDe[m.nome];
          const coordsDisc = discNome ? coordsPorMembro[discNome] : null;
          const distDisc = coordsDisc ? calculateDistance(m.latitude, m.longitude, coordsDisc[0], coordsDisc[1]) : null;

          // Formatação de endereço usando apenas colunas confirmadas (logradouro, bairro, cidade, estado)
          const endereco = [m.logradouro, m.bairro, m.cidade, m.estado]
            .filter(Boolean)
            .join(', ') || 'Endereço não disponível';

          // Adiciona um pequeno jitter (desvio) para evitar sobreposição exata de pins no mesmo endereço
          const jitter = () => (Math.random() - 0.5) * 0.0001;
          const finalLat = m.latitude + jitter();
          const finalLng = m.longitude + jitter();

          const nameUpper = m.nome?.trim().toUpperCase();
          const isLider = lideresSet.has(nameUpper);
          const isAuxiliar = auxiliaresSet.has(nameUpper);
          const isDiscipulador = discipuladoresSet.has(nameUpper);

          return {
            id: m.id,
            nome: m.nome,
            latitude: finalLat,
            longitude: finalLng,
            tipo: 'membro' as const,
            metadata: { 
              grupo: m.grupos_caseiros, 
              status: m.estado_civil,
              genero: m.sexo,
              faixaEtaria: idade,
              vinculo: m.tipo_de_pessoa,
              setor: m.setor_residencial ? getNormalizedSectorName(m.setor_residencial) : (m.grupos_caseiros ? getNormalizedSectorName(setorPorGrupo[m.grupos_caseiros]) : 'Sem Setor'),
              setor_eclesiastico: m.setor_eclesiastico ? getNormalizedSectorName(m.setor_eclesiastico) : (m.grupos_caseiros ? getNormalizedSectorName(setorPorGrupo[m.grupos_caseiros]) : 'Sem Setor'),
              distanciaAteGrupo: distGrupo || undefined,
              distanciaAteDiscipulador: distDisc || undefined,
              coordsGrupo: coordsGrupo || undefined,
              coordsDiscipulador: coordsDisc || undefined,
              discipuladorNome: discNome,
              enderecoCompleto: endereco,
              isLider,
              isAuxiliar,
              isDiscipulador
            }
          };
        }),
        ...geoGrupos.map(g => ({
          id: g.id,
          nome: g.grupo_caseiro,
          latitude: g.latitude,
          longitude: g.longitude,
          tipo: 'grupo' as const,
          metadata: { lider: g.lider, setor: getNormalizedSectorName(g.setor) }
        }))
      ];

      setAllLocations(formattedLocations);
      
      const setores = Array.from(new Set(formattedLocations.map(l => l.metadata.setor).filter(Boolean))) as string[];
      const gruposNomes = Array.from(new Set(formattedLocations.map(l => l.metadata.grupo || (l.tipo === 'grupo' ? l.nome : '')).filter(Boolean))) as string[];
      const vinculos = Array.from(new Set(geoMembros.map(m => m.tipo_de_pessoa).filter(Boolean))) as string[];

      setOptions({
        setores: setores.sort(),
        grupos: gruposNomes.sort(),
        discipuladores: Array.from(new Set(Object.values(discipuladorDe))).sort(),
        vinculos: vinculos.sort()
      });

    } catch (err: any) {
      console.error('Erro catastrófico no Radar:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLocations = useMemo(() => {
    const isSearchingName = filters.nome.trim().length > 0;

    const filteredMembros = allLocations.filter(loc => {
      if (loc.tipo !== 'membro') return false;
      
      // Membros que devem aparecer:
      // 1. O membro selecionado (clicado)
      if (selectedLocation?.id === loc.id) return true;

      // 2. O discipulador do membro selecionado
      if (selectedLocation?.tipo === 'membro' && selectedLocation.metadata.discipuladorNome === loc.nome) return true;

      // 3. Se estiver buscando por nome, o membro que bate com a busca OU o discipulador dele
      if (isSearchingName) {
        const matchesSearch = loc.nome.toLowerCase().includes(filters.nome.toLowerCase());
        const isDiscipuladorOfMatch = allLocations.some(m => 
          m.tipo === 'membro' && 
          m.nome.toLowerCase().includes(filters.nome.toLowerCase()) && 
          m.metadata.discipuladorNome === loc.nome
        );
        return matchesSearch || isDiscipuladorOfMatch;
      }

      if (filters.tipoVinculo !== 'Todos' && loc.metadata.vinculo !== filters.tipoVinculo) return false;
      if (filters.sexo !== 'Todos' && loc.metadata.genero !== filters.sexo) return false;
      if (filters.setor !== 'Todos' && loc.metadata.setor !== filters.setor) return false;
      if (filters.grupoCaseiro !== 'Todos' && loc.metadata.grupo !== filters.grupoCaseiro) return false;
      if (filters.discipulador !== 'Todos' && loc.metadata.discipuladorNome !== filters.discipulador) return false;
      
      // Se filtrar por discipulador, o próprio discipulador deve aparecer como pin
      if (filters.discipulador !== 'Todos' && loc.nome === filters.discipulador) return true;

      // Check role filters
      const mIsLider = loc.metadata.isLider;
      const mIsAuxiliar = loc.metadata.isAuxiliar;
      const mIsDiscipulador = loc.metadata.isDiscipulador;

      const matchRoles = selectedRoles.length === 0 || selectedRoles.some(role => {
        if (role === 'Líder') return mIsLider;
        if (role === 'Auxiliar de Liderança') return mIsAuxiliar;
        if (role === 'Discipulador') return mIsDiscipulador;
        if (role === 'Membro Comum') return !mIsLider && !mIsAuxiliar && !mIsDiscipulador;
        return false;
      });

      if (!matchRoles) return false;

      if (filters.distanciaMinima > 0) {
        const distGrupo = parseFloat(loc.metadata.distanciaAteGrupo || '0');
        const distDisc = parseFloat(loc.metadata.distanciaAteDiscipulador || '0');
        if (distGrupo < filters.distanciaMinima && distDisc < filters.distanciaMinima) return false;
      }

      if (filters.faixaEtaria !== 'Todas') {
        const idade = loc.metadata.faixaEtaria || 0;
        if (filters.faixaEtaria === '0-12' && idade > 12) return false;
        if (filters.faixaEtaria === '13-18' && (idade < 13 || idade > 18)) return false;
        if (filters.faixaEtaria === '19-30' && (idade < 19 || idade > 30)) return false;
        if (filters.faixaEtaria === '31-60' && (idade < 31 || idade > 60)) return false;
        if (filters.faixaEtaria === '60+' && idade < 60) return false;
      }
      return true;
    });

    const gruposParaMostrar = allLocations.filter(loc => {
      if (loc.tipo !== 'grupo') return false;
      
      // Se houver membro selecionado, mostra o grupo dele
      if (selectedLocation?.tipo === 'membro' && selectedLocation.metadata.grupo === loc.nome) return true;

      // Se estiver buscando por nome ou discipulador, mostra os grupos daqueles membros encontrados
      if (isSearchingName || filters.discipulador !== 'Todos') {
        return filteredMembros.some(m => m.metadata.grupo === loc.nome);
      }

      if (filters.setor !== 'Todos' && loc.metadata.setor !== filters.setor) return false;
      if (filters.grupoCaseiro !== 'Todos' && loc.nome !== filters.grupoCaseiro) return false;
      return true;
    });

    return [...filteredMembros, ...gruposParaMostrar];
  }, [allLocations, filters, selectedLocation, selectedRoles]);

  const clearFilters = () => {
    setFilters({
      nome: '',
      tipoVinculo: 'Todos',
      faixaEtaria: 'Todas',
      sexo: 'Todos',
      setor: 'Todos',
      grupoCaseiro: 'Todos',
      discipulador: 'Todos',
      distanciaMinima: 0
    });
    setSelectedRoles([]);
  };

  const tableData = useMemo(() => {
    return filteredLocations.filter(loc => loc.tipo === 'membro');
  }, [filteredLocations]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700 max-w-7xl mx-auto pb-12 px-4 sm:px-6 lg:px-8 pt-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Georreferenciamento Estratégico</h1>
          <p className="text-sm text-gray-500">Mapeamento dinâmico de células, membros e raios de pastoreio.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2 text-primary-600 font-semibold">
            <Filter className="h-5 w-5" />
            <span>Radar de Gestão</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
              className={clsx(
                "flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border transition-all cursor-pointer",
                isAdvancedFiltersOpen 
                  ? "bg-primary-50 border-primary-200 text-primary-700 shadow-sm"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              Filtros Avançados
              {(filters.tipoVinculo !== 'Todos' || filters.sexo !== 'Todos' || filters.faixaEtaria !== 'Todas' || selectedRoles.length > 0) && (
                <span className="ml-1 px-1.5 py-0.2 bg-primary-600 text-white rounded-full text-[9px] font-black animate-pulse">
                  !
                </span>
              )}
            </button>
            <button onClick={clearFilters} className="text-red-500 text-sm font-medium hover:text-red-600 flex items-center gap-1 cursor-pointer">
              <X className="h-4 w-4" /> Limpar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Buscar Membro</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Nome..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                value={filters.nome}
                onChange={(e) => setFilters({...filters, nome: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Setor</label>
            <select
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none appearance-none"
              value={filters.setor}
              onChange={(e) => setFilters({...filters, setor: e.target.value})}
            >
              <option>Todos</option>
              {options.setores.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Grupo</label>
            <select
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none appearance-none"
              value={filters.grupoCaseiro}
              onChange={(e) => setFilters({...filters, grupoCaseiro: e.target.value})}
            >
              <option>Todos</option>
              {options.grupos.map(g => <option key={g}>{g}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Discipulador</label>
            <select
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none appearance-none font-medium text-emerald-700"
              value={filters.discipulador}
              onChange={(e) => setFilters({...filters, discipulador: e.target.value})}
            >
              <option value="Todos">Todos</option>
              {options.discipuladores.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>

          <div className="space-y-2 lg:col-span-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex justify-between">
              <span>Distância Mínima (Zona Crítica)</span>
              <span className="text-primary-600">{filters.distanciaMinima} km</span>
            </label>
            <input 
              type="range" 
              min="0" 
              max="50" 
              step="1"
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              value={filters.distanciaMinima}
              onChange={(e) => setFilters({...filters, distanciaMinima: parseInt(e.target.value)})}
            />
          </div>
        </div>

        {/* Collapsible Advanced Filters Section */}
        {isAdvancedFiltersOpen && (
          <div className="pt-4 border-t border-gray-100 flex flex-wrap gap-4 items-end animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Sexo */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Sexo</label>
              <select
                className="text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50/50 px-3 py-2 text-gray-700 min-w-[130px]"
                value={filters.sexo}
                onChange={(e) => setFilters({...filters, sexo: e.target.value})}
              >
                <option value="Todos">Todos os Sexos</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
              </select>
            </div>

            {/* Faixa Etária */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Faixa Etária</label>
              <select
                className="text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50/50 px-3 py-2 text-gray-700 min-w-[150px]"
                value={filters.faixaEtaria}
                onChange={(e) => setFilters({...filters, faixaEtaria: e.target.value})}
              >
                <option value="Todas">Todas as Idades</option>
                <option value="0-12">Crianças (0-12)</option>
                <option value="13-18">Adolescentes (13-18)</option>
                <option value="19-30">Jovens (19-30)</option>
                <option value="31-60">Adultos (31-60)</option>
                <option value="60+">Idosos (60+)</option>
              </select>
            </div>

            {/* Tipo de Vínculo */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Tipo de Vínculo</label>
              <select
                className="text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-gray-50/50 px-3 py-2 text-gray-700 min-w-[150px]"
                value={filters.tipoVinculo}
                onChange={(e) => setFilters({...filters, tipoVinculo: e.target.value})}
              >
                <option value="Todos">Todos os Vínculos</option>
                {options.vinculos.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>

            {/* Checkbox Multiselect Dropdown for Roles */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Função / Cargo</label>
              <div className="relative" ref={rolesDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsRolesOpen(!isRolesOpen)}
                  className="flex items-center justify-between gap-2 text-sm border border-gray-200 rounded-lg focus:ring-primary-500 focus:border-primary-500 bg-gray-50/50 px-3 py-2 text-gray-700 hover:bg-gray-150 transition-colors cursor-pointer min-w-[180px]"
                >
                  <span>{selectedRoles.length === 0 ? 'Todas as Funções' : `${selectedRoles.length} Função(ões)`}</span>
                  <span className="text-xs text-gray-400">▼</span>
                </button>

                {isRolesOpen && (
                  <div className="absolute left-0 mt-2 w-64 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                      <span className="text-[10px] font-bold text-gray-400 uppercase font-sans">Funções</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedRoles([])}
                          className="text-[10px] text-red-500 hover:underline font-bold"
                        >
                          Limpar
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedRoles(['Líder', 'Auxiliar de Liderança', 'Discipulador', 'Membro Comum'])}
                          className="text-[10px] text-primary-600 hover:underline font-bold"
                        >
                          Todas
                        </button>
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2 py-1 pr-1 scrollbar-thin">
                      {['Líder', 'Auxiliar de Liderança', 'Discipulador', 'Membro Comum'].map(role => (
                        <label key={role} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={selectedRoles.includes(role)}
                            onChange={() => {
                              setSelectedRoles(prev =>
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
            </div>
          </div>
        )}
      </div>

      <div className="h-[600px] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 z-[1000] bg-white/80 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
              <p className="text-gray-600 font-medium">Sincronizando...</p>
            </div>
          </div>
        )}

        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
          <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-lg shadow-lg border border-white flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-bold text-gray-700">{tableData.length} Membros</span>
          </div>

          {/* Map Legend */}
          <div className="bg-white/90 backdrop-blur-md p-3 rounded-lg shadow-lg border border-white/60 text-[10px] space-y-1.5 font-medium text-gray-700">
            <div className="font-extrabold text-[9px] uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-1 mb-1">Legenda</div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-505 inline-block" style={{ backgroundColor: '#ef4444' }}></span>
              <span>Célula / GC</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#D4AF37' }}></span>
              <span>Líder de GC</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: '#ff9800' }}></span>
              <span>Auxiliar de Liderança</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-505 inline-block" style={{ backgroundColor: '#22c55e' }}></span>
              <span>Discipulador</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-505 inline-block" style={{ backgroundColor: '#3b82f6' }}></span>
              <span>Membro / Participante</span>
            </div>
          </div>
        </div>

        <MapContainer 
          center={[-15.7942, -47.8822]} 
          zoom={10} 
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {filteredLocations.filter(l => l.tipo === 'membro' && l.metadata.coordsGrupo).map(m => (
            <Polyline 
              key={`line-group-${m.id}`}
              positions={[[m.latitude, m.longitude], m.metadata.coordsGrupo!]}
              color={selectedLocation?.id === m.id || filters.nome || filters.distanciaMinima > 0 ? "#3b82f6" : "transparent"}
              weight={2}
              dashArray="5, 10"
              opacity={0.6}
            />
          ))}

          {filteredLocations.filter(l => l.tipo === 'membro' && l.metadata.coordsDiscipulador).map(m => (
            <Polyline 
              key={`line-disc-${m.id}`}
              positions={[[m.latitude, m.longitude], m.metadata.coordsDiscipulador!]}
              color={selectedLocation?.id === m.id || filters.nome || filters.distanciaMinima > 0 ? "#10b981" : "transparent"}
              weight={2}
              dashArray="2, 6"
              opacity={0.6}
            />
          ))}

          {filteredLocations.map((loc) => (
            <Marker 
              key={loc.id} 
              position={[loc.latitude, loc.longitude]}
              icon={
                loc.tipo === 'grupo'
                  ? cellIcon
                  : loc.metadata.isLider
                  ? leaderIcon
                  : loc.metadata.isAuxiliar
                  ? auxiliarIcon
                  : loc.metadata.isDiscipulador
                  ? discipuladorIcon
                  : memberIcon
              }
              draggable={editingId === loc.id}
              eventHandlers={{
                click: () => setSelectedLocation(loc),
                dragend: (e: any) => handleMarkerDragEnd(loc.id, e.target.getLatLng()),
              }}
            >
              <Popup>
                <div className="p-2 min-w-[220px]">
                  <div className="flex items-center justify-between mb-2 border-b pb-1">
                    <div className="flex items-center gap-2">
                      {loc.tipo === 'grupo' ? <Home className="h-4 w-4 text-red-600" /> : <Users className="h-4 w-4 text-blue-600" />}
                      <span className="font-bold text-gray-900">{loc.nome}</span>
                    </div>
                    {loc.tipo === 'membro' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(editingId === loc.id ? null : loc.id);
                        }}
                        className={`text-[10px] px-2 py-1 rounded font-bold transition-colors ${editingId === loc.id ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {editingId === loc.id ? 'SALVAR POSIÇÃO' : 'CORRIGIR LOCAL'}
                      </button>
                    )}
                  </div>
                  
                  {loc.tipo === 'membro' && (
                    <div className="space-y-2 text-sm text-gray-600">
                      {editingId === loc.id && (
                        <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-[10px] text-yellow-700 font-medium animate-pulse">
                          📍 Arraste o pin para o local correto no mapa e clique em SALVAR.
                        </div>
                      )}
                      <p><strong>Endereço:</strong> {loc.metadata.enderecoCompleto}</p>
                      <p><strong>Setor de Residência:</strong> {loc.metadata.setor}</p>
                      <p><strong>Grupo Caseiro (GC):</strong> {loc.metadata.grupo || 'Nenhum'} ({loc.metadata.setor_eclesiastico || 'Sem Setor'})</p>
                      <p><strong>Discipulador:</strong> {loc.metadata.discipuladorNome || 'Nenhum'}</p>
                      <div className="grid grid-cols-1 gap-1 mt-2">
                        {loc.metadata.distanciaAteGrupo && (
                          <div className="p-1.5 bg-blue-50 rounded text-blue-700 text-xs font-semibold flex items-center gap-1">
                            <Navigation className="h-3 w-3" />
                            <span>{loc.metadata.distanciaAteGrupo} km do grupo</span>
                          </div>
                        )}
                        {loc.metadata.distanciaAteDiscipulador && (
                          <div className="p-1.5 bg-emerald-50 rounded text-emerald-700 text-xs font-semibold flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{loc.metadata.distanciaAteDiscipulador} km do discipulador</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {loc.tipo === 'grupo' && (
                    <div className="space-y-1 text-sm text-gray-600">
                      <p><strong>Líder:</strong> {loc.metadata.lider}</p>
                      <p><strong>Setor:</strong> {loc.metadata.setor}</p>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Linhas de Conexão (Raiozinhos) */}
          {filteredLocations.filter(l => l.tipo === 'membro').map(m => {
            const isSelected = selectedLocation?.id === m.id;
            const isFilterActive = filters.discipulador !== 'Todos' && m.metadata.discipuladorNome === filters.discipulador;
            
            return (
              <React.Fragment key={`lines-${m.id}`}>
                {/* Linha para o Grupo (Sempre que selecionado) */}
                {isSelected && m.metadata.coordsGrupo && (
                  <Polyline 
                    positions={[[m.latitude, m.longitude], m.metadata.coordsGrupo]}
                    color="#2563eb"
                    dashArray="10, 10"
                    weight={2}
                    opacity={0.6}
                  />
                )}
                
                {/* Linha para o Discipulador (Selecionado OU Filtro Ativo) */}
                {(isSelected || isFilterActive) && m.metadata.coordsDiscipulador && (
                  <Polyline 
                    positions={[[m.latitude, m.longitude], m.metadata.coordsDiscipulador]}
                    color="#059669"
                    dashArray="5, 5"
                    weight={isFilterActive ? 1.5 : 2}
                    opacity={isFilterActive ? 0.4 : 0.6}
                  />
                )}
              </React.Fragment>
            );
          })}
        </MapContainer>

        {selectedLocation && (
          <div className="absolute bottom-4 left-4 z-[1000] bg-white p-5 rounded-xl shadow-2xl border border-gray-100 w-80">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-lg ${selectedLocation.tipo === 'membro' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                {selectedLocation.tipo === 'membro' ? <Users className="h-6 w-6" /> : <Home className="h-6 w-6" />}
              </div>
              <button onClick={() => setSelectedLocation(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <h3 className="font-bold text-gray-900 text-xl leading-tight">{selectedLocation.nome}</h3>
            <p className="text-sm text-gray-500 mb-4">{selectedLocation.metadata.enderecoCompleto}</p>
            <div className="space-y-3">
              {selectedLocation.tipo === 'membro' && (
                <>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-400 uppercase font-bold">Grupo / Discipulador</p>
                    <p className="text-sm font-medium text-gray-700">{selectedLocation.metadata.grupo} / {selectedLocation.metadata.discipuladorNome}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Nova Tabela de Dados */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-gray-700">
            <ClipboardList className="h-5 w-5 text-primary-600" />
            <span>Lista de Auditoria de Endereços</span>
          </div>
          <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full font-bold">
            {tableData.length} resultados
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100 text-gray-600 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-6 py-3">Membro</th>
                <th className="px-6 py-3">Bairro / Endereço</th>
                <th className="px-6 py-3">Discipulador</th>
                <th className="px-6 py-3">Grupo Caseiro</th>
                <th className="px-6 py-3 text-center">Distância (KM)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tableData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-400">Nenhum membro encontrado com os filtros atuais.</td>
                </tr>
              ) : (
                tableData.map((m) => {
                  const distGrupoNum = parseFloat(m.metadata.distanciaAteGrupo || '0');
                  const distDiscNum = parseFloat(m.metadata.distanciaAteDiscipulador || '0');
                  const bairroMembro = m.metadata.enderecoCompleto?.split(',')[1]?.trim()?.toLowerCase() || '';
                  const nomeGrupo = m.metadata.grupo?.toLowerCase() || '';
                  const bairroMismatch = nomeGrupo && !nomeGrupo.includes(bairroMembro) && bairroMembro !== '';

                  return (
                    <tr 
                      key={m.id} 
                      className={`hover:bg-primary-50/50 transition-colors cursor-pointer ${selectedLocation?.id === m.id ? 'bg-primary-50' : ''}`}
                      onClick={() => setSelectedLocation(m)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{m.nome}</div>
                        <div className="text-[10px] text-gray-400">{m.metadata.vinculo}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-1">
                          <span className={`text-xs font-bold ${bairroMismatch ? 'text-orange-600' : 'text-gray-500'}`}>
                            {bairroMembro.toUpperCase() || 'SEM BAIRRO'}
                          </span>
                          {bairroMismatch && <div className="p-0.5 bg-orange-100 rounded text-orange-600" title="Bairro diferente do nome do Grupo"><Filter className="h-3 w-3" /></div>}
                        </div>
                        <div className="text-[11px] text-gray-400 max-w-xs truncate" title={m.metadata.enderecoCompleto}>
                          {m.metadata.enderecoCompleto}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-emerald-600 font-medium text-xs">{m.metadata.discipuladorNome || '-'}</td>
                      <td className="px-6 py-4">
                        <div className="text-blue-600 font-bold text-xs">{m.metadata.grupo || '-'}</div>
                        <div className="text-[10px] text-gray-400">Res.: {m.metadata.setor} | GC: {m.metadata.setor_eclesiastico}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col gap-1 items-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${distGrupoNum > 5 ? 'bg-red-100 text-red-600' : distGrupoNum > 2 ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-500'}`}>
                            G: {m.metadata.distanciaAteGrupo}km
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${distDiscNum > 5 ? 'bg-red-100 text-red-600' : 'bg-emerald-50 text-emerald-500'}`}>
                            D: {m.metadata.distanciaAteDiscipulador}km
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Georeferencing;
