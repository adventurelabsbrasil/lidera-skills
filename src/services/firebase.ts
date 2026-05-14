import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, query, where, addDoc, doc, getDoc, setDoc, deleteDoc, limit, startAfter, QueryDocumentSnapshot, DocumentData, Query, orderBy } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Configuração do Firebase usando variáveis de ambiente. Exportada para o
// secondary auth app de criação de usuários (src/services/userManagement.ts).
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDjyKAT2aZ4A3OrqaM8a6E6c0ht12BT278",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "lidera-skills.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "lidera-skills",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "lidera-skills.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "187326943178",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:187326943178:web:9f895ab33f246d83ca8933"
};

// Inicialização
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// --- FUNÇÕES DE AJUDA ---

// Login com Google
export const loginGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Erro no login:", error);
    throw error;
  }
};

// Login com email e senha
export const loginEmailPassword = async (email: string, password: string) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    console.error("Erro no login:", error);
    throw error;
  }
};

// Criar usuário com email e senha (útil para criar o admin)
export const createUserEmailPassword = async (email: string, password: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    throw error;
  }
};

// Logout
export const logout = () => signOut(auth);

// NOVA: Função para criar uma empresa
export const createCompany = async (name: string) => {
  await addDoc(collection(db, 'companies'), {
    name,
    createdAt: new Date().toISOString()
  });
};

/** Busca uma empresa por ID (usado para usuário com role 'company' — evita permission-denied na coleção inteira) */
export const getCompany = async (companyId: string): Promise<{ id: string; name: string; [key: string]: unknown } | null> => {
  try {
    const docRef = doc(db, 'companies', companyId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as { id: string; name: string; [key: string]: unknown };
    }
    return null;
  } catch (error) {
    console.error('Erro ao buscar empresa:', error);
    return null;
  }
};

// ATUALIZADA: Busca filtrada por empresa
export const fetchCollection = async (collectionName: string, companyId?: string | null) => {
  try {
    let q;
    
    // Se passar companyId, filtra. Se for 'users' ou 'companies', traz tudo (ou filtra por user)
    if (companyId && collectionName !== 'companies' && collectionName !== 'users') {
      q = query(collection(db, collectionName), where("companyId", "==", companyId));
    } else {
      // Para companies e users, busca todos os documentos sem filtro
      q = query(collection(db, collectionName));
    }

    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`✅ fetchCollection(${collectionName}):`, results.length, 'documentos encontrados');
    if (results.length > 0) {
      console.log(`   Primeiros resultados:`, results.slice(0, 3));
    }
    return results;
  } catch (error) {
    console.error(`❌ Erro ao buscar ${collectionName}:`, error);
    // Log detalhado do erro
    if (error instanceof Error) {
      console.error('   Mensagem:', error.message);
      const firebaseError = error as Error & { code?: string };
      if (firebaseError.code) {
        console.error('   Código do erro:', firebaseError.code);
        if (firebaseError.code === 'permission-denied') {
          console.error('   ⚠️ ERRO DE PERMISSÃO: Verifique se:');
          console.error('      1. Você está autenticado');
          console.error('      2. As regras do Firestore foram deployadas');
          console.error('      3. As regras permitem leitura para usuários autenticados');
        }
      }
      console.error('   Stack:', error.stack);
    }
    return [];
  }
};

/**
 * Busca paginada de uma coleção
 * @param collectionName Nome da coleção
 * @param companyId ID da empresa (opcional, para filtro)
 * @param lastDoc Último documento da página anterior (null para primeira página)
 * @param pageSize Tamanho da página
 * @returns Objeto com items, lastDoc e hasMore
 */
export const fetchCollectionPaginated = async (
  collectionName: string,
  companyId: string | null | undefined,
  lastDoc: QueryDocumentSnapshot<DocumentData> | null,
  pageSize: number = 20
): Promise<{
  items: DocumentData[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}> => {
  try {
    let q: Query<DocumentData>;
    
    // Constrói a query base
    if (companyId && collectionName !== 'companies' && collectionName !== 'users' && collectionName !== 'evaluation_criteria') {
      q = query(
        collection(db, collectionName),
        where("companyId", "==", companyId),
        limit(pageSize + 1) // +1 para verificar se há mais
      );
    } else {
      q = query(
        collection(db, collectionName),
        limit(pageSize + 1)
      );
    }

    // Adiciona startAfter se houver lastDoc
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const querySnapshot = await getDocs(q);
    const docs = querySnapshot.docs;
    
    // Verifica se há mais documentos
    const hasMore = docs.length > pageSize;
    const items = (hasMore ? docs.slice(0, pageSize) : docs).map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      items,
      lastDoc: docs.length > 0 ? (hasMore ? docs[pageSize - 1] : docs[docs.length - 1]) : null,
      hasMore,
    };
  } catch (error) {
    console.error(`Erro ao buscar ${collectionName} paginado:`, error);
    return {
      items: [],
      lastDoc: null,
      hasMore: false,
    };
  }
};

// --- SISTEMA DE ROLES ---

/**
 * Nível de acesso (RBAC). Campo separado de `role` (que descreve função do
 * usuário em avaliações — gestor/líder/colaborador). Os 4 níveis controlam
 * isolamento multi-empresa e granularidade de leitura/escrita no Firestore.
 *
 * L0 — Dev/Admin Adventure+Lidera: vê todas as empresas, cria qualquer nível.
 * L1 — Owner da empresa: tudo dentro da empresa, cria L2/L3 da própria empresa.
 * L2 — Gestor: tudo dentro da empresa, não cria usuários.
 * L3 — Líder de setor: só dados dos setores em `sectorIds`, não cria usuários.
 */
export type AccessLevel = 'L0' | 'L1' | 'L2' | 'L3';

export interface UserRole {
  id: string;
  userId: string;
  email: string;
  role: 'master' | 'admin' | 'gestor' | 'lider' | 'colaborador' | 'company';
  /**
   * Nível de acesso RBAC. Opcional durante janela de migração: docs antigos
   * sem `level` derivam do `role` legado (`master`→L0, `company`→L1) via
   * `scripts/migrate-user-roles-to-levels.ts`. Após migração completa, este
   * campo passa a ser obrigatório e `role` fica como rótulo funcional.
   */
  level?: AccessLevel;
  /** Para L1/L2/L3 e role 'company': ID da empresa permitida. Null/undefined para L0. */
  companyId?: string;
  /** Para L3: IDs dos setores que o usuário lidera. Vazio/undefined nos demais níveis. */
  sectorIds?: string[];
  companyIds?: string[]; // Empresas que o usuário tem acesso (se aplicável, para outros roles)
  /**
   * Soft-delete. Quando true, o usuário não tem acesso efetivo (AuthContext
   * retorna level=null e UIs bloqueiam) e fica oculto por padrão na lista
   * de Níveis de Acesso. Hard-delete do Firebase Auth não é feito porque
   * exige Admin SDK (Service Account JSON bloqueado por policy org).
   */
  disabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Busca o role do usuário no Firestore
 */
export const getUserRole = async (userId: string): Promise<UserRole | null> => {
  try {
    const roleDoc = await getDoc(doc(db, 'user_roles', userId));
    if (roleDoc.exists()) {
      return { id: roleDoc.id, ...roleDoc.data() } as UserRole;
    }
    return null;
  } catch (error) {
    console.error('Erro ao buscar role do usuário:', error);
    return null;
  }
};

/**
 * Cria ou atualiza o role de um usuário
 * Apenas usuários master podem executar esta função
 */
export const setUserRole = async (userId: string, roleData: Omit<UserRole, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {
  try {
    const roleRef = doc(db, 'user_roles', userId);
    const existing = await getDoc(roleRef);
    
    const now = new Date().toISOString();
    
    if (existing.exists()) {
      // Atualiza role existente
      await setDoc(roleRef, {
        ...roleData,
        updatedAt: now
      }, { merge: true });
    } else {
      // Cria novo role
      await setDoc(roleRef, {
        ...roleData,
        createdAt: now,
        updatedAt: now
      });
    }
  } catch (error) {
    console.error('Erro ao definir role do usuário:', error);
    throw error;
  }
};

// --- SISTEMA DE METAS ---

export interface PerformanceGoal {
  id: string;
  companyId: string;
  sectorId?: string; // Opcional: meta específica por setor
  roleId?: string; // Opcional: meta específica por cargo
  goalValue: number; // Valor da meta (0-10)
  level?: 'Estratégico' | 'Tático' | 'Operacional' | 'Geral'; // Nível hierárquico
  createdAt: string;
  updatedAt: string;
}

/**
 * Busca metas de desempenho para uma empresa
 * Prioridade: Meta específica (setor/cargo) > Meta por nível > Meta geral
 */
export const getPerformanceGoals = async (companyId: string, sectorId?: string, roleId?: string, level?: string): Promise<PerformanceGoal[]> => {
  try {
    const goals: PerformanceGoal[] = [];
    
    // Busca meta geral da empresa
    const generalQuery = query(
      collection(db, 'performance_goals'),
      where('companyId', '==', companyId),
      where('sectorId', '==', null)
    );
    const generalSnapshot = await getDocs(generalQuery);
    generalSnapshot.docs.forEach(doc => {
      goals.push({ id: doc.id, ...doc.data() } as PerformanceGoal);
    });
    
    // Busca meta por setor se fornecido
    if (sectorId) {
      const sectorQuery = query(
        collection(db, 'performance_goals'),
        where('companyId', '==', companyId),
        where('sectorId', '==', sectorId)
      );
      const sectorSnapshot = await getDocs(sectorQuery);
      sectorSnapshot.docs.forEach(doc => {
        goals.push({ id: doc.id, ...doc.data() } as PerformanceGoal);
      });
    }
    
    // Busca meta por cargo se fornecido
    if (roleId) {
      const roleQuery = query(
        collection(db, 'performance_goals'),
        where('companyId', '==', companyId),
        where('roleId', '==', roleId)
      );
      const roleSnapshot = await getDocs(roleQuery);
      roleSnapshot.docs.forEach(doc => {
        goals.push({ id: doc.id, ...doc.data() } as PerformanceGoal);
      });
    }
    
    // Busca meta por nível se fornecido
    if (level) {
      const levelQuery = query(
        collection(db, 'performance_goals'),
        where('companyId', '==', companyId),
        where('level', '==', level),
        where('sectorId', '==', null),
        where('roleId', '==', null)
      );
      const levelSnapshot = await getDocs(levelQuery);
      levelSnapshot.docs.forEach(doc => {
        goals.push({ id: doc.id, ...doc.data() } as PerformanceGoal);
      });
    }
    
    return goals;
  } catch (error) {
    console.error('Erro ao buscar metas:', error);
    return [];
  }
};

/**
 * Obtém o valor da meta mais específica disponível
 */
export const getGoalValue = async (
  companyId: string,
  sectorId?: string,
  roleId?: string,
  level?: string
): Promise<number> => {
  const goals = await getPerformanceGoals(companyId, sectorId, roleId, level);
  
  // Prioridade: setor+cargo > setor > cargo > nível > geral
  const specificGoal = goals.find(g => g.sectorId && g.roleId) ||
                       goals.find(g => g.sectorId) ||
                       goals.find(g => g.roleId) ||
                       goals.find(g => g.level) ||
                       goals.find(g => !g.sectorId && !g.roleId && !g.level);
  
  return specificGoal?.goalValue || 9.0; // Default: 9.0
};

/**
 * Cria ou atualiza uma meta de desempenho
 */
export const setPerformanceGoal = async (
  companyId: string,
  goalData: Omit<PerformanceGoal, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    const now = new Date().toISOString();
    
    // Verifica se já existe uma meta com os mesmos critérios
    let existingGoalId: string | null = null;
    
    if (goalData.sectorId || goalData.roleId || goalData.level) {
      const existingQuery = query(
        collection(db, 'performance_goals'),
        where('companyId', '==', companyId),
        where('sectorId', '==', goalData.sectorId || null),
        where('roleId', '==', goalData.roleId || null),
        where('level', '==', goalData.level || null)
      );
      const existingSnapshot = await getDocs(existingQuery);
      if (!existingSnapshot.empty) {
        existingGoalId = existingSnapshot.docs[0].id;
      }
    }
    
    const goalRef = existingGoalId ? doc(db, 'performance_goals', existingGoalId) : doc(collection(db, 'performance_goals'));
    
    if (existingGoalId) {
      // Atualiza meta existente
      await setDoc(goalRef, {
        companyId,
        ...goalData,
        updatedAt: now
      }, { merge: true });
    } else {
      // Cria nova meta
      await setDoc(goalRef, {
        companyId,
        ...goalData,
        createdAt: now,
        updatedAt: now
      });
    }
    
    return goalRef.id;
  } catch (error) {
    console.error('Erro ao salvar meta:', error);
    throw error;
  }
};

/**
 * Remove uma meta de desempenho
 */
export const deletePerformanceGoal = async (goalId: string): Promise<void> => {
  try {
    const goalRef = doc(db, 'performance_goals', goalId);
    await deleteDoc(goalRef);
  } catch (error) {
    console.error('Erro ao deletar meta:', error);
    throw error;
  }
};

// --- SISTEMA DE AUDIT LOGS ---

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  userName?: string;
  action: 'create' | 'update' | 'delete' | 'view' | 'export' | 'import';
  entityType: string; // Tipo de entidade: 'evaluation', 'employee', 'sector', etc.
  entityId: string; // ID da entidade afetada
  entityName?: string; // Nome/identificação da entidade
  companyId: string;
  changes?: Record<string, { old?: unknown; new?: unknown }>; // Mudanças específicas (para updates)
  metadata?: Record<string, unknown>; // Dados adicionais
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

/**
 * Cria um log de auditoria
 */
export const createAuditLog = async (
  userId: string,
  userEmail: string,
  action: AuditLog['action'],
  entityType: string,
  entityId: string,
  companyId: string,
  options?: {
    userName?: string;
    entityName?: string;
    changes?: Record<string, { old?: unknown; new?: unknown }>;
    metadata?: Record<string, unknown>;
  }
): Promise<string> => {
  try {
    const auditLog: Omit<AuditLog, 'id'> = {
      userId,
      userEmail,
      userName: options?.userName,
      action,
      entityType,
      entityId,
      entityName: options?.entityName,
      companyId,
      changes: options?.changes,
      metadata: options?.metadata,
      timestamp: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, 'audit_logs'), auditLog);
    return docRef.id;
  } catch (error) {
    console.error('Erro ao criar audit log:', error);
    // Não lança erro para não quebrar o fluxo principal
    return '';
  }
};

/**
 * Busca logs de auditoria
 */
export const getAuditLogs = async (
  companyId: string,
  filters?: {
    userId?: string;
    action?: AuditLog['action'];
    entityType?: string;
    entityId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }
): Promise<AuditLog[]> => {
  try {
    let q: Query<DocumentData> = query(
      collection(db, 'audit_logs'),
      where('companyId', '==', companyId)
    );

    if (filters?.userId) {
      q = query(q, where('userId', '==', filters.userId));
    }
    if (filters?.action) {
      q = query(q, where('action', '==', filters.action));
    }
    if (filters?.entityType) {
      q = query(q, where('entityType', '==', filters.entityType));
    }
    if (filters?.entityId) {
      q = query(q, where('entityId', '==', filters.entityId));
    }
    if (filters?.startDate) {
      q = query(q, where('timestamp', '>=', filters.startDate));
    }
    if (filters?.endDate) {
      q = query(q, where('timestamp', '<=', filters.endDate));
    }

    if (filters?.limit) {
      q = query(q, limit(filters.limit));
    }

    // Ordenar por timestamp descendente (mais recente primeiro)
    q = query(q, orderBy('timestamp', 'desc'));

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AuditLog));
  } catch (error) {
    console.error('Erro ao buscar audit logs:', error);
    return [];
  }
};