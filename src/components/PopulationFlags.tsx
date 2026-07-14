import React from 'react';
import type { PopulationMode } from '../lib/populationScope';

export const PopulationFlags: React.FC<{
  value: PopulationMode;
  onChange: (value: PopulationMode) => void;
  className?: string;
}> = ({ value, onChange, className = '' }) => (
  <div className={`flex flex-wrap items-center gap-3 text-[11px] ${className}`}>
    <span className="font-bold uppercase tracking-wider text-indigo-500">População:</span>
    <label className="inline-flex items-center gap-1.5 cursor-pointer">
      <input type="checkbox" checked={value === 'local'} onChange={() => onChange(value === 'local' ? 'todos' : 'local')} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
      Somente local
    </label>
    <label className="inline-flex items-center gap-1.5 cursor-pointer">
      <input type="checkbox" checked={value === 'vinculado'} onChange={() => onChange(value === 'vinculado' ? 'todos' : 'vinculado')} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
      Somente vinculado
    </label>
  </div>
);
