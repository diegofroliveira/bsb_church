import { useMemo } from 'react';
import { 
  normalizeName, 
  normalizePhone, 
  normalizeAddress, 
  calculateAge 
} from '../lib/geoUtils';

export interface Member {
  id: number;
  nome: string;
  grupos_caseiros: string | null;
  status: string;
  sexo: string;
  bairro: string | null;
  pai: string | null;
  mae: string | null;
  logradouro: string | null;
  celular_principal_sms: string | null;
  telefone_fixo: string | null;
  estado_civil: string | null;
  nascimento: string | null;
  latitude?: number | null;
  longitude?: number | null;
  tipo_de_pessoa?: string | null;
  cidade?: string | null;
  estado?: string | null;
}

export interface Cell {
  id: string;
  grupo_caseiro: string;
  lider: string;
  setor: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface DiscipleshipLink {
  discipulador: string;
  discipulo: string;
}

export interface Family {
  id: string;
  name: string;
  headId: string;
  memberIds: string[];
}

export interface FamilyRelation {
  id_pessoa_a: number;
  pessoa_a: string;
  parentesco: string;
  id_pessoa_b: number;
  pessoa_b: string;
  mesmo_domicilio: string;
  data?: string | null;
}

export const useFamilyEngine = (
  draftMembers: Member[],
  relations: FamilyRelation[] = []
): Record<string, Family> => {
  return useMemo((): Record<string, Family> => {
    if (draftMembers.length === 0) return {};
    
    const memberById = new Map<string, Member>();
    const memberByName = new Map<string, Member>();
    
    // Robust name cleanup that strips quotes and extra whitespaces
    const cleanName = (name: string | null | undefined): string => {
      if (!name) return '';
      return name.replace(/['"]/g, '').trim().toUpperCase().replace(/\s+/g, ' ');
    };

    draftMembers.forEach(m => {
      const idStr = m.id.toString();
      memberById.set(idStr, m);
      const normName = cleanName(m.nome);
      if (normName) memberByName.set(normName, m);
    });

    // DSU logic
    const parentDSU = new Map<string, string>();
    const find = (i: string): string => {
      let root = i;
      while (parentDSU.get(root) !== undefined) {
        root = parentDSU.get(root)!;
      }
      let curr = i;
      while (curr !== root) {
        let nxt = parentDSU.get(curr)!;
        parentDSU.set(curr, root);
        curr = nxt;
      }
      return root;
    };
    
    const union = (i: string, j: string) => {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) {
        parentDSU.set(rootI, rootJ);
      }
    };

    // Step 1: Group strictly using the official Prover "Pessoas x Familiares" relations (where Mesmo Domicilio = "Sim")
    if (Array.isArray(relations) && relations.length > 0) {
      relations.forEach(rel => {
        const mesmoDomicilio = rel.mesmo_domicilio || '';
        if (mesmoDomicilio.toUpperCase().trim() === 'SIM') {
          const idAStr = rel.id_pessoa_a?.toString();
          const idBStr = rel.id_pessoa_b?.toString();
          if (idAStr && idBStr && memberById.has(idAStr) && memberById.has(idBStr)) {
            union(idAStr, idBStr);
          }
        }
      });
    }

    // No address or text fallback grouping is used.
    // Grouping is done strictly by the explicit relationships defined by the database IDs in Prover "Pessoas x Familiares" table.


    // Collect components
    const components: Record<string, string[]> = {};
    draftMembers.forEach(m => {
      const idStr = m.id.toString();
      const root = find(idStr);
      if (!components[root]) components[root] = [];
      components[root].push(idStr);
    });

    // Build Family definitions
    const result: Record<string, Family> = {};
    Object.entries(components).forEach(([rootId, mIds]) => {
      const familyMembers = mIds.map(id => memberById.get(id)!);
      
      // Determine Head of Family
      let head = familyMembers[0];
      
      const marriedMale = familyMembers.find(m => 
        m.sexo === 'Masculino' && 
        m.estado_civil && 
        m.estado_civil.toUpperCase().includes('CASADO')
      );
      if (marriedMale) {
        head = marriedMale;
      } else {
        const parent = familyMembers.find(m => {
          const normName = cleanName(m.nome);
          return familyMembers.some(c => 
            cleanName(c.pai) === normName || 
            cleanName(c.mae) === normName
          );
        });
        if (parent) {
          head = parent;
        } else {
          let oldest = head;
          let oldestAge = -1;
          familyMembers.forEach(m => {
            const age = calculateAge(m.nascimento);
            if (age > oldestAge) {
              oldestAge = age;
              oldest = m;
            }
          });
          head = oldest;
        }
      }

      const headIdStr = head.id.toString();
      const nameParts = head.nome.trim().split(' ');
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
      const familyName = lastName 
        ? `Família ${lastName} (${head.nome.split(' ')[0]})`
        : `Família de ${head.nome}`;

      result[headIdStr] = {
        id: headIdStr,
        name: familyName,
        headId: headIdStr,
        memberIds: mIds
      };
    });

    return result;
  }, [draftMembers, relations]);
};
