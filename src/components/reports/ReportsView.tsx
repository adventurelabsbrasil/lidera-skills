import React, { useState, useEffect } from 'react';
import { ReportTypeSelector, REPORT_TYPES, type ReportType } from './ReportTypeSelector';
import { AdvancedReportFilters, DEFAULT_REPORT_FILTERS, type ReportFilters } from './AdvancedReportFilters';
import { DataPreviewTable } from './DataPreviewTable';
import { useCompany } from '../../contexts/CompanyContext';
import { fetchCollection } from '../../services/firebase';
import { useReportData } from '../../hooks/useReportData';
import {
  exportReportToCSV,
  exportReportToXLS,
  exportReportToPDF,
  exportGeneralReportToPDF,
  exportGeneralReportToExcel,
  getReportColumns,
  type GeneralReportData,
} from '../../utils/reportExporterAnalytics';
import { toast } from '../../utils/toast';
import { Menu, X, FileText, FileSpreadsheet, FileDown, Loader2 } from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { currentCompany } = useCompany();
  const [selectedReportType, setSelectedReportType] = useState<ReportType | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_REPORT_FILTERS);
  const [uniqueSectors, setUniqueSectors] = useState<string[]>([]);
  const [uniqueRoles, setUniqueRoles] = useState<string[]>([]);
  const [uniqueEmployees, setUniqueEmployees] = useState<string[]>([]);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [exportingXLS, setExportingXLS] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  const companyId = currentCompany?.id === 'all' ? null : currentCompany?.id ?? null;

  useEffect(() => {
    const loadFilterOptions = async () => {
      if (!companyId && currentCompany?.id !== 'all') return;
      try {
        const [sectorsData, rolesData, employeesData] = await Promise.all([
          fetchCollection('sectors', companyId),
          fetchCollection('roles', companyId),
          fetchCollection('employees', companyId),
        ]);
        setUniqueSectors([...new Set((sectorsData as { name?: string }[]).map((s) => s.name).filter(Boolean))] as string[]);
        setUniqueRoles([...new Set((rolesData as { name?: string }[]).map((r) => r.name).filter(Boolean))] as string[]);
        setUniqueEmployees([...new Set((employeesData as { name?: string }[]).map((e) => e.name).filter(Boolean))] as string[]);
      } catch (error) {
        console.error('Erro ao carregar opções de filtro:', error);
      }
    };
    loadFilterOptions();
  }, [companyId, currentCompany?.id]);

  const selectedOption = REPORT_TYPES.find((t) => t.id === selectedReportType);
  const selectedLabel = selectedOption?.label ?? 'Relatórios';

  const { data, loading, error, totalCount } = useReportData({
    reportType: selectedReportType,
    filters,
    companyId,
  });

  const rows = Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  const generalData = !Array.isArray(data) && data && typeof data === 'object' ? (data as GeneralReportData) : null;
  const canExport =
    selectedReportType &&
    (selectedReportType === 'geral' ? !!generalData?.summary || !!generalData?.sections : rows.length > 0);

  const companyName = currentCompany?.name ?? 'Empresa';

  const handleExportCSV = () => {
    if (!canExport || selectedReportType === 'geral') return;
    setExportingCSV(true);
    try {
      exportReportToCSV(rows, undefined, selectedReportType!);
      toast.success('Relatório CSV exportado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao exportar CSV.');
    } finally {
      setExportingCSV(false);
    }
  };

  const handleExportXLS = () => {
    if (!canExport) return;
    setExportingXLS(true);
    try {
      if (selectedReportType === 'geral' && generalData) {
        exportGeneralReportToExcel(generalData, companyName);
      } else {
        const sheetName = selectedLabel?.slice(0, 31) || 'Dados';
        exportReportToXLS(rows, sheetName, undefined, selectedReportType!);
      }
      toast.success('Relatório Excel exportado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao exportar Excel.');
    } finally {
      setExportingXLS(false);
    }
  };

  const handleExportPDF = () => {
    if (!canExport) return;
    setExportingPDF(true);
    try {
      if (selectedReportType === 'geral' && generalData) {
        exportGeneralReportToPDF(generalData, companyName);
      } else {
        const cols = getReportColumns(selectedReportType!);
        exportReportToPDF(rows, selectedLabel || 'Relatório', cols, undefined, selectedReportType!);
      }
      toast.success('Relatório PDF exportado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao exportar PDF.');
    } finally {
      setExportingPDF(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 animate-fadeIn">
      {/* Mobile toggle */}
      <div className="md:hidden mb-4">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="flex items-center gap-2 bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-700 px-4 py-2 rounded-lg shadow-sm text-gray-700 dark:text-white w-full justify-between"
        >
          <span className="font-semibold flex items-center gap-2">
            <Menu size={18} /> Tipo de Relatório
          </span>
          {isSidebarOpen ? <X size={18} /> : null}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`md:w-64 flex-shrink-0 ${isSidebarOpen ? 'block' : 'hidden md:block'}`}>
        <div className="bg-white dark:bg-lidera-gray rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4 sticky top-24">
          <ReportTypeSelector selectedType={selectedReportType} onSelect={setSelectedReportType} />
        </div>
      </aside>

      {/* Main content */}
      <section className="flex-1 min-w-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Relatórios</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {selectedReportType
              ? `Configure filtros e exporte o relatório de ${selectedLabel}`
              : 'Selecione um tipo de relatório para começar'}
          </p>
        </div>

        {selectedReportType ? (
          <div className="space-y-6">
            <AdvancedReportFilters
              reportType={selectedReportType}
              filters={filters}
              onFiltersChange={setFilters}
              onApply={() => {}}
              uniqueSectors={uniqueSectors}
              uniqueRoles={uniqueRoles}
              uniqueEmployees={uniqueEmployees}
            />
            {canExport && (
              <div className="flex flex-wrap gap-2">
                {selectedReportType !== 'geral' && (
                  <button
                    onClick={handleExportCSV}
                    disabled={exportingCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {exportingCSV ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
                    Exportar CSV
                  </button>
                )}
                <button
                  onClick={handleExportXLS}
                  disabled={exportingXLS}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {exportingXLS ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                  Exportar Excel
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={exportingPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {exportingPDF ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                  Exportar PDF
                </button>
              </div>
            )}
            <DataPreviewTable
              data={data}
              reportType={selectedReportType}
              loading={loading}
              error={error}
              totalCount={totalCount}
            />
          </div>
        ) : (
          <div className="bg-white dark:bg-lidera-gray rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              Selecione um tipo de relatório no menu à esquerda para configurar filtros e exportar.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};
