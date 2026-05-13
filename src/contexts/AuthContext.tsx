import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, loginGoogle, loginEmailPassword, logout, getUserRole, type UserRole, type AccessLevel } from '../services/firebase';
import { effectiveLevel } from '../lib/rbac';

interface AuthContextType {
  user: User | null;
  userRole: UserRole | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isMaster: boolean;
  /** Usuário com role 'company': acesso apenas à empresa vinculada (avaliações e dados da empresa) */
  isCompanyUser: boolean;
  /**
   * Autenticado mas sem documento em `user_roles` — tratado como L0/master pelas
   * firestore.rules ("legacy initial owner"). Necessário expor client-side pra
   * que UIs administrativas apareçam pro dono inicial do projeto.
   */
  isLegacyInitialOwner: boolean;
  /**
   * Nível RBAC efetivo (resolvido de `level` novo, `role` legado ou
   * legacy initial owner). `null` apenas durante loading inicial.
   */
  level: AccessLevel | null;
  /** Setores que L3 tem permissão de ver. Vazio array pra demais níveis. */
  allowedSectorIds: string[];
  /** ID da empresa permitida quando isCompanyUser é true; null caso contrário */
  allowedCompanyId: string | null;
  refreshUserRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserRole = async (userId: string) => {
    try {
      const role = await getUserRole(userId);
      setUserRole(role);
      // Debug: conferir no console se o usuário tem role 'company' e companyId
      if (role) {
        console.log('[Lidera] userRole carregado:', { uid: userId, role: role.role, companyId: role.companyId });
      } else {
        console.log('[Lidera] Sem documento em user_roles para UID:', userId, '→ acesso total (legado)');
      }
    } catch (error) {
      console.error('Erro ao carregar role do usuário:', error);
      setUserRole(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadUserRole(currentUser.uid);
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    await loginGoogle();
  };

  const signInWithEmail = async (email: string, password: string) => {
    await loginEmailPassword(email, password);
  };

  const signOutUser = async () => {
    await logout();
    setUserRole(null);
  };

  const refreshUserRole = async () => {
    if (user) {
      await loadUserRole(user.uid);
    }
  };

  const isMaster = userRole?.role === 'master' || false;
  const isCompanyUser = userRole?.role === 'company' || false;
  // Autenticado + sem doc em user_roles = legacy initial owner (rules tratam como L0)
  const isLegacyInitialOwner = !!user && !loading && userRole === null;
  const level: AccessLevel | null = effectiveLevel(userRole, isLegacyInitialOwner);
  const allowedSectorIds: string[] =
    level === 'L3' ? userRole?.sectorIds ?? [] : [];
  // Qualquer nível com tenant restrito (L1/L2/L3 novos OU role 'company' legado)
  // tem companyId permitido. Apenas L0 e legacy initial owner (sem doc) podem
  // ler todas as empresas via fetchCollection — os demais precisam usar
  // getCompany(allowedCompanyId) para evitar permission-denied no list.
  const allowedCompanyId =
    level && level !== 'L0' && userRole?.companyId
      ? userRole.companyId
      : null;

  return (
    <AuthContext.Provider value={{
      user,
      userRole,
      loading,
      signIn,
      signInWithEmail,
      signOut: signOutUser,
      isMaster,
      isCompanyUser,
      isLegacyInitialOwner,
      level,
      allowedSectorIds,
      allowedCompanyId,
      refreshUserRole
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);