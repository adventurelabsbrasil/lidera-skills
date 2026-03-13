import React, { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';
import { Trophy, Star, Award, TrendingUp, Users, Briefcase, Layers, BarChart3, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useCompany } from '../../../contexts/CompanyContext';
import { formatShortName } from '../../../utils/nameFormatter';
import { exportRankingToExcel, exportRankingToPDF, type RankingExportRow } from '../../../utils/reportExporter';
import { toast } from '../../../utils/toast';

interface RankingViewProps {
  evaluations: any[];
  employees: any[];
  filters: {
    dateStart?: string;
    dateEnd?: string;
    selectedStatuses?: string[];
  };
}

type RankingType = 'geral' | 'setor' | 'cargo' | 'nivel';

export const RankingView = ({ evaluations = [], employees = [], filters }: RankingViewProps) => {
  const { currentCompany } = useCompany();
  const [rankingType, setRankingType] = useState<RankingType>('geral');
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [exportFiltered, setExportFiltered] = useState(true);
  const [exportTable, setExportTable] = useState(true);
  const [exportChart, setExportChart] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Mapa de funcionários para busca rápida
  const employeeMap = useMemo(() => {
    const map = new Map();
    employees.forEach((emp: any) => {
      map.set(emp.id, emp);
      if (emp.employeeCode) map.set(emp.employeeCode.toString().toLowerCase().trim(), emp);
      if (emp.name) map.set(emp.name.toLowerCase().trim(), emp);
    });
    return map;
  }, [employees]);

  // Função para normalizar ID do funcionário (remove duplicatas)
  const normalizeEmployeeId = React.useCallback((evaluation: any): string | null => {
    // Estratégia 1: Usar employeeId se disponível
    if (evaluation.employeeId) {
      const emp = employeeMap.get(evaluation.employeeId);
      if (emp) {
        return emp.id || evaluation.employeeId;
      }
      // Tentar como string normalizada
      const normalizedId = evaluation.employeeId.toString().toLowerCase().trim();
      const empById = Array.from(employeeMap.values()).find((e: any) => 
        e.id?.toString().toLowerCase().trim() === normalizedId ||
        e.employeeCode?.toString().toLowerCase().trim() === normalizedId
      );
      if (empById) return empById.id;
    }

    // Estratégia 2: Usar employeeCode se disponível
    if (evaluation.employeeCode) {
      const emp = employeeMap.get(evaluation.employeeCode.toString().toLowerCase().trim());
      if (emp) return emp.id;
    }

    // Estratégia 3: Usar employeeName normalizado
    if (evaluation.employeeName) {
      const normalizedName = evaluation.employeeName.toLowerCase().trim();
      const emp = employeeMap.get(normalizedName);
      if (emp) return emp.id;
    }

    // Fallback: usar employeeId ou employeeName como string única
    return evaluation.employeeId?.toString().toLowerCase().trim() || 
           evaluation.employeeCode?.toString().toLowerCase().trim() ||
           evaluation.employeeName?.toLowerCase().trim() ||
           null;
  }, [employeeMap]);

  // Processar avaliações e calcular pontuação acumulada
  const processedRankings = useMemo(() => {
    // Filtrar avaliações por período e status (comparação por data YYYY-MM-DD, sem timezone)
    let filtered = evaluations.filter((ev: any) => {
      // Filtro de data: compara strings YYYY-MM-DD para evitar deslocamento de fuso
      if (filters.dateStart || filters.dateEnd) {
        const evDateStr = ev.date ? String(ev.date).slice(0, 10) : '';
        if (!evDateStr) return false;

        if (filters.dateStart) {
          const startStr = filters.dateStart.slice(0, 10);
          if (evDateStr < startStr) return false;
        }
        if (filters.dateEnd) {
          const endStr = filters.dateEnd.slice(0, 10);
          if (evDateStr > endStr) return false;
        }
      }

      // Filtro de status
      if (filters.selectedStatuses && filters.selectedStatuses.length > 0) {
        const emp = employeeMap.get(ev.employeeId) || employeeMap.get(ev.employeeName?.toLowerCase().trim());
        if (!emp || !filters.selectedStatuses.includes(emp.status || 'Ativo')) {
          return false;
        }
      }

      return true;
    });

    // Agrupar por funcionário e calcular pontuação acumulada (sem duplicatas)
    const employeeScores = new Map<string, {
      name: string;
      employeeId: string;
      sector: string;
      role: string;
      level: string;
      scores: number[];
      dates: string[];
      totalScore: number;
      averageScore: number;
      evaluationCount: number;
      highlights: {
        bySelection: number;
        byScore: number;
      };
    }>();

    filtered.forEach((ev: any) => {
      const score = typeof ev.average === 'number' ? ev.average : parseFloat((ev.notaFinal || '0').replace(',', '.'));
      if (isNaN(score)) return;

      // Usar função de normalização para garantir ID único
      const normalizedId = normalizeEmployeeId(ev);
      if (!normalizedId) return; // Pular se não conseguir normalizar

      const emp = employeeMap.get(ev.employeeId) || 
                  employeeMap.get(ev.employeeCode?.toString().toLowerCase().trim()) ||
                  employeeMap.get(ev.employeeName?.toLowerCase().trim());
      const employeeName = emp?.name || ev.employeeName || 'Desconhecido';
      const employeeId = normalizedId; // Usar ID normalizado como chave única
      const sector = emp?.sector || ev.sector || 'Não definido';
      const role = emp?.role || ev.role || 'Não definido';
      const level = emp?.jobLevel || ev.level || ev.type || 'Operacional';

      // Usar ID normalizado como chave para evitar duplicatas
      if (!employeeScores.has(employeeId)) {
        employeeScores.set(employeeId, {
          name: employeeName,
          employeeId: emp?.id || ev.employeeId || ev.employeeCode || ev.employeeName || normalizedId, // ID real se disponível
          sector,
          role,
          level,
          scores: [],
          dates: [],
          totalScore: 0,
          averageScore: 0,
          evaluationCount: 0,
          highlights: {
            bySelection: 0,
            byScore: 0
          }
        });
      }

      const empData = employeeScores.get(employeeId)!;
      empData.scores.push(score);
      empData.dates.push(ev.date || new Date().toISOString());
      empData.totalScore += score;
      empData.evaluationCount++;
      empData.averageScore = empData.totalScore / empData.evaluationCount;

      // Contar destaques
      if (ev.funcionarioMes === 'Sim' || ev.funcionarioMes === true || ev.funcionarioMes === 'sim') {
        empData.highlights.bySelection++;
      }
      // Se está no top 5 do período, conta como destaque por pontuação
      // Isso será calculado depois
    });

    // Calcular destaques por pontuação (top 5 de cada período)
    const dates = Array.from(new Set(filtered.map((ev: any) => ev.date || ev.month))).sort();
    dates.forEach((date: string) => {
      const periodEvaluations = filtered.filter((ev: any) => (ev.date || ev.month) === date);
      const top5 = [...periodEvaluations]
        .sort((a: any, b: any) => {
          const scoreA = typeof a.average === 'number' ? a.average : parseFloat((a.notaFinal || '0').replace(',', '.'));
          const scoreB = typeof b.average === 'number' ? b.average : parseFloat((b.notaFinal || '0').replace(',', '.'));
          return scoreB - scoreA;
        })
        .slice(0, 5);

      top5.forEach((ev: any) => {
        const normalizedId = normalizeEmployeeId(ev);
        if (normalizedId) {
          const empData = employeeScores.get(normalizedId);
          if (empData) {
            empData.highlights.byScore++;
          }
        }
      });
    });

    // Converter para array e ordenar por pontuação média
    const rankings = Array.from(employeeScores.values())
      .sort((a, b) => b.averageScore - a.averageScore);

    // Separar por tipo - os dados já são filtrados pelos filtros do Dashboard principal
    // Quando rankingType é diferente de 'geral', mostra todos os rankings (já filtrados pelo Dashboard)
    const byType: Record<RankingType, typeof rankings> = {
      geral: rankings,
      setor: rankings, // Já filtrado por setor pelo Dashboard
      cargo: rankings, // Já filtrado por cargo pelo Dashboard (se houver)
      nivel: rankings  // Já filtrado por nível pelo Dashboard (se houver)
    };

    return {
      rankings: byType[rankingType],
      allRankings: rankings,
      uniqueSectors: Array.from(new Set(rankings.map(r => r.sector))).sort(),
      uniqueRoles: Array.from(new Set(rankings.map(r => r.role))).sort(),
      uniqueLevels: Array.from(new Set(rankings.map(r => r.level))).sort()
    };
  }, [evaluations, employees, filters, rankingType, employeeMap, normalizeEmployeeId]);

  // Preparar dados para gráfico de linhas (evolução temporal CUMULATIVA - SOMA)
  const chartData = useMemo(() => {
    const top10 = processedRankings.rankings.slice(0, 10);
    
    if (top10.length === 0) return [];
    
    // Obter todas as datas únicas ordenadas de TODAS as avaliações dos top10
    const allDates = Array.from(new Set(
      evaluations
        .filter(ev => {
          // Verificar se esta avaliação pertence a algum dos top10 usando normalização
          const evNormalizedId = normalizeEmployeeId(ev);
          if (!evNormalizedId) return false;
          
          return top10.some(emp => {
            const empNormalizedId = (emp.employeeId || '').toString().toLowerCase().trim();
            const empName = (emp.name || '').toString().toLowerCase().trim();
            const evEmployeeId = (ev.employeeId || '').toString().toLowerCase().trim();
            const evEmployeeName = (ev.employeeName || '').toString().toLowerCase().trim();
            
            return evNormalizedId === empNormalizedId ||
                   evNormalizedId === empName ||
                   evEmployeeId === empNormalizedId ||
                   evEmployeeName === empName;
          });
        })
        .map(ev => {
          // Normalizar data para formato YYYY-MM
          const dateStr = ev.date || ev.month || '';
          if (!dateStr) return null;
          // Se for YYYY-MM-DD, converter para YYYY-MM
          if (dateStr.includes('-') && dateStr.split('-').length === 3) {
            return dateStr.substring(0, 7); // YYYY-MM
          }
          return dateStr.substring(0, 7); // Já está em YYYY-MM ou similar
        })
        .filter(Boolean)
    )).sort();

    if (allDates.length === 0) return [];

    // Calcular SOMA acumulada por funcionário
    const cumulativeData: Array<Record<string, any>> = [];
    
    allDates.forEach((currentDate, dateIdx) => {
      const dataPoint: any = { date: currentDate };
      
      top10.forEach((emp) => {
        // Usar employeeId como chave única para o gráfico
        const empKey = `emp_${emp.employeeId || emp.name}`.replace(/\s+/g, '_');
        
        // Buscar TODAS as avaliações deste funcionário usando normalização
        const empNormalizedId = (emp.employeeId || '').toString().toLowerCase().trim();
        const empName = (emp.name || '').toString().toLowerCase().trim();
        
        const allEmpEvals = evaluations.filter((e: any) => {
          const normalizedId = normalizeEmployeeId(e);
          if (!normalizedId) return false;
          
          const evEmployeeId = (e.employeeId || '').toString().toLowerCase().trim();
          const evEmployeeCode = (e.employeeCode || '').toString().toLowerCase().trim();
          const evEmployeeName = (e.employeeName || '').toString().toLowerCase().trim();
          
          return normalizedId === empNormalizedId ||
                 normalizedId === empName ||
                 evEmployeeId === empNormalizedId ||
                 evEmployeeCode === empNormalizedId ||
                 evEmployeeName === empName ||
                 evEmployeeId === empName ||
                 evEmployeeName === empNormalizedId;
        }).sort((a: any, b: any) => {
          const dateA = (a.date || a.month || '').toString();
          const dateB = (b.date || b.month || '').toString();
          return dateA.localeCompare(dateB);
        });

        // Filtrar avaliações até a data atual (inclusive) e somar
        const empEvals = allEmpEvals.filter((e: any) => {
          let evDate = (e.date || e.month || '').toString();
          if (!evDate) return false;
          // Normalizar data para YYYY-MM
          if (evDate.includes('-') && evDate.split('-').length === 3) {
            evDate = evDate.substring(0, 7);
          } else {
            evDate = evDate.substring(0, 7);
          }
          // Comparar datas como strings (formato YYYY-MM)
          return evDate <= currentDate;
        });

        if (empEvals.length > 0) {
          // SOMA ACUMULADA: somar TODAS as notas médias até esta data
          const cumulativeSum = empEvals.reduce((sum: number, e: any) => {
            const score = typeof e.average === 'number' ? e.average : parseFloat((e.notaFinal || '0').replace(',', '.'));
            return sum + (isNaN(score) ? 0 : score);
          }, 0);
          dataPoint[empKey] = cumulativeSum;
          // Também salvar o nome para exibição na legenda
          dataPoint[`${empKey}_name`] = emp.name;
        } else {
          // Se não tem avaliação ainda nesta data, usar o valor anterior ou null
          if (dateIdx > 0 && cumulativeData.length > 0) {
            const previousValue = cumulativeData[dateIdx - 1]?.[empKey];
            dataPoint[empKey] = previousValue !== undefined && previousValue !== null ? previousValue : null;
            dataPoint[`${empKey}_name`] = emp.name;
          } else {
            dataPoint[empKey] = null;
            dataPoint[`${empKey}_name`] = emp.name;
          }
        }
      });
      
      cumulativeData.push(dataPoint);
    });

    return cumulativeData;
  }, [processedRankings.rankings, evaluations, normalizeEmployeeId]);

  const colors = ['#0F52BA', '#4CA1AF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1'];

  return (
    <div className="space-y-6">
      {/* Cabeçalho com Filtros */}
      <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-lg shadow-sm border border-gray-200 dark:border-[#121212]">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Trophy className="text-yellow-500" size={28} />
              Ranking de Pontuação
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Visualização acumulada das pontuações dos funcionários
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Tipo de Ranking */}
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setRankingType('geral')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  rankingType === 'geral'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                <BarChart3 size={16} className="inline mr-1" />
                Geral
              </button>
              <button
                onClick={() => setRankingType('setor')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  rankingType === 'setor'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                <Users size={16} className="inline mr-1" />
                Setor
              </button>
              <button
                onClick={() => setRankingType('cargo')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  rankingType === 'cargo'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                <Briefcase size={16} className="inline mr-1" />
                Cargo
              </button>
              <button
                onClick={() => setRankingType('nivel')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  rankingType === 'nivel'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                <Layers size={16} className="inline mr-1" />
                Nível
              </button>
            </div>


            {/* Modo de Visualização */}
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('chart')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'chart'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                Gráfico
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                Tabela
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Painel de Exportação */}
      {processedRankings.rankings.length > 0 && (
        <div className="bg-white dark:bg-[#1E1E1E] p-4 rounded-lg shadow-sm border border-gray-200 dark:border-[#121212]">
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportFiltered}
                  onChange={(e) => setExportFiltered(e.target.checked)}
                  className="rounded text-blue-600"
                />
                Exportar dados filtrados
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportTable}
                  onChange={(e) => setExportTable(e.target.checked)}
                  className="rounded text-blue-600"
                />
                Tabela de ranking
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportChart}
                  onChange={(e) => setExportChart(e.target.checked)}
                  className="rounded text-blue-600"
                />
                Gráfico de evolução
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const data = exportFiltered ? processedRankings.rankings : processedRankings.allRankings;
                  const rows: RankingExportRow[] = data.map((r: any) => ({
                    name: r.name,
                    employeeId: r.employeeId,
                    sector: r.sector,
                    role: r.role,
                    level: r.level,
                    totalScore: r.totalScore,
                    averageScore: r.averageScore,
                    evaluationCount: r.evaluationCount,
                    highlights: r.highlights || { bySelection: 0, byScore: 0 },
                  }));
                  setExportingExcel(true);
                  try {
                    exportRankingToExcel(rows, 'Ranking', `ranking_${currentCompany?.name || 'empresa'}_${new Date().toISOString().split('T')[0]}.xlsx`);
                    toast.success('Excel exportado com sucesso!');
                  } catch (e) {
                    toast.error('Erro ao exportar Excel.');
                  } finally {
                    setExportingExcel(false);
                  }
                }}
                disabled={exportingExcel || (!exportTable && !exportChart)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportingExcel ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                Exportar Excel
              </button>
              <button
                onClick={async () => {
                  const data = exportFiltered ? processedRankings.rankings : processedRankings.allRankings;
                  const rows: RankingExportRow[] = data.map((r: any) => ({
                    name: r.name,
                    employeeId: r.employeeId,
                    sector: r.sector,
                    role: r.role,
                    level: r.level,
                    totalScore: r.totalScore,
                    averageScore: r.averageScore,
                    evaluationCount: r.evaluationCount,
                    highlights: r.highlights || { bySelection: 0, byScore: 0 },
                  }));
                  setExportingPDF(true);
                  try {
                    let chartImageData: string | undefined;
                    if (exportChart) {
                      await new Promise((r) => setTimeout(r, 400));
                      const chartEl = chartContainerRef.current;
                      if (chartEl) {
                        try {
                          const canvas = await html2canvas(chartEl, {
                            scale: 2,
                            useCORS: true,
                            logging: false,
                            backgroundColor: '#ffffff',
                          });
                          chartImageData = canvas.toDataURL('image/png');
                        } catch {
                          toast.warning('Gráfico não capturado. Tente desmarcar Gráfico de evolução.');
                        }
                      }
                    }
                    exportRankingToPDF(rows, 'Ranking de Pontuação', currentCompany?.name || 'Empresa', {
                      includeTable: exportTable,
                      includeChart: exportChart,
                      chartImageData,
                    });
                    toast.success('PDF exportado com sucesso!');
                  } catch (e) {
                    toast.error('Erro ao exportar PDF.');
                  } finally {
                    setExportingPDF(false);
                  }
                }}
                disabled={exportingPDF || (!exportTable && !exportChart)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportingPDF ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                Exportar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico oculto para exportação PDF (renderizado quando exportChart está marcado) */}
      {exportChart && processedRankings.rankings.length > 0 && chartData.length > 0 && (
        <div
          ref={chartContainerRef}
          className="bg-white p-6 border border-gray-200"
          style={{
            position: 'absolute',
            left: -9999,
            top: 0,
            width: 800,
            minHeight: 400,
            zIndex: -1,
          }}
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4">Evolução Temporal - Top 10</h3>
          <ResponsiveContainer width={760} height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#666666" />
              <XAxis dataKey="date" stroke="#333333" tick={{ fill: '#1a1a1a' }} />
              <YAxis stroke="#333333" tick={{ fill: '#1a1a1a' }} domain={['auto', 'auto']} />
              <Legend />
              {processedRankings.rankings.slice(0, 10).map((emp, idx) => {
                const empKey = `emp_${emp.employeeId || emp.name}`.replace(/\s+/g, '_');
                return (
                  <Line
                    key={emp.employeeId || emp.name}
                    type="monotone"
                    dataKey={empKey}
                    name={emp.name}
                    stroke={colors[idx % colors.length]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Conteúdo */}
      {processedRankings.rankings.length === 0 ? (
        <div className="bg-white dark:bg-[#1E1E1E] p-10 rounded-lg shadow-sm border border-gray-200 dark:border-[#121212] text-center">
          <p className="text-gray-500 dark:text-gray-400">Nenhum dado encontrado para os filtros selecionados.</p>
        </div>
      ) : viewMode === 'chart' ? (
        <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-lg shadow-sm border border-gray-200 dark:border-[#121212]" style={{ minHeight: 400 }}>
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            Evolução Temporal - Top 10
          </h3>
          <ResponsiveContainer width="100%" height={500}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cccccc" />
              <XAxis 
                dataKey="date" 
                stroke="#333333"
                tickFormatter={(value) => {
                  // value já está em formato YYYY-MM
                  if (!value) return '';
                  const parts = value.split('-');
                  if (parts.length >= 2) {
                    return `${parts[1]}/${parts[0].slice(-2)}`;
                  }
                  return value;
                }}
              />
              <YAxis 
                stroke="#333333" 
                domain={['auto', 'auto']}
                label={{ value: 'Pontuação Acumulada', angle: -90, position: 'insideLeft', fill: '#1a1a1a' }}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white dark:bg-navy-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-navy-700">
                      <p className="font-semibold text-gray-800 dark:text-white mb-2">{data.date}</p>
                      {payload.map((entry: any, idx: number) => {
                        const empKey = entry.dataKey;
                        const empName = data[`${empKey}_name`] || empKey.replace('emp_', '');
                        return (
                          <p key={idx} style={{ color: entry.color }} className="text-sm">
                            {empName}: {entry.value?.toFixed(2) || '0.00'}
                          </p>
                        );
                      })}
                    </div>
                  );
                }}
              />
              <Legend 
                formatter={(value) => {
                  // Extrair nome do value que está no formato emp_xxx
                  const firstDataPoint = chartData[0];
                  if (firstDataPoint) {
                    const nameKey = `${value}_name`;
                    return firstDataPoint[nameKey] || value.replace('emp_', '');
                  }
                  return value.replace('emp_', '');
                }}
              />
              {processedRankings.rankings.slice(0, 10).map((emp, idx) => {
                const empKey = `emp_${emp.employeeId || emp.name}`.replace(/\s+/g, '_');
                return (
                  <Line
                    key={emp.employeeId || emp.name}
                    type="monotone"
                    dataKey={empKey}
                    name={emp.name}
                    stroke={colors[idx % colors.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-lg shadow-sm border border-gray-200 dark:border-[#121212] overflow-x-auto">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
            Tabela de Ranking - {rankingType === 'geral' ? 'Geral' : rankingType === 'setor' ? 'Por Setor' : rankingType === 'cargo' ? 'Por Cargo' : 'Por Nível'}
          </h3>
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Posição</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Destaques</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Nome</th>
                {rankingType === 'geral' && <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Setor</th>}
                {rankingType === 'geral' && <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Cargo</th>}
                {rankingType === 'geral' && <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Nível</th>}
                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Pontuação Acumulada</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Avaliações</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Tendência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {processedRankings.rankings.map((emp, idx) => {
                const trend = emp.scores.length >= 2 
                  ? emp.scores[emp.scores.length - 1] - emp.scores[0]
                  : 0;
                return (
                  <tr key={emp.employeeId} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {idx < 3 ? (
                          <Trophy 
                            size={20} 
                            className={idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : 'text-orange-600'} 
                          />
                        ) : (
                          <span className="text-sm font-bold text-gray-500">#{idx + 1}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        {emp.highlights.bySelection > 0 && (
                          <span className="flex items-center gap-1" title={`${emp.highlights.bySelection}x destaque por seleção`}>
                            <Star size={16} className="text-yellow-500 fill-yellow-500" />
                            {emp.highlights.bySelection > 1 && <span className="text-xs text-gray-500">{emp.highlights.bySelection}</span>}
                          </span>
                        )}
                        {emp.highlights.byScore > 0 && (
                          <span className="flex items-center gap-1" title={`${emp.highlights.byScore}x destaque por pontuação`}>
                            <Award size={16} className="text-blue-500" />
                            {emp.highlights.byScore > 1 && <span className="text-xs text-gray-500">{emp.highlights.byScore}</span>}
                          </span>
                        )}
                        {emp.highlights.bySelection === 0 && emp.highlights.byScore === 0 && (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-medium text-gray-900 dark:text-white">
                      {currentCompany && emp.employeeId ? (
                        <Link
                          to={`/employee/${currentCompany.id}/${emp.employeeId}`}
                          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                        >
                          {formatShortName(emp.name)}
                        </Link>
                      ) : (
                        formatShortName(emp.name)
                      )}
                    </td>
                    {rankingType === 'geral' && <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">{emp.sector}</td>}
                    {rankingType === 'geral' && <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">{emp.role}</td>}
                    {rankingType === 'geral' && <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">{emp.level}</td>}
                    <td className="px-4 py-4">
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400" title="Pontuação acumulada (soma de todas as notas)">
                        {emp.totalScore.toFixed(2)}
                      </span>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1" title="Média histórica">
                        Média: {emp.averageScore.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">{emp.evaluationCount}</td>
                    <td className="px-4 py-4">
                      {trend > 0 ? (
                        <TrendingUp size={16} className="text-green-500" />
                      ) : trend < 0 ? (
                        <TrendingUp size={16} className="text-red-500 rotate-180" />
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
