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

    // Pre-calculate address validity and normalized keys
    const memberAddresses = new Map<string, { key: string; isValid: boolean }>();
    draftMembers.forEach(m => {
      const addrKey = normalizeAddress(m.logradouro);
      const isValid = addrKey.length > 2 && !['naoinformado', 'semendereco', 'n/a', 'naoconsta'].includes(addrKey);
      memberAddresses.set(m.id.toString(), { key: addrKey, isValid });
    });

    // Step 2: Group strictly by exact same valid physical address
    const byAddress = new Map<string, string[]>();
    draftMembers.forEach(m => {
      const idStr = m.id.toString();
      const addr = memberAddresses.get(idStr)!;
      if (addr.isValid) {
        if (!byAddress.has(addr.key)) byAddress.set(addr.key, []);
        byAddress.get(addr.key)!.push(idStr);
      }
    });

    byAddress.forEach(ids => {
      for (let k = 1; k < ids.length; k++) {
        union(ids[0], ids[k]);
      }
    });

    // Step 3: Fallback grouping for missing/incomplete addresses (DSU)
    // We union them ONLY if BOTH members have invalid addresses, 
    // ensuring we never group people with valid addresses via parentage/spouse.
    draftMembers.forEach(m1 => {
      const id1 = m1.id.toString();
      const addr1 = memberAddresses.get(id1)!;

      draftMembers.forEach(m2 => {
        const id2 = m2.id.toString();
        if (id1 === id2) return;
        const addr2 = memberAddresses.get(id2)!;

        // Condition: BOTH members must have invalid/blank addresses.
        const canGroup = !addr1.isValid && !addr2.isValid;
        if (!canGroup) return;

        // Check 1: Spouse relation
        const spouse1 = cleanName(m1.esposo_a);
        const name2 = cleanName(m2.nome);
        const isSpouse = spouse1 && (spouse1 === name2 || name2.includes(spouse1) || spouse1.includes(name2));

        // Check 2: Parent-child relation
        const parent1 = cleanName(m2.pai);
        const parent2 = cleanName(m2.mae);
        const name1 = cleanName(m1.nome);
        const isParentChild = (parent1 && (parent1 === name1 || name1.includes(parent1) || parent1.includes(name1))) ||
                             (parent2 && (parent2 === name1 || name1.includes(parent2) || parent2.includes(name1)));

        // Check 3: Share a phone number
        const ph1_1 = normalizePhone(m1.celular_principal_sms);
        const ph1_2 = normalizePhone(m1.telefone_fixo);
        const ph2_1 = normalizePhone(m2.celular_principal_sms);
        const ph2_2 = normalizePhone(m2.telefone_fixo);
        const sharesPhone = (ph1_1 && ph1_1.length >= 8 && (ph1_1 === ph2_1 || ph1_1 === ph2_2)) ||
                            (ph1_2 && ph1_2.length >= 8 && (ph1_2 === ph2_1 || ph1_2 === ph2_2));

        if (isSpouse || isParentChild || sharesPhone) {
          union(id1, id2);
        }
      });
    });

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
