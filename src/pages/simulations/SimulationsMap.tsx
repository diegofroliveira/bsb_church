import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Home, Brain, Filter, EyeOff } from 'lucide-react';
import clsx from 'clsx';
import type { Member, Cell, DiscipleshipLink } from '../../hooks/useFamilyEngine';
import { ChangeMapView } from './ChangeMapView';
import { BairroTag } from './BairroTag';
import { 
  calculateDistance, 
  regionCoordinates, 
  getAdministrativeRegion, 
  getGCRegion 
} from '../../lib/geoUtils';

// Leaflet icon configuration
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

const disciplerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const isolatedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface SimulationsMapProps {
  activeTab: 'gc' | 'discipleship';
  draftMembers: Member[];
  draftCells: Cell[];
  draftLinks: DiscipleshipLink[];
  mapCenter: [number, number];
  mapZoom: number;
  selectedSource: string;
  selectedTarget: string;
  showPopupMembersGC: string | null;
  setShowPopupMembersGC: (gcName: string | null) => void;
  setNewCellName: (name: string) => void;
  setNewCellSector: (sector: string) => void;
  setNewCellLeader: (leader: string) => void;
  setIsCreateCellOpen: (open: boolean) => void;
  handleLinkDiscipleship: (disciple: string, discipler: string) => void;
}

export const SimulationsMap: React.FC<SimulationsMapProps> = ({
  activeTab,
  draftMembers,
  draftCells,
  draftLinks,
  mapCenter,
  mapZoom,
  selectedSource,
  selectedTarget,
  showPopupMembersGC,
  setShowPopupMembersGC,
  setNewCellName,
  setNewCellSector,
  setNewCellLeader,
  setIsCreateCellOpen,
  handleLinkDiscipleship
}) => {
  return (
    <>
      <MapContainer 
        center={mapCenter} 
        zoom={mapZoom} 
        className="h-full w-full z-10"
      >
        <ChangeMapView center={mapCenter} zoom={mapZoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* GC Mode Layers */}
        {activeTab === 'gc' && (
          <>
            {/* Draft Cell Pins (Red Markers) */}
            {draftCells.filter(c => c.latitude && c.longitude).map(c => (
              <React.Fragment key={c.id}>
                <Marker 
                  position={[c.latitude!, c.longitude!]}
                  icon={cellIcon}
                >
                  <Popup>
                    <div className="p-2 text-xs w-64 max-h-[300px] overflow-y-auto scrollbar-thin">
                      <div className="font-black text-gray-900 border-b pb-1 mb-1 flex items-center gap-1.5">
                        <Home className="w-3.5 h-3.5 text-rose-500" />
                        {c.grupo_caseiro}
                      </div>
                      <p><strong>Líder:</strong> {c.lider}</p>
                      <p><strong>Setor:</strong> {c.setor}</p>
                      <p className="text-[10px] text-indigo-500 font-bold mt-1">
                        👥 Membros Simulados: {draftMembers.filter(m => m.grupos_caseiros === c.grupo_caseiro && m.status === 'Ativo').length}
                      </p>

                      <div className="mt-2 border-t pt-2">
                        <button
                          onClick={() => {
                            setShowPopupMembersGC(showPopupMembersGC === c.grupo_caseiro ? null : c.grupo_caseiro);
                          }}
                          className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 border-0"
                        >
                          {showPopupMembersGC === c.grupo_caseiro ? '✕ Ocultar Membros' : '👥 Listar Membros & Distâncias'}
                        </button>
                      </div>

                      {showPopupMembersGC === c.grupo_caseiro && (
                        <div className="mt-2 space-y-1 max-h-36 overflow-y-auto divide-y divide-gray-50 pt-1">
                          {draftMembers
                            .filter(m => m.grupos_caseiros === c.grupo_caseiro && m.status === 'Ativo')
                            .map(m => {
                              const dist = (m.latitude && m.longitude && c.latitude && c.longitude)
                                ? calculateDistance(c.latitude, c.longitude, m.latitude, m.longitude)
                                : null;
                              
                              const distNum = dist ? parseFloat(dist) : 0;
                              const distColor = distNum > 5 
                                ? 'text-rose-600 font-black' 
                                : distNum > 3 
                                ? 'text-amber-600 font-bold' 
                                : 'text-emerald-600 font-bold';

                              return (
                                <div key={m.id} className="py-1 flex items-center justify-between text-[10px] first:pt-0">
                                  <span className="font-medium text-gray-700 truncate max-w-[140px]" title={m.nome}>
                                    {m.nome}
                                  </span>
                                  <span className={clsx("shrink-0", distColor)}>
                                    {dist ? `${dist} km` : 'Sem coord.'}
                                  </span>
                                </div>
                              );
                            })}
                          {draftMembers.filter(m => m.grupos_caseiros === c.grupo_caseiro && m.status === 'Ativo').length === 0 && (
                            <p className="text-[9px] text-gray-400 text-center py-1">Nenhum membro neste GC.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
                {showPopupMembersGC === c.grupo_caseiro && (
                  draftMembers
                    .filter(m => m.grupos_caseiros === c.grupo_caseiro && m.status === 'Ativo' && m.latitude && m.longitude)
                    .map(m => {
                      const dist = calculateDistance(c.latitude!, c.longitude!, m.latitude!, m.longitude!);
                      const distNum = dist ? parseFloat(dist) : 0;
                      const lineColor = distNum > 5 
                        ? '#ef4444' 
                        : distNum > 3 
                        ? '#d97706' 
                        : '#10b981';
                      
                      return (
                        <Polyline 
                          key={`line_${c.id}_${m.id}`}
                          positions={[[c.latitude!, c.longitude!], [m.latitude!, m.longitude!]]}
                          color={lineColor}
                          weight={2}
                          dashArray="5, 5"
                          opacity={0.85}
                        />
                      );
                    })
                )}
              </React.Fragment>
            ))}

            {/* Draft Member Pins (Blue Markers) */}
            {draftMembers.filter(m => m.latitude && m.longitude && m.status === 'Ativo').map(m => {
              const assignedCell = draftCells.find(c => c.grupo_caseiro === m.grupos_caseiros);
              const isSelected = selectedSource === m.grupos_caseiros || selectedTarget === m.grupos_caseiros;

              return (
                <React.Fragment key={m.id}>
                  <Marker 
                    position={[m.latitude!, m.longitude!]}
                    icon={memberIcon}
                  >
                    <Popup>
                      <div className="p-2 text-xs">
                        <div className="font-black text-gray-900 border-b pb-1 mb-1">
                          👤 {m.nome}
                        </div>
                        <p><strong>📍 Bairro:</strong> {m.bairro || 'Não informado'}</p>
                        <p><strong>🏠 GC Atual (Draft):</strong> {m.grupos_caseiros || 'Sem GC'}</p>
                        {m.logradouro && <p className="text-[10px] text-gray-400 mt-1 max-w-[200px]">{m.logradouro}</p>}
                      </div>
                    </Popup>
                  </Marker>

                  {/* Polyline connection to the current draft GC cell if selected */}
                  {isSelected && assignedCell && assignedCell.latitude && assignedCell.longitude && (
                    <Polyline 
                      positions={[[m.latitude!, m.longitude!], [assignedCell.latitude!, assignedCell.longitude!]]}
                      color="#3b82f6"
                      weight={1.5}
                      dashArray="5, 5"
                      opacity={0.7}
                    />
                  )}
                </React.Fragment>
              );
            })}

            {/* Territorial Opportunity Heatmap (Pulsing Circles) */}
            {Object.entries(regionCoordinates).map(([region, coords]) => {
              const localMembersCount = draftMembers.filter(m => getAdministrativeRegion(m.bairro || '') === region && m.status === 'Ativo').length;
              const localCellsCount = draftCells.filter(c => getGCRegion(c.grupo_caseiro) === region).length;
              const isOpportunity = localMembersCount >= 10 && localCellsCount === 0;

              if (!isOpportunity) return null;

              return (
                <Circle
                  key={`opp_${region}`}
                  center={coords}
                  radius={450}
                  pathOptions={{ 
                    fillColor: '#8b5cf6', 
                    color: '#7c3aed', 
                    weight: 2, 
                    fillOpacity: 0.25,
                    dashArray: '3, 6'
                  }}
                >
                  <Popup>
                    <div className="p-2 text-xs space-y-1.5 max-w-[220px]">
                      <div className="font-black text-indigo-900 border-b border-indigo-100 pb-1 flex items-center gap-1.5">
                        <Brain className="w-4 h-4 text-indigo-600 animate-pulse" />
                        Oportunidade de Plantação!
                      </div>
                      <p className="text-[11px] text-gray-600">
                        Encontramos <strong>{localMembersCount} membros</strong> residentes em <strong>{region}</strong> que estão sem GC local assistindo eles!
                      </p>
                      <button
                        onClick={() => {
                          setNewCellName(`BSB ${region}`);
                          setNewCellSector('SETOR SIMULADO');
                          setNewCellLeader('');
                          setIsCreateCellOpen(true);
                        }}
                        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg transition-colors cursor-pointer text-center text-[10px] flex items-center justify-center gap-1 border-0"
                      >
                        ⚡ Plantar GC em {region}
                      </button>
                    </div>
                  </Popup>
                </Circle>
              );
            })}
          </>
        )}

        {/* Discipleship Mode Layers */}
        {activeTab === 'discipleship' && (
          <>
            {/* Discipleship Member Pins */}
            {draftMembers.filter(m => m.latitude && m.longitude && m.status === 'Ativo').map(m => {
              const disciplersSet = new Set(draftLinks.map(l => l.discipulador));
              const disciplesSet = new Set(draftLinks.map(l => l.discipulo));
              const isDiscipler = disciplersSet.has(m.nome);
              const isIsolated = !disciplesSet.has(m.nome);
              const icon = isIsolated ? isolatedIcon : (isDiscipler ? disciplerIcon : memberIcon);

              const memberRA = getAdministrativeRegion(m.bairro || '');
              
              // Generate recommendations
              const activeMembersByName = new Map<string, any>();
              draftMembers.forEach(otherM => {
                if (otherM.status === 'Ativo') {
                  activeMembersByName.set(otherM.nome, otherM);
                }
              });
              
              const disciplesCountByDiscipler: Record<string, string[]> = {};
              draftLinks.forEach(link => {
                const dName = link.discipulador;
                if (!disciplesCountByDiscipler[dName]) {
                  disciplesCountByDiscipler[dName] = [];
                }
                disciplesCountByDiscipler[dName].push(link.discipulo);
              });

              const recommendations: { name: string; count: number; distance: number | null }[] = [];
              if (isIsolated) {
                activeMembersByName.forEach((otherMem, otherName) => {
                  if (otherName === m.nome) return;
                  const currentDisciplesCount = disciplesCountByDiscipler[otherName]?.length || 0;
                  if (currentDisciplesCount >= 5) return;

                  const otherRA = getAdministrativeRegion(otherMem.bairro);
                  if (otherRA === memberRA && memberRA !== 'NÃO INFORMADO') {
                    let distNum: number | null = null;
                    if (m.latitude && m.longitude && otherMem.latitude && otherMem.longitude) {
                      const distStr = calculateDistance(otherMem.latitude, otherMem.longitude, m.latitude!, m.longitude!);
                      distNum = distStr ? parseFloat(distStr) : null;
                    }
                    recommendations.push({
                      name: otherName,
                      count: currentDisciplesCount,
                      distance: distNum
                    });
                  }
                });

                recommendations.sort((a, b) => {
                  if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
                  if (a.distance !== null) return -1;
                  if (b.distance !== null) return 1;
                  return b.count - a.count;
                });
              }

              const topRecommendations = recommendations.slice(0, 3);

              return (
                <Marker 
                  key={m.id}
                  position={[m.latitude!, m.longitude!]}
                  icon={icon}
                >
                  <Popup>
                    <div className="p-2 text-xs w-64 max-h-[300px] overflow-y-auto scrollbar-thin">
                      <div className="font-black text-gray-900 border-b pb-1 mb-1">
                        {isIsolated ? '🟠 Membro Isolado' : (isDiscipler ? '🟢 Discipulador' : '🔵 Discípulo')}
                      </div>
                      <div className="font-bold text-gray-800 text-[13px]">{m.nome}</div>
                      <p className="mt-1"><strong>📍 RA/Bairro:</strong> {memberRA} / {m.bairro || 'Não informado'}</p>
                      
                      {!isIsolated ? (
                        <p className="mt-1 text-indigo-600 font-bold">
                          🤝 Discipulador: {draftLinks.find(l => l.discipulo === m.nome)?.discipulador}
                        </p>
                      ) : (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <span className="text-[10px] font-bold text-rose-500 block mb-1">💡 Recomendações de Discipulador (Na mesma RA):</span>
                          {topRecommendations.length > 0 ? (
                            <div className="space-y-1.5 mt-1">
                              {topRecommendations.map(rec => (
                                <div key={rec.name} className="flex items-center justify-between bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                                  <div className="text-[10px] text-gray-700 truncate max-w-[120px]" title={rec.name}>
                                    <div className="font-bold truncate">{rec.name}</div>
                                    <div className="text-[8px] text-gray-400 font-semibold">({rec.count}/5 discípulos)</div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {rec.distance !== null && <span className="text-[9px] text-gray-500 font-bold">{rec.distance} km</span>}
                                    <button
                                      onClick={() => handleLinkDiscipleship(m.nome, rec.name)}
                                      className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black rounded flex items-center gap-0.5 shadow-sm cursor-pointer border-0"
                                    >
                                      ⚡ Vincular
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[9px] text-gray-400 font-semibold italic">Nenhum discipulador disponível na mesma RA.</p>
                          )}
                        </div>
                      )}

                      {isDiscipler && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <span className="text-[10px] font-bold text-emerald-600 block mb-1">👥 Discípulos ({disciplesCountByDiscipler[m.nome]?.length || 0}):</span>
                          <div className="max-h-24 overflow-y-auto space-y-0.5">
                            {(disciplesCountByDiscipler[m.nome] || []).map(d => (
                              <div key={d} className="text-[10px] text-gray-600 font-medium py-0.5 border-b border-gray-50 last:border-0 truncate">
                                • {d}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Discipleship Connections (Polylines) */}
            {draftLinks.map((link, idx) => {
              const disciple = draftMembers.find(m => m.nome === link.discipulo && m.status === 'Ativo');
              const discipler = draftMembers.find(m => m.nome === link.discipulador && m.status === 'Ativo');
              if (!disciple || !discipler || !disciple.latitude || !disciple.longitude || !discipler.latitude || !discipler.longitude) return null;

              const distStr = calculateDistance(discipler.latitude, discipler.longitude, disciple.latitude, disciple.longitude);
              const distNum = distStr ? parseFloat(distStr) : 0;
              const isDistant = distNum > 15;
              const color = isDistant ? '#ef4444' : '#6366f1';
              
              return (
                <Polyline
                  key={`link_${idx}`}
                  positions={[[disciple.latitude!, disciple.longitude!], [discipler.latitude!, discipler.longitude!]]}
                  color={color}
                  weight={2.5}
                  dashArray={isDistant ? "5, 5" : undefined}
                  opacity={0.8}
                >
                  <Popup>
                    <div className="p-1.5 text-xs">
                      <div className="font-bold text-gray-800">Vínculo de Discipulado</div>
                      <div className="mt-1 text-gray-600">
                        <strong>Líder:</strong> {link.discipulador}<br />
                        <strong>Discípulo:</strong> {link.discipulo}
                      </div>
                      <div className={clsx("mt-1.5 font-extrabold text-[10px]", isDistant ? "text-rose-600" : "text-indigo-600")}>
                        📏 Distância: {distStr} km {isDistant ? '(Alerta de Deslocamento!)' : '(Excelente)'}
                      </div>
                    </div>
                  </Popup>
                </Polyline>
              );
            })}
          </>
        )}
      </MapContainer>

      {/* Floating Map Legend overlaid on Leaflet Map */}
      <div className="absolute bottom-4 left-4 z-[999] bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl p-4 shadow-xl max-w-[240px] text-xs space-y-2.5 pointer-events-auto">
        <div className="font-bold text-gray-800 border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-indigo-500" />
          Legenda do Mapa
        </div>
        {activeTab === 'gc' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#ef4444] border border-white shadow-sm inline-block shrink-0"></span>
              <span className="text-gray-600 font-medium text-[11px]">Grupo Caseiro (Pino Vermelho)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#3b82f6] border border-white shadow-sm inline-block shrink-0"></span>
              <span className="text-gray-600 font-medium text-[11px]">Membro Ativo (Pino Azul)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-dashed border-[#7c3aed] bg-[#8b5cf6]/20 inline-block shrink-0"></span>
              <span className="text-gray-600 font-medium text-[11px]">Oportunidade (&gt;= 10 Moradores)</span>
            </div>
            <div className="border-t border-gray-100 my-1.5 pt-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              Distância ao Grupo (Linhas)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-0.5 border-t-2 border-dashed border-[#10b981] inline-block shrink-0"></span>
              <span className="text-gray-600 font-medium text-[11px]">Excelente (&lt;= 3 km)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-0.5 border-t-2 border-dashed border-[#d97706] inline-block shrink-0"></span>
              <span className="text-gray-600 font-medium text-[11px]">Intermediária (3 a 5 km)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-0.5 border-t-2 border-dashed border-[#ef4444] inline-block shrink-0"></span>
              <span className="text-gray-600 font-medium text-[11px]">Distante (&gt; 5 km)</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#10b981] border border-white shadow-sm inline-block shrink-0"></span>
              <span className="text-gray-600 font-medium text-[11px]">Discipulador (Pino Verde)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#ef4444] border border-white shadow-sm inline-block shrink-0"></span>
              <span className="text-gray-600 font-medium text-[11px]">Membro Isolado (Pino Laranja)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#3b82f6] border border-white shadow-sm inline-block shrink-0"></span>
              <span className="text-gray-600 font-medium text-[11px]">Discípulo (Pino Azul)</span>
            </div>
            <div className="border-t border-gray-100 my-1.5 pt-1.5 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              Vínculo de Discipulado (Linhas)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-0.5 bg-[#6366f1] inline-block shrink-0"></span>
              <span className="text-gray-600 font-medium text-[11px]">Vínculo Saudável (&lt;= 15 km)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-0.5 border-t-2 border-dashed border-[#ef4444] inline-block shrink-0"></span>
              <span className="text-gray-600 font-medium text-[11px]">Distante (&gt; 15 km)</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
