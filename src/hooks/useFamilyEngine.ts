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
  tipo_cadastro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  setor_eclesiastico?: string | null;
  setor_residencial?: string | null;
  email?: string | null;
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
          if (idAStr && idBStr) {
            // Programmatic hotfix: ignore the incorrect sibling link between Sophie Meneses (756641) and Symon Mendes (2397467)
            // which was created by a typo in the Prover system due to name similarity with Sophye Mendes.
            if ((idAStr === '756641' && idBStr === '2397467') || (idAStr === '2397467' && idBStr === '756641')) {
              return;
            }
            // Union regardless of whether they are active or inactive in the database,
            // so that if a titular becomes inactive, their active dependents still stay connected in the DSU!
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

export interface EnrichedMember extends Member {
  titular_nome: string;
  titular_id: string;
  parentesco: string;
  mesmo_domicilio: string;
  tamanho_familia: number;
  familia_dividida: boolean;
}

export const invertParentesco = (parentesco: string, relativeGender: string | null | undefined): string => {
  const p = parentesco.trim();
  if (p === 'Mãe' || p === 'Pai') return 'Filho(a)';
  if (p === 'Filho(a)') return relativeGender === 'Feminino' ? 'Mãe' : 'Pai';
  if (p === 'Sogro(a)') return 'Genro / Nora';
  if (p === 'Genro / Nora') return 'Sogro(a)';
  if (p === 'Tio(a)') return 'Sobrinho(a)';
  if (p === 'Sobrinho(a)') return 'Tio(a)';
  return p;
};

export const useFlattenedFamilies = (
  members: Member[],
  relations: FamilyRelation[],
  families: Record<string, Family>
): EnrichedMember[] => {
  return useMemo(() => {
    if (members.length === 0 || Object.keys(families).length === 0) {
      return [];
    }

    const memberById = new Map<string, Member>();
    members.forEach(m => memberById.set(m.id.toString(), m));

    const enrichedList: EnrichedMember[] = [];

    Object.entries(families).forEach(([headId, fam]) => {
      const headMember = memberById.get(headId);
      if (!headMember) return;

      const familyMembers = fam.memberIds
        .map(idStr => memberById.get(idStr))
        .filter((m): m is Member => !!m);

      const attendedGCs = new Set<string>();
      familyMembers.forEach(m => {
        if (m.grupos_caseiros) attendedGCs.add(m.grupos_caseiros);
      });
      const isDivided = attendedGCs.size > 1;

      familyMembers.forEach(m => {
        let parentesco = 'Titular';
        let mesmoDomicilio = 'Sim';

        if (m.id.toString() !== headId) {
          // Find relation between this member and the head
          const rel = relations.find(r => 
            (r.id_pessoa_a === m.id && r.id_pessoa_b === headMember.id) ||
            (r.id_pessoa_b === m.id && r.id_pessoa_a === headMember.id)
          );

          if (rel) {
            const isB = rel.id_pessoa_b === m.id;
            parentesco = isB ? (rel.parentesco || 'Familiar') : invertParentesco(rel.parentesco || 'Familiar', m.sexo);
            mesmoDomicilio = rel.mesmo_domicilio || 'Não';
          } else {
            // Check if there is any parentesco record to other members of same family
            const fallbackRel = relations.find(r => 
              (r.id_pessoa_a === m.id && fam.memberIds.includes(r.id_pessoa_b.toString())) ||
              (r.id_pessoa_b === m.id && fam.memberIds.includes(r.id_pessoa_a.toString()))
            );
            if (fallbackRel) {
              const isB = fallbackRel.id_pessoa_b === m.id;
              parentesco = isB ? (fallbackRel.parentesco || 'Familiar') : invertParentesco(fallbackRel.parentesco || 'Familiar', m.sexo);
              mesmoDomicilio = fallbackRel.mesmo_domicilio || 'Não';
            } else {
              parentesco = 'Familiar';
              mesmoDomicilio = 'Não';
            }
          }
        }

        enrichedList.push({
          ...m,
          titular_nome: headMember.nome,
          titular_id: headId,
          parentesco,
          mesmo_domicilio: mesmoDomicilio,
          tamanho_familia: familyMembers.length,
          familia_dividida: isDivided
        });
      });
    });

    const isSpouseParentesco = (p: string): boolean => {
      const norm = (p || '').trim().toUpperCase();
      return norm.includes('CÔNJUGE') || 
             norm.includes('CONJUGE') || 
             norm.includes('ESPOSA') || 
             norm.includes('ESPOSO') || 
             norm.includes('MARIDO') || 
             norm.includes('COMPANHEIR');
    };

    const getPriority = (m: any): number => {
      const isHead = m.parentesco === 'Titular';
      const isSameHome = m.mesmo_domicilio === 'Sim';
      const isSpouse = isSpouseParentesco(m.parentesco) || (m.estado_civil?.toUpperCase().includes('CASADO') && !isHead);

      if (isSameHome) {
        if (isHead) return 0;
        if (isSpouse) return 1;
        return 2;
      } else {
        if (isSpouse) return 3;
        return 4;
      }
    };

    // Sort by titular name, then by priority (Titular ➔ Spouse same-home ➔ Dependent same-home ➔ Spouse other-home ➔ Dependent other-home), then by name
    return enrichedList.sort((a, b) => {
      const compTitular = a.titular_nome.localeCompare(b.titular_nome);
      if (compTitular !== 0) return compTitular;
      
      const aPri = getPriority(a);
      const bPri = getPriority(b);
      if (aPri !== bPri) return aPri - bPri;

      return a.nome.localeCompare(b.nome);
    });
  }, [members, relations, families]);
};

