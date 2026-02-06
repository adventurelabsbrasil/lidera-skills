import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CompanyProvider, useCompany } from './contexts/CompanyContext';
import { CompanySelector } from './components/layout/CompanySelector';
import { Dashboard } from './components/dashboard/Dashboard';
import { EvaluationHistory } from './components/dashboard/EvaluationHistory';
import { EvaluationsView } from './components/evaluations/EvaluationsView';
import { HelpView } from './components/help/HelpView';
import DocumentationView from './components/documentation/DocumentationView';
import { WelcomeView } from './components/welcome/WelcomeView';
import { EmployeeProfile } from './components/employee/EmployeeProfile';
import { ReportsView } from './components/reports/ReportsView';
import { fetchCollection } from './services/firebase';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { Toaster } from './components/ui/Toaster';

import { 
  CriteriaView, 
  SectorsView, 
  RolesView, 
  EmployeesView, 
  UsersView,
  CompaniesView,
  HistoryImportView, // <--- Importação da nova View
  GoalsView
} from './components/settings/Registers';

import { 
  LayoutDashboard, 
  History, 
  LogOut, 
  Settings,
  Users, 
  Briefcase,
  Target, 
  Layers, 
  UserCog,
  ClipboardList,
  Menu,
  X,
  FileCheck,
  HelpCircle,
  Building,
  FileSpreadsheet,
  FileBarChart,
  type LucideIcon
} from 'lucide-react';

// Tipos para os componentes de botões
interface NavButtonProps {
  view: string;
  icon: LucideIcon;
  label: string;
}

interface SettingsButtonProps {
  view: string;
  icon: LucideIcon;
  label: string;
}

interface Evaluation {
  id?: string;
  [key: string]: unknown;
}

interface Employee {
  id?: string;
  [key: string]: unknown;
}

function DashboardWrapper() {
  const { tab } = useParams<{ tab: string }>();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const { currentCompany } = useCompany();

  useEffect(() => {
    const loadData = async () => {
      if (!currentCompany) return;
      try {
        const companyFilter = currentCompany.id === 'all' ? null : currentCompany.id;
        const evaluationsData = await fetchCollection('evaluations', companyFilter);
        const employeesData = await fetchCollection('employees'); 
        
        setEvaluations(evaluationsData);
        setEmployees(employeesData);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      }
    };
    loadData();
  }, [currentCompany]);

  return <Dashboard evaluations={evaluations} employees={employees} initialTab={tab} />;
}

function SettingsWrapper() {
  const { view } = useParams<{ view: string }>();
  const { isMaster } = useCompany();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const SettingsButton = ({ view: viewName, icon: Icon, label }: SettingsButtonProps) => (
    <button
      onClick={() => {
        navigate(`/settings/${viewName}`);
        setIsSidebarOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${
        view === viewName
          ? 'bg-brand-gradient text-white dark:text-black shadow-md'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
    >
      <Icon size={18} />
      {label}
    </button>
  );

  return (
    <div className="flex flex-col md:flex-row gap-6 animate-fadeIn">
      <div className="md:hidden mb-4">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="flex items-center gap-2 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-lg shadow-sm text-gray-700 dark:text-white w-full justify-between"
        >
          <span className="font-semibold flex items-center gap-2">
            <Menu size={18} /> Menu de Cadastros
          </span>
          {isSidebarOpen ? <X size={18} /> : <Settings size={18} />}
        </button>
      </div>

      <aside className={`md:w-64 flex-shrink-0 ${isSidebarOpen ? 'block' : 'hidden md:block'}`}>
        <div className="bg-white dark:bg-lidera-gray rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4 sticky top-24">
          
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-4">Cadastros Gerais</h3>
          <div className="space-y-1">
            <SettingsButton view="criteria" icon={ClipboardList} label="Critérios" />
            <SettingsButton view="sectors" icon={Layers} label="Setores" />
            <SettingsButton view="roles" icon={Briefcase} label="Cargos" />
          </div>

          <div className="my-4 border-t border-gray-100 dark:border-gray-800"></div>
          
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-4">Pessoas</h3>
          <div className="space-y-1">
            <SettingsButton view="employees" icon={Users} label="Funcionários" />
            <SettingsButton view="users" icon={UserCog} label="Usuários" />
          </div>

          <div className="my-4 border-t border-gray-100 dark:border-gray-800"></div>
          
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-4">Dados</h3>
          <div className="space-y-1">
            <SettingsButton view="import" icon={FileSpreadsheet} label="Importar Histórico" />
            <SettingsButton view="goals" icon={Target} label="Metas de Desempenho" />
          </div>

          {isMaster && (
            <>
              <div className="my-4 border-t border-gray-100 dark:border-gray-800"></div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-4">Admin</h3>
              <SettingsButton view="companies" icon={Building} label="Empresas" />
            </>
          )}
        </div>
      </aside>

      <section className="flex-1 min-w-0">
        {view === 'criteria' && <CriteriaView />}
        {view === 'sectors' && <SectorsView />}
        {view === 'roles' && <RolesView />}
        {view === 'employees' && <EmployeesView />}
        {view === 'users' && <UsersView />}
        {view === 'import' && <HistoryImportView />}
        {view === 'goals' && <GoalsView />}
        {isMaster && view === 'companies' && <CompaniesView />}
      </section>
    </div>
  );
}

function MainApp() {
  const { currentCompany } = useCompany();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Backspace para voltar (apenas quando não está em input/textarea)
  useEffect(() => {
    const handleBackspace = (e: KeyboardEvent) => {
      // Não faz nada se estiver em um campo de input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as HTMLElement).isContentEditable) {
        return;
      }
      
      // Backspace volta na navegação
      if (e.key === 'Backspace' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        navigate(-1);
      }
    };
    
    window.addEventListener('keydown', handleBackspace);
    return () => window.removeEventListener('keydown', handleBackspace);
  }, [navigate]);
  
  const pathParts = location.pathname.split('/').filter(Boolean);
  const currentView = pathParts[0] || 'dashboard';

  const NavButton = ({ view, icon: Icon, label }: NavButtonProps) => (
    <button
      onClick={() => navigate(`/${view}`)}
      className={`flex flex-col md:flex-row items-center gap-1 md:gap-2 px-3 py-2 rounded-md transition-all text-xs md:text-sm font-medium ${
        currentView === view
          ? 'bg-skills-blue-primary/10 text-skills-blue-primary dark:bg-gold-500/20 dark:text-gold-400'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
      }`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );

  if (!currentCompany) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-skills-light dark:bg-navy-900 text-center p-4">
        <div className="bg-white dark:bg-navy-800 p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-navy-700 max-w-md w-full animate-fadeIn">
          <div className="mb-6 flex justify-center">
             <div className="w-20 h-20 rounded-full overflow-hidden shadow-lg ring-4 ring-blue-100 dark:ring-gray-700">
               <img 
                 src="/lidera-logo.png" 
                 alt="Lidera Skills" 
                 className="w-full h-full object-cover"
               />
             </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Bem-vindo ao Lidera Skills</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">Para acessar os painéis, selecione ou cadastre uma empresa cliente.</p>
          <div className="flex justify-center">
            <CompanySelector />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-skills-light dark:bg-lidera-dark flex flex-col font-sans transition-colors duration-300">
      
      <header className="bg-white dark:bg-lidera-gray shadow-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16 items-center">
            
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full overflow-hidden shadow-lg ring-2 ring-white dark:ring-gray-800">
                  <img 
                    src="/lidera-logo.png" 
                    alt="Lidera Skills" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <h1 className="text-xl font-bold text-gray-800 dark:text-white hidden md:block tracking-tight">
                  Lidera Skills
                </h1>
              </button>
              <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 hidden md:block"></div>
              <div className="hidden md:block">
                <CompanySelector />
              </div>
            </div>

            <nav className="flex items-center gap-1 md:gap-2">
              <NavButton view="dashboard" icon={LayoutDashboard} label="Painel" />
              <NavButton view="evaluations" icon={FileCheck} label="Avaliações" />
              <NavButton view="history" icon={History} label="Histórico" />
              <NavButton view="reports" icon={FileBarChart} label="Relatórios" />
              <NavButton view="settings" icon={Settings} label="Configurações" />
              <NavButton view="help" icon={HelpCircle} label="Ajuda" />
            </nav>

            <div className="flex items-center border-l border-gray-200 dark:border-gray-700 pl-4 ml-2 md:ml-4 gap-2">
              <ThemeToggle />
              <button 
                onClick={() => signOut()} 
                className="text-gray-400 hover:text-red-600 transition-colors" 
                title="Sair"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-8">
        <Routes>
          <Route path="/" element={<WelcomeView />} />
          <Route path="/welcome" element={<WelcomeView />} />
          <Route path="/dashboard" element={<Navigate to="/dashboard/overview" replace />} />
          <Route path="/dashboard/:tab" element={<DashboardWrapper />} />
          <Route path="/evaluations" element={<EvaluationsView />} />
          <Route path="/history" element={
            <div className="animate-fade-in-up">
              <div className="mb-6 flex justify-between items-end">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Histórico Legado</h2>
                  <p className="text-gray-500 dark:text-gray-400">Visualização de avaliações importadas antigas.</p>
                </div>
              </div>
              <EvaluationHistory />
            </div>
          } />
          <Route path="/help" element={<HelpView />} />
          <Route path="/reports" element={
            <div className="animate-fade-in-up">
              <ReportsView />
            </div>
          } />
          <Route path="/employee/:companyId/:employeeId" element={<EmployeeProfile />} />
          <Route path="/settings" element={<Navigate to="/settings/criteria" replace />} />
          <Route path="/settings/:view" element={<SettingsWrapper />} />
          <Route path="*" element={<Navigate to="/welcome" replace />} />
        </Routes>
      </main>
      <Toaster />
    </div>
  );
}

// Componente interno que verifica autenticação
function AppContent() {
  const { user, loading, signIn, signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      await signInWithEmail(email, password);
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Tela de Login
  if (!loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
        <div className="bg-white dark:bg-[#1E1E1E] rounded-2xl shadow-2xl p-8 max-w-md w-full border border-gray-200 dark:border-[#121212] relative overflow-hidden">
          {/* Elementos decorativos dourados */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400/20 to-amber-600/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-yellow-500/20 to-amber-500/20 rounded-full blur-2xl"></div>
          
          <div className="relative z-10">
            <div className="mb-8 flex justify-center">
              <div className="w-24 h-24 rounded-full overflow-hidden shadow-xl ring-4 ring-yellow-500/30 dark:ring-yellow-600/50">
                <img 
                  src="/lidera-logo.png" 
                  alt="Lidera Skills" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            
            <h1 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">
              Lidera Skills
            </h1>
            <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
              Sistema de Gestão de Performance e Avaliações
            </p>
            
            {/* Formulário de Email e Senha */}
            <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-yellow-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  placeholder="seu@email.com"
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Senha
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-yellow-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  placeholder="••••••••"
                />
              </div>
              
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all transform hover:scale-105 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </button>
            </form>
            
            {/* Divisor */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-[#1E1E1E] text-gray-500 dark:text-gray-400">ou</span>
              </div>
            </div>
            
            {/* Botão do Google */}
            <button
              onClick={signIn}
              className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all transform hover:scale-105 flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Entrar com Google
            </button>
            
            <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-6">
              Ao entrar, você concorda com nossos termos de uso
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-yellow-500/30 border-t-yellow-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Carregando...</p>
        </div>
      </div>
    );
  }
  
  // App principal
  return (
    <CompanyProvider>
      <MainApp />
    </CompanyProvider>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Rota pública de documentação - sem restrição de acesso */}
        <Route path="/documentation" element={<DocumentationView />} />
        
        {/* Rotas protegidas */}
        <Route path="*" element={
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        } />
      </Routes>
    </Router>
  );
}

export default App;