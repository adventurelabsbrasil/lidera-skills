import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchCollection, createCompany, getCompany } from '../services/firebase';
import { useAuth } from './AuthContext';

interface Company {
  id: string;
  name: string;
}

interface CompanyContextType {
  currentCompany: Company | null;
  setCompany: (company: Company | null) => void;
  companies: Company[];
  refreshCompanies: () => void;
  addNewCompany: (name: string) => Promise<void>;
  loading: boolean;
  isMaster: boolean;
  /** Usuário com acesso restrito a uma empresa (role 'company') */
  isCompanyUser: boolean;
}

const CompanyContext = createContext<CompanyContextType>({} as CompanyContextType);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { isMaster: userIsMaster, user, loading: authLoading, isCompanyUser, allowedCompanyId } = useAuth();
  
  const [currentCompany, setCurrentCompanyState] = useState<Company | null>(() => {
    const saved = localStorage.getItem('lidera_selected_company');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCompanies = async () => {
    // Não tenta carregar se não estiver autenticado
    if (authLoading || !user) {
      console.log('Aguardando autenticação...');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('🔍 [Lidera] Carregando empresas. UID:', user?.uid, 'isCompanyUser:', isCompanyUser, 'allowedCompanyId:', allowedCompanyId);
      let data: Company[];
      if (allowedCompanyId) {
        // Empresa-restrita (L1/L2/L3 ou role 'company' legado): busca só o doc
        // permitido — list em /companies sem filtro dá permission-denied pelas rules.
        const company = await getCompany(allowedCompanyId);
        data = company ? [{ id: company.id, name: company.name }] : [];
        console.log('✅ [Lidera] Company (única permitida):', data.length ? data[0] : 'nenhuma');
      } else {
        // L0 ou legacy initial owner: lista todas.
        data = (await fetchCollection('companies')) as Company[];
        console.log('✅ [Lidera] Companies retornadas pelo Firestore:', data?.length, 'empresa(s)', data);
      }
      setCompanies(data);
    } catch (error) {
      console.error('❌ Erro ao carregar empresas:', error);
      if (error instanceof Error) {
        console.error('   Mensagem:', error.message);
        const err = error as Error & { code?: string };
        if (err.code) console.error('   Código:', err.code);
      }
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Só carrega empresas após autenticação (e role, para company user) estar completo
    if (!authLoading) {
      loadCompanies();
    }
  }, [userIsMaster, user, authLoading, isCompanyUser, allowedCompanyId]);

  // Empresa-restrita (qualquer L1/L2/L3 ou role 'company'): auto-seleciona
  // a única empresa permitida — não há escolha pra fazer.
  useEffect(() => {
    if (loading || !allowedCompanyId || companies.length === 0) return;
    const allowed = companies.find(c => c.id === allowedCompanyId);
    if (allowed && (!currentCompany || currentCompany.id !== allowedCompanyId)) {
      setCurrentCompanyState(allowed);
      localStorage.setItem('lidera_selected_company', JSON.stringify(allowed));
    }
  }, [loading, allowedCompanyId, companies, currentCompany?.id]);

  const setCompany = (company: Company | null) => {
    setCurrentCompanyState(company);
    if (company) {
      localStorage.setItem('lidera_selected_company', JSON.stringify(company));
    } else {
      localStorage.removeItem('lidera_selected_company');
    }
  };

  const addNewCompany = async (name: string) => {
    await createCompany(name);
    await loadCompanies();
  };

  return (
    <CompanyContext.Provider value={{ 
      currentCompany, 
      setCompany, 
      companies, 
      refreshCompanies: loadCompanies,
      addNewCompany,
      loading,
      isMaster: userIsMaster,
      isCompanyUser: isCompanyUser ?? false
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export const useCompany = () => useContext(CompanyContext);