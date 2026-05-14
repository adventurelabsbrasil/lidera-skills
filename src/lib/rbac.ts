/**
 * Helpers de RBAC compartilhados entre AuthContext, componentes admin e
 * dashboards. Resolve o "nível efetivo" do usuário considerando os dois
 * estados de transição:
 *
 * - Novo: `user_roles.level` ('L0'|'L1'|'L2'|'L3') populado.
 * - Legado A: doc com `role: 'master'` ou `'company'` (sem `level` ainda).
 * - Legado B: usuário autenticado SEM doc em `user_roles` — tratado como
 *   "dono inicial" pelas firestore.rules (= L0).
 */

import type { UserRole, AccessLevel } from "../services/firebase";

export function effectiveLevel(
  role: UserRole | null,
  isLegacyInitialOwner: boolean
): AccessLevel | null {
  // Soft-deleted = sem acesso (mesmo que role/level estejam setados)
  if (role?.disabled) return null;
  if (isLegacyInitialOwner) return "L0";
  if (!role) return null;
  if (role.level) return role.level;
  if (role.role === "master") return "L0";
  if (role.role === "company") return "L1";
  return null;
}

/** L0 e L1 podem gerenciar usuários (criar L2/L3 via tela Níveis de Acesso). */
export function canManageUsers(level: AccessLevel | null): boolean {
  return level === "L0" || level === "L1";
}

/** L0/L1/L2 podem escrever em configurações da empresa (sectors, roles, etc). */
export function canWriteTenantConfig(level: AccessLevel | null): boolean {
  return level === "L0" || level === "L1" || level === "L2";
}

/** L3 só lê — não cadastra, não importa, não cria metas. */
export function isReadOnlyLevel(level: AccessLevel | null): boolean {
  return level === "L3";
}

/**
 * Filtra um array de itens por setor permitido. No-op para níveis que não são
 * L3 ou enquanto os nomes ainda estão sendo resolvidos (`allowedSectorNames`
 * é null). Quando vazio array, retorna [] (nada permitido).
 *
 * @param items Lista a filtrar (employees, evaluations, etc).
 * @param sectorKey Propriedade que contém o nome do setor (ex: 'sector').
 * @param level Nível efetivo do usuário corrente.
 * @param allowedSectorNames Nomes resolvidos via AuthContext (`null` = loading).
 */
export function filterBySector<T extends Record<string, unknown>>(
  items: T[],
  sectorKey: keyof T,
  level: AccessLevel | null,
  allowedSectorNames: string[] | null
): T[] {
  if (level !== "L3") return items;
  if (allowedSectorNames === null) return []; // ainda carregando — esconde
  if (allowedSectorNames.length === 0) return [];
  const set = new Set(allowedSectorNames);
  return items.filter((item) => {
    const sector = item[sectorKey];
    return typeof sector === "string" && set.has(sector);
  });
}
