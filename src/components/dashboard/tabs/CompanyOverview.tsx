import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList
} from 'recharts';
import { Card } from '../../ui/Card';
import { ChartInfoTooltip } from '../../ui/ChartInfoTooltip';
import { CustomTooltip } from '../../ui/CustomTooltip';
import { Users, Briefcase, Award, TrendingUp, AlertCircle, CheckCircle, Star, Filter, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useCompany } from '../../../contexts/CompanyContext';
import { getInitials, formatShortName } from '../../../utils/nameFormatter';

const COLORS = ['#0F52BA', '#4CA1AF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1'];
const COLOR_OTHER = '#9CA3AF'; // Cor cinza para "Outros"

// Função para calcular luminosidade de uma cor (0-255)
const getLuminance = (hex: string): number => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b);
};

// Função para gerar cor de gradiente baseada na escala (0-10)
// Gradiente: Vermelho → Laranja → Amarelo → Verde (pior->melhor)
// Cores correspondem exatamente à legenda
const getHeatmapColor = (score: number): { bg: string; text: string } => {
  // Normaliza o score para 0-10
  const normalizedScore = Math.max(0, Math.min(10, score));
  
  let bgColor: string;
  // Mapeia para gradiente verde->vermelho (melhor->pior) - igual à legenda
  if (normalizedScore >= 9) bgColor = '#34D399'; // Verde (9-10) - melhor
  else if (normalizedScore >= 7) bgColor = '#FCD34D'; // Amarelo (7-8)
  else if (normalizedScore >= 5) bgColor = '#F59E0B'; // Laranja (5-6)
  else bgColor = '#DC2626'; // Vermelho (0-4)
  
  // Determina cor do texto baseado na luminosidade (escura para cores claras, clara para cores escuras)
  const luminance = getLuminance(bgColor);
  const textColor = luminance > 128 ? '#1F2937' : '#FFFFFF'; // Escuro se claro, branco se escuro
  
  return { bg: bgColor, text: textColor };
};

// Função para gerar cor de fundo com opacidade (estilo Looker Studio)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getHeatmapBgColor = (score: number): string => {
  const color = getHeatmapColor(score);
  // Converte hex para rgba com opacidade baseada na nota
  const opacity = Math.min(0.3 + (score / 10) * 0.4, 0.7); // Opacidade entre 0.3 e 0.7
  return color + Math.round(opacity * 255).toString(16).padStart(2, '0');
};

export const CompanyOverview = ({ data, competenceData, employees = [], visibleSections }: { data: any; competenceData?: any; employees?: any[]; visibleSections?: Record<string, boolean> }) => {
  const { currentCompany } = useCompany();
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Detectar tema atual
  useEffect(() => {
    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  const { 
    healthScore, 
    activeSectorsCount, 
    activeEmployeesCount, 
    activeRolesCount, 
    sectorDistribution, 
    roleDistribution, 
    totalEvaluations,
    uniqueEmployeesEvaluated,
    performanceList,
    highlightedByScore,
    highlightedBySelection,
    discPerformanceBySector,
    discPerformanceByRole,
    roleRanking
  } = data;

  // Helper para encontrar employeeId pelo nome
  const getEmployeeId = (employeeName: string): string | null => {
    const employee = employees.find((emp: any) => emp.name === employeeName);
    return employee?.id || null;
  };
  
  // Dados das métricas para os scorecards
  const metricsData = competenceData?.matrixData || [];
  
  // Funcionários mais novos e mais antigos
  const newestEmployees = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    return employees
      .filter((emp: any) => emp.admissionDate && emp.status === 'Ativo')
      .sort((a: any, b: any) => {
        const dateA = new Date(a.admissionDate).getTime();
        const dateB = new Date(b.admissionDate).getTime();
        return dateB - dateA; // Mais recente primeiro
      })
      .slice(0, 3);
  }, [employees]);
  
  const oldestEmployees = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    return employees
      .filter((emp: any) => emp.admissionDate && emp.status === 'Ativo')
      .sort((a: any, b: any) => {
        const dateA = new Date(a.admissionDate).getTime();
        const dateB = new Date(b.admissionDate).getTime();
        return dateA - dateB; // Mais antigo primeiro
      })
      .slice(0, 3);
  }, [employees]);
  
  const [selectedLevel, setSelectedLevel] = useState<string>('Todos');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    scorecards: true,
    rankings: true,
    health: true,
    distributions: true,
    performance: true,
    highlights: true,
    employees: true,
    disc: true
  });
  const [showAllRanking, setShowAllRanking] = useState(false);
  const ITEMS_PER_PAGE = 10;
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Cor do Health Score (com gradiente dourado)
  const healthColor = healthScore >= 8 
    ? 'text-emerald-500' 
    : healthScore >= 6 
    ? 'bg-gradient-to-r from-yellow-500 to-amber-600 bg-clip-text text-transparent' 
    : 'text-red-500';
  
  // Filtrar performanceList por nível
  const filteredPerformanceList = useMemo(() => {
    if (selectedLevel === 'Todos') return performanceList;
    return performanceList.filter((item: any) => {
      const nivel = item.realType || item.type || 'Operacional';
      return nivel === selectedLevel;
    });
  }, [performanceList, selectedLevel]);
  
  const [performanceTableSort, setPerformanceTableSort] = useState<{field: string | null, direction: 'asc' | 'desc'}>({field: null, direction: 'asc'});
  
  const handlePerformanceTableSort = (field: string) => {
    setPerformanceTableSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };
  
  const sortedPerformanceList = useMemo(() => {
    let sorted = [...filteredPerformanceList];
    
    // Se tiver ordenação, aplicar
    if (performanceTableSort.field) {
      sorted.sort((a: any, b: any) => {
        let aVal: any, bVal: any;
        
        switch (performanceTableSort.field) {
          case 'name':
            aVal = (a.realName || '').toLowerCase();
            bVal = (b.realName || '').toLowerCase();
            break;
          case 'sector':
            aVal = (a.realSector || '').toLowerCase();
            bVal = (b.realSector || '').toLowerCase();
            break;
          case 'role':
            aVal = (a.realRole || '').toLowerCase();
            bVal = (b.realRole || '').toLowerCase();
            break;
          case 'type':
            aVal = (a.realType || a.type || '').toLowerCase();
            bVal = (b.realType || b.type || '').toLowerCase();
            break;
          case 'score':
            aVal = a.score || 0;
            bVal = b.score || 0;
            break;
          default:
            return 0;
        }
        
        if (aVal < bVal) return performanceTableSort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return performanceTableSort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return sorted;
  }, [filteredPerformanceList, performanceTableSort]);
  
  // Lista paginada para exibição
  const displayedPerformanceList = useMemo(() => {
    if (showAllRanking) {
      return sortedPerformanceList;
    }
    return sortedPerformanceList.slice(0, ITEMS_PER_PAGE);
  }, [sortedPerformanceList, showAllRanking]);
  
  const hasMoreItems = sortedPerformanceList.length > ITEMS_PER_PAGE;
  
  // Obter níveis únicos disponíveis
  const availableLevels = useMemo<string[]>(() => {
    const levels = new Set<string>(performanceList.map((item: any) => item.realType || item.type || 'Operacional'));
    return ['Todos', ...Array.from(levels).sort()];
  }, [performanceList]);

  // Função auxiliar para cores do gráfico (inclui "Outros")
  const getSliceColor = (entry: any, index: number) => {
    if (entry.name === 'Outros') return COLOR_OTHER;
    return COLORS[index % COLORS.length];
  };
  
  // Calcular ranking de setores (média de notas por setor)
  const sectorRanking = useMemo(() => {
    const sectorScores: Record<string, { sum: number; count: number }> = {};
    
    performanceList.forEach((item: any) => {
      const sector = item.realSector || 'Geral';
      if (!sectorScores[sector]) {
        sectorScores[sector] = { sum: 0, count: 0 };
      }
      sectorScores[sector].sum += item.score || 0;
      sectorScores[sector].count += 1;
    });
    
    const rankings = Object.entries(sectorScores)
      .map(([name, data]) => ({
        name,
        average: data.count > 0 ? data.sum / data.count : 0,
        count: data.count
      }))
      .sort((a, b) => b.average - a.average);
    
    // Calcular média geral para comparação
    const overallAverage = rankings.length > 0 
      ? rankings.reduce((sum, r) => sum + r.average, 0) / rankings.length 
      : 0;
    
    return rankings.map(r => ({ ...r, overallAverage: overallAverage }));
  }, [performanceList]);
  
  // Cores para gráficos (Navy Blue + Dourado em dark mode)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navyGoldColors = ['#0A1128', '#162447', '#1F3A5F', '#274472', '#D4AF37', '#E5C158', '#F3E5AB', '#B8941F'];
  
  // Função para obter cor do cargo por nível (usando paleta consistente com o app)
  const getRoleColorByLevel = (level: string): string => {
    switch (level) {
      case 'Estratégico': return '#0F52BA'; // Navy Blue (cor principal do app)
      case 'Tático': return '#2563EB'; // Blue 600
      case 'Líder': return '#3B82F6'; // Blue 500
      case 'Operacional': return '#60A5FA'; // Blue 400
      case 'Colaborador': return '#93C5FD'; // Blue 300
      default: return '#6B7280'; // Cinza
    }
  };
  

  const show = (key: string) => visibleSections?.[key] !== false;

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* 1. Scorecards Superiores */}
      {show('scorecards') && (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card title="Colaboradores" value={activeEmployeesCount} icon={Users} className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20" />
        <Card title="Setores" value={activeSectorsCount} icon={Briefcase} className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/20 dark:to-gray-700/20" />
        <Card title="Cargos" value={activeRolesCount} icon={Award} className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20" />
        <Card 
          title="Total de Avaliações" 
          value={totalEvaluations} 
          icon={TrendingUp} 
          className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20"
          subtitle={uniqueEmployeesEvaluated ? `${uniqueEmployeesEvaluated} funcionário${uniqueEmployeesEvaluated !== 1 ? 's' : ''} avaliado${uniqueEmployeesEvaluated !== 1 ? 's' : ''}` : undefined}
        />
        <Card title="Férias" value={0} icon={CheckCircle} subtitle="Mock Data" className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20" /> 
        <Card title="Afastados" value={0} icon={AlertCircle} subtitle="Mock Data" className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20" />
      </div>
      )}

      {/* 1.1 e 1.2. Rankings lado a lado */}
      {show('rankings') && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking de Setores */}
        <div className="bg-white dark:bg-navy-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ChartInfoTooltip
                title="Ranking de Setores"
                description="Este gráfico mostra a média de performance de cada setor da empresa, ordenada do maior para o menor desempenho. Use para identificar quais setores estão performando melhor e quais precisam de atenção."
                usage="Analise as barras para comparar o desempenho entre setores. Setores com barras mais longas (mais próximas de 10) têm melhor performance média."
              />
            </div>
            <button
              onClick={() => toggleSection('rankings')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
            >
              {expandedSections.rankings ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>
          {expandedSections.rankings && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorRanking} layout="vertical" margin={{ left: 0, right: 20, top: 20, bottom: 20 }}>
                <defs>
                  {sectorRanking.map((entry: any, index: number) => {
                    const score = entry.average;
                    let startColor, endColor;
                    if (score >= 9) { startColor = '#D4AF37'; endColor = '#E5C158'; }
                    else if (score >= 8) { startColor = '#EAB308'; endColor = '#F59E0B'; }
                    else if (score >= 7) { startColor = '#F59E0B'; endColor = '#F97316'; }
                    else if (score >= 6) { startColor = '#F97316'; endColor = '#FB923C'; }
                    else if (score >= 5) { startColor = '#FB923C'; endColor = '#EF4444'; }
                    else if (score >= 4) { startColor = '#EF4444'; endColor = '#F87171'; }
                    else if (score >= 3) { startColor = '#F87171'; endColor = '#DC2626'; }
                    else if (score >= 2) { startColor = '#DC2626'; endColor = '#B91C1C'; }
                    else { startColor = '#B91C1C'; endColor = '#991B1B'; }
                    
                    return (
                      <linearGradient key={`gradient-sector-${index}`} id={`gradient-sector-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={startColor} />
                        <stop offset="100%" stopColor={endColor} />
                      </linearGradient>
                    );
                  })}
                </defs>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.1} stroke="#9ca3af" />
                <XAxis type="number" domain={[0, 10]} stroke="#9ca3af" tick={{fontSize: 12}} />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={0} 
                  tick={false}
                  axisLine={false}
                />
                <Tooltip 
                  content={(props: any) => {
                    if (!props?.active || !props?.payload || props.payload.length === 0) return null;
                    const entry = sectorRanking.find((r: { name: string; overallAverage?: number }) => r.name === props.label);
                    return (
                      <CustomTooltip
                        {...props}
                        formatter={(value: number) => [`${Number(value).toFixed(1)}`, 'Média']}
                        labelFormatter={(label: string) => `Setor: ${label}`}
                        showComparison={true}
                        averageValue={entry?.overallAverage}
                      />
                    );
                  }}
                  cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                />
                <Bar 
                  dataKey="average" 
                  fill="#3B82F6" 
                  radius={[0, 4, 4, 0]}
                  name="Média"
                  isAnimationActive={true}
                  animationDuration={800}
                  animationEasing="ease-out"
                >
                  {sectorRanking.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={`url(#gradient-sector-${index})`} />
                  ))}
                  <LabelList 
                    dataKey="name" 
                    position="insideLeft" 
                    style={{ fill: '#fff', fontSize: '12px', fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                    offset={15}
                  />
                  <LabelList 
                    dataKey="average" 
                    position="right" 
                    style={{ fill: '#374151', fontSize: '11px', fontWeight: 'bold' }}
                    formatter={(value: any) => `${Number(value).toFixed(1)}`}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          )}
        </div>

        {/* Ranking de Cargos */}
        {roleRanking && roleRanking.length > 0 && (
          <div className="bg-white dark:bg-navy-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-navy-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ChartInfoTooltip
                  title="Ranking de Cargos"
                  description="Este gráfico mostra a média de performance de cada cargo da empresa, ordenada do maior para o menor desempenho. Use para identificar quais cargos estão performando melhor."
                  usage="Analise as barras para comparar o desempenho entre cargos. Cargos com barras mais longas têm melhor performance média. As cores indicam o nível hierárquico do cargo."
                />
              </div>
              <button
                onClick={() => toggleSection('rankings')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
              >
                {expandedSections.rankings ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>
            {expandedSections.rankings && (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roleRanking} layout="vertical" margin={{ left: 0, right: 20, top: 20, bottom: 20 }}>
                  <defs>
                    {roleRanking.map((entry: any, index: number) => {
                      const baseColor = getRoleColorByLevel(entry.level || 'Operacional');
                      // Criar gradiente mais sutil baseado na cor do nível (tons de azul)
                      let endColor = baseColor;
                      if (baseColor === '#0F52BA') endColor = '#2563EB'; // Estratégico
                      else if (baseColor === '#2563EB') endColor = '#3B82F6'; // Tático
                      else if (baseColor === '#3B82F6') endColor = '#60A5FA'; // Líder
                      else if (baseColor === '#60A5FA') endColor = '#93C5FD'; // Operacional
                      else if (baseColor === '#93C5FD') endColor = '#BFDBFE'; // Colaborador
                      else endColor = '#9CA3AF'; // Default
                      
                      return (
                        <linearGradient key={`gradient-role-${index}`} id={`gradient-role-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor={baseColor} />
                          <stop offset="100%" stopColor={endColor} />
                        </linearGradient>
                      );
                    })}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.1} stroke="#9ca3af" />
                  <XAxis type="number" domain={[0, 10]} stroke="#9ca3af" tick={{fontSize: 12}} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={0} 
                    tick={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    content={(props: any) => {
                      if (!props.active || !props.payload || props.payload.length === 0) return null;
                      const entry = roleRanking.find((r: any) => r.name === props.label);
                      return (
                        <CustomTooltip
                          {...props}
                          formatter={(value: any) => [`${Number(value).toFixed(1)}`, 'Média']}
                          labelFormatter={(label) => `Cargo: ${label}`}
                          showComparison={true}
                          averageValue={entry?.overallAverage}
                        />
                      );
                    }}
                    cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '10px' }}
                    formatter={(value) => {
                      const level = String(value);
                      const color = getRoleColorByLevel(level);
                      return (
                        <span style={{ color }}>
                          {level}
                        </span>
                      );
                    }}
                    payload={Array.from(new Set(roleRanking.map((r: any) => r.level || 'Operacional'))).map((level) => ({
                      value: String(level),
                      type: 'square' as const,
                      color: getRoleColorByLevel(String(level)),
                      payload: { level: String(level), strokeDasharray: '' }
                    }))}
                  />
                  <Bar 
                    dataKey="average" 
                    fill="#D4AF37" 
                    radius={[0, 4, 4, 0]}
                    name="Média"
                    isAnimationActive={true}
                    animationDuration={800}
                    animationEasing="ease-out"
                  >
                    {roleRanking.map((entry: any, index: number) => (
                      <Cell key={`cell-${entry.name}`} fill={`url(#gradient-role-${index})`} />
                    ))}
                    <LabelList 
                      dataKey="name" 
                      position="insideLeft" 
                      style={{ fill: '#fff', fontSize: '12px', fontWeight: 'normal', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                      offset={15}
                    />
                    <LabelList 
                      dataKey="average" 
                      position="right" 
                      style={{ fill: isDarkMode ? '#E5E7EB' : '#1F2937', fontSize: '11px', fontWeight: 'normal' }}
                      formatter={(value: any) => `${Number(value).toFixed(1)}`}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* 1.3. Scorecards por Critério de Avaliação (Donuts) */}
      {show('scorecards') && metricsData && metricsData.length > 0 && (
        <div className="bg-white dark:bg-navy-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">Pontuação por Critério de Avaliação</h3>
              <ChartInfoTooltip
                title="Pontuação por Critério de Avaliação"
                description="Cada donut mostra a pontuação geral (média de todos os setores) de um critério de avaliação. Use para identificar quais competências a empresa está desenvolvendo melhor e quais precisam de mais atenção."
                usage="Analise as cores dos donuts: dourado indica excelente performance (9-10), amarelo indica boa (7-8), laranja indica média (5-6), e vermelho indica baixa performance (0-4)."
              />
            </div>
            <button
              onClick={() => toggleSection('scorecards')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
            >
              {expandedSections.scorecards ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Média geral de cada critério de avaliação (ordenado alfabeticamente)</p>
          {expandedSections.scorecards && (
          <div className={`grid gap-4 ${metricsData.length > 32 ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}`}>
            {[...metricsData].sort((a: any, b: any) => {
              const nameA = (a.criteria || '').toLowerCase();
              const nameB = (b.criteria || '').toLowerCase();
              return nameA.localeCompare(nameB);
            }).map((metric: any, index: number) => {
              const score = metric.average || 0;
              // Cores para mapa de calor: Verde (9-10), Amarelo (7-8), Laranja (5-6), Vermelho (0-4)
              let bgColor = '#DC2626'; // Vermelho (0-4)
              let textColor = '#FFFFFF';
              if (score >= 9) {
                bgColor = '#34D399'; // Verde (9-10)
                textColor = '#FFFFFF';
              } else if (score >= 7) {
                bgColor = '#FCD34D'; // Amarelo (7-8)
                textColor = '#1F2937';
              } else if (score >= 5) {
                bgColor = '#F59E0B'; // Laranja (5-6)
                textColor = '#FFFFFF';
              }
              
              return (
                <div 
                  key={metric.criteria || index} 
                  className="bg-white dark:bg-navy-800 rounded-xl shadow-sm border-2 border-gray-200 dark:border-navy-700 overflow-hidden transition-transform hover:scale-105"
                  style={{ borderColor: bgColor, borderWidth: '2px' }}
                >
                  <div 
                    className="p-6 text-center"
                    style={{ backgroundColor: bgColor }}
                  >
                    <div className="text-5xl font-bold mb-2" style={{ color: textColor }}>
                      {score.toFixed(1)}
                    </div>
                    <div className="text-xs font-medium" style={{ color: textColor, opacity: 0.9 }}>
                      de 10.0
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-navy-900">
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 text-center line-clamp-2">
                      {metric.criteria || 'Critério'}
                    </h4>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {(show('health') || show('distributions')) && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. Medidor de Saúde */}
        {show('health') && (
        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-navy-800 dark:to-navy-900 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-navy-700 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-6 left-6 flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">Saúde da Empresa</h3>
            <ChartInfoTooltip
              title="Saúde da Empresa"
              description="Este indicador mostra a média geral de todas as avaliações do período selecionado. É um indicador consolidado da performance da empresa."
              usage="Scores acima de 8 indicam excelente saúde, entre 6-8 indicam boa saúde, e abaixo de 6 indicam necessidade de atenção."
            />
          </div>
          <div className="relative mt-8">
            <ResponsiveContainer width={250} height={250}>
               <PieChart>
                 <defs>
                   <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                     <stop offset="0%" stopColor="#D4AF37" />
                     <stop offset="100%" stopColor="#F3E5AB" />
                   </linearGradient>
                 </defs>
                 <Pie
                    data={[{ value: healthScore }, { value: 10 - healthScore }]}
                    cx="50%" cy="50%"
                    innerRadius={80} outerRadius={100}
                    startAngle={180} endAngle={0}
                    dataKey="value"
                    isAnimationActive={true}
                    animationDuration={1000}
                    animationEasing="ease-out"
                 >
                    <Cell fill={healthScore >= 8 ? '#10B981' : healthScore >= 6 ? 'url(#goldGradient)' : '#EF4444'} />
                    <Cell fill="#e5e7eb" />
                 </Pie>
               </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center -mt-8">
               <span className={`text-5xl font-bold ${healthColor}`}>{healthScore.toFixed(1)}</span>
               <span className="block text-sm text-gray-400">de 10.0</span>
            </div>
          </div>
          <p className="text-sm text-gray-500 text-center mt-[-40px]">Baseado na média geral das avaliações do período.</p>
        </div>
        )}

        {/* 3. Distribuição de Setores (Rosca) */}
        {show('distributions') && (
        <div className="bg-white dark:bg-navy-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-navy-700">
           <div className="flex items-center gap-2 mb-4">
             <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">Setores Ativos</h3>
             <ChartInfoTooltip
               title="Distribuição de Setores"
               description="Este gráfico mostra a distribuição de funcionários por setor. Use para visualizar a proporção de colaboradores em cada área da empresa."
               usage="Passe o mouse sobre cada fatia para ver detalhes. A legenda mostra todos os setores."
             />
           </div>
           <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie 
                   data={sectorDistribution} 
                   cx="50%" cy="50%" 
                   innerRadius={60} 
                   outerRadius={80} 
                   paddingAngle={5} 
                   dataKey="value"
                 >
                   {sectorDistribution.map((entry: any, index: number) => (
                     <Cell key={`cell-${index}`} fill={getSliceColor(entry, index)} />
                   ))}
                 </Pie>
                 <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff', padding: '12px', fontSize: '14px' }} />
                 <Legend />
               </PieChart>
             </ResponsiveContainer>
           </div>
        </div>
        )}

        {/* 4. Distribuição de Cargos (Rosca) */}
        {show('distributions') && (
        <div className="bg-white dark:bg-navy-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-navy-700">
           <div className="flex items-center gap-2 mb-4">
             <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">Cargos Ativos</h3>
             <ChartInfoTooltip
               title="Distribuição de Cargos"
               description="Este gráfico mostra a distribuição de funcionários por cargo. Use para visualizar a proporção de colaboradores em cada função."
               usage="Passe o mouse sobre cada fatia para ver detalhes. A legenda mostra todos os cargos."
             />
           </div>
           <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie 
                  data={roleDistribution} 
                  cx="50%" cy="50%" 
                  innerRadius={60} 
                  outerRadius={80} 
                  paddingAngle={5} 
                  dataKey="value"
                  isAnimationActive={true}
                  animationDuration={800}
                  animationEasing="ease-out"
                 >
                   {roleDistribution.map((entry: any, index: number) => (
                     <Cell key={`cell-${index}`} fill={getSliceColor(entry, index + 2)} />
                   ))}
                 </Pie>
                 <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff', padding: '12px', fontSize: '14px' }} />
                 <Legend />
               </PieChart>
             </ResponsiveContainer>
           </div>
        </div>
        )}
      </div>
      )}

      {/* 5. Tabela Resumo e Destaque */}
      {(show('performance') || show('highlights')) && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Tabela Resumo com Mapa de Calor */}
         {show('performance') && (
         <div className="lg:col-span-2 bg-white dark:bg-navy-800 rounded-xl shadow-sm border border-gray-200 dark:border-navy-700 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-navy-700 flex justify-between items-center">
               <h3 className="font-bold text-gray-800 dark:text-white">
                 Resumo de Performance {showAllRanking ? `(${sortedPerformanceList.length} funcionários)` : `(Top ${ITEMS_PER_PAGE})`}
               </h3>
               <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-400" />
                  <select
                     value={selectedLevel}
                     onChange={(e) => {
                       setSelectedLevel(e.target.value);
                       setShowAllRanking(false); // Reset paginação ao mudar filtro
                     }}
                     className="px-3 py-1.5 text-sm border border-gray-200 dark:border-navy-700 rounded-lg bg-white dark:bg-navy-900 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 ring-blue-500/20"
                  >
                     {availableLevels.map((level: string) => (
                        <option key={level} value={level}>{level}</option>
                     ))}
                  </select>
               </div>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-navy-900 text-gray-500 font-medium">
                     <tr>
                        <th className="p-3 text-left">Rank</th>
                        <th className="p-3 text-left">
                          <button onClick={() => handlePerformanceTableSort('name')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-gold-400 transition-colors">
                            Nome
                            {performanceTableSort.field === 'name' ? (
                              performanceTableSort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                            ) : <ArrowUpDown size={14} className="opacity-30" />}
                          </button>
                        </th>
                        <th className="p-3 text-left">
                          <button onClick={() => handlePerformanceTableSort('sector')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-gold-400 transition-colors">
                            Setor
                            {performanceTableSort.field === 'sector' ? (
                              performanceTableSort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                            ) : <ArrowUpDown size={14} className="opacity-30" />}
                          </button>
                        </th>
                        <th className="p-3 text-left">
                          <button onClick={() => handlePerformanceTableSort('role')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-gold-400 transition-colors">
                            Cargo
                            {performanceTableSort.field === 'role' ? (
                              performanceTableSort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                            ) : <ArrowUpDown size={14} className="opacity-30" />}
                          </button>
                        </th>
                        <th className="p-3 text-left">
                          <button onClick={() => handlePerformanceTableSort('type')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-gold-400 transition-colors">
                            Nível
                            {performanceTableSort.field === 'type' ? (
                              performanceTableSort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                            ) : <ArrowUpDown size={14} className="opacity-30" />}
                          </button>
                        </th>
                        <th className="p-3 text-center">
                          <button onClick={() => handlePerformanceTableSort('score')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-gold-400 transition-colors mx-auto">
                            Nota
                            {performanceTableSort.field === 'score' ? (
                              performanceTableSort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                            ) : <ArrowUpDown size={14} className="opacity-30" />}
                          </button>
                        </th>
                        <th className="p-3 text-center">Destaque</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                     {displayedPerformanceList.length > 0 ? (
                       displayedPerformanceList.map((item: any, idx: number) => {
                         const score = item.score || 0;
                         const colorInfo = getHeatmapColor(score);
                         // Verificar funcionarioMes: pode ser 'Sim', 'sim', 'SIM', true, ou boolean
                         const funcionarioMesValue = item.funcionarioMes || item.funcionario_mes || false;
                         const isDestaqueSelecao = funcionarioMesValue === 'Sim' || 
                                           funcionarioMesValue === 'sim' || 
                                           funcionarioMesValue === 'SIM' ||
                                           funcionarioMesValue === true ||
                                           funcionarioMesValue === 'true';
                         // Verificar se está no top 10 (índice real na lista completa, não na paginada)
                         const realIndex = sortedPerformanceList.findIndex((i: any) => 
                           (i.realName || i.employeeName) === (item.realName || item.employeeName)
                         );
                         const isTop10 = realIndex < 10;
                         
                         // Verificar se o funcionário está inativo
                         const employeeStatus = item.employeeStatus || item.status || 'Ativo';
                         const isInactive = employeeStatus !== 'Ativo';
                         
                         return (
                           <tr 
                             key={item.id || `${item.realName}-${idx}`} 
                             className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                               isTop10 && !isInactive ? 'bg-gradient-to-r from-yellow-50/50 to-amber-50/50 dark:from-yellow-900/20 dark:to-amber-900/20 border-l-4 border-yellow-500' : ''
                             } ${isInactive ? 'opacity-60 bg-gray-100/50 dark:bg-gray-800/30' : ''}`}
                           >
                              <td className="p-3 text-gray-400 font-mono text-xs">
                                <span className={`${isTop10 && !isInactive ? 'font-bold text-yellow-600 dark:text-yellow-400' : ''} ${isInactive ? 'text-gray-400' : ''}`}>
                                  #{realIndex + 1}
                                </span>
                              </td>
                              <td className={`p-3 font-medium ${isInactive ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
                                 <div className="flex items-center gap-3">
                                   {(() => {
                                     const emp = employees.find((e: any) => e.name === item.realName);
                                     const photoUrl = emp?.photoUrl;
                                     return photoUrl ? (
                                       <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 dark:border-navy-700 flex-shrink-0">
                                         <img 
                                           src={photoUrl} 
                                           alt={item.realName}
                                           className="w-full h-full object-cover"
                                           onError={(e) => {
                                             (e.target as HTMLImageElement).style.display = 'none';
                                           }}
                                         />
                                       </div>
                                     ) : (
                                       <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-2 border-gray-200 dark:border-navy-700 flex-shrink-0">
                                         <span className="text-sm font-bold text-white">
                                           {getInitials(item.realName)}
                                         </span>
                                       </div>
                                     );
                                   })()}
                                   <div>
                                     {currentCompany && getEmployeeId(item.realName) ? (
                                       <Link
                                         to={`/employee/${currentCompany.id}/${getEmployeeId(item.realName)}`}
                                         className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                                       >
                                         {formatShortName(item.realName)}
                                       </Link>
                                     ) : (
                                       formatShortName(item.realName)
                                     )}
                                     {isInactive && <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(Inativo)</span>}
                                   </div>
                                 </div>
                              </td>
                              <td className={`p-3 ${isInactive ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500'}`}>{item.realSector}</td>
                              <td className={`p-3 ${isInactive ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500'}`}>{item.realRole}</td>
                              <td className="p-3">
                                 <span className={`px-2 py-0.5 rounded text-xs font-medium ${isInactive ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                                    {item.realType || item.type || 'Operacional'}
                                 </span>
                              </td>
                              <td className="p-0">
                                 <div 
                                    className="flex items-center justify-center w-full h-full font-bold text-sm min-h-[48px]"
                                    style={{ 
                                       backgroundColor: isInactive ? '#9CA3AF' : colorInfo.bg,
                                       color: isInactive ? '#FFFFFF' : colorInfo.text,
                                       opacity: isInactive ? 0.7 : 1
                                    }}
                                 >
                                    {score.toFixed(1)}
                                 </div>
                              </td>
                              <td className="p-3 text-center">
                                 <div className="flex items-center justify-center gap-1">
                                    {isDestaqueSelecao && <span className="text-lg" title="Destaque por Seleção">⭐</span>}
                                    {isTop10 && !isInactive && <span className="text-lg" title="Top 10">🏆</span>}
                                 </div>
                              </td>
                           </tr>
                         );
                       })
                     ) : (
                       <tr>
                         <td colSpan={7} className="p-6 text-center text-gray-500">Nenhum dado encontrado para o período.</td>
                       </tr>
                     )}
                  </tbody>
               </table>
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-navy-700 bg-gray-50 dark:bg-navy-900">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs">
                     <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-600 dark:text-gray-400">Legenda:</span>
                        <div className="flex items-center gap-1">
                           <div className="w-4 h-4 rounded" style={{ backgroundColor: '#DC2626' }}></div>
                           <span className="text-gray-500">0-4</span>
                        </div>
                        <div className="flex items-center gap-1">
                           <div className="w-4 h-4 rounded" style={{ backgroundColor: '#F59E0B' }}></div>
                           <span className="text-gray-500">5-6</span>
                        </div>
                        <div className="flex items-center gap-1">
                           <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FCD34D' }}></div>
                           <span className="text-gray-500">7-8</span>
                        </div>
                        <div className="flex items-center gap-1">
                           <div className="w-4 h-4 rounded" style={{ backgroundColor: '#34D399' }}></div>
                           <span className="text-gray-500">9-10</span>
                        </div>
                     </div>
                  </div>
                  {hasMoreItems && (
                     <button
                        onClick={() => setShowAllRanking(!showAllRanking)}
                        className="px-4 py-2 text-sm font-medium text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-colors flex items-center gap-2"
                     >
                        {showAllRanking ? (
                           <>
                              <ChevronUp size={16} />
                              Mostrar Menos
                           </>
                        ) : (
                           <>
                              Ver Mais ({sortedPerformanceList.length - ITEMS_PER_PAGE} funcionários)
                              <ChevronDown size={16} />
                           </>
                        )}
                     </button>
                  )}
               </div>
            </div>
         </div>
         )}

         {/* Cards de Destaques */}
         {show('highlights') && (
         <div className="space-y-4">
            {/* Destaque por Pontuação (Azul) */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-20"><Award size={80} /></div>
               <h3 className="text-blue-100 uppercase tracking-widest text-xs font-bold mb-4 flex items-center gap-2">
                  <TrendingUp size={16} />
                  Destaque por Pontuação
               </h3>
               
               <div className="space-y-3 max-h-64 overflow-y-auto">
                  {highlightedByScore && highlightedByScore.length > 0 ? (
                     highlightedByScore.map((emp: any, idx: number) => (
                        <div key={emp.id || idx} className="flex items-center gap-3 p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                           <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                              {idx + 1}
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm line-clamp-1" title={emp.realName || emp.employeeName}>
                                 {formatShortName(emp.realName || emp.employeeName)}
                              </p>
                              <p className="text-xs text-blue-200 line-clamp-1">{emp.realRole || emp.role}</p>
                           </div>
                           <div className="text-right flex-shrink-0">
                              <p className="text-lg font-bold">{emp.score?.toFixed(1) || '0.0'}</p>
                           </div>
                        </div>
                     ))
                  ) : (
                     <p className="text-blue-200 text-sm text-center py-4">Nenhum destaque por pontuação</p>
                  )}
               </div>
            </div>

            {/* Destaque por Seleção (Dourado) */}
            <div className="bg-gradient-to-br from-yellow-500 via-yellow-600 to-amber-600 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-20"><Star size={80} className="fill-white" /></div>
               <h3 className="text-yellow-100 uppercase tracking-widest text-xs font-bold mb-4 flex items-center gap-2">
                  <Star size={16} className="fill-yellow-200" />
                  Destaque por Seleção
               </h3>
               
               <div className="space-y-3 max-h-64 overflow-y-auto">
                  {highlightedBySelection && highlightedBySelection.length > 0 ? (
                     highlightedBySelection.map((emp: any, idx: number) => (
                        <div key={emp.id || idx} className="flex items-center gap-3 p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                           <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                              <Star size={20} className="fill-yellow-200 text-yellow-200" />
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm line-clamp-1" title={emp.realName || emp.employeeName}>
                                 {formatShortName(emp.realName || emp.employeeName)}
                              </p>
                              <p className="text-xs text-yellow-200 line-clamp-1">{emp.realRole || emp.role}</p>
                           </div>
                           <div className="text-right flex-shrink-0">
                              <p className="text-lg font-bold">{emp.score?.toFixed(1) || '0.0'}</p>
                              {emp.highlightCount > 1 && (
                                 <p className="text-xs text-yellow-200">({emp.highlightCount}x)</p>
                              )}
                           </div>
                        </div>
                     ))
                  ) : (
                     <p className="text-yellow-200 text-sm text-center py-4">Nenhum destaque por seleção</p>
                  )}
               </div>
            </div>
         </div>
         )}
      </div>
      )}

      {/* Destaques de Funcionários (Mais Novos e Mais Antigos) */}
      {show('employees') && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Funcionários Mais Novos */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl shadow-lg p-6 border border-green-200 dark:border-green-800">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-green-600 dark:text-green-400" />
            Funcionários Mais Novos
          </h3>
          <div className="space-y-3">
            {newestEmployees.length > 0 ? (
              newestEmployees.map((emp: any, idx: number) => {
                const admissionDate = new Date(emp.admissionDate);
                const daysSince = Math.floor((new Date().getTime() - admissionDate.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={emp.id || idx} className="flex items-center gap-3 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg backdrop-blur-sm">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-800 dark:text-white line-clamp-1" title={emp.name}>
                        {formatShortName(emp.name)}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">{emp.role || 'Sem cargo'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {admissionDate.toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                        {daysSince} dias
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">Nenhum funcionário novo encontrado</p>
            )}
          </div>
        </div>

        {/* Funcionários Mais Antigos */}
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl shadow-lg p-6 border border-amber-200 dark:border-amber-800">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <Award size={20} className="text-amber-600 dark:text-amber-400" />
            Funcionários Mais Antigos
          </h3>
          <div className="space-y-3">
            {oldestEmployees.length > 0 ? (
              oldestEmployees.map((emp: any, idx: number) => {
                const admissionDate = new Date(emp.admissionDate);
                const daysSince = Math.floor((new Date().getTime() - admissionDate.getTime()) / (1000 * 60 * 60 * 24));
                const years = Math.floor(daysSince / 365);
                return (
                  <div key={emp.id || idx} className="flex items-center gap-3 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg backdrop-blur-sm">
                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-800 dark:text-white line-clamp-1" title={emp.name}>
                        {formatShortName(emp.name)}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">{emp.role || 'Sem cargo'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {admissionDate.toLocaleDateString('pt-BR')}
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                        {years > 0 ? `${years} ano${years > 1 ? 's' : ''}` : `${daysSince} dias`}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">Nenhum funcionário antigo encontrado</p>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Dashboard de Perfil Comportamental (DISC) */}
      {show('disc') && ((discPerformanceBySector && discPerformanceBySector.length > 0) || (discPerformanceByRole && discPerformanceByRole.length > 0) ? (
        <div className="space-y-6 mt-6">
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2">
              <Award size={24} className="text-purple-600 dark:text-purple-400" />
              Análise de Perfil Comportamental (DISC)
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Identifique quais perfis DISC estão performando melhor em cada setor e cargo
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance DISC por Setor */}
            {discPerformanceBySector && discPerformanceBySector.length > 0 && (
              <div className="bg-white dark:bg-navy-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-navy-700">
                <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Performance por Setor</h4>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {discPerformanceBySector.map((item: any) => (
                    <div key={item.sector} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-center mb-3">
                        <h5 className="font-bold text-gray-800 dark:text-white">{item.sector}</h5>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {item.profiles.reduce((acc: number, p: any) => acc + p.count, 0)} avaliações
                        </span>
                      </div>
                      <div className="space-y-2">
                        {item.profiles.slice(0, 3).map((profile: any, idx: number) => (
                          <div key={profile.profile} className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded">
                            <div className="flex items-center gap-2">
                              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                idx === 0 
                                  ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white' 
                                  : idx === 1
                                  ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800'
                                  : 'bg-gradient-to-br from-amber-600 to-amber-700 text-white'
                              }`}>
                                {idx + 1}
                              </span>
                              <span className="font-medium text-gray-700 dark:text-gray-300">{profile.profile}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-gray-800 dark:text-white">{profile.average.toFixed(1)}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">({profile.count})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Performance DISC por Cargo */}
            {discPerformanceByRole && discPerformanceByRole.length > 0 && (
              <div className="bg-white dark:bg-navy-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-navy-700">
                <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Performance por Cargo</h4>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {discPerformanceByRole.map((item: any) => (
                    <div key={item.role} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-center mb-3">
                        <h5 className="font-bold text-gray-800 dark:text-white">{item.role}</h5>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {item.profiles.reduce((acc: number, p: any) => acc + p.count, 0)} avaliações
                        </span>
                      </div>
                      <div className="space-y-2">
                        {item.profiles.slice(0, 3).map((profile: any, idx: number) => (
                          <div key={profile.profile} className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded">
                            <div className="flex items-center gap-2">
                              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                idx === 0 
                                  ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white' 
                                  : idx === 1
                                  ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800'
                                  : 'bg-gradient-to-br from-amber-600 to-amber-700 text-white'
                              }`}>
                                {idx + 1}
                              </span>
                              <span className="font-medium text-gray-700 dark:text-gray-300">{profile.profile}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-gray-800 dark:text-white">{profile.average.toFixed(1)}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">({profile.count})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null)}
    </div>
  );
};