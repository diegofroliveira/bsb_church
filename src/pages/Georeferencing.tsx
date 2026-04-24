import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '../lib/supabase';
import { Home, Users, Navigation, Info, Search, Filter, X, ArrowRight } from 'lucide-react';
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

interface LocationData {
  id: string;
  nome: string;
  latitude: number;
  longitude: number;
  tipo: 'membro' | 'celula';
  metadata: {
    setor?: string;
    grupo?: string;
    genero?: string;
    faixaEtaria?: number;
    vinculo?: string;
    lider?: string;
    status?: string;
    distanciaAteCelula?: string;
    coordsCelula?: [number, number];
  };
}

// Função de Haversine para distância
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
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
  const [allLocations, setAllLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  
  const [filters, setFilters] = useState({
    nome: '',
    tipoVinculo: 'Todos',
    faixaEtaria: 'Todas',
    sexo: 'Todos',
    setor: 'Todos',
    grupoCaseiro: 'Todos',
    uf: 'Todos',
    discipulador: 'Todos'
  });

  const [options, setOptions] = useState({
    setores: [] as string[],
    grupos: [] as string[],
    vinculos: [] as string[]
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: membros, error: mError } = await supabase
        .from('membros')
        .select('id, nome, latitude, longitude, grupos_caseiros, estado_civil, sexo, nascimento, tipo_de_pessoa')
        .eq('status', 'Ativo');

      const { data: celulas, error: cError } = await supabase
        .from('celulas')
        .select('id, grupo_caseiro, latitude, longitude, lider, setor');

      if (mError) throw new Error(`Erro Membros: ${mError.message}`);
      if (cError) throw new Error(`Erro Células: ${cError.message}`);

      const setorPorCelula: Record<string, string> = {};
      const coordsPorCelula: Record<string, [number, number]> = {};
      (celulas || []).forEach(c => {
        if (c.grupo_caseiro) {
          if (c.setor) setorPorCelula[c.grupo_caseiro] = c.setor;
          if (c.latitude && c.longitude) coordsPorCelula[c.grupo_caseiro] = [c.latitude, c.longitude];
        }
      });

      const geoMembros = (membros || []).filter(m => m.latitude && m.longitude);
      const geoCelulas = (celulas || []).filter(c => c.latitude && c.longitude);

      const formattedLocations: LocationData[] = [
        ...geoMembros.map(m => {
          let idade = 0;
          if (m.nascimento) {
            try {
              idade = differenceInYears(new Date(), parseISO(m.nascimento));
            } catch (e) {}
          }
          
          let dist = '';
          const coordsCel = m.grupos_caseiros ? coordsPorCelula[m.grupos_caseiros] : null;
          if (coordsCel) {
            dist = calculateDistance(m.latitude, m.longitude, coordsCel[0], coordsCel[1]);
          }

          return {
            id: m.id,
            nome: m.nome,
            latitude: m.latitude,
            longitude: m.longitude,
            tipo: 'membro' as const,
            metadata: { 
              grupo: m.grupos_caseiros, 
              status: m.estado_civil,
              genero: m.sexo,
              faixaEtaria: idade,
              vinculo: m.tipo_de_pessoa,
              setor: m.grupos_caseiros ? setorPorCelula[m.grupos_caseiros] : undefined,
              distanciaAteCelula: dist,
              coordsCelula: coordsCel || undefined
            }
          };
        }),
        ...geoCelulas.map(c => ({
          id: c.id,
          nome: c.grupo_caseiro,
          latitude: c.latitude,
          longitude: c.longitude,
          tipo: 'celula' as const,
          metadata: { lider: c.lider, setor: c.setor }
        }))
      ];

      setAllLocations(formattedLocations);
      
      const setores = Array.from(new Set(formattedLocations.map(l => l.metadata.setor).filter(Boolean))) as string[];
      const grupos = Array.from(new Set(formattedLocations.map(l => l.metadata.grupo || (l.tipo === 'celula' ? l.nome : '')).filter(Boolean))) as string[];
      const vinculos = Array.from(new Set(geoMembros.map(m => m.tipo_de_pessoa).filter(Boolean))) as string[];

      setOptions({
        setores: setores.sort(),
        grupos: grupos.sort(),
        vinculos: vinculos.sort()
      });

    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  };

  const filteredLocations = useMemo(() => {
    const filteredMembros = allLocations.filter(loc => {
      if (loc.tipo !== 'membro') return false;
      if (filters.nome && !loc.nome.toLowerCase().includes(filters.nome.toLowerCase())) return false;
      if (filters.tipoVinculo !== 'Todos' && loc.metadata.vinculo !== filters.tipoVinculo) return false;
      if (filters.sexo !== 'Todos' && loc.metadata.genero !== filters.sexo) return false;
      if (filters.setor !== 'Todos' && loc.metadata.setor !== filters.setor) return false;
      if (filters.grupoCaseiro !== 'Todos' && loc.metadata.grupo !== filters.grupoCaseiro) return false;
      
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

    // Se houver filtro de nome, mostrar também as células dos membros filtrados
    const celulasParaMostrar = allLocations.filter(loc => {
      if (loc.tipo !== 'celula') return false;
      if (filters.nome) {
        return filteredMembros.some(m => m.metadata.grupo === loc.nome);
      }
      if (filters.setor !== 'Todos' && loc.metadata.setor !== filters.setor) return false;
      if (filters.grupoCaseiro !== 'Todos' && loc.nome !== filters.grupoCaseiro) return false;
      return true;
    });

    return [...filteredMembros, ...celulasParaMostrar];
  }, [allLocations, filters]);

  const clearFilters = () => {
    setFilters({
      nome: '',
      tipoVinculo: 'Todos',
      faixaEtaria: 'Todas',
      sexo: 'Todos',
      setor: 'Todos',
      grupoCaseiro: 'Todos',
      uf: 'Todos',
      discipulador: 'Todos'
    });
  };

  return (
    <div className="space-y-6 flex flex-col min-h-screen pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Georreferenciamento</h1>
          <p className="text-gray-500">Conexão visual entre membros e células</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2 text-primary-600 font-semibold">
            <Filter className="h-5 w-5" />
            <span>Painel de Filtros Avançados</span>
          </div>
          <button onClick={clearFilters} className="text-red-500 text-sm font-medium hover:text-red-600 flex items-center gap-1">
            <X className="h-4 w-4" /> Limpar Filtros
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Buscar por Nome</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Ex: João da Silva..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                value={filters.nome}
                onChange={(e) => setFilters({...filters, nome: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo / Vínculo</label>
            <select
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none appearance-none"
              value={filters.tipoVinculo}
              onChange={(e) => setFilters({...filters, tipoVinculo: e.target.value})}
            >
              <option>Todos</option>
              {options.vinculos.map(v => <option key={v}>{v}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Faixa Etária</label>
            <select
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none appearance-none"
              value={filters.faixaEtaria}
              onChange={(e) => setFilters({...filters, faixaEtaria: e.target.value})}
            >
              <option>Todas</option>
              <option value="0-12">Crianças (0-12)</option>
              <option value="13-18">Adolescentes (13-18)</option>
              <option value="19-30">Jovens (19-30)</option>
              <option value="31-60">Adultos (31-60)</option>
              <option value="60+">Idosos (60+)</option>
            </select>
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
        </div>
      </div>

      <div className="h-[600px] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 z-[1000] bg-white/80 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
              <p className="text-gray-600 font-medium">Calculando distâncias...</p>
            </div>
          </div>
        )}

        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
          <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-lg shadow-lg border border-white flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-bold text-gray-700">{filteredLocations.filter(l => l.tipo === 'membro').length} Membros</span>
          </div>
          <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-lg shadow-lg border border-white flex items-center gap-2">
            <Home className="h-4 w-4 text-red-600" />
            <span className="text-sm font-bold text-gray-700">{filteredLocations.filter(l => l.tipo === 'celula').length} Células</span>
          </div>
        </div>

        <MapContainer 
          center={[-15.7942, -47.8822]} 
          zoom={11} 
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Desenhar linhas de conexão para o membro selecionado ou quando filtrado por nome */}
          {filteredLocations.filter(l => l.tipo === 'membro' && l.metadata.coordsCelula).map(m => (
            <Polyline 
              key={`line-${m.id}`}
              positions={[[m.latitude, m.longitude], m.metadata.coordsCelula!]}
              color={selectedLocation?.id === m.id || filters.nome ? "#3b82f6" : "transparent"}
              weight={2}
              dashArray="5, 10"
              opacity={0.6}
            />
          ))}

          {filteredLocations.map((loc) => (
            <Marker 
              key={loc.id} 
              position={[loc.latitude, loc.longitude]}
              icon={loc.tipo === 'celula' ? cellIcon : memberIcon}
              eventHandlers={{
                click: () => setSelectedLocation(loc),
              }}
            >
              <Popup>
                <div className="p-2 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-2 border-b pb-1">
                    {loc.tipo === 'celula' ? <Home className="h-4 w-4 text-red-600" /> : <Users className="h-4 w-4 text-blue-600" />}
                    <span className="font-bold text-gray-900">{loc.nome}</span>
                  </div>
                  
                  {loc.tipo === 'membro' && (
                    <div className="space-y-1 text-sm text-gray-600">
                      <p><strong>Grupo:</strong> {loc.metadata.grupo || 'Nenhum'}</p>
                      {loc.metadata.distanciaAteCelula && (
                        <div className="mt-2 p-2 bg-blue-50 rounded text-blue-700 font-semibold flex items-center gap-1">
                          <Navigation className="h-3 w-3" />
                          <span>{loc.metadata.distanciaAteCelula} km da célula</span>
                        </div>
                      )}
                      <p className="text-xs mt-2 text-gray-400">Líder: {loc.metadata.lider || 'Ver na célula'}</p>
                    </div>
                  )}

                  {loc.tipo === 'celula' && (
                    <div className="space-y-1 text-sm text-gray-600">
                      <p><strong>Líder:</strong> {loc.metadata.lider}</p>
                      <p><strong>Setor:</strong> {loc.metadata.setor}</p>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {selectedLocation && (
          <div className="absolute bottom-4 left-4 z-[1000] bg-white p-5 rounded-xl shadow-2xl border border-gray-100 w-80 animate-in fade-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-lg ${selectedLocation.tipo === 'membro' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                {selectedLocation.tipo === 'membro' ? <Users className="h-6 w-6" /> : <Home className="h-6 w-6" />}
              </div>
              <button onClick={() => setSelectedLocation(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            
            <h3 className="font-bold text-gray-900 text-xl leading-tight">{selectedLocation.nome}</h3>
            <p className="text-sm text-gray-500 mb-4 capitalize">{selectedLocation.tipo}</p>
            
            <div className="space-y-4">
              {selectedLocation.tipo === 'membro' && (
                <>
                  <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <Home className="h-5 w-5 text-red-400" />
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-bold">Célula Vinculada</p>
                      <p className="text-sm font-medium text-gray-700">{selectedLocation.metadata.grupo || 'Sem grupo'}</p>
                    </div>
                  </div>
                  
                  {selectedLocation.metadata.distanciaAteCelula && (
                    <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-lg border border-blue-100">
                      <Navigation className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-xs text-blue-400 uppercase font-bold">Distância Estratégica</p>
                        <p className="text-sm font-bold text-blue-700">{selectedLocation.metadata.distanciaAteCelula} KM</p>
                      </div>
                    </div>
                  )}
                </>
              )}
              
              {selectedLocation.tipo === 'celula' && (
                <div className="flex items-center gap-3 bg-red-50 p-3 rounded-lg border border-red-100">
                  <Users className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-xs text-red-400 uppercase font-bold">Responsável</p>
                    <p className="text-sm font-bold text-red-700">{selectedLocation.metadata.lider}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Georeferencing;
