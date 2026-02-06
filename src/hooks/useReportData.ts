import { useState, useEffect, useMemo } from 'react';
import { fetchCollection } from '../services/firebase';
import { useDashboardAnalytics } from './useDashboardAnalytics';
import { usePerformanceGoals } from './usePerformanceGoals';
import type { ReportType } from '../components/reports/ReportTypeSelector';
import type { ReportFilters } from '../components/reports/AdvancedReportFilters';

interface UseReportDataInput {
  reportType: ReportType | null;
  filters: ReportFilters;
  companyId: string | null;
}

interface UseReportDataOutput {
  data: Record<string, unknown>[] | unknown;
  loading: boolean;
  error: string | null;
  totalCount: number;
}

export function useReportData({
  reportType,
  filters,
  companyId,
}: UseReportDataInput): UseReportDataOutput {
  const [rawData, setRawData] = useState<{
    companies: Record<string, unknown>[];
    sectors: Record<string, unknown>[];
    roles: Record<string, unknown>[];
    employees: Record<string, unknown>[];
    criteria: Record<string, unknown>[];
    evaluations: Record<string, unknown>[];
  }>({
    companies: [],
    sectors: [],
    roles: [],
    employees: [],
    criteria: [],
    evaluations: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { goalValue } = usePerformanceGoals();

  const loadData = async () => {
    if (!reportType) return;
    setLoading(true);
    setError(null);
    try {
      const [companiesData, sectorsData, rolesData, employeesData, criteriaData, evaluationsData] =
        await Promise.all([
          fetchCollection('companies'),
          fetchCollection('sectors', companyId),
          fetchCollection('roles', companyId),
          fetchCollection('employees', companyId),
          fetchCollection('evaluation_criteria'),
          fetchCollection('evaluations', companyId),
        ]);
      setRawData({
        companies: companiesData as Record<string, unknown>[],
        sectors: sectorsData as Record<string, unknown>[],
        roles: rolesData as Record<string, unknown>[],
        employees: employeesData as Record<string, unknown>[],
        criteria: criteriaData as Record<string, unknown>[],
        evaluations: evaluationsData as Record<string, unknown>[],
      });
    } catch (err) {
      console.error('Erro ao carregar dados para relatório:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
      setRawData({
        companies: [],
        sectors: [],
        roles: [],
        employees: [],
        criteria: [],
        evaluations: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [reportType, companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const analytics = useDashboardAnalytics(
    rawData.evaluations,
    rawData.employees,
    {
      selectedSectors: filters.selectedSectors,
      selectedEmployees: filters.selectedEmployees,
      selectedStatuses: filters.selectedStatuses,
      dateStart: filters.dateStart,
      dateEnd: filters.dateEnd,
    },
    rawData.criteria as { id?: string; name?: string; type?: string }[],
    goalValue
  );

  const data = useMemo(() => {
    if (!reportType) return [];

    const ev = rawData.evaluations as Record<string, unknown>[];
    const emp = rawData.employees as Record<string, unknown>[];

    switch (reportType) {
      case 'empresas':
        return rawData.companies;

      case 'setores': {
        let list = rawData.sectors;
        if (filters.selectedSectors.length > 0) {
          list = list.filter((s) =>
            filters.selectedSectors.includes((s.name as string) || '')
          );
        }
        return list;
      }

      case 'cargos': {
        let list = rawData.roles;
        if (filters.selectedRoles.length > 0) {
          list = list.filter((r) =>
            filters.selectedRoles.includes((r.name as string) || '')
          );
        }
        return list;
      }

      case 'niveis': {
        const levels = new Map<string, { jobLevel: string; count: number; sectors: string[] }>();
        let filtered = emp;
        if (filters.selectedSectors.length > 0) {
          filtered = filtered.filter((e) =>
            filters.selectedSectors.includes((e.sector as string) || '')
          );
        }
        filtered.forEach((e) => {
          const level = (e.jobLevel as string) || 'Não informado';
          if (!levels.has(level)) {
            levels.set(level, { jobLevel: level, count: 0, sectors: [] });
          }
          const entry = levels.get(level)!;
          entry.count++;
          const s = (e.sector as string) || '';
          if (s && !entry.sectors.includes(s)) entry.sectors.push(s);
        });
        return Array.from(levels.values()).map((v) => ({
          Nível: v.jobLevel,
          Quantidade: v.count,
          Setores: v.sectors.join(', '),
        }));
      }

      case 'colaboradores': {
        let list = emp;
        if (filters.selectedSectors.length > 0) {
          list = list.filter((e) =>
            filters.selectedSectors.includes((e.sector as string) || '')
          );
        }
        if (filters.selectedRoles.length > 0) {
          list = list.filter((e) =>
            filters.selectedRoles.includes((e.role as string) || '')
          );
        }
        if (filters.selectedStatuses.length > 0) {
          list = list.filter((e) =>
            filters.selectedStatuses.includes((e.status as string) || 'Ativo')
          );
        }
        if (filters.dateStart || filters.dateEnd) {
          const empIds = new Set<string>();
          const empNames = new Set<string>();
          ev
            .filter((e) => {
              const d = (e.date as string) || (e.referenceMonth as string) || '';
              if (!d) return false;
              const dateStr = d.length >= 7 ? d.slice(0, 7) : d;
              if (filters.dateStart && dateStr < filters.dateStart.slice(0, 7)) return false;
              if (filters.dateEnd && dateStr > filters.dateEnd.slice(0, 7)) return false;
              return true;
            })
            .forEach((e) => {
              if (e.employeeId) empIds.add(String(e.employeeId));
              if (e.employeeName) empNames.add(String(e.employeeName));
            });
          list = list.filter(
            (e) => empIds.has(String(e.id)) || empNames.has(String(e.name))
          );
        }
        return list;
      }

      case 'criterios': {
        let list = rawData.criteria;
        if (filters.criteriaType !== 'all') {
          list = list.filter((c) => (c.type as string) === filters.criteriaType);
        }
        return list;
      }

      case 'historico': {
        let list = ev;
        if (filters.dateStart) {
          const start = filters.dateStart.slice(0, 7);
          list = list.filter((e) => {
            const d = (e.date as string) || (e.referenceMonth as string) || '';
            const evMonth = d.length >= 7 ? d.slice(0, 7) : d;
            return evMonth >= start;
          });
        }
        if (filters.dateEnd) {
          const end = filters.dateEnd.slice(0, 7);
          list = list.filter((e) => {
            const d = (e.date as string) || (e.referenceMonth as string) || '';
            const evMonth = d.length >= 7 ? d.slice(0, 7) : d;
            return evMonth <= end;
          });
        }
        if (filters.selectedSectors.length > 0) {
          list = list.filter((e) =>
            filters.selectedSectors.includes((e.sector as string) || '')
          );
        }
        if (filters.selectedEmployees.length > 0) {
          list = list.filter((e) =>
            filters.selectedEmployees.includes((e.employeeName as string) || '')
          );
        }
        return list;
      }

      case 'disc': {
        let list = emp.filter((e) => e.discProfile);
        if (filters.selectedSectors.length > 0) {
          list = list.filter((e) =>
            filters.selectedSectors.includes((e.sector as string) || '')
          );
        }
        if (filters.selectedRoles.length > 0) {
          list = list.filter((e) =>
            filters.selectedRoles.includes((e.role as string) || '')
          );
        }
        return list;
      }

      case 'ranking-pontuacao': {
        const pl = analytics.generalMetrics?.performanceList || [];
        return pl.map((item: Record<string, unknown>, idx: number) => ({
          Posição: idx + 1,
          Nome: item.realName ?? item.employeeName,
          Setor: item.realSector ?? item.sector,
          Cargo: item.realRole ?? item.role,
          Nível: item.realType ?? item.type,
          Pontuação: (item.score as number)?.toFixed?.(2) ?? item.score,
          Avaliações: item.evaluationCount ?? 0,
        }));
      }

      case 'ranking-destaque': {
        const pl = analytics.generalMetrics?.performanceList || [];
        const ev = rawData.evaluations as Record<string, unknown>[];
        const highlightCountByEmployee = new Map<string, number>();
        ev.forEach((e) => {
          const isHighlight =
            e.funcionarioMes === 'Sim' ||
            e.funcionarioMes === 'sim' ||
            e.funcionario_mes === 'Sim' ||
            e.funcionario_mes === true;
          if (!isHighlight) return;
          const name = (e.employeeName as string) || (e.realName as string) || '';
          if (!name) return;
          highlightCountByEmployee.set(name, (highlightCountByEmployee.get(name) || 0) + 1);
        });
        const sorted = [...pl].sort(
          (a: Record<string, unknown>, b: Record<string, unknown>) => {
            const nameA = (a.realName ?? a.employeeName) as string;
            const nameB = (b.realName ?? b.employeeName) as string;
            const ha = highlightCountByEmployee.get(nameA) ?? 0;
            const hb = highlightCountByEmployee.get(nameB) ?? 0;
            return hb - ha;
          }
        );
        return sorted.map((item: Record<string, unknown>, idx: number) => {
          const name = (item.realName ?? item.employeeName) as string;
          return {
            Posição: idx + 1,
            Nome: name,
            Setor: item.realSector ?? item.sector,
            Cargo: item.realRole ?? item.role,
            Nível: item.realType ?? item.type,
            Pontuação: (item.score as number)?.toFixed?.(2) ?? item.score,
            Destaques: highlightCountByEmployee.get(name) ?? 0,
          };
        });
      }

      case 'geral':
        return {
          summary: analytics.generalMetrics,
          sections: {
            companies: rawData.companies,
            sectors: rawData.sectors,
            roles: rawData.roles,
            employees: rawData.employees,
            criteria: rawData.criteria,
            evaluations: rawData.evaluations,
            disc: emp.filter((e) => e.discProfile),
            ranking: analytics.generalMetrics?.performanceList || [],
          },
        };

      default:
        return [];
    }
  }, [
    reportType,
    filters,
    rawData,
    analytics.generalMetrics,
  ]);

  const totalCount = useMemo(() => {
    if (!data) return 0;
    if (Array.isArray(data)) return data.length;
    if (typeof data === 'object' && 'sections' in data) {
      const s = data.sections as Record<string, unknown[]>;
      return Object.values(s).reduce((acc, arr) => acc + (arr?.length ?? 0), 0);
    }
    return 0;
  }, [data]);

  return {
    data,
    loading,
    error,
    totalCount,
  };
}
