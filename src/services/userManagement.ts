/**
 * Criação de usuário via GUI sem perder a sessão do administrador atual.
 *
 * Problema: `createUserWithEmailAndPassword` no auth principal faz auto-login
 * como o usuário recém-criado, destruindo a sessão do admin que está criando.
 *
 * Solução: segundo `initializeApp` ("secondary") isolado. O fluxo é:
 *   1. Cria user via `createUserWithEmailAndPassword(secondaryAuth, ...)`
 *   2. Imediatamente `signOut(secondaryAuth)` (não acumula sessão)
 *   3. Cria doc em `user_roles` usando o `db` primário (sessão do admin é
 *      quem assina as escritas — passa pelas firestore.rules como o admin)
 *
 * Padrão oficial Firebase pra esse caso. Sem Cloud Functions, sem Admin SDK
 * no cliente, sem plano Blaze.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  type Auth,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import {
  firebaseConfig,
  db,
  auth as primaryAuth,
  createAuditLog,
  type AccessLevel,
  type UserRole,
} from "./firebase";

const SECONDARY_APP_NAME = "user-creation";

function getSecondaryAuth(): Auth {
  const existing = getApps().find((a) => a.name === SECONDARY_APP_NAME);
  const app: FirebaseApp =
    existing ?? initializeApp(firebaseConfig, SECONDARY_APP_NAME);
  return getAuth(app);
}

export interface CreateUserInput {
  email: string;
  /**
   * Se omitido, o sistema gera uma senha aleatória interna e dispara email de
   * password reset — o usuário define a senha real ao clicar no link. Modo
   * recomendado: admin nunca toca em senha de outros usuários.
   *
   * Se passado, vira a senha inicial (admin precisa comunicar via canal externo).
   */
  password?: string;
  level: AccessLevel;
  /** Obrigatório para L1/L2/L3. Ignorado para L0. */
  companyId?: string | null;
  /** Obrigatório para L3 (≥1 setor). Ignorado nos outros níveis. */
  sectorIds?: string[];
  /**
   * Rótulo funcional legado (gestor/líder/colaborador). Não controla acesso —
   * `level` controla. Mantido por compat com componentes existentes.
   */
  role?: UserRole["role"];
}

export interface CreateUserResult {
  uid: string;
  email: string;
  /** True quando a senha foi gerada internamente e email de reset foi enviado. */
  passwordResetEmailSent: boolean;
}

/**
 * Gera senha aleatória forte (24 chars) usada temporariamente quando o admin
 * opta pelo fluxo de invite por email. Não fica armazenada em lugar nenhum —
 * o user vai redefinir via password reset email.
 */
function generateRandomPassword(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "");
}

/**
 * Cria um Firebase Auth user + doc em user_roles sem fazer logout do admin.
 *
 * Validações server-side ficam nas firestore.rules — esta função só falha
 * antes da escrita do user_roles se o caller não tiver permissão pelas rules.
 * Validações de UX (esconder form, mensagens) ficam nos componentes.
 *
 * @throws Firebase Auth errors (email já existe, senha fraca, etc.) ou
 *         FirestoreError com code='permission-denied' se as rules barrarem.
 */
export async function createUserViaSecondaryApp(
  input: CreateUserInput,
  createdBy: { uid: string; email: string }
): Promise<CreateUserResult> {
  // Validações client-side mínimas (UX). Server-side é responsabilidade das rules.
  if (input.level !== "L0" && !input.companyId) {
    throw new Error("companyId é obrigatório para L1/L2/L3.");
  }
  if (input.level === "L3" && (!input.sectorIds || input.sectorIds.length === 0)) {
    throw new Error("sectorIds é obrigatório para L3 (≥1 setor).");
  }

  const usingInviteFlow = !input.password;
  const initialPassword = input.password ?? generateRandomPassword();

  const secondaryAuth = getSecondaryAuth();
  const cred = await createUserWithEmailAndPassword(
    secondaryAuth,
    input.email,
    initialPassword
  );
  const uid = cred.user.uid;

  // Importante: desloga do secondary IMEDIATAMENTE pra não vazar sessão.
  // Mesmo que a próxima escrita falhe, o user já foi criado no Auth — o doc
  // em user_roles pode ser reconciliado manualmente (ver
  // README_USUARIOS_E_PERMISSOES.md, Opção B).
  await signOut(secondaryAuth);

  // Modo invite: dispara email de password reset usando o auth primário.
  // Se falhar, o user ainda existe no Auth com a senha aleatória — admin
  // pode reenviar via "Esqueci minha senha" na tela de login.
  let passwordResetEmailSent = false;
  if (usingInviteFlow) {
    try {
      await sendPasswordResetEmail(primaryAuth, input.email);
      passwordResetEmailSent = true;
    } catch (err) {
      console.warn(
        "[userManagement] Falha ao enviar password reset email:",
        err
      );
    }
  }

  const now = new Date().toISOString();
  const roleDoc: Omit<UserRole, "id"> = {
    userId: uid,
    email: input.email,
    role: input.role ?? "colaborador",
    level: input.level,
    companyId: input.level === "L0" ? undefined : input.companyId ?? undefined,
    sectorIds: input.level === "L3" ? input.sectorIds : undefined,
    createdAt: now,
    updatedAt: now,
  };

  // Remove campos undefined antes de gravar (Firestore não aceita undefined).
  const clean = Object.fromEntries(
    Object.entries(roleDoc).filter(([, v]) => v !== undefined)
  );

  await setDoc(doc(db, "user_roles", uid), clean);

  // Audit log — best-effort, não bloqueia o sucesso da criação.
  await createAuditLog(
    createdBy.uid,
    createdBy.email,
    "create",
    "user_role",
    uid,
    input.companyId ?? "(global)",
    {
      entityName: input.email,
      metadata: { level: input.level, sectorIds: input.sectorIds },
    }
  );

  return { uid, email: input.email, passwordResetEmailSent };
}

/**
 * Envia email de password reset pro user. Usado tanto pelo "Esqueci minha
 * senha" da tela de login quanto pelo invite flow de criação de usuário.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(primaryAuth, email);
}

/**
 * Lista user_roles. Se `companyIdFilter` for passado, retorna apenas docs da
 * empresa (usado por L1 pra ver sua equipe). Sem filtro retorna todos (L0).
 *
 * As firestore.rules garantem que callers sem permissão recebem permission-denied
 * — esta função não tenta esconder; deixa o erro propagar.
 */
export async function listUserRoles(
  companyIdFilter?: string | null
): Promise<UserRole[]> {
  const col = collection(db, "user_roles");
  const q = companyIdFilter
    ? query(col, where("companyId", "==", companyIdFilter))
    : query(col);
  const snap = await getDocs(q);
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as UserRole)
  );
}

export interface UpdateUserRoleInput {
  level?: AccessLevel;
  companyId?: string | null;
  sectorIds?: string[];
}

/**
 * Atualiza um user_role existente. Rules garantem que apenas L0 ou L1 da
 * mesma empresa podem editar. Email e userId não são editáveis aqui (mudar
 * email = nova conta, fluxo separado).
 */
export async function updateUserRole(
  uid: string,
  patch: UpdateUserRoleInput,
  editedBy: { uid: string; email: string }
): Promise<void> {
  const ref = doc(db, "user_roles", uid);
  const update: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (patch.level !== undefined) update.level = patch.level;
  if (patch.companyId !== undefined) {
    if (patch.companyId === null) update.companyId = null;
    else update.companyId = patch.companyId;
  }
  if (patch.sectorIds !== undefined) update.sectorIds = patch.sectorIds;

  await setDoc(ref, update, { merge: true });

  await createAuditLog(
    editedBy.uid,
    editedBy.email,
    "update",
    "user_role",
    uid,
    (patch.companyId ?? "(unchanged)") as string,
    { metadata: patch as Record<string, unknown> }
  );
}

/**
 * Soft-delete: marca o user_role como desativado. Auth user persiste (não
 * conseguimos deletar sem Admin SDK por causa da policy org), mas o usuário
 * fica sem acesso efetivo — `effectiveLevel` retorna null pra docs disabled
 * e firestore.rules continuam permitindo apenas o que o doc declara.
 *
 * Para "reativar", chamar `setUserRoleDisabled(uid, false, ...)`.
 */
export async function setUserRoleDisabled(
  uid: string,
  disabled: boolean,
  editedBy: { uid: string; email: string }
): Promise<void> {
  const ref = doc(db, "user_roles", uid);
  await setDoc(
    ref,
    { disabled, updatedAt: new Date().toISOString() },
    { merge: true }
  );

  await createAuditLog(
    editedBy.uid,
    editedBy.email,
    disabled ? "delete" : "update",
    "user_role",
    uid,
    "(soft)",
    { metadata: { disabled } }
  );
}

