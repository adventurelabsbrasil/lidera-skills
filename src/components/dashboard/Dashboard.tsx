import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDashboardAnalytics } from '../../hooks/useDashboardAnalytics';
import { fetchCollection } from '../../services/firebase';
import { useCompany } from '../../contexts/CompanyContext';
import { ReportExporter } from '../reports/ReportExporter';
import { exportOverviewToExcel, exportOverviewToPDF } from '../../utils/reportExporter';
import { FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from '../../utils/toast';
import { usePerformanceGoals } from '../../hooks/usePerformanceGoals';

// Import Tabs
import { CompanyOverview } from './tabs/CompanyOverview';
import { PerformanceAnalysis } from './tabs/PerformanceAnalysis';
import { IndividualAnalysis } from './tabs/IndividualAnalysis';
import { RankingView } from './tabs/RankingView';
import { BehavioralProfile } from './tabs/BehavioralProfile';

export const Dashboard = ({ evaluations = [], employees = [], initialTab }: { evaluations?: any[]; employees?: any[]; initialTab?: string }) => {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const dashboardContentRef = useRef<HTMLDivElement>(null);
  
  // Estado Local de Filtros
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['Ativo']); // Por padrão mostra apenas ativos
  const [activeFilterLabel, setActiveFilterLabel] = useState('Todo o período');
  const [criteriaList, setCriteriaList] = useState<any[]>([]);
  const [showSectorDropdown, setShowSectorDropdown] = useState(false);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [sectorSearchTerm, setSectorSearchTerm] = useState('');
  const [statusSearchTerm, setStatusSearchTerm] = useState('');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [exportingOverviewPDF, setExportingOverviewPDF] = useState(false);
  const [exportingOverviewExcel, setExportingOverviewExcel] = useState(false);

  // Seções visíveis no Dashboard (Saúde da Empresa)
  const [overviewSections, setOverviewSections] = useState({
    scorecards: true,
    rankings: true,
    health: true,
    distributions: true,
    performance: true,
    highlights: true,
    employees: true,
    disc: true,
  });
  
  // Chave para localStorage
  const FILTERS_STORAGE_KEY = 'lidera-skills-dashboard-filters';
  
  // Buscar critérios do banco
  useEffect(() => {
    const loadCriteria = async () => {
      try {
        const criteria = await fetchCollection('evaluation_criteria');
        setCriteriaList(criteria);
      } catch (error) {
        console.error("Erro ao carregar critérios:", error);
      }
    };
    loadCriteria();
  }, []);
  
  // Estado da Aba Ativa (usa initialTab da URL se disponível)
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'individual' | 'ranking' | 'behavioral'>(
    (initialTab as any) || 'overview'
  );
  
  // Atualizar tab quando initialTab mudar (navegação via URL)
  useEffect(() => {
    if (initialTab && ['overview', 'performance', 'individual', 'ranking', 'behavioral'].includes(initialTab)) {
      setActiveTab(initialTab as any);
    }
  }, [initialTab]);

  // Carregar filtros salvos do localStorage
  useEffect(() => {
    try {
      const savedFilters = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (savedFilters) {
        const filters = JSON.parse(savedFilters);
        setSelectedSectors(filters.selectedSectors || []);
        setSelectedEmployees(filters.selectedEmployees || []);
        setSelectedStatuses(filters.selectedStatuses || ['Ativo']);
        setDateStart(filters.dateStart || '');
        setDateEnd(filters.dateEnd || '');
        setActiveFilterLabel(filters.activeFilterLabel || 'Todo o período');
        if (filters.overviewSections) setOverviewSections(filters.overviewSections);
      }
    } catch (error) {
      console.error('Erro ao carregar filtros salvos:', error);
    }
  }, []);

  // Salvar filtros no localStorage quando mudarem
  useEffect(() => {
    try {
      const filtersToSave = {
        selectedSectors,
        selectedEmployees,
        selectedStatuses,
        dateStart,
        dateEnd,
        activeFilterLabel,
        overviewSections
      };
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filtersToSave));
    } catch (error) {
      console.error('Erro ao salvar filtros:', error);
    }
  }, [selectedSectors, selectedEmployees, selectedStatuses, dateStart, dateEnd, activeFilterLabel, overviewSections]);

  // Hook de Metas
  const { goalValue } = usePerformanceGoals();

  // Hook de Analytics
  const analytics = useDashboardAnalytics(evaluations, employees, {
    searchTerm: '', // Removido - agora usa apenas selectedEmployees
    selectedSectors,
    selectedEmployees,
    selectedStatuses,
    dateStart,
    dateEnd
  }, criteriaList, goalValue);

  // Lista de Setores para o Select
  const uniqueSectors = analytics.competenceMetrics.allSectors || [];
  
  // Lista de funcionários únicos para busca
  const uniqueEmployees = useMemo(() => {
    const names = new Set<string>();
    evaluations.forEach((ev: any) => {
      if (ev.employeeName) names.add(ev.employeeName);
    });
    return Array.from(names).sort();
  }, [evaluations]);
  
  // Funcionários filtrados pela busca
  const filteredEmployees = useMemo(() => {
    if (!employeeSearchTerm) return uniqueEmployees;
    return uniqueEmployees.filter(name => 
      name.toLowerCase().includes(employeeSearchTerm.toLowerCase())
    );
  }, [uniqueEmployees, employeeSearchTerm]);

  // Funções de Filtro de Período (adequado para avaliações mensais)
  const applyDateFilter = (type: 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter' | 'thisSemester' | 'lastSemester' | 'thisYear' | 'lastYear' | 'all') => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (type) {
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setActiveFilterLabel('Este Mês');
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        setActiveFilterLabel('Mês Passado');
        break;
      case 'thisQuarter': {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), currentQuarter * 3, 1);
        end = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
        setActiveFilterLabel('Este Trimestre');
        break;
      }
      case 'lastQuarter': {
        const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
        const lastQuarterYear = lastQuarter < 0 ? now.getFullYear() - 1 : now.getFullYear();
        const lastQuarterMonth = lastQuarter < 0 ? 9 : lastQuarter * 3;
        start = new Date(lastQuarterYear, lastQuarterMonth, 1);
        end = new Date(lastQuarterYear, lastQuarterMonth + 3, 0);
        setActiveFilterLabel('Trimestre Passado');
        break;
      }
      case 'thisSemester': {
        const currentSemester = now.getMonth() < 6 ? 0 : 6;
        start = new Date(now.getFullYear(), currentSemester, 1);
        end = new Date(now.getFullYear(), currentSemester + 6, 0);
        setActiveFilterLabel('Este Semestre');
        break;
      }
      case 'lastSemester': {
        const lastSemester = now.getMonth() < 6 ? 6 : 0;
        const lastSemesterYear = now.getMonth() < 6 ? now.getFullYear() - 1 : now.getFullYear();
        start = new Date(lastSemesterYear, lastSemester, 1);
        end = new Date(lastSemesterYear, lastSemester + 6, 0);
        setActiveFilterLabel('Semestre Passado');
        break;
      }
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        setActiveFilterLabel('Este Ano');
        break;
      case 'lastYear':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        setActiveFilterLabel('Ano Passado');
        break;
      case 'all':
        setDateStart('');
        setDateEnd('');
        setActiveFilterLabel('Todo o período');
        return;
    }

    setDateStart(start.toISOString().split('T')[0]);
    setDateEnd(end.toISOString().split('T')[0]);
  };

  // Filtrar setores por busca
  const filteredSectors = useMemo(() => {
    if (!sectorSearchTerm) return uniqueSectors.sort();
    return uniqueSectors.filter(s => 
      s.toLowerCase().includes(sectorSearchTerm.toLowerCase())
    ).sort();
  }, [uniqueSectors, sectorSearchTerm]);

  // Filtrar status por busca
  const filteredStatuses = useMemo(() => {
    const allStatuses = ['Ativo', 'Inativo', 'Férias', 'Afastado'];
    if (!statusSearchTerm) return allStatuses;
    return allStatuses.filter(s => 
      s.toLowerCase().includes(statusSearchTerm.toLowerCase())
    );
  }, [statusSearchTerm]);

  // Função para limpar filtros salvos
  const clearSavedFilters = () => {
    try {
      localStorage.removeItem(FILTERS_STORAGE_KEY);
      setSelectedSectors([]);
      setSelectedEmployees([]);
      setSelectedStatuses(['Ativo']);
      setDateStart('');
      setDateEnd('');
      setActiveFilterLabel('Todo o período');
      setOverviewSections({ scorecards: true, rankings: true, health: true, distributions: true, performance: true, highlights: true, employees: true, disc: true });
      setEmployeeSearchTerm('');
      setSectorSearchTerm('');
      setStatusSearchTerm('');
    } catch (error) {
      console.error('Erro ao limpar filtros:', error);
    }
  };

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.sector-filter') && !target.closest('.employee-filter') && 
          !target.closest('.status-filter') && !target.closest('.period-filter') &&
          !target.closest('.date-picker')) {
        setShowSectorDropdown(false);
        setShowEmployeeDropdown(false);
        setShowStatusDropdown(false);
        setShowPeriodDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Títulos dinâmicos baseados na aba
  const getPageTitle = () => {
    switch (activeTab) {
      case 'overview':
        return { h1: 'Painel', h2: 'Saúde da Empresa' };
      case 'performance':
        return { h1: 'Painel', h2: 'Análise de Desempenho' };
      case 'individual':
        return { h1: 'Painel', h2: 'Comparativo Individual' };
      case 'ranking':
        return { h1: 'Painel', h2: 'Ranking' };
      case 'behavioral':
        return { h1: 'Painel', h2: 'Perfil Comportamental' };
      default:
        return { h1: 'Painel', h2: 'Dashboard' };
    }
  };

  const pageTitles = getPageTitle();

  return (
    <div className="space-y-6 pb-10 relative">
      
      {/* --- TÍTULOS E NAVEGAÇÃO POR ABAS (FIXO) --- */}
      <div className="sticky top-0 z-30 bg-skills-light dark:bg-lidera-dark -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 pt-4 pb-2 border-b border-gray-200 dark:border-gray-800">
        {/* Títulos */}
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{pageTitles.h1}</h1>
          <h2 className="text-xl text-gray-600 dark:text-gray-400 mt-1">{pageTitles.h2}</h2>
        </div>
        
        {/* Separador */}
        <div className="h-px bg-gray-200 dark:bg-gray-800 my-4"></div>
        
        {/* Navegação por Abas */}
        <div className="flex flex-wrap gap-1 bg-gray-200 dark:bg-navy-700 p-1 rounded-lg">

      {/* --- OVERLAY (quando menu aberto) --- */}
      {isFilterPanelOpen && (
        <div
          onClick={() => setIsFilterPanelOpen(false)}
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-30"
        />
      )}

      {/* --- BOTÃO TOGGLE DO MENU DE FILTROS (Fixo na direita) --- */}
      <button
        onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-l border-t border-b border-blue-200 dark:border-blue-700 rounded-l-lg shadow-lg transition-all hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-800/40 dark:hover:to-blue-700/40 flex flex-col items-center justify-center gap-1.5 ${
          isFilterPanelOpen ? 'translate-x-[380px]' : 'translate-x-0'
        }`}
        style={{ top: '50%', padding: '14px 10px', minWidth: '50px' }}
        title={isFilterPanelOpen ? 'Recolher filtros' : 'Expandir filtros'}
      >
        <Filter size={20} className="text-blue-600 dark:text-blue-400" />
        <span 
          className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          Filtros
        </span>
        {isFilterPanelOpen ? (
          <ChevronRight size={14} className="text-blue-600 dark:text-blue-400" />
        ) : (
          <ChevronLeft size={14} className="text-blue-600 dark:text-blue-400" />
        )}
      </button>

      {/* --- MENU DE FILTROS RECOLHÍVEL (Lateral Direita) --- */}
      <div
        className={`fixed right-0 top-0 h-full bg-white dark:bg-navy-800 border-l border-gray-200 dark:border-navy-700 shadow-2xl z-40 transition-transform duration-300 ease-in-out overflow-y-auto ${
          isFilterPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: '380px', paddingTop: '20px' }}
      >
        <div className="p-6 space-y-6">
          {/* Cabeçalho do Menu */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-navy-700 pb-4">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Filter size={20} />
              Filtros
            </h3>
            <button
              onClick={() => setIsFilterPanelOpen(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-navy-700 rounded transition-colors"
            >
              <X size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Filtro Setor - Estilo Busca */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Setores</label>
            <div className="relative sector-filter">
              <div className="relative">
                <div className="flex items-center">
                  <input
                    type="text"
                    placeholder="Buscar setor..."
                    value={sectorSearchTerm}
                    onChange={(e) => {
                      setSectorSearchTerm(e.target.value);
                      setShowSectorDropdown(true);
                    }}
                    onFocus={() => setShowSectorDropdown(true)}
                    className="w-full pl-10 pr-8 py-2 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-lg outline-none text-gray-700 dark:text-gray-300 focus:ring-2 ring-blue-500/20"
                  />
                  <Search className="absolute left-3 top-2.5 text-gray-400 z-10" size={18} />
                  {selectedSectors.length > 0 && (
                    <span className="absolute right-8 text-xs bg-blue-500 text-white rounded-full px-2 py-0.5">
                      {selectedSectors.length}
                    </span>
                  )}
                </div>
                {showSectorDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                    <div className="p-2">
                      <button
                        onClick={() => {
                          setSelectedSectors([]);
                          setShowSectorDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                      >
                        Todos Setores
                      </button>
                      {filteredSectors.map((s: string) => (
                        <label key={s} className="flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedSectors.includes(s)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSectors([...selectedSectors, s]);
                              } else {
                                setSelectedSectors(selectedSectors.filter(sec => sec !== s));
                              }
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{s}</span>
                        </label>
                      ))}
                      {filteredSectors.length === 0 && (
                        <div className="px-3 py-2 text-xs text-gray-500">Nenhum setor encontrado</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filtro Funcionário */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Funcionários</label>
            <div className="relative employee-filter">
              <div className="relative">
                <div className="flex items-center">
                  <input
                    type="text"
                    placeholder="Buscar funcionário..."
                    value={employeeSearchTerm}
                    onChange={(e) => {
                      setEmployeeSearchTerm(e.target.value);
                      setShowEmployeeDropdown(true);
                    }}
                    onFocus={() => setShowEmployeeDropdown(true)}
                    className="w-full pl-10 pr-8 py-2 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-lg outline-none text-gray-700 dark:text-gray-300 focus:ring-2 ring-blue-500/20"
                  />
                  <Search className="absolute left-3 top-2.5 text-gray-400 z-10" size={18} />
                  {selectedEmployees.length > 0 && (
                    <span className="absolute right-8 text-xs bg-blue-500 text-white rounded-full px-2 py-0.5">
                      {selectedEmployees.length}
                    </span>
                  )}
                </div>
                {showEmployeeDropdown && filteredEmployees.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                    <div className="p-2">
                      {filteredEmployees.slice(0, 10).map((name: string) => (
                        <label key={name} className="flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedEmployees.includes(name)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEmployees([...selectedEmployees, name]);
                              } else {
                                setSelectedEmployees(selectedEmployees.filter(emp => emp !== name));
                              }
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{name}</span>
                        </label>
                      ))}
                      {filteredEmployees.length > 10 && (
                        <div className="px-3 py-2 text-xs text-gray-500">
                          +{filteredEmployees.length - 10} mais...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filtros de Status - Estilo Busca */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
            <div className="relative status-filter">
              <div className="relative">
                <div className="flex items-center">
                  <input
                    type="text"
                    placeholder="Buscar status..."
                    value={statusSearchTerm}
                    onChange={(e) => {
                      setStatusSearchTerm(e.target.value);
                      setShowStatusDropdown(true);
                    }}
                    onFocus={() => setShowStatusDropdown(true)}
                    className="w-full pl-10 pr-8 py-2 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-lg outline-none text-gray-700 dark:text-gray-300 focus:ring-2 ring-blue-500/20"
                  />
                  <Search className="absolute left-3 top-2.5 text-gray-400 z-10" size={18} />
                  {selectedStatuses.length > 0 && selectedStatuses.length < 4 && (
                    <span className="absolute right-8 text-xs bg-blue-500 text-white rounded-full px-2 py-0.5">
                      {selectedStatuses.length}
                    </span>
                  )}
                </div>
                {showStatusDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                    <div className="p-2">
                      {filteredStatuses.map((status: string) => (
                        <label key={status} className="flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedStatuses.includes(status)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStatuses([...selectedStatuses, status]);
                              } else {
                                setSelectedStatuses(selectedStatuses.filter(s => s !== status));
                              }
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{status}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filtros de Período - Estilo Busca */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Período</label>
            <div className="relative period-filter">
              <div className="relative">
                <button
                  onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                  className="w-full pl-10 pr-8 py-2 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-lg outline-none cursor-pointer text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors flex items-center justify-between"
                >
                  <span className="truncate">
                    {activeFilterLabel}
                  </span>
                  <span className="text-xs text-gray-400">▼</span>
                </button>
                <Calendar className="absolute left-3 top-2.5 text-gray-400 z-10" size={18} />
                {showPeriodDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                    <div className="p-2">
                      {[
                        { key: 'thisMonth', label: 'Este Mês' },
                        { key: 'lastMonth', label: 'Mês Passado' },
                        { key: 'thisQuarter', label: 'Este Trimestre' },
                        { key: 'lastQuarter', label: 'Trimestre Passado' },
                        { key: 'thisSemester', label: 'Este Semestre' },
                        { key: 'lastSemester', label: 'Semestre Passado' },
                        { key: 'thisYear', label: 'Este Ano' },
                        { key: 'lastYear', label: 'Ano Passado' },
                        { key: 'all', label: 'Todo Período' }
                      ].map((period) => {
                        const isActive = (period.key === 'all' && !dateStart) || activeFilterLabel === period.label;
                        
                        return (
                          <button 
                            key={period.key}
                            onClick={() => {
                              applyDateFilter(period.key as any);
                              setShowPeriodDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm rounded transition-all ${
                               isActive 
                               ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' 
                               : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {period.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Intervalo Personalizado - Com Date Picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Período Personalizado</label>
            <div className="flex flex-col gap-2">
              <div className="relative date-picker">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400" />
                  <input 
                    type="date" 
                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-lg outline-none text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                    value={dateStart}
                    onChange={e => { 
                      setDateStart(e.target.value); 
                      setActiveFilterLabel('Personalizado'); 
                    }}
                    placeholder="Data inicial"
                  />
                </div>
              </div>
              <div className="relative date-picker">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">até</span>
                  <input 
                    type="date" 
                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-lg outline-none text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                    value={dateEnd}
                    onChange={e => { 
                      setDateEnd(e.target.value); 
                      setActiveFilterLabel('Personalizado'); 
                    }}
                    placeholder="Data final"
                  />
                  {(dateStart || dateEnd) && (
                    <button 
                      onClick={() => {
                        setDateStart('');
                        setDateEnd('');
                        applyDateFilter('all');
                      }} 
                      className="p-2 hover:bg-gray-100 dark:hover:bg-navy-700 rounded transition-colors"
                      title="Limpar datas"
                    >
                      <X size={16} className="text-gray-600 dark:text-gray-400" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* O que mostrar no Dashboard (Saúde da Empresa) */}
          {activeTab === 'overview' && (
            <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-navy-700">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">O que mostrar no Dashboard</label>
              <div className="space-y-2">
                {[
                  { key: 'scorecards', label: 'Scorecards' },
                  { key: 'rankings', label: 'Rankings (Setor/Cargo)' },
                  { key: 'health', label: 'Saúde da Empresa' },
                  { key: 'distributions', label: 'Distribuições' },
                  { key: 'performance', label: 'Tabela de Performance' },
                  { key: 'highlights', label: 'Destaques' },
                  { key: 'employees', label: 'Colaboradores' },
                  { key: 'disc', label: 'DISC' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overviewSections[key as keyof typeof overviewSections]}
                      onChange={(e) => setOverviewSections((prev) => ({ ...prev, [key]: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Indicador de Filtros Ativos */}
          {(selectedSectors.length > 0 || selectedEmployees.length > 0 || selectedStatuses.length !== 1 || selectedStatuses[0] !== 'Ativo' || dateStart || dateEnd) && (
            <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-navy-700">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filtros Ativos</label>
              <div className="flex flex-col gap-2">
                {selectedSectors.length > 0 && (
                  <div className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm">
                    Setores: {selectedSectors.length}
                  </div>
                )}
                {selectedEmployees.length > 0 && (
                  <div className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm">
                    Funcionários: {selectedEmployees.length}
                  </div>
                )}
                {(selectedStatuses.length !== 1 || selectedStatuses[0] !== 'Ativo') && (
                  <div className="px-3 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-sm">
                    Status: {selectedStatuses.join(', ')}
                  </div>
                )}
                {(dateStart || dateEnd) && (
                  <div className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-sm">
                    {activeFilterLabel}
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => {
                      setSelectedSectors([]);
                      setSelectedEmployees([]);
                      setSelectedStatuses(['Ativo']);
                      setEmployeeSearchTerm('');
                      setSectorSearchTerm('');
                      setStatusSearchTerm('');
                      applyDateFilter('all');
                    }}
                    className="w-full px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-200 dark:border-red-800"
                  >
                    Limpar todos os filtros
                  </button>
                  <button 
                    onClick={clearSavedFilters}
                    className="w-full px-3 py-2 text-sm font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors border border-orange-200 dark:border-orange-800"
                    title="Remove os filtros salvos do navegador"
                  >
                    Limpar filtros salvos
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Exportação - Overview com seções ou Dashboard completo */}
          {evaluations.length > 0 && (
            <div className="pt-4 border-t border-gray-200 dark:border-navy-700 space-y-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Exportar</label>
              {activeTab === 'overview' ? (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={async () => {
                      setExportingOverviewExcel(true);
                      try {
                        exportOverviewToExcel(
                          analytics.generalMetrics,
                          analytics.competenceMetrics,
                          currentCompany?.name || 'Empresa',
                          overviewSections
                        );
                        toast.success('Excel exportado com sucesso!');
                      } catch (e) {
                        toast.error('Erro ao exportar Excel.');
                      } finally {
                        setExportingOverviewExcel(false);
                      }
                    }}
                    disabled={exportingOverviewExcel}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {exportingOverviewExcel ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                    Exportar Excel
                  </button>
                  <button
                    onClick={async () => {
                      setExportingOverviewPDF(true);
                      try {
                        exportOverviewToPDF(analytics.generalMetrics, currentCompany?.name || 'Empresa', overviewSections);
                        toast.success('PDF exportado com sucesso!');
                      } catch (e) {
                        toast.error('Erro ao exportar PDF.');
                      } finally {
                        setExportingOverviewPDF(false);
                      }
                    }}
                    disabled={exportingOverviewPDF}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {exportingOverviewPDF ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                    Exportar PDF
                  </button>
                </div>
              ) : (
                <ReportExporter
                  title="Dashboard de Desempenho"
                  contentRef={dashboardContentRef}
                  generalMetrics={analytics.generalMetrics}
                  competenceMetrics={analytics.competenceMetrics}
                  comparativeMetrics={analytics.comparativeMetrics}
                  companyName={currentCompany?.name || 'Empresa'}
                  exportType="dashboard"
                />
              )}
            </div>
          )}
        </div>
      </div>

          <button
            onClick={() => {
              setActiveTab('overview');
              navigate('/dashboard/overview');
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'overview' 
                ? 'bg-white dark:bg-navy-800 text-blue-600 dark:text-gold-400 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            Saúde da Empresa
          </button>
          <button
            onClick={() => {
              setActiveTab('performance');
              navigate('/dashboard/performance');
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'performance' 
                ? 'bg-white dark:bg-navy-800 text-blue-600 dark:text-gold-400 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            Análise de Desempenho
          </button>
          <button
            onClick={() => {
              setActiveTab('individual');
              navigate('/dashboard/individual');
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'individual' 
                ? 'bg-white dark:bg-navy-800 text-blue-600 dark:text-gold-400 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            Comparativo Individual
          </button>
          <button
            onClick={() => {
              setActiveTab('ranking');
              navigate('/dashboard/ranking');
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'ranking' 
                ? 'bg-white dark:bg-navy-800 text-blue-600 dark:text-gold-400 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            Ranking
          </button>
          <button
            onClick={() => {
              setActiveTab('behavioral');
              navigate('/dashboard/behavioral');
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'behavioral' 
                ? 'bg-white dark:bg-navy-800 text-blue-600 dark:text-gold-400 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            Perfil Comportamental
          </button>
        </div>
      </div>

      {/* --- CONTEÚDO DAS ABAS --- */}
      <div 
        ref={dashboardContentRef}
        className={`transition-all duration-300 ${isFilterPanelOpen ? 'mr-[380px]' : 'mr-0'}`}
      >
        {evaluations.length === 0 ? (
          <div className="p-10 text-center text-gray-500 bg-white dark:bg-navy-800 rounded-xl border border-dashed border-gray-300 dark:border-navy-700">
            Nenhuma avaliação encontrada. Utilize a aba "Histórico" para importar dados via CSV.
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <CompanyOverview
                data={analytics.generalMetrics}
                competenceData={analytics.competenceMetrics}
                employees={employees}
                visibleSections={overviewSections}
              />
            )}
            {activeTab === 'performance' && <PerformanceAnalysis data={analytics.competenceMetrics} />}
            {activeTab === 'individual' && <IndividualAnalysis data={analytics.comparativeMetrics} />}
            {activeTab === 'ranking' && (
              <RankingView 
                evaluations={evaluations} 
                employees={employees} 
                filters={{
                  dateStart,
                  dateEnd,
                  selectedStatuses
                }}
              />
            )}
            {activeTab === 'behavioral' && <BehavioralProfile />}
          </>
        )}
      </div>

    </div>
  );
};