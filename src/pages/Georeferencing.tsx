import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { supabase } from '../lib/supabase';
import { Home, Users, Navigation, Info } from 'lucide-react';

// Fix para os ícones do Leaflet que costumam quebrar no React/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Ícones customizados
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
  metadata?: any;
}

const Georeferencing: React.FC = () => {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [stats, setStats] = useState({ membros: 0, celulas: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: membros, error: mError } = await supabase
        .from('membros')
        .select('id, nome, latitude, longitude, grupos_caseiros, estado_civil')
        .eq('status', 'Ativo');

      const { data: celulas, error: cError } = await supabase
        .from('celulas')
        .select('id, grupo_caseiro, latitude, longitude, lider, setor');

      if (mError) throw new Error(`Erro Membros: ${mError.message}`);
      if (cError) throw new Error(`Erro Células: ${cError.message}`);

      const geoMembros = (membros || []).filter(m => m.latitude && m.longitude);
      const geoCelulas = (celulas || []).filter(c => c.latitude && c.longitude);

      const formattedLocations: LocationData[] = [
        ...geoMembros.map(m => ({
          id: m.id,
          nome: m.nome,
          latitude: m.latitude,
          longitude: m.longitude,
          tipo: 'membro' as const,
          metadata: { grupo: m.grupos_caseiros, status: m.estado_civil }
        })),
        ...geoCelulas.map(c => ({
          id: c.id,
          nome: c.grupo_caseiro,
          latitude: c.latitude,
          longitude: c.longitude,
          tipo: 'celula' as const,
          metadata: { lider: c.lider, setor: c.setor }
        }))
      ];

      setLocations(formattedLocations);
      setStats({
        membros: geoMembros.length,
        celulas: geoCelulas.length
      });
    } catch (err: any) {
      console.error('Erro ao carregar dados geográficos:', err);
      setError(err.message || 'Erro desconhecido ao carregar o mapa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 h-[calc(100vh-180px)] flex flex-col">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Georreferenciamento</h1>
          <p className="text-gray-500">Mapeamento geográfico de membros e células</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-100 flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">{stats.membros} Membros Localizados</span>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-100 flex items-center gap-2">
            <Home className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-gray-700">{stats.celulas} Células</span>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 z-[1000] bg-white/80 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
              <p className="text-gray-600 font-medium">Carregando mapa...</p>
            </div>
          </div>
        )}

        <MapContainer 
          center={[-15.7942, -47.8822]} 
          zoom={11} 
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {locations.map((loc) => (
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
                      <p><strong>Estado Civil:</strong> {loc.metadata.status}</p>
                    </div>
                  )}

                  {loc.tipo === 'celula' && (
                    <div className="space-y-1 text-sm text-gray-600">
                      <p><strong>Líder:</strong> {loc.metadata.lider}</p>
                      <p><strong>Setor:</strong> {loc.metadata.setor}</p>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => fetchData()}
                    className="mt-3 w-full text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 py-1 rounded border transition-colors flex items-center justify-center gap-1"
                  >
                    <Info className="h-3 w-3" /> Ver Detalhes
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {selectedLocation && (
          <div className="absolute top-4 right-4 z-[1000] bg-white p-4 rounded-xl shadow-xl border border-gray-100 w-72 animate-in slide-in-from-right duration-300">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-lg ${selectedLocation.tipo === 'membro' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                {selectedLocation.tipo === 'membro' ? <Users className="h-5 w-5" /> : <Home className="h-5 w-5" />}
              </div>
              <button onClick={() => setSelectedLocation(null)} className="text-gray-400 hover:text-gray-600">×</button>
            </div>
            <h3 className="font-bold text-gray-900 text-lg">{selectedLocation.nome}</h3>
            <p className="text-sm text-gray-500 mb-4 capitalize">{selectedLocation.tipo}</p>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Navigation className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">Coordenadas: {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}</span>
              </div>
              
              {selectedLocation.tipo === 'membro' && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Análise de Proximidade</p>
                  <p className="text-sm text-gray-600 italic">Selecione uma célula para calcular a distância.</p>
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
