import { useMemo } from 'react';
import { Member, Family } from '../pages/Simulations';
import { 
  normalizeName, 
  normalizePhone, 
  normalizeAddress, 
  calculateAge 
} from '../lib/geoUtils';

export const useFamilyEngine = (draftMembers: Member[]): Record<string, Family> => {
  return useMemo((): Record<string, Family> => {
    if (draftMembers.length === 0) return {};
    
    const memberById = new Map<string, Member>();
    const memberByName = new Map<string, Member>();
    
    draftMembers.forEach(m => {
      const idStr = m.id.toString();
      memberById.set(idStr, m);
      const normName = normalizeName(m.nome);
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

    // Rule 1: Parent-child connection
    draftMembers.forEach(m => {
      const idStr = m.id.toString();
      const p1 = normalizeName(m.pai);
      const p2 = normalizeName(m.mae);
      
      if (p1 && memberByName.has(p1)) {
        union(idStr, memberByName.get(p1)!.id.toString());
      }
      if (p2 && memberByName.has(p2)) {
        union(idStr, memberByName.get(p2)!.id.toString());
      }
    });

    // Rule 2: Share the same parent string (siblings)
    const byParents = new Map<string, string[]>();
    draftMembers.forEach(m => {
      const idStr = m.id.toString();
      const p1 = normalizeName(m.pai);
      const p2 = normalizeName(m.mae);
      if (p1) {
        if (!byParents.has(p1)) byParents.set(p1, []);
        byParents.get(p1)!.push(idStr);
      }
      if (p2) {
        if (!byParents.has(p2)) byParents.set(p2, []);
        byParents.get(p2)!.push(idStr);
      }
    });
    byParents.forEach(ids => {
      for (let k = 1; k < ids.length; k++) {
        union(ids[0], ids[k]);
      }
    });

    // Rule 3: Share the same phone number (>= 8 digits)
    const byPhone = new Map<string, string[]>();
    draftMembers.forEach(m => {
      const idStr = m.id.toString();
      const ph1 = normalizePhone(m.celular_principal_sms);
      const ph2 = normalizePhone(m.telefone_fixo);
      [ph1, ph2].forEach(ph => {
        if (ph && ph.length >= 8) {
          if (!byPhone.has(ph)) byPhone.set(ph, []);
          byPhone.get(ph)!.push(idStr);
        }
      });
    });
    byPhone.forEach(ids => {
      for (let k = 1; k < ids.length; k++) {
        union(ids[0], ids[k]);
      }
    });

    // Rule 4: Share the exact same address
    const byAddress = new Map<string, string[]>();
    draftMembers.forEach(m => {
      const idStr = m.id.toString();
      const addr = normalizeAddress(m.logradouro);
      if (addr && addr.length > 6) {
        if (!byAddress.has(addr)) byAddress.set(addr, []);
        byAddress.get(addr)!.push(idStr);
      }
    });
    byAddress.forEach(ids => {
      for (let k = 1; k < ids.length; k++) {
        union(ids[0], ids[k]);
      }
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
      
      // Determine Head
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
          const normName = normalizeName(m.nome);
          return familyMembers.some(c => 
            normalizeName(c.pai) === normName || 
            normalizeName(c.mae) === normName
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

      result[rootId] = {
        id: rootId,
        name: familyName,
        headId: headIdStr,
        memberIds: mIds
      };
    });

    return result;
  }, [draftMembers]);
};
