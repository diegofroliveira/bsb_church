import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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

import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { 
  Users, Home, Play, RotateCcw, Save, ArrowRight, ArrowLeft,
  Search, ShieldAlert, CheckCircle2, Download, Filter,
  BookOpen, Network, TrendingUp, AlertTriangle, Brain, MapPin,
  ChevronDown, ChevronUp, UserCheck, Eye, Heart, Plus, X, PlusCircle, Zap, Lightbulb
} from 'lucide-react';
import clsx from 'clsx';
import { 
  calculateDistance, 
  regionCoordinates, 
  calculateAge, 
  normalizeName, 
  normalizePhone, 
  normalizeAddress, 
  getAdministrativeRegion, 
  getGCRegion,
  getFallbackRegion
} from '../lib/geoUtils';
import { useFamilyEngine } from '../hooks/useFamilyEngine';
import type { Member, Cell, DiscipleshipLink, Family } from '../hooks/useFamilyEngine';

// Componente auxiliar para alterar dinamicamente o centro e zoom do mapa Leaflet
const ChangeMapView: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

const renderBairroTag = (m: Member, activeCell: Cell | undefined, allCells?: Cell[]) => {
  if (!m.bairro) return null;
  const mRegion = getAdministrativeRegion(m.bairro);
  const cellRegion = activeCell ? getGCRegion(activeCell.grupo_caseiro) : '';
  
  if (!cellRegion) return (
    <span className="text-[9px] text-indigo-500 bg-indigo-50/50 font-bold block mt-0.5">
      📍 {m.bairro}
    </span>
  );

  const hasLocalGC = allCells ? allCells.some(c => getGCRegion(c.grupo_caseiro) === mRegion) : true;
  const fallbackRegion = getFallbackRegion(mRegion);
  const isCorrect = (mRegion === cellRegion) || 
                    (cellRegion === 'GUARÁ-NB' && (mRegion === 'GUARÁ' || mRegion === 'NÚCLEO BANDEIRANTE')) ||
                    (!hasLocalGC && cellRegion === fallbackRegion);
  
  return (
    <span 
      className={clsx(
        "text-[9px] font-bold block mt-0.5 w-fit px-1 rounded transition-all",
        !isCorrect 
          ? "text-rose-600 bg-rose-50 border border-rose-100 animate-pulse font-extrabold" 
          : "text-indigo-500 bg-indigo-50/50"
      )} 
      title={!isCorrect ? `${m.bairro} (Fora do Setor do GC: ${cellRegion})` : m.bairro + (m.logradouro ? ` - ${m.logradouro}` : '')}
    >
      📍 {m.bairro} {!isCorrect && "⚠️ Fora do Setor"}
    </span>
  );
};


export const Simulations: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'gc' | 'discipleship'>('gc');
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Sandbox Data (Drafts)
  const [draftMembers, setDraftMembers] = useState<Member[]>([]);
  const [draftCells, setDraftCells] = useState<Cell[]>([]);
  const [draftLinks, setDraftLinks] = useState<DiscipleshipLink[]>([]);
  
  // Baseline (to compare)
  const [baselineMembers, setBaselineMembers] = useState<Member[]>([]);
  
  // Selection State
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedTargetMembers, setSelectedTargetMembers] = useState<string[]>([]);

  // Map Navigation and Highlight States
  const [mapCenter, setMapCenter] = useState<[number, number]>([-15.82, -47.95]);
  const [mapZoom, setMapZoom] = useState<number>(11);
  const [showPopupMembersGC, setShowPopupMembersGC] = useState<string | null>(null);

  const handleLocalizeGC = (cellName: string) => {
    const cell = draftCells.find(c => c.grupo_caseiro === cellName);
    if (cell && cell.latitude && cell.longitude) {
      setIsMapExpanded(true);
      setMapCenter([cell.latitude, cell.longitude]);
      setMapZoom(14);
      setTimeout(() => {
        document.getElementById('radar-sandbox-container')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const handleLocalizeMember = (memberId: string) => {
    const member = draftMembers.find(m => m.id === memberId);
    if (member && member.latitude && member.longitude) {
      setIsMapExpanded(true);
      setMapCenter([member.latitude, member.longitude]);
      setMapZoom(15);
      setTimeout(() => {
        document.getElementById('radar-sandbox-container')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };
  
  // Selection Mode: individual vs family
  const [moveMode, setMoveMode] = useState<'individual' | 'family'>('family');
  
  // Search state for panels
  const [sourceSearch, setSourceSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');

  // Expandable UI for families
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});

  // Expandable UI for territorial insights residents
  const [expandedInsightIndex, setExpandedInsightIndex] = useState<number | null>(null);

  // States for creating a custom draft cell
  const [isCreateCellOpen, setIsCreateCellOpen] = useState(false);
  // Auditoria collapsible states (Auditoria de Alocação)
  const [isAuditMismatchesExpanded, setIsAuditMismatchesExpanded] = useState(true);
  const [isAuditOvercrowdedExpanded, setIsAuditOvercrowdedExpanded] = useState(false);
  const [isAuditCriticalExpanded, setIsAuditCriticalExpanded] = useState(false);
  const [isAuditSuggestionsExpanded, setIsAuditSuggestionsExpanded] = useState(true);
  // Modal hybrid custom states
  const [isCustomLeader, setIsCustomLeader] = useState(false);
  const [isCustomSector, setIsCustomSector] = useState(false);


  const [newCellName, setNewCellName] = useState('');
  const [newCellLeader, setNewCellLeader] = useState('');
  const [newCellSector, setNewCellSector] = useState('');

  const loadBaseline = async () => {
    setIsLoading(true);
    try {
      const [membersRes, cellsRes, discRes] = await Promise.all([
        supabase.from('membros').select('id, nome, grupos_caseiros, status, sexo, bairro, pai, mae, logradouro, celular_principal_sms, telefone_fixo, estado_civil, nascimento, latitude, longitude'),
        supabase.from('celulas').select('id, grupo_caseiro, lider, setor, latitude, longitude'),
        supabase.from('discipulado').select('discipulador, discipulo')
      ]);

      if (membersRes.data) {
        // cast strictly to ensure type safety
        const parsedMembers = (membersRes.data as any[]).map(m => ({
          ...m,
          id: Number(m.id) // Ensure ID is strictly a number
        })) as Member[];
        
        setDraftMembers(parsedMembers);
        setBaselineMembers(parsedMembers.map(m => ({ ...m })));
      }
      if (cellsRes.data) setDraftCells(cellsRes.data);
      if (discRes.data) setDraftLinks(discRes.data);
      
    } catch (err) {
      console.error('Error loading simulation data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBaseline();
  }, []);

  // Multiplication Preview Modal States
  // Multiplication Preview Modal States
  const [multiplyModalOpen, setMultiplyModalOpen] = useState(false);
  const [multiplyOriginalCellName, setMultiplyOriginalCellName] = useState('');
  const [multiplyNewCellName, setMultiplyNewCellName] = useState('');
  const [multiplyGroupA, setMultiplyGroupA] = useState<Member[]>([]);
  const [multiplyGroupB, setMultiplyGroupB] = useState<Member[]>([]);

  const handleMultiplyCell = (cellName: string) => {
    const originalCell = draftCells.find(c => c.grupo_caseiro === cellName);
    if (!originalCell) return;

    const cellMembers = draftMembers.filter(m => m.grupos_caseiros === originalCell.grupo_caseiro && m.status === 'Ativo');
    if (cellMembers.length === 0) {
      alert("Nenhum membro ativo para multiplicar neste grupo.");
      return;
    }

    // 1. Identify Leader and Leader's Family (Exception: always remains in Mother Cell A)
    const leaderName = originalCell.lider || '';
    const cleanNormalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    const normalizedLeader = cleanNormalize(leaderName);
    
    let leaderMember = cellMembers.find(m => {
      if (!leaderName) return false;
      const nm = cleanNormalize(m.nome);
      return nm.includes(normalizedLeader) || normalizedLeader.includes(nm);
    });

    const leaderMemberIds = new Set<number>();
    if (leaderMember) {
      const leaderFam = Object.values(families).find(f => f.memberIds.includes(leaderMember.id.toString()));
      if (leaderFam) {
        leaderFam.memberIds.forEach(id => leaderMemberIds.add(Number(id)));
      } else {
        leaderMemberIds.add(leaderMember.id);
      }
    }

    const leaderFamilyMembers = cellMembers.filter(m => leaderMemberIds.has(m.id));
    const nonLeaderMembers = cellMembers.filter(m => !leaderMemberIds.has(m.id));

    // 2. Group non-leader members by family to prevent separation
    const groups: Record<string, Member[]> = {};
    nonLeaderMembers.forEach(m => {
      const idStr = m.id.toString();
      const fam = Object.values(families).find(f => f.memberIds.includes(idStr));
      const groupId = (fam && fam.memberIds.length > 1) ? `fam_${fam.id}` : `ind_${m.id}`;
      if (!groups[groupId]) groups[groupId] = [];
      groups[groupId].push(m);
    });

    // 3. Classify families by resident Region (local vs. displaced)
    const cellRegion = getGCRegion(originalCell.grupo_caseiro);
    const localGroups: Member[][] = [];
    const regionClusters: Record<string, Member[][]> = {};

    Object.values(groups).forEach(grp => {
      const rep = grp[0];
      const repRegion = getAdministrativeRegion(rep.bairro || '');
      if (repRegion === cellRegion) {
        localGroups.push(grp);
      } else {
        if (!regionClusters[repRegion]) regionClusters[repRegion] = [];
        regionClusters[repRegion].push(grp);
      }
    });

    const groupA: Member[] = [...leaderFamilyMembers];
    const groupB: Member[] = [];

    // Local families stay in Mother Cell A
    localGroups.forEach(grp => groupA.push(...grp));

    // Sort displaced clusters by size descending
    const sortedClusters = Object.entries(regionClusters).sort((a, b) => {
      const sizeA = a[1].reduce((sum, g) => sum + g.length, 0);
      const sizeB = b[1].reduce((sum, g) => sum + g.length, 0);
      return sizeB - sizeA;
    });

    // Distribute displaced region clusters to form the daughter cell
    let suggestedDaughterRegion = cellRegion;
    sortedClusters.forEach(([region, grps], idx) => {
      const clusterMembers = grps.flat();
      if (idx === 0) {
        suggestedDaughterRegion = region;
      }
      
      // Put the largest displaced region clusters in B, balancing size
      if (groupB.length === 0 || groupB.length + clusterMembers.length <= groupA.length + 3) {
        groupB.push(...clusterMembers);
      } else {
        groupA.push(...clusterMembers);
      }
    });

    // Fallback: If no displaced members existed, partition locals evenly keeping families together
    if (groupB.length === 0) {
      const sortedLocals = [...localGroups].sort((a, b) => b.length - a.length);
      const tempA: Member[] = [...leaderFamilyMembers];
      const tempB: Member[] = [];
      
      sortedLocals.forEach(grp => {
        if (tempA.length <= tempB.length) {
          tempA.push(...grp);
        } else {
          tempB.push(...grp);
        }
      });
      
      setMultiplyGroupA(tempA);
      setMultiplyGroupB(tempB);
    } else {
      setMultiplyGroupA(groupA);
      setMultiplyGroupB(groupB);
    }

    // Determine unique name for the daughter cell based on the dominant displaced region!
    let baseDaughterName = originalCell.grupo_caseiro;
    if (suggestedDaughterRegion !== cellRegion && suggestedDaughterRegion !== 'OUTRO') {
      baseDaughterName = `BSB ${suggestedDaughterRegion}`;
    }

    let alphabetCode = 66; // 'B'
    let newCellName = `${baseDaughterName} - ${String.fromCharCode(alphabetCode)}`;
    if (baseDaughterName !== originalCell.grupo_caseiro) {
      newCellName = baseDaughterName; // if region changed, e.g. BSB ARNIQUEIRA, try that directly first!
    }

    let counter = 2;
    while (draftCells.some(c => c.grupo_caseiro === newCellName)) {
      if (baseDaughterName === originalCell.grupo_caseiro) {
        alphabetCode++;
        if (alphabetCode > 90) {
          newCellName = `${baseDaughterName} - B${alphabetCode - 90}`;
          break;
        }
        newCellName = `${baseDaughterName} - ${String.fromCharCode(alphabetCode)}`;
      } else {
        newCellName = `${baseDaughterName} ${counter}`;
        counter++;
      }
    }

    setMultiplyOriginalCellName(originalCell.grupo_caseiro);
    setMultiplyNewCellName(newCellName);
    setMultiplyModalOpen(true);
  };

  const handleConfirmMultiply = () => {
    if (!multiplyNewCellName.trim()) {
      alert("Por favor, informe o nome do novo grupo.");
      return;
    }

    if (draftCells.some(c => c.grupo_caseiro === multiplyNewCellName.trim() && c.grupo_caseiro !== multiplyOriginalCellName)) {
      alert(`Já existe uma célula ativa ou em rascunho com o nome "${multiplyNewCellName.trim()}". Escolha um nome exclusivo.`);
      return;
    }

    const originalCell = draftCells.find(c => c.grupo_caseiro === multiplyOriginalCellName);
    if (!originalCell) return;

    // Create the new Draft Cell and offset coordinates slightly so they don't stack on Leaflet!
    const newCell: Cell = {
      id: 'draft_cell_' + Date.now(),
      grupo_caseiro: multiplyNewCellName.trim(),
      lider: `CO-LÍDER DE ${multiplyOriginalCellName}`,
      setor: originalCell.setor || 'SETOR SIMULADO',
      latitude: originalCell.latitude ? originalCell.latitude + 0.001 : null,
      longitude: originalCell.longitude ? originalCell.longitude + 0.001 : null
    };

    const bIds = new Set(multiplyGroupB.map(m => m.id));
    const aIds = new Set(multiplyGroupA.map(m => m.id));

    // Update draft cells & members
    setDraftCells(prev => [...prev, newCell]);
    setDraftMembers(prev => prev.map(m => {
      if (bIds.has(m.id)) {
        return { ...m, grupos_caseiros: multiplyNewCellName.trim() };
      }
      if (aIds.has(m.id)) {
        return { ...m, grupos_caseiros: multiplyOriginalCellName };
      }
      return m;
    }));

    // Focus UI on the changes
    setSelectedSource(multiplyOriginalCellName);
    setSelectedTarget(multiplyNewCellName.trim());
    setMultiplyModalOpen(false);
    window.scrollTo({ top: 300, behavior: 'smooth' });

    alert(`⚡ Multiplicação Confirmada!\n\nA célula "${multiplyOriginalCellName}" foi multiplicada com sucesso e a nova célula "${multiplyNewCellName.trim()}" foi criada com ${multiplyGroupB.length} membros.`);
  };

  // Rearrange Displaced Members Wizard States
  const [rearrangeModalOpen, setRearrangeModalOpen] = useState(false);
  const [rearrangeCellName, setRearrangeCellName] = useState('');
  const [rearrangeItems, setRearrangeItems] = useState<{
    member: Member;
    familyMembers: Member[];
    homeRegion: string;
    suggestedCell: string;
  }[]>([]);

  const handleOpenRearrange = (cellName: string) => {
    const originalCell = draftCells.find(c => c.grupo_caseiro === cellName);
    if (!originalCell) return;

    const cellMembers = draftMembers.filter(m => m.grupos_caseiros === originalCell.grupo_caseiro && m.status === 'Ativo');
    if (cellMembers.length === 0) {
      alert("Nenhum membro ativo neste grupo para reorganizar.");
      return;
    }

    // Identify Leader and Leader's Family (Exempt from relocation)
    const leaderName = originalCell.lider || '';
    const cleanNormalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    const normalizedLeader = cleanNormalize(leaderName);
    
    let leaderMember = cellMembers.find(m => {
      if (!leaderName) return false;
      const nm = cleanNormalize(m.nome);
      return nm.includes(normalizedLeader) || normalizedLeader.includes(nm);
    });

    const leaderMemberIds = new Set<number>();
    if (leaderMember) {
      const leaderFam = Object.values(families).find(f => f.memberIds.includes(leaderMember.id.toString()));
      if (leaderFam) {
        leaderFam.memberIds.forEach(id => leaderMemberIds.add(Number(id)));
      } else {
        leaderMemberIds.add(leaderMember.id);
      }
    }

    // Find non-leader geographically displaced members
    const cellRegion = getGCRegion(originalCell.grupo_caseiro);
    const displacedMembers = cellMembers.filter(m => {
      if (leaderMemberIds.has(m.id)) return false; // exempt leader family
      const mRegion = getAdministrativeRegion(m.bairro || '');
      return mRegion !== cellRegion && mRegion !== 'OUTRO';
    });

    if (displacedMembers.length === 0) {
      alert(`Todos os membros de "${originalCell.grupo_caseiro}" já residem na região de ${cellRegion}. Não há desvios territoriais para reorganizar.`);
      return;
    }

    // Group displaced members by families
    const itemsList: typeof rearrangeItems = [];
    const processedIds = new Set<number>();

    displacedMembers.forEach(m => {
      if (processedIds.has(m.id)) return;
      const idStr = m.id.toString();
      const fam = Object.values(families).find(f => f.memberIds.includes(idStr));
      
      let familyMembers: Member[] = [];
      if (fam) {
        familyMembers = cellMembers.filter(x => fam.memberIds.includes(x.id.toString()) && x.id !== m.id);
        fam.memberIds.forEach(id => processedIds.add(Number(id)));
      } else {
        processedIds.add(m.id);
      }

      const homeRegion = getAdministrativeRegion(m.bairro || '');
      
      // Look for any existing GC in their home region to suggest
      const localGC = draftCells.find(c => {
        const cReg = getGCRegion(c.grupo_caseiro);
        return cReg === homeRegion;
      });

      itemsList.push({
        member: m,
        familyMembers,
        homeRegion,
        suggestedCell: localGC ? localGC.grupo_caseiro : 'KEEP'
      });
    });

    setRearrangeCellName(cellName);
    setRearrangeItems(itemsList);
    setRearrangeModalOpen(true);
  };

  const handleConfirmRearrange = () => {
    // Commit the transfers
    setDraftMembers(prev => prev.map(m => {
      const matchItem = rearrangeItems.find(item => 
        item.member.id === m.id || item.familyMembers.some(f => f.id === m.id)
      );

      if (matchItem && matchItem.suggestedCell !== 'KEEP') {
        return { ...m, grupos_caseiros: matchItem.suggestedCell };
      }
      return m;
    }));

    setRearrangeModalOpen(false);
    
    // Compute total moved
    const movedCount = rearrangeItems.filter(x => x.suggestedCell !== 'KEEP').reduce((sum, item) => sum + 1 + item.familyMembers.length, 0);
    alert(`🔄 Sucesso! Reorganização concluída: ${movedCount} membros foram remanejados para seus GCs locais de residência.`);
  };



  // PROVER API Integration Modal States
  const [proverModalOpen, setProverModalOpen] = useState(false);
  const [proverLoadingStep, setProverLoadingStep] = useState(0);
  const [proverComplete, setProverComplete] = useState(false);

  // Conselheiro de Expansão (IA de Expansão) Calculations
  const expansionRecommendations = useMemo(() => {
    const alerts: { type: 'danger' | 'warning' | 'info'; text: string }[] = [];
    const suggestions: string[] = [];

    // Analyze cell sizes
    draftCells.forEach(c => {
      const count = draftMembers.filter(m => m.grupos_caseiros === c.grupo_caseiro && m.status === 'Ativo').length;
      if (count > 25) {
        alerts.push({
          type: 'danger',
          text: `Crítico: Célula "${c.grupo_caseiro}" está superlotada com ${count} membros. Risco de enfraquecimento de pastoreio em 2 meses!`
        });
      } else if (count > 15) {
        alerts.push({
          type: 'warning',
          text: `Alerta: Célula "${c.grupo_caseiro}" tem ${count} membros. Risco de saturação em 4-6 meses (Projeção: ${Math.round(count * 1.25)} membros).`
        });
      }
    });

    // Detect displaced clusters for smart suggestions
    draftCells.forEach(c => {
      const cellRegion = getGCRegion(c.grupo_caseiro);
      const members = draftMembers.filter(m => m.grupos_caseiros === c.grupo_caseiro && m.status === 'Ativo');
      
      const regionCounts: Record<string, number> = {};
      members.forEach(m => {
        const mRegion = getAdministrativeRegion(m.bairro || '');
        if (mRegion !== cellRegion && mRegion !== 'OUTRO') {
          regionCounts[mRegion] = (regionCounts[mRegion] || 0) + 1;
        }
      });

      Object.entries(regionCounts).forEach(([region, count]) => {
        if (count >= 3) {
          const matchingLocalCell = draftCells.find(x => getGCRegion(x.grupo_caseiro) === region);
          if (matchingLocalCell) {
            suggestions.push(
              `Mover as ${count} pessoas que moram em ${region} do "${c.grupo_caseiro}" para a célula local "${matchingLocalCell.grupo_caseiro}" liderada por ${matchingLocalCell.lider}.`
            );
          } else {
            suggestions.push(
              `Plantar um novo GC Rascunho em ${region} para acolher as ${count} pessoas deslocadas que hoje frequentam o "${c.grupo_caseiro}".`
            );
          }
        }
      });
    });

    if (alerts.length === 0) {
      alerts.push({
        type: 'info',
        text: 'Crescimento Sustentável: Todas as células estão operando dentro do limite saudável de tamanho!'
      });
    }

    return { alerts, suggestions };
  }, [draftCells, draftMembers]);



  const handleSaveModel = () => {
    if (impactStats.changes === 0) {
      alert("Nenhuma transferência ou mudança foi simulada ainda.");
      return;
    }

    const today = new Date().toLocaleDateString('pt-BR');
    let report = `====================================================\n`;
    report += `   BSB CHURCH - PLANO DE MULTIPLICAÇÃO & TRANSFERÊNCIA\n`;
    report += `          GERADO VIA LABORATÓRIO DE ESTRUTURA\n`;
    report += `====================================================\n`;
    report += `⚠️ IMPORTANTE: Este plano é 100% SIMULADO (Sandbox).\n`;
    report += `Nenhuma alteração foi realizada no banco de dados real.\n`;
    report += `As alterações oficiais de membros devem ser feitas\n`;
    report += `manualmente dentro do sistema oficial PROVER.\n`;
    report += `====================================================\n\n`;
    report += `Data de Planejamento: ${today}\n`;
    report += `Total de Transferências Simuladas: ${impactStats.changes}\n\n`;

    report += `----------------------------------------------------\n`;
    report += `1. DETALHE DAS TRANSFERÊNCIAS (DE ➔ PARA)\n`;
    report += `----------------------------------------------------\n`;
    impactStats.movedMembers.forEach((m, idx) => {
      report += `${idx + 1}. ${m.nome}\n`;
      report += `   📍 Bairro: ${m.bairro || 'Não informado'}\n`;
      report += `   🔴 De: ${m.de}\n`;
      report += `   🟢 Para: ${m.para}\n\n`;
    });

    report += `----------------------------------------------------\n`;
    report += `2. RESUMO FINAL DOS GCs APÓS MULTIPLICAÇÃO\n`;
    report += `----------------------------------------------------\n`;
    
    // Group draftMembers by their current draft groups
    const membersByGC: Record<string, string[]> = {};
    draftCells.forEach(c => {
      membersByGC[c.grupo_caseiro] = [];
    });
    draftMembers.forEach(m => {
      if (m.grupos_caseiros) {
        if (!membersByGC[m.grupos_caseiros]) {
          membersByGC[m.grupos_caseiros] = [];
        }
        membersByGC[m.grupos_caseiros].push(m.nome);
      }
    });

    draftCells.forEach(c => {
      const count = membersByGC[c.grupo_caseiro]?.length || 0;
      report += `👥 GC: ${c.grupo_caseiro}\n`;
      report += `   👑 Líder: ${c.lider}\n`;
      report += `   📍 Setor: ${c.setor}\n`;
      report += `   📊 Total de Membros: ${count}\n`;
      if (count > 0) {
        report += `   📋 Integrantes:\n`;
        membersByGC[c.grupo_caseiro].forEach(name => {
          report += `     - ${name}\n`;
        });
      }
      report += `\n`;
    });

    report += `====================================================\n`;
    report += `3. ASSINATURA E APROVAÇÃO\n`;
    report += `====================================================\n`;
    report += `Aprovado por: _____________________________________\n`;
    report += `Data da Aprovação: ____/____/________\n\n`;
    report += `⚠️ Lembrete: Efetivar transferências manualmente no PROVER.\n`;
    report += `Gerado no Simulador BSB Church.\n`;

    // Download the report as a .txt file
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BSB_Church_Plano_Multiplicacao_${today.replace(/\//g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Friendly alert warning
    alert("🎉 Plano de Multiplicação exportado com sucesso!\n\nLembre-se: Este é um plano simulado. Para que essas transferências se tornem oficiais, você deve realizá-las manualmente dentro do sistema oficial PROVER.");
  };



  const resetSimulation = () => {
    if (confirm('Deseja descartar todas as alterações da simulação e voltar aos dados reais?')) {
      setDraftMembers(baselineMembers.map(m => ({ ...m })));
      setSelectedMembers([]);
      setSelectedTargetMembers([]);
    }
  };

  // --- FAMILY GROUPING ENGINE ---
  const families = useFamilyEngine(draftMembers);

  // Expand families by default if they are in source
  useEffect(() => {
    if (selectedSource && Object.keys(families).length > 0) {
      const newExp: Record<string, boolean> = {};
      Object.entries(families).forEach(([fid, fam]) => {
        // Expand if any family member is in this source GC
        const hasMemberInSource = fam.memberIds.some(id => {
          const m = draftMembers.find(dm => dm.id.toString() === id);
          return m?.grupos_caseiros === selectedSource;
        });
        if (hasMemberInSource) {
          newExp[fid] = true;
        }
      });
      setExpandedFamilies(newExp);
    }
  }, [selectedSource, families]);

  // GC Metadata
  const sourceCell = useMemo(() => {
    return draftCells.find(c => c.grupo_caseiro === selectedSource);
  }, [draftCells, selectedSource]);

  const targetCell = useMemo(() => {
    return draftCells.find(c => c.grupo_caseiro === selectedTarget);
  }, [draftCells, selectedTarget]);

  // Filtered lists
  const sourceMembers = useMemo(() => {
    if (!selectedSource) return [];
    let list = draftMembers.filter(m => m.grupos_caseiros === selectedSource && m.status === 'Ativo');
    if (sourceSearch) {
      const q = sourceSearch.toLowerCase();
      list = list.filter(m => m.nome.toLowerCase().includes(q));
    }
    return list;
  }, [draftMembers, selectedSource, sourceSearch]);

  const targetMembers = useMemo(() => {
    if (!selectedTarget) return [];
    let list = draftMembers.filter(m => m.grupos_caseiros === selectedTarget && m.status === 'Ativo');
    if (targetSearch) {
      const q = targetSearch.toLowerCase();
      list = list.filter(m => m.nome.toLowerCase().includes(q));
    }
    return list;
  }, [draftMembers, selectedTarget, targetSearch]);

  // Toggle Source selections
  const toggleMemberSelection = (idStr: string) => {
    const member = draftMembers.find(m => m.id.toString() === idStr);
    if (!member) return;

    if (moveMode === 'family') {
      const fam = Object.values(families).find(f => f.memberIds.includes(idStr));
      if (fam && fam.memberIds.length > 1) {
        // Get all members of the family who are in the source GC
        const familySourceIds = fam.memberIds.filter(fId => {
          const m = draftMembers.find(dm => dm.id.toString() === fId);
          return m?.grupos_caseiros === selectedSource && m?.status === 'Ativo';
        });

        const allSelected = familySourceIds.every(fId => selectedMembers.includes(fId));
        if (allSelected) {
          setSelectedMembers(prev => prev.filter(fId => !familySourceIds.includes(fId)));
        } else {
          setSelectedMembers(prev => {
            const extra = familySourceIds.filter(fId => !prev.includes(fId));
            return [...prev, ...extra];
          });
        }
        return;
      }
    }

    // Individual mode
    setSelectedMembers(prev => 
      prev.includes(idStr) ? prev.filter(mId => mId !== idStr) : [...prev, idStr]
    );
  };

  // Toggle Target selections (to move back)
  const toggleTargetMemberSelection = (idStr: string) => {
    const member = draftMembers.find(m => m.id.toString() === idStr);
    if (!member) return;

    if (moveMode === 'family') {
      const fam = Object.values(families).find(f => f.memberIds.includes(idStr));
      if (fam && fam.memberIds.length > 1) {
        const familyTargetIds = fam.memberIds.filter(fId => {
          const m = draftMembers.find(dm => dm.id.toString() === fId);
          return m?.grupos_caseiros === selectedTarget && m?.status === 'Ativo';
        });

        const allSelected = familyTargetIds.every(fId => selectedTargetMembers.includes(fId));
        if (allSelected) {
          setSelectedTargetMembers(prev => prev.filter(fId => !familyTargetIds.includes(fId)));
        } else {
          setSelectedTargetMembers(prev => {
            const extra = familyTargetIds.filter(fId => !prev.includes(fId));
            return [...prev, ...extra];
          });
        }
        return;
      }
    }

    setSelectedTargetMembers(prev => 
      prev.includes(idStr) ? prev.filter(mId => mId !== idStr) : [...prev, idStr]
    );
  };

  // Execute Simulation Movement Source -> Target
  const handleMoveMembers = () => {
    if (!selectedTarget || selectedMembers.length === 0) return;
    
    const numericIds = selectedMembers.map(id => Number(id));
    setDraftMembers(prev => prev.map(m => 
      numericIds.includes(m.id) 
        ? { ...m, grupos_caseiros: selectedTarget } 
        : m
    ));
    setSelectedMembers([]);
  };

  // Execute Simulation Movement Target -> Source
  const handleMoveMembersBack = () => {
    if (!selectedSource || selectedTargetMembers.length === 0) return;
    
    const numericIds = selectedTargetMembers.map(id => Number(id));
    setDraftMembers(prev => prev.map(m => 
      numericIds.includes(m.id) 
        ? { ...m, grupos_caseiros: selectedSource } 
        : m
    ));
    setSelectedTargetMembers([]);
  };

  // Impact Analysis (Before vs After comparison on target)
  const targetComparison = useMemo(() => {
    if (!selectedTarget) return null;
    
    // Real members in target (drawn from baseline)
    const baselineInTarget = baselineMembers.filter(m => m.grupos_caseiros === selectedTarget && m.status === 'Ativo');
    
    // Simulated members currently in target (drawn from draftMembers)
    const currentDraftTarget = draftMembers.filter(m => m.grupos_caseiros === selectedTarget && m.status === 'Ativo');
    
    // Selected source members that will be simulated as added
    const incomingMembers = draftMembers.filter(m => selectedMembers.includes(m.id.toString()) && m.grupos_caseiros === selectedSource);
    
    // Total simulated after clicking right
    const simulatedInTarget = [...currentDraftTarget, ...incomingMembers];
    
    const getStats = (mList: Member[]) => {
      const total = mList.length;
      const male = mList.filter(m => m.sexo === 'Masculino').length;
      const female = mList.filter(m => m.sexo === 'Feminino').length;
      
      let totalAge = 0;
      let ageCount = 0;
      mList.forEach(m => {
        const age = calculateAge(m.nascimento);
        if (age >= 0) {
          totalAge += age;
          ageCount++;
        }
      });
      const avgAge = ageCount > 0 ? Math.round(totalAge / ageCount) : 0;
      
      const famIds = new Set<string>();
      mList.forEach(m => {
        const fam = Object.values(families).find(f => f.memberIds.includes(m.id.toString()));
        if (fam) famIds.add(fam.id);
        else famIds.add('single_' + m.id);
      });
      const familiesCount = famIds.size;
      
      return { total, male, female, avgAge, familiesCount };
    };

    const before = getStats(currentDraftTarget);
    const after = getStats(simulatedInTarget);
    
    return { before, after, incomingCount: incomingMembers.length };
  }, [selectedTarget, selectedSource, selectedMembers, draftMembers, baselineMembers, families]);

  // Overall impact stats
  // Overall impact stats
  const impactStats = useMemo(() => {
    const movedMembers = draftMembers.filter(m => {
      const base = baselineMembers.find(bm => bm.id === m.id);
      return base && base.grupos_caseiros !== m.grupos_caseiros;
    }).map(m => {
      const base = baselineMembers.find(bm => bm.id === m.id)!;
      return {
        id: m.id,
        nome: m.nome,
        bairro: m.bairro,
        de: base.grupos_caseiros || 'Sem GC',
        para: m.grupos_caseiros || 'Sem GC'
      };
    });

    const changes = movedMembers.length;
    const sourceCount = sourceMembers.length;
    const targetCount = targetMembers.length;

    return { changes, sourceCount, targetCount, movedMembers };
  }, [draftMembers, baselineMembers, sourceMembers, targetMembers]);


  // Expandable UI toggle helper
  const toggleFamilyExpand = (familyId: string) => {
    setExpandedFamilies(prev => ({
      ...prev,
      [familyId]: !prev[familyId]
    }));
  };

  // Segmenting source members into Families vs Individuals
  const sourceSections = useMemo(() => {
    const familyGroups: Record<string, Member[]> = {};
    const individuals: Member[] = [];
    
    sourceMembers.forEach(m => {
      const idStr = m.id.toString();
      const fam = Object.values(families).find(f => f.memberIds.includes(idStr));
      if (fam && fam.memberIds.length > 1) {
        if (!familyGroups[fam.id]) familyGroups[fam.id] = [];
        familyGroups[fam.id].push(m);
      } else {
        individuals.push(m);
      }
    });

    return { familyGroups, individuals };
  }, [sourceMembers, families]);

  // Segmenting target members into Families vs Individuals
  const targetSections = useMemo(() => {
    const familyGroups: Record<string, Member[]> = {};
    const individuals: Member[] = [];
    
    targetMembers.forEach(m => {
      const idStr = m.id.toString();
      const fam = Object.values(families).find(f => f.memberIds.includes(idStr));
      if (fam && fam.memberIds.length > 1) {
        if (!familyGroups[fam.id]) familyGroups[fam.id] = [];
        familyGroups[fam.id].push(m);
      } else {
        individuals.push(m);
      }
    });

    return { familyGroups, individuals };
  }, [targetMembers, families]);

  // Simulated incoming members (members whose draft GC is target, but baseline GC was source)
  const simulatedIncoming = useMemo(() => {
    if (!selectedTarget) return [];
    return draftMembers.filter(m => 
      m.grupos_caseiros === selectedTarget && 
      m.status === 'Ativo' &&
      baselineMembers.find(bm => bm.id === m.id)?.grupos_caseiros === selectedSource
    );
  }, [draftMembers, baselineMembers, selectedTarget, selectedSource]);

  // --- TERRITORIAL INTELLIGENCE ENGINE ---
  // --- TERRITORIAL INTELLIGENCE ENGINE ---
  const territorialInsights = useMemo(() => {
    if (isLoading || draftMembers.length === 0) return { insights: [], minMembersInAnyGC: 0, activeGCsCount: 0 };
    
    const membersByRA: Record<string, Member[]> = {};
    draftMembers.filter(m => m.status === 'Ativo').forEach(m => {
      const ra = getAdministrativeRegion(m.bairro);
      if (!membersByRA[ra]) membersByRA[ra] = [];
      membersByRA[ra].push(m);
    });

    const gcsByRA: Record<string, Cell[]> = {};
    draftCells.forEach(c => {
      const ra = getGCRegion(c.grupo_caseiro);
      if (!gcsByRA[ra]) gcsByRA[ra] = [];
      gcsByRA[ra].push(c);
    });

    // 1. Calculate members count in each GC today (excluding Cobertura VIX)
    const membersCountByGC: Record<string, number> = {};
    draftMembers.filter(m => m.status === 'Ativo' && m.grupos_caseiros).forEach(m => {
      const gc = m.grupos_caseiros!;
      if (gc === 'COBERTURA - VIX') return;
      membersCountByGC[gc] = (membersCountByGC[gc] || 0) + 1;
    });

    // Find the mathematical minimum size among all active GCs today (with at least 5 members)
    const activeGCSizes = Object.values(membersCountByGC).filter(size => size >= 5);
    const minMembersInAnyGC = activeGCSizes.length > 0 ? Math.min(...activeGCSizes) : 10;
    const activeGCsCount = draftCells.filter(c => c.grupo_caseiro !== 'COBERTURA - VIX').length || 1;

    const insights: any[] = [];
    
    // 2. Scan all RAs to generate alerts based on the exact rule:
    // If RA has 0 GCs AND members count is >= minMembersInAnyGC
    Object.entries(membersByRA).forEach(([ra, members]) => {
      if (ra === 'NÃO INFORMADO') return;
      
      const gcList = gcsByRA[ra] || [];
      if (gcList.length === 0 && members.length >= minMembersInAnyGC) {
        insights.push({
          type: 'expansion',
          title: `Alerta de Expansão: ${ra}`,
          description: `Localidade ${ra} possui quantidade de membros (${members.length}) igual ou superior ao mínimo dos membros por grupo (${minMembersInAnyGC} membros/GC), mas não possui grupo na localidade.`,
          action: 'Ação sugerida: Avaliar criação de GC local ou reorganização regional',
          memberNames: members.map(m => m.nome).sort()
        });
      }
    });

    return { insights, minMembersInAnyGC, activeGCsCount };
  }, [isLoading, draftMembers, draftCells]);
  // --- MECANISMO DE AUDITORIA ESTRUTURAL & ALOCAÇÃO ---
  // Extract unique sectors from baseline GCs today
  const uniqueSectors = useMemo(() => {
    const sectors = new Set<string>();
    draftCells.forEach(c => {
      if (c.setor && c.setor.trim() && c.setor !== 'SETOR SIMULADO') {
        sectors.add(c.setor.trim());
      }
    });
    return Array.from(sectors).sort();
  }, [draftCells]);

  const auditData = useMemo(() => {
    if (isLoading || draftMembers.length === 0) {
      return { allocationMismatches: [], overcrowdedGCs: [], criticalGCs: [] };
    }

    // Build normalized set of leader names to ignore leaders and their family members (e.g. spouses)
    const leaderNamesNormalized = new Set(draftCells.map(c => normalizeName(c.lider)));

    const isLeaderOrFamilyOfLeader = (memberId: string, memberName: string) => {
      const normName = normalizeName(memberName);
      if (leaderNamesNormalized.has(normName)) return true;
      
      // Find family containing this member
      const memberFam = Object.values(families).find(f => f.memberIds.includes(memberId));
      if (memberFam) {
        // Check if any member of this family is a leader
        return memberFam.memberIds.some(idStr => {
          const famMem = draftMembers.find(dm => dm.id.toString() === idStr);
          return famMem && leaderNamesNormalized.has(normalizeName(famMem.nome));
        });
      }
      return false;
    };

    // 1. Group draft cells by their normalized region
    const gcsByRA: Record<string, string[]> = {};
    draftCells.forEach(c => {
      const ra = getGCRegion(c.grupo_caseiro);
      if (!gcsByRA[ra]) gcsByRA[ra] = [];
      gcsByRA[ra].push(c.grupo_caseiro);
    });

    const getRecommendedGCsForRegion = (memberRA: string) => {
      // 1. If we have GCs in this region, return them
      if (gcsByRA[memberRA] && gcsByRA[memberRA].length > 0) {
        return { gcs: gcsByRA[memberRA], isLocal: true, recommendedRegion: memberRA };
      }
      
      // 2. Predefined high-quality fallback mappings
      const mappedTarget = getFallbackRegion(memberRA);
      if (mappedTarget && gcsByRA[mappedTarget] && gcsByRA[mappedTarget].length > 0) {
        return { gcs: gcsByRA[mappedTarget], isLocal: false, recommendedRegion: mappedTarget };
      }
      
      // 3. Mathematical geographic closest region calculation
      const memberCoords = regionCoordinates[memberRA];
      if (memberCoords) {
        let closestRegion = '';
        let minDistance = Infinity;
        
        Object.entries(gcsByRA).forEach(([otherRA, otherGCs]) => {
          if (otherGCs.length === 0) return;
          const otherCoords = regionCoordinates[otherRA];
          if (otherCoords) {
            const distStr = calculateDistance(memberCoords[0], memberCoords[1], otherCoords[0], otherCoords[1]);
            if (distStr) {
              const dist = parseFloat(distStr);
              if (dist < minDistance) {
                minDistance = dist;
                closestRegion = otherRA;
              }
            }
          }
        });
        
        if (closestRegion && gcsByRA[closestRegion] && gcsByRA[closestRegion].length > 0) {
          return { gcs: gcsByRA[closestRegion], isLocal: false, recommendedRegion: closestRegion };
        }
      }
      
      // 4. Ultimate fallback: list GCs from any region that has them
      const anyRA = Object.keys(gcsByRA).find(ra => gcsByRA[ra] && gcsByRA[ra].length > 0);
      if (anyRA) {
        return { gcs: gcsByRA[anyRA], isLocal: false, recommendedRegion: anyRA };
      }
      
      return { gcs: [], isLocal: false, recommendedRegion: '' };
    };

    // 2. Count members per GC
    const membersCountByGC: Record<string, number> = {};
    draftMembers.filter(m => m.status === 'Ativo' && m.grupos_caseiros).forEach(m => {
      const gc = m.grupos_caseiros!;
      membersCountByGC[gc] = (membersCountByGC[gc] || 0) + 1;
    });

    // 3. Find territorial mismatches
    const allocationMismatches: any[] = [];
    draftMembers.filter(m => m.status === 'Ativo' && m.grupos_caseiros).forEach(m => {
      const memberIdStr = m.id.toString();
      if (isLeaderOrFamilyOfLeader(memberIdStr, m.nome)) return;

      const memberRA = getAdministrativeRegion(m.bairro);
      const gcName = m.grupos_caseiros!;
      const gcRA = getGCRegion(gcName);

      if (memberRA !== 'NÃO INFORMADO' && gcRA !== 'OUTRO') {
        const rec = getRecommendedGCsForRegion(memberRA);
        
        // A mismatch exists if:
        // They are in a region different from their own, AND they are NOT in their recommended fallback region!
        const isCorrectAllocation = (gcRA === memberRA) || 
                                    (gcRA === 'GUARÁ-NB' && (memberRA === 'GUARÁ' || memberRA === 'NÚCLEO BANDEIRANTE')) ||
                                    (!rec.isLocal && gcRA === rec.recommendedRegion);
        
        if (!isCorrectAllocation) {
          allocationMismatches.push({
            memberId: m.id,
            memberName: m.nome,
            memberBairro: m.bairro || 'Não informado',
            memberRA: memberRA,
            currentGC: gcName,
            currentGCRA: gcRA,
            hasLocalGCs: rec.gcs.length > 0,
            isLocalRecommendation: rec.isLocal,
            recommendedRegion: rec.recommendedRegion,
            localGCs: rec.gcs
          });
        }
      }
    });

    // Sort mismatches (members who have local GCs available go first)
    allocationMismatches.sort((a, b) => {
      if (a.hasLocalGCs && !b.hasLocalGCs) return -1;
      if (!a.hasLocalGCs && b.hasLocalGCs) return 1;
      return a.memberName.localeCompare(b.memberName);
    });

    // 4. Overcrowded GCs (> 15 members)
    const overcrowdedGCs = Object.entries(membersCountByGC)
      .filter(([gc, count]) => count > 15 && gc !== 'COBERTURA - VIX')
      .map(([gc, count]) => ({ gc, count }))
      .sort((a, b) => b.count - a.count);

    // 5. Critical GCs (< 5 members)
    const criticalGCs = Object.entries(membersCountByGC)
      .filter(([gc, count]) => count < 5 && gc !== 'COBERTURA - VIX')
      .map(([gc, count]) => ({ gc, count }))
      .sort((a, b) => a.count - b.count);

    return { allocationMismatches, overcrowdedGCs, criticalGCs };
  }, [isLoading, draftMembers, draftCells, families]);



  if (isLoading) return <div className="flex h-96 items-center justify-center"><TrendingUp className="h-8 w-8 animate-spin text-primary-600" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-700 max-w-7xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-3 border border-blue-100">
            <Play className="w-3 h-3 animate-pulse" /> Modo Simulação (Sandbox)
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Laboratório de Estrutura</h1>
          <p className="mt-2 text-sm text-gray-500 font-medium">Reorganize grupos, analise o impacto demográfico e planeje transferências com alocação familiar inteligente.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={resetSimulation} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 active:scale-95 transition-all">
            <RotateCcw className="w-4 h-4" /> Descartar Cenário
          </button>
          <button 
            onClick={handleSaveModel}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-primary-600 rounded-xl hover:bg-primary-700 active:scale-95 shadow-lg shadow-primary-100 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" /> Salvar Modelo
          </button>
          <button 
            disabled={impactStats.changes === 0}
            onClick={() => {
              setProverModalOpen(true);
              setProverLoadingStep(0);
              setProverComplete(false);
              setTimeout(() => setProverLoadingStep(1), 1200);
              setTimeout(() => setProverLoadingStep(2), 2400);
              setTimeout(() => setProverLoadingStep(3), 3600);
              setTimeout(() => setProverComplete(true), 4800);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-xl active:scale-95 shadow-lg shadow-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all cursor-pointer animate-pulse"
          >
            <Zap className="w-4 h-4 text-emerald-100 animate-bounce" /> Homologar no PROVER
          </button>

        </div>
      </header>

      {/* Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800">
          <strong>Sandbox Ativo:</strong> Nenhuma alteração feita nesta tela alterará dados reais no banco de dados. 
          Use este espaço de laboratório com total segurança para planejar a expansão da igreja.
        </div>
      </div>

      {/* Visual Map Radar Widget */}
      <div id="radar-sandbox-container" className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
        <button
          onClick={() => setIsMapExpanded(!isMapExpanded)}
          className="w-full flex items-center justify-between text-left cursor-pointer focus:outline-none"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-2xl">
              <MapPin className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Visualizador de Distribuição Espacial (Radar Sandbox)</h3>
              <p className="text-[10px] text-gray-400 font-semibold">Veja os membros e células em tempo real no mapa de Brasília enquanto simula transferências!</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-100 uppercase tracking-tighter">
              Radar Integrado
            </span>
            <ChevronDown className={clsx("w-5 h-5 text-gray-400 transition-transform duration-300", isMapExpanded && "rotate-180")} />
          </div>
        </button>

        {isMapExpanded && (
          <div className="h-[380px] rounded-2xl overflow-hidden border border-gray-100 relative mt-4 z-10">
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
                          className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
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
              {/* 1. Territorial Opportunity Heatmap (Pulsing Circles) */}
              {Object.entries(regionCoordinates).map(([region, coords]) => {
                // Count active members living here
                const localMembersCount = draftMembers.filter(m => getAdministrativeRegion(m.bairro || '') === region && m.status === 'Ativo').length;
                // Count cells already active in this region
                const localCellsCount = draftCells.filter(c => getGCRegion(c.grupo_caseiro) === region).length;
                
                // An opportunity exists if we have >= 4 members but 0 cells!
                const isOpportunity = localMembersCount >= 4 && localCellsCount === 0;

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
                          className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg transition-colors cursor-pointer text-center text-[10px] flex items-center justify-center gap-1"
                        >
                          ⚡ Plantar GC em {region}
                        </button>
                      </div>
                    </Popup>
                  </Circle>
                );
              })}



            </MapContainer>
          </div>
        )}
      </div>



      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Simulation Board */}
        <div className="lg:col-span-8 space-y-6">
           {/* Tabs and Mode Toggles */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100">
            <div className="flex gap-4">
              <button 
                onClick={() => setActiveTab('gc')}
                className={clsx(
                  "pb-4 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2",
                  activeTab === 'gc' ? "border-primary-600 text-primary-600" : "border-transparent text-gray-400 hover:text-gray-600"
                )}
              >
                <Home className="w-4 h-4" /> Simulador de GC
              </button>
              <button 
                onClick={() => setActiveTab('discipleship')}
                className={clsx(
                  "pb-4 px-2 text-sm font-bold border-b-2 transition-all flex items-center gap-2",
                  activeTab === 'discipleship' ? "border-primary-600 text-primary-600" : "border-transparent text-gray-400 hover:text-gray-600"
                )}
              >
                <Network className="w-4 h-4" /> Rede de Discipulado
              </button>
            </div>
            
            {activeTab === 'gc' && (
              <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl mb-3 sm:mb-0">
                <button
                  onClick={() => setMoveMode('family')}
                  className={clsx(
                    "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5",
                    moveMode === 'family' ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <Users className="w-3.5 h-3.5" /> Mover por Família
                </button>
                <button
                  onClick={() => setMoveMode('individual')}
                  className={clsx(
                    "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5",
                    moveMode === 'individual' ? "bg-white text-gray-800 shadow-sm" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <Users className="w-3.5 h-3.5 opacity-50" /> Mover por Pessoa
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-11 gap-4">
            {activeTab === 'gc' ? (
              <>
                {/* Source Panel (GC) */}
                <div className="md:col-span-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden min-h-[550px]">
                  <div className="p-4 border-b border-gray-50 bg-gray-50/30 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Grupo de Origem</label>
                        {selectedSource && (
                          <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-extrabold">
                            {sourceMembers.length} {sourceMembers.length === 1 ? 'remanescente' : 'remanescentes'}
                          </span>
                        )}
                      </div>
                      <select 

                        value={selectedSource} 
                        onChange={e => {
                          setSelectedSource(e.target.value);
                          setSelectedMembers([]);
                        }}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                      >
                        <option value="">Selecione um GC...</option>
                        {draftCells.map(c => <option key={c.id} value={c.grupo_caseiro}>{c.grupo_caseiro}</option>)}
                      </select>
                    </div>

                    {sourceCell && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center bg-white/70 border border-gray-100 rounded-xl p-2.5 text-xs">
                          <div>
                            <span className="text-gray-400 font-medium">Líder: </span>
                            <span className="font-bold text-gray-700">{sourceCell.lider}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 font-medium">Setor: </span>
                            <span className="font-bold text-indigo-600">{sourceCell.setor}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleLocalizeGC(selectedSource)}
                          className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 hover:border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <MapPin className="w-3.5 h-3.5 animate-bounce" /> Localizar Membros no Mapa
                        </button>
                      </div>
                    )}

                    {selectedSource && (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <input
                          type="text"
                          value={sourceSearch}
                          onChange={e => setSourceSearch(e.target.value)}
                          placeholder="Buscar membro na origem..."
                          className="w-full pl-9 pr-4 py-1.5 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 p-4 overflow-y-auto max-h-[500px]">
                    {!selectedSource ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <div className="p-4 bg-gray-50 rounded-full mb-4"><Users className="w-8 h-8 text-gray-300" /></div>
                        <p className="text-sm font-bold text-gray-400">Nenhum GC de Origem Selecionado</p>
                        <p className="text-xs text-gray-400 mt-1">Selecione o grupo acima para listar os membros.</p>
                      </div>
                    ) : sourceMembers.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-8">Nenhum membro ativo correspondente.</p>
                    ) : (
                      <div className="space-y-4">
                        {/* 1. Family Groups */}
                        {Object.entries(sourceSections.familyGroups).map(([fid, group]) => {
                          const fam = families[fid];
                          const isExpanded = expandedFamilies[fid] ?? false;
                          // Check if all family members in this source GC are selected
                          const familySourceIds = fam.memberIds.filter(id => sourceMembers.some(sm => sm.id.toString() === id));
                          const allSelected = familySourceIds.length > 0 && familySourceIds.every(id => selectedMembers.includes(id));
                          const someSelected = familySourceIds.some(id => selectedMembers.includes(id));

                          return (
                            <div key={fid} className="border border-gray-100 rounded-2xl overflow-hidden bg-gray-50/30">
                              <div className="flex items-center justify-between p-3 bg-gray-50/70 border-b border-gray-100 select-none">
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="checkbox" 
                                    checked={allSelected} 
                                    ref={el => {
                                      if (el) el.indeterminate = someSelected && !allSelected;
                                    }}
                                    onChange={() => toggleMemberSelection(fam.memberIds[0])}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-3.5 w-3.5"
                                  />
                                  <span className="text-xs font-extrabold text-gray-700 flex items-center gap-1">
                                    👨‍👩‍👧‍👦 {fam.name}
                                  </span>
                                  <span className="text-[10px] bg-gray-200 text-gray-600 font-bold px-1.5 py-0.5 rounded-full">
                                    {familySourceIds.length} {familySourceIds.length > 1 ? 'membros' : 'membro'}
                                  </span>
                                </div>
                                <button 
                                  onClick={() => toggleFamilyExpand(fid)}
                                  className="text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                              </div>

                              {isExpanded && (
                                <div className="p-2 space-y-1.5 bg-white">
                                  {group.map(m => {
                                    const idStr = m.id.toString();
                                    const isHead = fam.headId === idStr;
                                    const age = calculateAge(m.nascimento);
                                    return (
                                      <div 
                                        key={idStr}
                                        onClick={() => toggleMemberSelection(idStr)}
                                        className={clsx(
                                          "flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none",
                                          selectedMembers.includes(idStr) 
                                            ? "border-primary-500 bg-primary-50/50 ring-1 ring-primary-100" 
                                            : "border-gray-50 hover:border-gray-200"
                                        )}
                                      >
                                        <div className="flex items-center gap-2.5">
                                          <div className={clsx("h-7 w-7 rounded-full flex items-center justify-center text-xs font-extrabold", m.sexo === 'Masculino' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700')}>
                                            {m.nome.charAt(0)}
                                          </div>
                                          <div className="flex flex-col">
                                            <span className="text-xs font-bold text-gray-700 flex items-center gap-1">
                                              {m.nome.split(' ')[0]} {m.nome.split(' ').slice(-1)[0]}
                                              {isHead && <span className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-1 rounded font-bold">Cabeça</span>}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                              {age >= 0 ? `${age} anos` : 'Idade indefinida'} • {m.sexo === 'Masculino' ? 'M' : 'F'}
                                            </span>
                                            {renderBairroTag(m, sourceCell, draftCells)}
                                          </div>
                                        </div>
                                        {selectedMembers.includes(idStr) && <CheckCircle2 className="w-3.5 h-3.5 text-primary-600" />}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* 2. Individual Members */}
                        {sourceSections.individuals.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest px-1">Membros Individuais</h4>
                            {sourceSections.individuals.map(m => {
                              const idStr = m.id.toString();
                              const age = calculateAge(m.nascimento);
                              return (
                                <div 
                                  key={idStr}
                                  onClick={() => toggleMemberSelection(idStr)}
                                  className={clsx(
                                    "flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none",
                                    selectedMembers.includes(idStr) 
                                      ? "border-primary-500 bg-primary-50/50 ring-1 ring-primary-100" 
                                      : "border-gray-100 hover:border-gray-200"
                                  )}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className={clsx("h-7 w-7 rounded-full flex items-center justify-center text-xs font-extrabold", m.sexo === 'Masculino' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700')}>
                                      {m.nome.charAt(0)}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-xs font-bold text-gray-700">{m.nome}</span>
                                      <span className="text-[10px] text-gray-400">
                                        {age >= 0 ? `${age} anos` : 'Idade indefinida'} • {m.sexo === 'Masculino' ? 'M' : 'F'}
                                      </span>
                                      {renderBairroTag(m, sourceCell, draftCells)}
                                    </div>
                                  </div>
                                  {selectedMembers.includes(idStr) && <CheckCircle2 className="w-3.5 h-3.5 text-primary-600" />}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Column (Bidirectional moving) */}
                <div className="md:col-span-1 flex flex-row md:flex-col items-center justify-center gap-4 py-2">
                  <button 
                    disabled={selectedMembers.length === 0 || !selectedTarget || selectedSource === selectedTarget}
                    onClick={handleMoveMembers}
                    title="Mover selecionados para o Destino"
                    className="w-10 h-10 md:w-11 md:h-11 bg-primary-600 text-white rounded-2xl shadow-lg shadow-primary-200 flex items-center justify-center disabled:opacity-30 disabled:shadow-none hover:scale-105 active:scale-95 transition-all"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  
                  <button 
                    disabled={selectedTargetMembers.length === 0 || !selectedSource || selectedSource === selectedTarget}
                    onClick={handleMoveMembersBack}
                    title="Retornar selecionados para a Origem"
                    className="w-10 h-10 md:w-11 md:h-11 bg-white border border-gray-200 text-gray-600 rounded-2xl shadow-sm flex items-center justify-center disabled:opacity-30 disabled:border-gray-100 hover:scale-105 active:scale-95 transition-all"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                </div>

                {/* Target Panel (GC) */}
                <div className="md:col-span-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden min-h-[550px]">
                  <div className="p-4 border-b border-gray-50 bg-gray-50/30 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Grupo de Destino</label>
                          {selectedTarget && (
                            <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-extrabold">
                              {targetMembers.length + simulatedIncoming.length} {targetMembers.length + simulatedIncoming.length === 1 ? 'remanescente' : 'remanescentes'}
                            </span>
                          )}
                        </div>
                        <button 
                          onClick={() => setIsCreateCellOpen(true)}
                          className="text-[10px] font-extrabold text-primary-600 hover:text-primary-500 hover:underline flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" /> Criar Novo GC
                        </button>
                      </div>
                      <select 
                        value={selectedTarget} 
                        onChange={e => {
                          setSelectedTarget(e.target.value);
                          setSelectedTargetMembers([]);
                        }}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                      >
                        <option value="">Destino...</option>
                        {draftCells.map(c => <option key={c.id} value={c.grupo_caseiro}>{c.grupo_caseiro}</option>)}
                      </select>
                    </div>

                    {targetCell && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center bg-white/70 border border-gray-100 rounded-xl p-2.5 text-xs">
                          <div>
                            <span className="text-gray-400 font-medium">Líder: </span>
                            <span className="font-bold text-gray-700">{targetCell.lider}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 font-medium">Setor: </span>
                            <span className="font-bold text-indigo-600">{targetCell.setor}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleLocalizeGC(selectedTarget)}
                          className="w-full py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 hover:border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <MapPin className="w-3.5 h-3.5 animate-bounce" /> Localizar Membros no Mapa
                        </button>
                      </div>
                    )}

                    {selectedTarget && (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <input
                          type="text"
                          value={targetSearch}
                          onChange={e => setTargetSearch(e.target.value)}
                          placeholder="Buscar membro no destino..."
                          className="w-full pl-9 pr-4 py-1.5 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 p-4 overflow-y-auto max-h-[500px]">
                    {!selectedTarget ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <div className="p-4 bg-gray-50 rounded-full mb-4"><Users className="w-8 h-8 text-gray-300" /></div>
                        <p className="text-sm font-bold text-gray-400">Nenhum GC de Destino Selecionado</p>
                        <p className="text-xs text-gray-400 mt-1">Escolha o grupo de destino acima para visualizar e pré-visualizar mudanças.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Simulated Incoming Members (Previewing what is coming from Source) */}
                        {simulatedIncoming.length > 0 && (
                          <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-3 space-y-2">
                            <h4 className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5" /> Integrantes Simulados (+ Novo)
                            </h4>
                            <div className="grid grid-cols-1 gap-1.5">
                              {simulatedIncoming.map(m => {
                                const idStr = m.id.toString();
                                const age = calculateAge(m.nascimento);
                                return (
                                  <div 
                                    key={idStr}
                                    onClick={() => toggleTargetMemberSelection(idStr)}
                                    className={clsx(
                                      "flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer bg-white",
                                      selectedTargetMembers.includes(idStr)
                                        ? "border-primary-500 ring-1 ring-primary-100"
                                        : "border-emerald-200 shadow-sm"
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-extrabold">
                                        {m.nome.charAt(0)}
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-xs font-bold text-gray-800">{m.nome}</span>
                                        <span className="text-[9px] text-gray-500">
                                          {age >= 0 ? `${age} anos` : ''} • {m.sexo === 'Masculino' ? 'M' : 'F'}
                                        </span>
                                        {renderBairroTag(m, targetCell, draftCells)}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[8px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded-full">Simulado</span>
                                      {selectedTargetMembers.includes(idStr) && <CheckCircle2 className="w-3 w-3 text-primary-600" />}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Existing Target Members */}
                        {targetMembers.length === 0 && simulatedIncoming.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-8">Nenhum membro ativo correspondente.</p>
                        ) : (
                          <div className="space-y-3">
                            <h4 className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest px-1">Integrantes Atuais</h4>
                            
                            {/* 1. Target Families */}
                            {Object.entries(targetSections.familyGroups).map(([fid, group]) => {
                              const fam = families[fid];
                              const isExpanded = expandedFamilies[`t_${fid}`] ?? true;
                              const familyTargetIds = fam.memberIds.filter(id => targetMembers.some(tm => tm.id.toString() === id));
                              const allSelected = familyTargetIds.length > 0 && familyTargetIds.every(id => selectedTargetMembers.includes(id));
                              const someSelected = familyTargetIds.some(id => selectedTargetMembers.includes(id));

                              return (
                                <div key={fid} className="border border-gray-100 rounded-2xl overflow-hidden bg-gray-50/10">
                                  <div className="flex items-center justify-between p-2.5 bg-gray-50/50 border-b border-gray-100 select-none">
                                    <div className="flex items-center gap-2">
                                      <input 
                                        type="checkbox" 
                                        checked={allSelected} 
                                        ref={el => {
                                          if (el) el.indeterminate = someSelected && !allSelected;
                                        }}
                                        onChange={() => toggleTargetMemberSelection(fam.memberIds[0])}
                                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-3 w-3"
                                      />
                                      <span className="text-[11px] font-extrabold text-gray-600">
                                        👨‍👩‍👧‍👦 {fam.name}
                                      </span>
                                    </div>
                                    <button 
                                      onClick={() => {
                                        setExpandedFamilies(prev => ({
                                          ...prev,
                                          [`t_${fid}`]: !isExpanded
                                        }));
                                      }}
                                      className="text-gray-400 hover:text-gray-600"
                                    >
                                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>

                                  {isExpanded && (
                                    <div className="p-2 space-y-1 bg-white">
                                      {group.map(m => {
                                        const idStr = m.id.toString();
                                        const isHead = fam.headId === idStr;
                                        const age = calculateAge(m.nascimento);
                                        const isSimulated = simulatedIncoming.some(sm => sm.id === m.id);
                                        if (isSimulated) return null; // Already displayed above in the simulated list
                                        
                                        return (
                                          <div 
                                            key={idStr}
                                            onClick={() => toggleTargetMemberSelection(idStr)}
                                            className={clsx(
                                              "flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer select-none",
                                              selectedTargetMembers.includes(idStr) 
                                                ? "border-primary-500 bg-primary-50/50 ring-1 ring-primary-100" 
                                                : "border-gray-50 hover:border-gray-200"
                                            )}
                                          >
                                            <div className="flex items-center gap-2">
                                              <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold">
                                                {m.nome.charAt(0)}
                                              </div>
                                              <div className="flex flex-col">
                                                <span className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                                                  {m.nome.split(' ')[0]} {m.nome.split(' ').slice(-1)[0]}
                                                  {isHead && <span className="text-[8px] bg-gray-100 text-gray-500 px-1 rounded">Cabeça</span>}
                                                </span>
                                                <span className="text-[9px] text-gray-400">
                                                  {age >= 0 ? `${age} anos` : ''} • {m.sexo === 'Masculino' ? 'M' : 'F'}
                                                </span>
                                                {renderBairroTag(m, targetCell, draftCells)}
                                              </div>
                                            </div>
                                            {selectedTargetMembers.includes(idStr) && <CheckCircle2 className="w-3.5 h-3.5 text-primary-600" />}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* 2. Target Individuals */}
                            {targetSections.individuals.filter(m => !simulatedIncoming.some(sm => sm.id === m.id)).map(m => {
                              const idStr = m.id.toString();
                              const age = calculateAge(m.nascimento);
                              return (
                                <div 
                                  key={idStr}
                                  onClick={() => toggleTargetMemberSelection(idStr)}
                                  className={clsx(
                                    "flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer select-none",
                                    selectedTargetMembers.includes(idStr) 
                                      ? "border-primary-500 bg-primary-50/50 ring-1 ring-primary-100" 
                                      : "border-gray-100 hover:border-gray-200 opacity-80 hover:opacity-100"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold">
                                      {m.nome.charAt(0)}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-xs font-semibold text-gray-600">{m.nome}</span>
                                      <span className="text-[9px] text-gray-400">
                                        {age >= 0 ? `${age} anos` : ''} • {m.sexo === 'Masculino' ? 'M' : 'F'}
                                      </span>
                                      {renderBairroTag(m, targetCell, draftCells)}
                                    </div>
                                  </div>
                                  {selectedTargetMembers.includes(idStr) && <CheckCircle2 className="w-3.5 h-3.5 text-primary-600" />}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Source Panel (Discipleship) */}
                <div className="md:col-span-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden min-h-[500px]">
                  <div className="p-6 border-b border-gray-50 bg-gray-50/30">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Discipulador de Origem</label>
                    <select 
                      value={selectedSource} 
                      onChange={e => {
                        setSelectedSource(e.target.value);
                        setSelectedMembers([]);
                      }}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      <option value="">Selecione um Discipulador...</option>
                      {[...new Set(draftLinks.map(l => l.discipulador))].sort().map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex-1 p-4 overflow-y-auto max-h-[500px]">
                    {!selectedSource ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <div className="p-4 bg-gray-50 rounded-full mb-4"><Network className="w-8 h-8 text-gray-300" /></div>
                        <p className="text-sm text-gray-500 font-medium">Selecione o discipulador para listar os discípulos.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {draftLinks.filter(l => l.discipulador === selectedSource).map(link => {
                          const m = draftMembers.find(dm => dm.nome === link.discipulo);
                          const idStr = m?.id.toString() || link.discipulo;
                          return (
                            <div 
                              key={link.discipulo}
                              onClick={() => {
                                setSelectedMembers(prev => 
                                  prev.includes(idStr) ? prev.filter(mId => mId !== idStr) : [...prev, idStr]
                                );
                              }}
                              className={clsx(
                                "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none",
                                selectedMembers.includes(idStr) 
                                  ? "border-primary-500 bg-primary-50/50 ring-1 ring-primary-100" 
                                  : "border-gray-100 hover:border-gray-200"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className={clsx("h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold", m?.sexo === 'Masculino' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700')}>
                                  {link.discipulo.charAt(0)}
                                </div>
                                <span className="text-sm font-medium text-gray-700">{link.discipulo}</span>
                              </div>
                              {selectedMembers.includes(idStr) && <CheckCircle2 className="w-4 h-4 text-primary-600" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Column */}
                <div className="md:col-span-1 flex flex-col items-center justify-center gap-4">
                  <button 
                    disabled={selectedMembers.length === 0 || !selectedTarget || selectedSource === selectedTarget}
                    onClick={() => {
                      const selectedNames = selectedMembers.map(id => {
                        const m = draftMembers.find(dm => dm.id.toString() === id);
                        return m ? m.nome : '';
                      }).filter(Boolean);
                      
                      setDraftLinks(prev => prev.map(l => 
                        selectedNames.includes(l.discipulo) 
                          ? { ...l, discipulador: selectedTarget } 
                          : l
                      ));
                      setSelectedMembers([]);
                    }}
                    className="w-12 h-12 bg-primary-600 text-white rounded-2xl shadow-xl flex items-center justify-center disabled:opacity-30 hover:scale-105 active:scale-95 transition-all"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Target Panel (Discipleship) */}
                <div className="md:col-span-5 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col overflow-hidden min-h-[500px]">
                  <div className="p-6 border-b border-gray-50 bg-gray-50/30">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Novo Discipulador</label>
                    <select 
                      value={selectedTarget} 
                      onChange={e => {
                        setSelectedTarget(e.target.value);
                      }}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
                    >
                      <option value="">Destino...</option>
                      {draftMembers.filter(m => m.status === 'Ativo').sort((a,b) => a.nome.localeCompare(b.nome)).map(m => (
                        <option key={m.id} value={m.nome}>{m.nome}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex-1 p-4 overflow-y-auto max-h-[500px]">
                    {!selectedTarget ? (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                        <div className="p-4 bg-gray-50 rounded-full mb-4"><Users className="w-8 h-8 text-gray-300" /></div>
                        <p className="text-xs text-gray-400">Escolha o novo discipulador para visualizar o impacto.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">Discípulos Simulados</h4>
                        {draftLinks.filter(l => l.discipulador === selectedTarget).map(l => (
                          <div key={l.discipulo} className="flex items-center gap-3 p-2 border-b border-gray-50 opacity-60">
                            <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold">{l.discipulo.charAt(0)}</div>
                            <span className="text-xs text-gray-600">{l.discipulo}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Analytics & Insights */}
        <div className="lg:col-span-4 space-y-6">
           {/* 1. Destination Group Preview Comparison Table */}
           {activeTab === 'gc' && targetComparison && (
             <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
               <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                 <Eye className="w-4 h-4 text-primary-500 animate-pulse" /> Impacto no Destino (GC)
               </h4>
               
               <div className="grid grid-cols-2 gap-3">
                 <div className="bg-gray-50/50 p-3 rounded-2xl border border-gray-100 text-center">
                   <span className="text-[10px] text-gray-400 font-bold uppercase">Membros</span>
                   <div className="text-lg font-black text-gray-800 mt-1">
                     {targetComparison.before.total} <span className="text-xs text-gray-400 font-normal">➔</span> <span className="text-emerald-600">{targetComparison.after.total}</span>
                   </div>
                   <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full inline-block mt-1">
                     {targetComparison.incomingCount >= 0 ? `+${targetComparison.incomingCount} novos` : `${targetComparison.incomingCount} novos`}
                   </span>
                 </div>

                 <div className="bg-gray-50/50 p-3 rounded-2xl border border-gray-100 text-center">
                   <span className="text-[10px] text-gray-400 font-bold uppercase">Média de Idade</span>
                   <div className="text-lg font-black text-gray-800 mt-1">
                     {targetComparison.before.avgAge || '-'} <span className="text-xs text-gray-400 font-normal">➔</span> <span className="text-primary-600">{targetComparison.after.avgAge || '-'}</span>
                   </div>
                   <span className="text-[9px] text-gray-400 inline-block mt-1 font-medium">anos de idade</span>
                 </div>

                 <div className="bg-gray-50/50 p-3 rounded-2xl border border-gray-100 text-center">
                   <span className="text-[10px] text-gray-400 font-bold uppercase">Famílias</span>
                   <div className="text-lg font-black text-gray-800 mt-1">
                     {targetComparison.before.familiesCount} <span className="text-xs text-gray-400 font-normal">➔</span> <span className="text-indigo-600">{targetComparison.after.familiesCount}</span>
                   </div>
                   <span className="text-[9px] text-gray-400 inline-block mt-1 font-medium">núcleos representados</span>
                 </div>

                 <div className="bg-gray-50/50 p-3 rounded-2xl border border-gray-100 text-center">
                   <span className="text-[10px] text-gray-400 font-bold uppercase">Equilíbrio (M/F)</span>
                   <div className="text-xs font-bold text-gray-500 mt-1.5">
                     Antes: <span className="font-extrabold">{targetComparison.before.male}M/{targetComparison.before.female}F</span>
                   </div>
                   <div className="text-xs font-bold text-primary-600 mt-0.5">
                     Depois: <span className="font-extrabold">{targetComparison.after.male}M/{targetComparison.after.female}F</span>
                   </div>
                 </div>
               </div>

               <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-[11px] text-indigo-800 leading-relaxed">
                 <strong className="flex items-center gap-1"><Brain className="w-3.5 h-3.5" /> Recomendação de Saúde:</strong>
                 O tamanho ideal recomendado para um GC é de <strong>8 a 12 membros</strong>. Acima disso, sugere-se realizar uma multiplicação planejada de células.
               </div>
             </div>
           )}

            {/* 2. Expansion Alerts Panel */}
            <div className="bg-gray-900 rounded-3xl p-6 text-white shadow-2xl overflow-hidden relative">
               <div className="relative z-10 space-y-4">
                 <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-widest">
                    <Brain className="w-4 h-4 animate-bounce" /> Alertas de Expansão
                 </div>
                 
                 <div className="flex flex-col gap-1 bg-white/5 border border-white/10 rounded-2xl p-3 text-xs leading-relaxed">
                   <div className="flex justify-between font-bold text-gray-300">
                     <span>Mínimo de Membros/GC:</span>
                     <span className="text-indigo-300">{territorialInsights.minMembersInAnyGC} membros/GC</span>
                   </div>
                   <div className="flex justify-between text-[10px] text-gray-400 font-semibold">
                     <span>Total de GCs Ativos:</span>
                     <span>{territorialInsights.activeGCsCount} células</span>
                   </div>
                   <p className="text-[9px] text-gray-400 mt-1 border-t border-white/5 pt-1">
                     Regiões sem nenhum GC e com quantidade de moradores ativos igual ou superior ao mínimo existente de {territorialInsights.minMembersInAnyGC} membros por grupo são listadas abaixo.
                   </p>
                 </div>

                 <div className="space-y-4">
                    {territorialInsights.insights.length > 0 ? territorialInsights.insights.map((insight, i) => (
                      <div key={i} className="bg-white/10 rounded-2xl p-4 border border-white/10 hover:bg-white/20 transition-all cursor-default group">
                         <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                            <MapPin className="w-4 h-4 text-emerald-400" />
                            {insight.title}
                         </h4>
                         <p className="text-xs text-gray-300 leading-relaxed mb-3">{insight.description}</p>
                         <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-tighter bg-indigo-500/10 px-2 py-1 rounded inline-block">
                            {insight.action}
                         </div>
                         
                         {insight.memberNames && insight.memberNames.length > 0 && (
                           <div className="mt-3 pt-3 border-t border-white/10">
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setExpandedInsightIndex(expandedInsightIndex === i ? null : i);
                               }}
                               className="text-[10px] font-bold text-indigo-300 hover:text-indigo-200 hover:underline flex items-center gap-1 cursor-pointer transition-all"
                             >
                               {expandedInsightIndex === i ? 'Ocultar Residentes' : `Listar Residentes (${insight.memberNames.length})`}
                               <ChevronDown className={clsx("w-3 h-3 transition-transform", expandedInsightIndex === i && "rotate-180")} />
                             </button>
                             {expandedInsightIndex === i && (
                               <div className="mt-2 p-2 bg-black/20 rounded-xl space-y-1 max-h-36 overflow-y-auto border border-white/5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                 {insight.memberNames.map(name => (
                                   <div key={name} className="text-[10px] text-gray-300 font-medium py-0.5 border-b border-white/5 last:border-0">{name}</div>
                                 ))}
                               </div>
                             )}
                           </div>
                         )}
                      </div>
                    )) : (
                      <div className="text-center py-8 opacity-50">
                         <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400 animate-pulse" />
                         <p className="text-xs font-semibold">Nenhuma localidade sem GC ativa está acima do mínimo ({territorialInsights.minMembersInAnyGC} membros/GC).</p>
                      </div>
                    )}
                 </div>
               </div>
               <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-primary-600/20 rounded-full blur-3xl"></div>
            </div>

            {/* Coluna Direita: Auditoria & Diagnósticos de Expansão */}
            
              {/* Painel de Auditoria de Alocação */}
              <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-500" /> Auditoria de Saúde & Alocação
                </h4>
                <span className="text-[10px] bg-amber-50 text-amber-700 font-extrabold px-2 py-0.5 rounded-full border border-amber-100 animate-pulse">
                  {auditData.allocationMismatches.length + auditData.overcrowdedGCs.length + auditData.criticalGCs.length} pendências
                </span>
              </div>
              
              <div className="space-y-3">
                {/* 1. Collapsible: Allocation Mismatches */}
                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                  <button 
                    onClick={() => setIsAuditMismatchesExpanded(!isAuditMismatchesExpanded)}
                    className="w-full flex items-center justify-between p-3.5 bg-gray-50/50 hover:bg-gray-50 text-left transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-indigo-500" />
                      <span className="text-xs font-bold text-gray-700">Desvios Territoriais</span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded-full">
                        {auditData.allocationMismatches.length}
                      </span>
                    </div>
                    <ChevronDown className={clsx("w-4 h-4 text-gray-400 transition-transform", isAuditMismatchesExpanded && "rotate-180")} />
                  </button>
                  
                  {isAuditMismatchesExpanded && (
                    <div className="p-3 bg-white space-y-3 max-h-60 overflow-y-auto divide-y divide-gray-50 scrollbar-thin">
                      {auditData.allocationMismatches.length > 0 ? (
                        auditData.allocationMismatches.map((mismatch: any) => (
                          <div key={mismatch.memberId} className="pt-2 first:pt-0 space-y-1">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-gray-800">{mismatch.memberName}</span>
                                <button
                                  onClick={() => handleLocalizeMember(mismatch.memberId)}
                                  className="text-[9px] font-semibold text-indigo-600 hover:text-indigo-850 hover:underline cursor-pointer flex items-center gap-0.5"
                                  title="Localizar este membro no mapa"
                                >
                                  📍 Localizar
                                </button>
                              </div>
                              <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-bold uppercase shrink-0">
                                {mismatch.memberRA}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500 leading-relaxed">
                              Reside em <span className="font-semibold text-gray-700">{mismatch.memberBairro}</span>, mas está alocado em <span className="font-semibold text-indigo-600">{mismatch.currentGC}</span>.
                            </p>
                            {mismatch.hasLocalGCs && (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-1">
                                <span className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-md font-semibold">
                                  💡 GCs locais: {mismatch.localGCs.join(', ')}
                                </span>
                                <button
                                  onClick={() => {
                                    setSelectedSource(mismatch.currentGC);
                                    setSelectedTarget(mismatch.localGCs[0]);
                                    window.scrollTo({ top: 300, behavior: 'smooth' });
                                  }}
                                  className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline text-left cursor-pointer transition-all"
                                >
                                  Remanejar para GC Local ➔
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-gray-400 text-center py-2">Nenhum desvio territorial detectado.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Collapsible: Overcrowded GCs */}
                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                  <button 
                    onClick={() => setIsAuditOvercrowdedExpanded(!isAuditOvercrowdedExpanded)}
                    className="w-full flex items-center justify-between p-3.5 bg-gray-50/50 hover:bg-gray-50 text-left transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-rose-500" />
                      <span className="text-xs font-bold text-gray-700">GCs Superlotados (&gt; 15)</span>
                      <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded-full">
                        {auditData.overcrowdedGCs.length}
                      </span>
                    </div>
                    <ChevronDown className={clsx("w-4 h-4 text-gray-400 transition-transform", isAuditOvercrowdedExpanded && "rotate-180")} />
                  </button>
                  
                  {isAuditOvercrowdedExpanded && (
                    <div className="p-3 bg-white space-y-2 max-h-48 overflow-y-auto divide-y divide-gray-50 scrollbar-thin">
                      {auditData.overcrowdedGCs.length > 0 ? (
                        auditData.overcrowdedGCs.map((gc: any) => (
                          <div key={gc.gc} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                            <span className="font-semibold text-gray-700">{gc.gc}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-rose-600">{gc.count} membros</span>
                              <button
                                onClick={() => handleLocalizeGC(gc.gc)}
                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                              >
                                📍 Localizar
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedSource(gc.gc);
                                  window.scrollTo({ top: 300, behavior: 'smooth' });
                                }}
                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                              >
                                Selecionar
                              </button>
                              <button
                                onClick={() => handleOpenRearrange(gc.gc)}
                                className="text-[10px] font-bold text-amber-600 hover:text-amber-800 hover:underline cursor-pointer flex items-center gap-0.5 mr-1"
                                title="Rearranjar membros deslocados para GCs locais de seus bairros"
                              >
                                🔄 Rearranjar
                              </button>
                              <button
                                onClick={() => handleMultiplyCell(gc.gc)}
                                className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 hover:underline cursor-pointer flex items-center gap-0.5"
                                title="Multiplicar este GC automaticamente mantendo as famílias unidas"
                              >
                                ⚡ Multiplicar
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-gray-400 text-center py-2">Nenhum GC superlotado.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Collapsible: Critical GCs */}
                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                  <button 
                    onClick={() => setIsAuditCriticalExpanded(!isAuditCriticalExpanded)}
                    className="w-full flex items-center justify-between p-3.5 bg-gray-50/50 hover:bg-gray-50 text-left transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-bold text-gray-700">GCs Críticos (&lt; 5)</span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-full">
                        {auditData.criticalGCs.length}
                      </span>
                    </div>
                    <ChevronDown className={clsx("w-4 h-4 text-gray-400 transition-transform", isAuditCriticalExpanded && "rotate-180")} />
                  </button>
                  
                  {isAuditCriticalExpanded && (
                    <div className="p-3 bg-white space-y-2 max-h-48 overflow-y-auto divide-y divide-gray-50 scrollbar-thin">
                      {auditData.criticalGCs.length > 0 ? (
                        auditData.criticalGCs.map((gc: any) => (
                          <div key={gc.gc} className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                            <span className="font-semibold text-gray-700">{gc.gc}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-amber-600">{gc.count} membros</span>
                              <button
                                onClick={() => handleLocalizeGC(gc.gc)}
                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                              >
                                📍 Localizar
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedTarget(gc.gc);
                                  window.scrollTo({ top: 300, behavior: 'smooth' });
                                }}
                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                              >
                                Destinar
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-gray-400 text-center py-2">Nenhum GC abaixo de 5 membros.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* 4. Collapsible: Strategic Suggestions */}
                <div className="border border-indigo-100 rounded-2xl overflow-hidden bg-indigo-50/20">
                  <button 
                    onClick={() => setIsAuditSuggestionsExpanded(!isAuditSuggestionsExpanded)}
                    className="w-full flex items-center justify-between p-3.5 bg-indigo-50/40 hover:bg-indigo-50 text-left transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-indigo-600 animate-pulse" />
                      <span className="text-xs font-bold text-indigo-900">Recomendações e Nomenclatura</span>
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded-full">
                        💡 Diretrizes
                      </span>
                    </div>
                    <ChevronDown className={clsx("w-4 h-4 text-indigo-400 transition-transform", isAuditSuggestionsExpanded && "rotate-180")} />
                  </button>
                  
                  {isAuditSuggestionsExpanded && (
                    <div className="p-4 bg-white space-y-3 divide-y divide-gray-50 text-xs animate-in fade-in duration-300">
                      {/* Suggestion 1: Rename Recanto to Recanto-Entorno */}
                      <div className="pt-2 first:pt-0 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-gray-800">Renomear GCs do Recanto</span>
                          <span className="text-[8px] bg-amber-50 text-amber-700 border border-amber-100 px-1.5 py-0.2 rounded font-black uppercase">Recomendado</span>
                        </div>
                        <p className="text-[10px] text-gray-500 leading-relaxed">
                          Membros residentes no <span className="font-semibold text-gray-700">Entorno</span> estão alocados em GCs do <span className="font-semibold text-gray-700">Recanto</span>. Recomendamos renomear esses GCs para <span className="font-bold text-indigo-600">"[Nome] Recanto-Entorno"</span> para integrá-los e oficializar a cobertura territorial híbrida.
                        </p>
                      </div>

                      {/* Suggestion 2: Lago Norte / Noroeste / Itapoã in Asa Norte */}
                      <div className="pt-3 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-gray-800">Alocação de Regiões Sem Quórum</span>
                          <span className="text-[8px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.2 rounded font-black uppercase">Diretriz</span>
                        </div>
                        <p className="text-[10px] text-gray-500 leading-relaxed">
                          As regiões de <span className="font-semibold text-gray-700">Lago Norte, Noroeste, Itapoã e Sobradinho</span> não possuem quórum ou GCs locais ativos. A diretriz estratégica é alocar esses membros nos GCs ativos da <span className="font-bold text-indigo-600">Asa Norte</span>.
                        </p>
                      </div>

                      {/* Suggestion 3: Sudoeste and Cruzeiro in Asa Sul */}
                      <div className="pt-3 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-gray-800">Sudoeste & Cruzeiro ➔ Asa Sul</span>
                          <span className="text-[8px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.2 rounded font-black uppercase">Diretriz</span>
                        </div>
                        <p className="text-[10px] text-gray-500 leading-relaxed">
                          Membros do <span className="font-semibold text-gray-700">Sudoeste e Cruzeiro</span> devem ser idealmente acolhidos nos GCs ativos da <span className="font-bold text-indigo-600">Asa Sul</span> para melhor acompanhamento geográfico.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Summary of Changes */}
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
               <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Resumo do Cenário Draft
               </h4>
               <div className="space-y-6">
                  <div>
                     <div className="flex justify-between text-sm mb-2 font-medium">
                        <span className="text-gray-500">Membros Alocados Fora da Base Real</span>
                        <span className="font-extrabold text-indigo-600">
                           {impactStats.changes}
                        </span>
                     </div>
                     <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 transition-all duration-500"
                          style={{ width: `${Math.min((impactStats.changes / draftMembers.length) * 100 * 5, 100)}%` }}
                        />
                     </div>
                  </div>
                   {impactStats.movedMembers && impactStats.movedMembers.length > 0 ? (
                     <div className="space-y-2.5 pt-4 border-t border-gray-50">
                       <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Mapeamento de Transferências (De ➔ Para)</label>
                       <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                         {impactStats.movedMembers.map(m => (
                           <div key={m.id} className="p-2.5 bg-gray-50 border border-gray-100 rounded-xl space-y-1.5 hover:bg-gray-100/70 transition-all">
                             <div className="flex justify-between items-center">
                               <span className="text-xs font-bold text-gray-800">{m.nome}</span>
                               {m.bairro && (
                                 <span className="text-[8px] bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded">
                                   📍 {m.bairro}
                                 </span>
                               )}
                             </div>
                             <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-semibold">
                               <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-100 line-through truncate max-w-[150px]">{m.de}</span>
                               <span className="text-gray-400 font-bold">➔</span>
                               <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100 font-extrabold truncate max-w-[150px]">{m.para}</span>
                             </div>
                           </div>
                         ))}
                       </div>
                     </div>
                   ) : (
                     <div className="text-center py-4 bg-gray-50/50 border border-dashed border-gray-200 rounded-2xl">
                       <p className="text-[11px] text-gray-400 font-bold">Nenhuma alteração simulada ainda</p>
                       <p className="text-[9px] text-gray-400 font-medium">Mova membros entre os GCs para ver o resumo de transferência aqui.</p>
                     </div>
                   )}

                  <div className="pt-4 border-t border-gray-50">
                     <p className="text-xs text-gray-500 leading-relaxed">
                       <strong>Nota de Auxílio:</strong> Se as mudanças planejadas estiverem satisfatórias, você pode exportar este plano em formato PDF/Excel usando o botão "Salvar Modelo" para apresentá-lo na próxima reunião de liderança.
                     </p>
                  </div>
               </div>
            </div>

          </div>
      
      {/* 4. Overlay Modal: Create Custom Sandbox GC */}
      {isCreateCellOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-primary-600" /> Criar Novo GC (Draft)
              </h3>
              <button 
                onClick={() => {
                  setIsCreateCellOpen(false); setIsCustomLeader(false); setIsCustomSector(false);
                  setNewCellName('');
                  setNewCellLeader('');
                  setNewCellSector('');
                }}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-gray-500 leading-relaxed font-semibold">
              Crie uma nova célula sandbox temporária para simular transferências e organizar redes de multiplicação.
            </p>
            
            <div className="space-y-3.5">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Nome do GC (Ex: BSB ARNIQUEIRA)</label>
                <input 
                  type="text" 
                  value={newCellName}
                  onChange={e => setNewCellName(e.target.value)}
                  placeholder="Ex: BSB ARNIQUEIRA"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-primary-500 outline-none text-gray-800"
                />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Líder do GC (Opcional)</label>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsCustomLeader(!isCustomLeader);
                      setNewCellLeader('');
                    }}
                    className="text-[9px] font-bold text-primary-600 hover:text-primary-800 hover:underline cursor-pointer transition-all"
                  >
                    {isCustomLeader ? "📋 Selecionar da Base" : "✍️ Digitar Personalizado"}
                  </button>
                </div>
                {isCustomLeader ? (
                  <input 
                    type="text" 
                    value={newCellLeader}
                    onChange={e => setNewCellLeader(e.target.value)}
                    placeholder="Digite o nome do líder"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-primary-500 outline-none text-gray-800"
                  />
                ) : (
                  <select 
                    value={newCellLeader}
                    onChange={e => setNewCellLeader(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-primary-500 outline-none text-gray-800 cursor-pointer"
                  >
                    <option value="">-- Selecione um Líder da Base --</option>
                    {draftMembers
                      .filter(m => m.status === 'Ativo')
                      .map(m => m.nome)
                      .sort()
                      .map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))
                    }
                  </select>
                )}
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Setor (Opcional)</label>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsCustomSector(!isCustomSector);
                      setNewCellSector('');
                    }}
                    className="text-[9px] font-bold text-primary-600 hover:text-primary-800 hover:underline cursor-pointer transition-all"
                  >
                    {isCustomSector ? "📋 Selecionar da Base" : "✍️ Digitar Personalizado"}
                  </button>
                </div>
                {isCustomSector ? (
                  <input 
                    type="text" 
                    value={newCellSector}
                    onChange={e => setNewCellSector(e.target.value)}
                    placeholder="Digite o setor"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-primary-500 outline-none text-gray-800"
                  />
                ) : (
                  <select 
                    value={newCellSector}
                    onChange={e => setNewCellSector(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-primary-500 outline-none text-gray-800 cursor-pointer"
                  >
                    <option value="">-- Selecione um Setor da Base --</option>
                    {uniqueSectors.map(sector => (
                      <option key={sector} value={sector}>{sector}</option>
                    ))}
                  </select>
                )}
              </div>

            </div>
            
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => {
                  setIsCreateCellOpen(false); setIsCustomLeader(false); setIsCustomSector(false);
                  setNewCellName('');
                  setNewCellLeader('');
                  setNewCellSector('');
                }}
                className="flex-1 px-4 py-2.5 text-xs font-black text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all text-center cursor-pointer active:scale-95"
              >
                Cancelar
              </button>
              <button 
                disabled={!newCellName.trim()}
                onClick={() => {
                  const name = newCellName.trim().toUpperCase();
                  const newCell: Cell = {
                    id: 'draft_cell_' + Date.now(),
                    grupo_caseiro: name,
                    lider: newCellLeader.trim().toUpperCase() || 'LÍDER SIMULADO',
                    setor: newCellSector.trim() || 'SETOR SIMULADO'
                  };
                  setDraftCells(prev => [...prev, newCell]);
                  setSelectedTarget(newCell.grupo_caseiro);
                  setIsCreateCellOpen(false); setIsCustomLeader(false); setIsCustomSector(false);
                  setNewCellName('');
                  setNewCellLeader('');
                  setNewCellSector('');
                }}
                className="flex-1 px-4 py-2.5 text-xs font-black text-white bg-primary-600 rounded-xl hover:bg-primary-500 disabled:opacity-40 disabled:hover:bg-primary-600 transition-all text-center cursor-pointer active:scale-95"
              >
                Criar GC
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Multiplication Preview Modal */}
      {multiplyModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-indigo-600 to-primary-600 text-white flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-lg font-black flex items-center gap-2">
                  <Brain className="w-5 h-5 animate-pulse" />
                  Planejar Multiplicação de Célula (Ajuste Sandbox)
                </h3>
                <p className="text-xs text-indigo-100 leading-relaxed max-w-2xl">
                  O algoritmo balanceou os tamanhos mantendo as famílias unidas. Ajuste o nome da célula filha e mova membros usando as setas se desejar refinar a alocação antes de confirmar!
                </p>
              </div>
              <button 
                onClick={() => setMultiplyModalOpen(false)}
                className="text-white/80 hover:text-white transition-colors text-2xl font-bold focus:outline-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Name Configurations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Célula Mãe (Original)
                  </label>
                  <input
                    type="text"
                    readOnly
                    className="w-full px-3.5 py-2 bg-gray-200 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 cursor-not-allowed focus:outline-none"
                    value={multiplyOriginalCellName}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-1">
                    Célula Filha (Nova Célula Rascunho)
                  </label>
                  <input
                    type="text"
                    className="w-full px-3.5 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Nome da nova célula..."
                    value={multiplyNewCellName}
                    onChange={(e) => setMultiplyNewCellName(e.target.value)}
                  />
                </div>
              </div>

              {/* Parallel Split View */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Column A: Mother Cell */}
                <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50 flex flex-col h-[350px]">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-3 shrink-0">
                    <span className="text-xs font-bold text-gray-700 truncate max-w-[200px]">
                      🔴 {multiplyOriginalCellName}
                    </span>
                    <span className="text-[10px] bg-red-100 text-red-800 font-black px-2 py-0.5 rounded-full">
                      {multiplyGroupA.length} membros
                    </span>
                  </div>

                  <div className="overflow-y-auto flex-1 space-y-1.5 scrollbar-thin pr-1">
                    {multiplyGroupA.length === 0 ? (
                      <div className="text-center py-12 text-xs text-gray-400 font-medium">Nenhum membro alocado.</div>
                    ) : (
                      multiplyGroupA.map((member) => (
                        <div key={member.id} className="bg-white border border-gray-100 hover:border-indigo-100 rounded-xl p-2.5 flex items-center justify-between text-xs transition-all shadow-sm animate-in fade-in slide-in-from-right-1 duration-150">
                          <div className="space-y-0.5 truncate pr-2">
                            <div className="font-bold text-gray-800 truncate">{member.nome}</div>
                            {member.bairro && (
                              <span className="text-[8px] bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-semibold">
                                📍 {member.bairro}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setMultiplyGroupA(prev => prev.filter(x => x.id !== member.id));
                              setMultiplyGroupB(prev => [...prev, member]);
                            }}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                            title="Mover para a Célula Filha"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Column B: Daughter Cell */}
                <div className="border border-emerald-100 rounded-2xl p-4 bg-emerald-50/10 flex flex-col h-[350px]">
                  <div className="flex justify-between items-center border-b border-emerald-100 pb-2 mb-3 shrink-0">
                    <span className="text-xs font-bold text-emerald-800 truncate max-w-[200px]">
                      🟢 {multiplyNewCellName || 'Nova Célula'}
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded-full">
                      {multiplyGroupB.length} membros
                    </span>
                  </div>

                  <div className="overflow-y-auto flex-1 space-y-1.5 scrollbar-thin pr-1">
                    {multiplyGroupB.length === 0 ? (
                      <div className="text-center py-12 text-xs text-gray-400 font-medium">Nenhum membro alocado.</div>
                    ) : (
                      multiplyGroupB.map((member) => (
                        <div key={member.id} className="bg-white border border-gray-100 hover:border-emerald-100 rounded-xl p-2.5 flex items-center justify-between text-xs transition-all shadow-sm animate-in fade-in slide-in-from-left-1 duration-150">
                          <button
                            onClick={() => {
                              setMultiplyGroupB(prev => prev.filter(x => x.id !== member.id));
                              setMultiplyGroupA(prev => [...prev, member]);
                            }}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                            title="Mover de volta para a Célula Mãe"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                          <div className="space-y-0.5 truncate pl-2 text-right">
                            <div className="font-bold text-gray-800 truncate">{member.nome}</div>
                            {member.bairro && (
                              <span className="text-[8px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-semibold font-medium">
                                📍 {member.bairro}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setMultiplyModalOpen(false)}
                className="px-4 py-2 border border-gray-200 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-500 transition-colors cursor-pointer"
              >
                ❌ Cancelar
              </button>
              <button
                onClick={handleConfirmMultiply}
                disabled={multiplyGroupA.length === 0 && multiplyGroupB.length === 0}
                className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                ✅ Confirmar Multiplicação
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Rearrange Displaced Members Wizard Modal */}
      {rearrangeModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-amber-500 to-primary-600 text-white flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-lg font-black flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 animate-spin" style={{ animationDuration: '4s' }} />
                  Reorganizar Membros Deslocados (Ajuste Territorial)
                </h3>
                <p className="text-xs text-amber-50 leading-relaxed max-w-2xl">
                  Identificamos membros em <strong>{rearrangeCellName}</strong> que residem em outras regiões administratívas. Veja as sugestões de remanejamento para os GCs locais de seus próprios bairros!
                </p>
              </div>
              <button 
                onClick={() => setRearrangeModalOpen(false)}
                className="text-white/80 hover:text-white transition-colors text-2xl font-bold focus:outline-none"
              >
                &times;
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="text-xs text-gray-500 leading-relaxed bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Exceção de Liderança Garantida:</strong> O líder da célula e seus familiares diretos foram automaticamente omitidos desta lista e permanecerão na célula original Vicente Pires.
                </div>
              </div>

              <div className="space-y-3">
                {rearrangeItems.map((item, idx) => {
                  const allFamilyNames = [item.member.nome, ...item.familyMembers.map(f => f.nome)].join(', ');

                  return (
                    <div key={item.member.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      {/* Left: Member & Family info */}
                      <div className="space-y-1 truncate flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-gray-800 text-sm truncate">
                            👤 {item.member.nome}
                          </span>
                          {item.familyMembers.length > 0 && (
                            <span className="text-[9px] bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded-full">
                              +{item.familyMembers.length} familiares
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400 font-semibold truncate" title={allFamilyNames}>
                          Família: {allFamilyNames}
                        </div>
                        <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md inline-block font-semibold">
                          📍 Reside em: {item.member.bairro || 'Bairro indefinido'} ({item.homeRegion})
                        </div>
                      </div>

                      {/* Right: Dropdown target selector */}
                      <div className="w-full sm:w-72 space-y-1 shrink-0">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">
                          Destino Sugerido
                        </label>
                        <select
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:ring-2 focus:ring-primary-500 outline-none"
                          value={item.suggestedCell}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRearrangeItems(prev => prev.map((x, i) => i === idx ? { ...x, suggestedCell: val } : x));
                          }}
                        >
                          <option value="KEEP">🔴 Manter em {rearrangeCellName}</option>
                          {draftCells
                            .filter(c => c.grupo_caseiro !== rearrangeCellName)
                            .map(c => (
                              <option key={c.id} value={c.grupo_caseiro}>
                                🟢 Transferir para {c.grupo_caseiro} ({c.lider})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setRearrangeModalOpen(false)}
                className="px-4 py-2 border border-gray-200 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-500 transition-colors cursor-pointer"
              >
                ❌ Cancelar
              </button>
              <button
                onClick={handleConfirmRearrange}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-primary-600 hover:from-amber-600 hover:to-primary-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                ✅ Efetivar Reorganização Regional
              </button>
            </div>
          </div>
        </div>
      )}



      {/* PROVER API Integration Modal */}
      {proverModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-md w-full p-6 text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center space-y-2">
              <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-full animate-bounce">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-gray-900">
                Ponte de Homologação PROVER API
              </h3>
              <p className="text-xs text-gray-400 font-medium leading-relaxed">
                Transmitindo com segurança as alterações do cenário Sandbox para a moderação e banco de dados oficial do sistema PROVER.
              </p>
            </div>

            {/* Status Steps */}
            <div className="text-left space-y-3.5 border border-gray-100 bg-gray-50/50 p-4.5 rounded-2xl">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-700 flex items-center gap-2">
                  🔐 1. Estabelecer túnel SSL criptografado
                </span>
                {proverLoadingStep >= 1 ? (
                  <span className="text-[10px] text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">CONECTADO</span>
                ) : (
                  <span className="text-[10px] text-indigo-600 font-extrabold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 animate-pulse">PROCESSANDO...</span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-700 flex items-center gap-2">
                  👤 2. Autenticar credenciais de Pastor Titular
                </span>
                {proverLoadingStep >= 2 ? (
                  <span className="text-[10px] text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">AUTENTICADO</span>
                ) : proverLoadingStep === 1 ? (
                  <span className="text-[10px] text-indigo-600 font-extrabold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 animate-pulse">AUTENTICANDO...</span>
                ) : (
                  <span className="text-[10px] text-gray-400 font-bold">AGUARDANDO</span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-700 flex items-center gap-2">
                  📊 3. Transmitir lote de {impactStats.changes} remanejamentos
                </span>
                {proverComplete ? (
                  <span className="text-[10px] text-emerald-600 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">HOMOLOGADO</span>
                ) : proverLoadingStep === 2 ? (
                  <span className="text-[10px] text-indigo-600 font-extrabold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 animate-pulse">TRANSMITINDO...</span>
                ) : (
                  <span className="text-[10px] text-gray-400 font-bold">AGUARDANDO</span>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500"
                style={{ 
                  width: proverComplete ? '100%' : `${proverLoadingStep * 33 + 10}%` 
                }}
              />
            </div>

            {/* Bottom Actions */}
            {proverComplete ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50 text-emerald-800 text-[11px] leading-relaxed font-bold border border-emerald-100 rounded-xl">
                  🎉 Lote de Simulação Homologado com Sucesso! Os remanejamentos e novas células foram enviados e integrados à moderação administrativa do PROVER. As mudanças estarão ativas em instantes.
                </div>
                <button
                  onClick={() => setProverModalOpen(false)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow transition-all cursor-pointer active:scale-95"
                >
                  Concluir e Voltar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setProverModalOpen(false)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95"
              >
                Cancelar Transmissão
              </button>
            )}
          </div>
        </div>
      )}



    </div>
    </div>
  );
};
