import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth, loginGoogle, loginEmailPassword, logout, getUserRole, type UserRole } from '../services/firebase';

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
  const allowedCompanyId = userRole?.role === 'company' && userRole?.companyId ? userRole.companyId : null;

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
      allowedCompanyId,
      refreshUserRole
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);