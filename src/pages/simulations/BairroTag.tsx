import React from 'react';
import clsx from 'clsx';
import type { Member, Cell } from '../../hooks/useFamilyEngine';
import { getAdministrativeRegion, getGCRegion, getFallbackRegion } from '../../lib/geoUtils';

interface BairroTagProps {
  member: Member;
  activeCell: Cell | undefined;
  allCells?: Cell[];
}

export const BairroTag: React.FC<BairroTagProps> = ({ member, activeCell, allCells }) => {
  if (!member.bairro) return null;
  const mRegion = getAdministrativeRegion(member.bairro);
  const cellRegion = activeCell ? getGCRegion(activeCell.grupo_caseiro) : '';
  
  if (!cellRegion) {
    return (
      <span className="text-[9px] text-indigo-500 bg-indigo-50/50 font-bold block mt-0.5">
        📍 {member.bairro}
      </span>
    );
  }

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
      title={!isCorrect ? `${member.bairro} (Fora do Setor do GC: ${cellRegion})` : member.bairro + (member.logradouro ? ` - ${member.logradouro}` : '')}
    >
      📍 {member.bairro} {!isCorrect && "⚠️ Fora do Setor"}
    </span>
  );
};
