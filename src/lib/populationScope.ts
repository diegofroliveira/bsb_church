export type PopulationMode = 'todos' | 'local' | 'vinculado';

const EXCLUDED_LOCAL_TYPES = new Set([
  'CONTADOR',
  'EXTERNO',
  'EXTRA LOCAL',
  'FUNCIONARIO',
  'VISITANTE',
  'APOSTOLO'
]);

const normalizeType = (member: any): string => String(member?.tipo_de_pessoa || member?.tipo_cadastro || '')
  .trim()
  .toUpperCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

export const isLocalPopulationMember = (member: any): boolean =>
  member?.status === 'Ativo' && !EXCLUDED_LOCAL_TYPES.has(normalizeType(member));

export const isLinkedPopulationMember = (member: any): boolean =>
  isLocalPopulationMember(member) && normalizeType(member) !== 'AGREGADO' && normalizeType(member) !== 'AGREGADOS';

export const matchesPopulationMode = (member: any, mode: PopulationMode): boolean =>
  mode === 'todos' || (mode === 'local' ? isLocalPopulationMember(member) : isLinkedPopulationMember(member));
