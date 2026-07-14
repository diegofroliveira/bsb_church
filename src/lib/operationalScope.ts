const TECHNICAL_GROUPS = new Set(['COBERTURA - VIX']);

export const normalizeGroupName = (value: unknown): string =>
  String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();

export const isTechnicalGroup = (value: unknown): boolean =>
  TECHNICAL_GROUPS.has(normalizeGroupName(value));

export const filterOperationalMembers = <T extends { grupos_caseiros?: unknown }>(rows: T[]): T[] =>
  rows.filter(row => !isTechnicalGroup(row.grupos_caseiros));

export const filterOperationalCells = <T extends { grupo_caseiro?: unknown }>(rows: T[]): T[] =>
  rows.filter(row => !isTechnicalGroup(row.grupo_caseiro));
