import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '../lib/supabase';
import { Home, Users, Navigation, Search, Filter, X, ClipboardList } from 'lucide-react';
import { differenceInYears, parseISO } from 'date-fns';

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
      
      let celQuery = supabase.from('celulas').select('id, grupo_caseiro, latitude, longitude, lider, setor');
      let membQuery = supabase.from('membros').select(`
        id, nome, latitude, longitude, grupos_caseiros, estado_civil, sexo, nascimento, tipo_de_pessoa,
        logradouro, bairro, cidade, estado
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

      let membros = fullMembros;

      if (mError) {
        console.error('Erro ao buscar membros com endereços:', mError.message);
        let fallbackQuery = supabase.from('membros').select('id, nome, latitude, longitude, grupos_caseiros, estado_civil, sexo, nascimento, tipo_de_pessoa').eq('status', 'Ativo');
        if (user?.assigned_gc) {
          fallbackQuery = fallbackQuery.ilike('grupos_caseiros', `%${user.assigned_gc}%`);
        }
        const { data: fallbackMembros } = await fallbackQuery;
        membros = fallbackMembros;
      }

      // 3. Buscar Discipulado
      const { data: discipulados, error: dError } = await supabase
        .from('discipulado')
        .select('discipulador, discipulo');

      if (dError) console.warn('Discipulado não disponível:', dError.message);

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
              setor: m.grupos_caseiros ? setorPorGrupo[m.grupos_caseiros] : undefined,
              distanciaAteGrupo: distGrupo || undefined,
              distanciaAteDiscipulador: distDisc || undefined,
              coordsGrupo: coordsGrupo || undefined,
              coordsDiscipulador: coordsDisc || undefined,
              discipuladorNome: discNome,
              enderecoCompleto: endereco
            }
          };
        }),
        ...geoGrupos.map(g => ({
          id: g.id,
          nome: g.grupo_caseiro,
          latitude: g.latitude,
          longitude: g.longitude,
          tipo: 'grupo' as const,
          metadata: { lider: g.lider, setor: g.setor }
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
  }, [allLocations, filters]);

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
          <button onClick={clearFilters} className="text-red-500 text-sm font-medium hover:text-red-600 flex items-center gap-1">
            <X className="h-4 w-4" /> Limpar
          </button>
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
              icon={loc.tipo === 'grupo' ? cellIcon : (filters.discipulador !== 'Todos' && loc.nome === filters.discipulador ? discipuladorIcon : memberIcon)}
              draggable={editingId === loc.id}
              eventHandlers={{
                click: () => setSelectedLocation(loc),
                dragend: (e) => handleMarkerDragEnd(loc.id, e.target.getLatLng()),
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
                      <p><strong>Grupo:</strong> {loc.metadata.grupo || 'Nenhum'}</p>
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
                        <div className="text-[10px] text-gray-400">{m.metadata.setor}</div>
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
