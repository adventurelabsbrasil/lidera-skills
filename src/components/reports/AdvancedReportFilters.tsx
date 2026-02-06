import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, X, ChevronDown } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import { fetchCollection } from '../../services/firebase';
import type { ReportType } from './ReportTypeSelector';

export interface ReportFilters {
  dateStart: string;
  dateEnd: string;
  selectedSectors: string[];
  selectedRoles: string[];
  selectedStatuses: string[];
  employeeSearchTerm: string;
  selectedEmployees: string[];
  criteriaType: 'Líder' | 'Colaborador' | 'all';
}

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  dateStart: '',
  dateEnd: '',
  selectedSectors: [],
  selectedRoles: [],
  selectedStatuses: ['Ativo'],
  employeeSearchTerm: '',
  selectedEmployees: [],
  criteriaType: 'all',
};

const REPORT_FILTERS_STORAGE_KEY = 'lidera-skills-reports-filters';

const STATUS_OPTIONS = ['Ativo', 'Inativo', 'Férias', 'Afastado'];

const PERIOD_PRESETS: { label: string; getRange: () => { start: string; end: string } }[] = [
  { label: 'Todo o período', getRange: () => ({ start: '', end: '' }) },
  {
    label: 'Este mês',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    },
  },
  {
    label: 'Mês passado',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - 1, 0);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    },
  },
  {
    label: 'Este trimestre',
    getRange: () => {
      const now = new Date();
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      const end = new Date(now.getFullYear(), (q + 1) * 3, 0);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    },
  },
  {
    label: 'Este ano',
    getRange: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    },
  },
];

function loadSavedFilters(reportType: ReportType): Partial<ReportFilters> {
  try {
    const saved = localStorage.getItem(`${REPORT_FILTERS_STORAGE_KEY}-${reportType}`);
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return {};
}

function saveFilters(reportType: ReportType, filters: ReportFilters) {
  try {
    localStorage.setItem(`${REPORT_FILTERS_STORAGE_KEY}-${reportType}`, JSON.stringify(filters));
  } catch {
    // ignore
  }
}

interface AdvancedReportFiltersProps {
  reportType: ReportType;
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
  onApply?: () => void;
  uniqueSectors?: string[];
  uniqueRoles?: string[];
  uniqueEmployees?: string[];
}

export const AdvancedReportFilters: React.FC<AdvancedReportFiltersProps> = ({
  reportType,
  filters,
  onFiltersChange,
  onApply,
  uniqueSectors = [],
  uniqueRoles = [],
  uniqueEmployees = [],
}) => {
  const { currentCompany } = useCompany();
  const [showSectors, setShowSectors] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showEmployees, setShowEmployees] = useState(false);
  const [showPeriod, setShowPeriod] = useState(false);

  const companyId = currentCompany?.id === 'all' ? null : currentCompany?.id ?? null;

  useEffect(() => {
    const saved = loadSavedFilters(reportType);
    if (Object.keys(saved).length > 0) {
      onFiltersChange({ ...DEFAULT_REPORT_FILTERS, ...saved });
    }
  }, [reportType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    saveFilters(reportType, filters);
  }, [reportType, filters]);

  const filteredSectors = useMemo(() => [...uniqueSectors].sort(), [uniqueSectors]);

  const filteredRolesForSelect = useMemo(() => {
    return uniqueRoles.sort();
  }, [uniqueRoles]);

  const filteredStatuses = useMemo(() => STATUS_OPTIONS, []);

  const filteredEmployeesForSelect = useMemo(() => {
    const term = (filters.employeeSearchTerm || '').toLowerCase();
    if (!term) return uniqueEmployees.slice(0, 20);
    return uniqueEmployees.filter((e) => e.toLowerCase().includes(term)).slice(0, 20);
  }, [uniqueEmployees, filters.employeeSearchTerm]);

  const needsSectors = [
    'geral',
    'niveis',
    'colaboradores',
    'historico',
    'disc',
    'ranking-pontuacao',
    'ranking-destaque',
  ].includes(reportType);
  const needsRoles = ['niveis', 'colaboradores', 'disc'].includes(reportType);
  const needsStatus = ['geral', 'colaboradores', 'ranking-pontuacao'].includes(reportType);
  const needsPeriod = [
    'geral',
    'colaboradores',
    'historico',
    'ranking-pontuacao',
    'ranking-destaque',
  ].includes(reportType);
  const needsEmployees = ['historico'].includes(reportType);
  const needsCriteriaType = ['criterios'].includes(reportType);

  const handleClear = () => {
    onFiltersChange({ ...DEFAULT_REPORT_FILTERS });
    setShowSectors(false);
    setShowRoles(false);
    setShowStatus(false);
    setShowEmployees(false);
    setShowPeriod(false);
  };

  const handlePeriodPreset = (preset: (typeof PERIOD_PRESETS)[0]) => {
    const { start, end } = preset.getRange();
    onFiltersChange({ ...filters, dateStart: start, dateEnd: end });
  };

  const hasAnyFilter =
    filters.dateStart ||
    filters.dateEnd ||
    filters.selectedSectors.length > 0 ||
    filters.selectedRoles.length > 0 ||
    (filters.selectedStatuses.length > 0 && filters.selectedStatuses.length < STATUS_OPTIONS.length) ||
    filters.selectedEmployees.length > 0 ||
    filters.criteriaType !== 'all';

  return (
    <div className="bg-white dark:bg-lidera-gray rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Filter size={20} />
          Filtros Avançados
        </h3>
        {hasAnyFilter && (
          <button
            onClick={handleClear}
            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-400"
          >
            Limpar
          </button>
        )}
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Configure os filtros abaixo e clique em Aplicar para carregar os dados filtrados antes de exportar.
      </p>

      <div className="space-y-4">
        {needsPeriod && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Período</label>
            <div className="flex flex-wrap gap-2">
              {PERIOD_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => handlePeriodPreset(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm ${
                    !filters.dateStart && !filters.dateEnd && p.label === 'Todo o período'
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      : filters.dateStart === p.getRange().start && filters.dateEnd === p.getRange().end
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={filters.dateStart}
                onChange={(e) => onFiltersChange({ ...filters, dateStart: e.target.value })}
                className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm"
              />
              <span className="self-center text-gray-500">até</span>
              <input
                type="date"
                value={filters.dateEnd}
                onChange={(e) => onFiltersChange({ ...filters, dateEnd: e.target.value })}
                className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-white text-sm"
              />
            </div>
          </div>
        )}

        {needsSectors && uniqueSectors.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Setores</label>
            <div className="relative">
              <button
                onClick={() => setShowSectors(!showSectors)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-lg text-left text-sm"
              >
                <span className="text-gray-700 dark:text-gray-300">
                  {filters.selectedSectors.length === 0
                    ? 'Todos os setores'
                    : `${filters.selectedSectors.length} selecionado(s)`}
                </span>
                <ChevronDown size={16} className="text-gray-400" />
              </button>
              {showSectors && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto p-2">
                  <button
                    onClick={() => {
                      onFiltersChange({ ...filters, selectedSectors: [] });
                      setShowSectors(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    Todos
                  </button>
                  {filteredSectors.map((s) => (
                    <label
                      key={s}
                      className="flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filters.selectedSectors.includes(s)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onFiltersChange({
                              ...filters,
                              selectedSectors: [...filters.selectedSectors, s],
                            });
                          } else {
                            onFiltersChange({
                              ...filters,
                              selectedSectors: filters.selectedSectors.filter((x) => x !== s),
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{s}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {needsRoles && uniqueRoles.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cargos</label>
            <div className="relative">
              <button
                onClick={() => setShowRoles(!showRoles)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-lg text-left text-sm"
              >
                <span className="text-gray-700 dark:text-gray-300">
                  {filters.selectedRoles.length === 0
                    ? 'Todos os cargos'
                    : `${filters.selectedRoles.length} selecionado(s)`}
                </span>
                <ChevronDown size={16} className="text-gray-400" />
              </button>
              {showRoles && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto p-2">
                  <button
                    onClick={() => {
                      onFiltersChange({ ...filters, selectedRoles: [] });
                      setShowRoles(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    Todos
                  </button>
                  {filteredRolesForSelect.map((r) => (
                    <label
                      key={r}
                      className="flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filters.selectedRoles.includes(r)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onFiltersChange({
                              ...filters,
                              selectedRoles: [...filters.selectedRoles, r],
                            });
                          } else {
                            onFiltersChange({
                              ...filters,
                              selectedRoles: filters.selectedRoles.filter((x) => x !== r),
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{r}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {needsStatus && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
            <div className="relative">
              <button
                onClick={() => setShowStatus(!showStatus)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-lg text-left text-sm"
              >
                <span className="text-gray-700 dark:text-gray-300">
                  {filters.selectedStatuses.length === 0 || filters.selectedStatuses.length === STATUS_OPTIONS.length
                    ? 'Todos os status'
                    : `${filters.selectedStatuses.length} selecionado(s)`}
                </span>
                <ChevronDown size={16} className="text-gray-400" />
              </button>
              {showStatus && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-lg shadow-lg z-50 p-2">
                  {filteredStatuses.map((s) => (
                    <label
                      key={s}
                      className="flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filters.selectedStatuses.includes(s)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onFiltersChange({
                              ...filters,
                              selectedStatuses: [...filters.selectedStatuses, s],
                            });
                          } else {
                            onFiltersChange({
                              ...filters,
                              selectedStatuses: filters.selectedStatuses.filter((x) => x !== s),
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{s}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {needsEmployees && uniqueEmployees.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Colaboradores</label>
            <div className="relative">
              <div className="flex items-center gap-2">
                <Search size={16} className="text-gray-400 absolute left-3" />
                <input
                  type="text"
                  placeholder="Buscar colaborador..."
                  value={filters.employeeSearchTerm}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, employeeSearchTerm: e.target.value })
                  }
                  onFocus={() => setShowEmployees(true)}
                  className="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-lg text-sm"
                />
              </div>
              {showEmployees && filteredEmployeesForSelect.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-navy-800 border border-gray-200 dark:border-navy-700 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto p-2">
                  {filteredEmployeesForSelect.map((name) => (
                    <label
                      key={name}
                      className="flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filters.selectedEmployees.includes(name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onFiltersChange({
                              ...filters,
                              selectedEmployees: [...filters.selectedEmployees, name],
                            });
                          } else {
                            onFiltersChange({
                              ...filters,
                              selectedEmployees: filters.selectedEmployees.filter((x) => x !== name),
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {needsCriteriaType && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Critério</label>
            <select
              value={filters.criteriaType}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  criteriaType: e.target.value as ReportFilters['criteriaType'],
                })
              }
              className="w-full px-3 py-2 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-lg text-gray-800 dark:text-white text-sm"
            >
              <option value="all">Todos</option>
              <option value="Líder">Líder</option>
              <option value="Colaborador">Colaborador</option>
            </select>
          </div>
        )}

        {!needsPeriod && !needsSectors && !needsRoles && !needsStatus && !needsEmployees && !needsCriteriaType && (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            Este tipo de relatório não possui filtros específicos.
          </p>
        )}
      </div>

      {onApply && (needsPeriod || needsSectors || needsRoles || needsStatus || needsEmployees || needsCriteriaType) && (
        <div className="mt-6">
          <button
            onClick={onApply}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-gradient text-white dark:text-black font-medium rounded-lg shadow-md hover:opacity-90 transition-opacity"
          >
            <Filter size={18} />
            Aplicar Filtros
          </button>
        </div>
      )}
    </div>
  );
};
