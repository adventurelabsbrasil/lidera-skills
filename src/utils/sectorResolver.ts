import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

type SectorDoc = { id: string; name?: string; companyId?: string | null; companyIds?: string[] };

/**
 * Monta o mapa nome→id dos setores visíveis para um tenant.
 * Setor do próprio tenant tem prioridade sobre setor universal de mesmo nome.
 */
export const buildSectorIdByName = (
  sectors: SectorDoc[],
  companyId: string
): Record<string, string> => {
  const universal: Record<string, string> = {};
  const tenant: Record<string, string> = {};
  sectors.forEach((s) => {
    if (typeof s.name !== 'string') return;
    const ownedByTenant =
      s.companyId === companyId ||
      (Array.isArray(s.companyIds) && s.companyIds.includes(companyId));
    const isUniversal = s.companyId == null && !Array.isArray(s.companyIds);
    if (ownedByTenant) tenant[s.name] = s.id;
    else if (isUniversal) universal[s.name] = s.id;
  });
  return { ...universal, ...tenant };
};

export const loadSectorIdByName = async (companyId: string): Promise<Record<string, string>> => {
  const snap = await getDocs(collection(db, 'sectors'));
  return buildSectorIdByName(
    snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SectorDoc, 'id'>) })),
    companyId
  );
};
