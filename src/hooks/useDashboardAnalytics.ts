import { useMemo } from 'react';

interface FilterState {
  searchTerm?: string;
  selectedSectors: string[]; // Mudado para array
  selectedEmployees: string[]; // Novo: seleção múltipla de funcionários
  selectedStatuses?: string[]; // Filtro de status de funcionários
  dateStart?: string;
  dateEnd?: string;
}

// Função auxiliar para formatar Mês/Ano (ex: jan/24)
const formatMonthYear = (dateStr: string) => {
  if (!dateStr || dateStr.length < 7) return 'N/A';
  const [year, month] = dateStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
};

// Função para agrupar dados do gráfico de rosca (Top 5 + Outros)
const aggregateDonutData = (data: { name: string; value: number }[]) => {
  if (data.length <= 5) return data.sort((a, b) => b.value - a.value);
  
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top5 = sorted.slice(0, 5);
  const othersValue = sorted.slice(5).reduce((acc, curr) => acc + curr.value, 0);
  
  if (othersValue > 0) {
    top5.push({ name: 'Outros', value: othersValue });
  }
  return top5;
};

export const useDashboardAnalytics = (
  evaluations: any[], 
  employees: any[], 
  filters: FilterState, 
  criteriaList?: any[],
  goalValue: number = 9.0
) => {
  
  // 1. Processamento Inicial e Normalização
  const processedData = useMemo(() => {
    // Mapa para busca rápida de nome por ID
    const empMapById = new Map(employees.map(e => [e.id, e]));
    // Mapa secundário por nome (caso o ID falhe)
    const empMapByName = new Map(employees.map(e => [e.name?.toLowerCase().trim(), e]));

    return evaluations.map((ev: any) => {
      // Normalização de nota
      let score = typeof ev.average === 'number' ? ev.average : parseFloat((ev.notaFinal || '0').replace(',', '.'));
      if (isNaN(score)) score = 0;

      // Normalização de detalhes
      const details: Record<string, number> = {};
      if (ev.details) {
         Object.entries(ev.details).forEach(([k, v]: [string, any]) => {
            details[k] = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.') || '0');
         });
      } else if (ev.detalhes) {
         Object.entries(ev.detalhes).forEach(([k, v]: [string, any]) => {
            details[k] = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.') || '0');
         });
      }

      // Resolução Inteligente de Nome e Status
      let resolvedName = ev.employeeName || ev.displayName;
      let employeeStatus = 'Ativo'; // Default
      let employeeData = null;
      
      if (ev.employeeId && empMapById.has(ev.employeeId)) {
        employeeData = empMapById.get(ev.employeeId);
        resolvedName = employeeData.name;
        employeeStatus = employeeData.status || 'Ativo';
      } else if (resolvedName && empMapByName.has(resolvedName.toLowerCase().trim())) {
        employeeData = empMapByName.get(resolvedName.toLowerCase().trim());
        resolvedName = employeeData.name;
        employeeStatus = employeeData.status || 'Ativo';
      }

      // Normaliza o tipo/nível (garante que está no formato correto)
      let normalizedType = ev.type || 'Operacional';
      // Normaliza variações comuns
      if (typeof normalizedType === 'string') {
        normalizedType = normalizedType.trim();
        // Garante que está no formato correto (Estratégico, Tático, Operacional)
        if (normalizedType.toLowerCase().includes('estrat') || normalizedType.toLowerCase().includes('estrateg')) {
          normalizedType = 'Estratégico';
        } else if (normalizedType.toLowerCase().includes('tatic') || normalizedType.toLowerCase().includes('tático')) {
          normalizedType = 'Tático';
        } else if (normalizedType.toLowerCase().includes('oper') || normalizedType.toLowerCase().includes('operacional')) {
          normalizedType = 'Operacional';
        }
      }

      // Prioriza nível do perfil do funcionário (jobLevel) para exibição/agregação quando disponível,
      // para que funcionários marcados como Tático apareçam com métricas de nível tático
      const jobLevel = employeeData?.jobLevel;
      let realType = normalizedType;
      if (jobLevel && typeof jobLevel === 'string') {
        const j = jobLevel.trim().toLowerCase();
        if (j.includes('estrat') || j.includes('estrateg')) realType = 'Estratégico';
        else if (j.includes('tatic') || j.includes('tático')) realType = 'Tático';
        else if (j.includes('oper') || j.includes('operacional') || j.includes('colaborador') || j.includes('líder') || j.includes('lider')) realType = 'Operacional';
      }
      
      return {
        ...ev,
        realName: resolvedName || 'Colaborador Desconhecido',
        // Sector/role preservam histórico; realType usa jobLevel do funcionário quando setado para alinhar métricas ao perfil
        realSector: ev.sector || 'Geral',
        realRole: ev.role || 'Não definido',
        realType,
        realStatus: employeeStatus, // Status do funcionário (pode usar employeeData pois status não afeta histórico de avaliações)
        realDiscProfile: employeeData?.discProfile || null, // Perfil DISC do funcionário
        score,
        details,
        dateRaw: ev.date || '', // Mantém data original YYYY-MM-DD para filtro
        monthYear: formatMonthYear(ev.date), // Data formatada para agrupamento
        // Normalizar funcionarioMes: pode ser 'Sim', 'sim', true, 'true', etc.
        funcionarioMes: (() => {
          const value = ev.funcionarioMes || ev.funcionario_mes;
          if (value === true || value === 'true' || value === 'Sim' || value === 'sim' || value === 'SIM') {
            return 'Sim';
          }
          return 'Não';
        })()
      };
    });
  }, [evaluations, employees]);

  // 2. Aplicação de Filtros
  const filteredData = useMemo(() => {
    return processedData.filter((item) => {
      const searchMatch = !filters.searchTerm || 
        item.realName.toLowerCase().includes(filters.searchTerm.toLowerCase());
      
      // Filtro de setores (múltipla seleção)
      const sectorMatch = filters.selectedSectors.length === 0 || filters.selectedSectors.includes(item.realSector);
      
      // Filtro de funcionários (múltipla seleção)
      const employeeMatch = filters.selectedEmployees.length === 0 || filters.selectedEmployees.includes(item.realName);
      
      // Filtro de status (múltipla seleção)
      const statusMatch = !filters.selectedStatuses || filters.selectedStatuses.length === 0 || 
        filters.selectedStatuses.includes(item.realStatus || 'Ativo');
      
      let dateMatch = true;
      if (filters.dateStart) dateMatch = dateMatch && item.dateRaw >= filters.dateStart;
      if (filters.dateEnd) dateMatch = dateMatch && item.dateRaw <= filters.dateEnd;

      return searchMatch && sectorMatch && employeeMatch && statusMatch && dateMatch;
    });
  }, [processedData, filters]);

  // 3. Métricas Gerais (Aba 1)
  const generalMetrics = useMemo(() => {
    // Total de avaliações (pode ter múltiplas avaliações por funcionário)
    const totalEvaluations = filteredData.length;
    
    // Número de funcionários únicos avaliados
    const uniqueEmployeesSet = new Set(filteredData.map(d => d.realName || d.employeeName));
    const uniqueEmployeesCount = uniqueEmployeesSet.size;
    
    const avg = totalEvaluations > 0 ? filteredData.reduce((acc, curr) => acc + curr.score, 0) / totalEvaluations : 0;
    
    // Contagens únicas
    const sectorsSet = new Set(filteredData.map(d => d.realSector));
    const rolesSet = new Set(filteredData.map(d => d.realRole));
    const employeesSet = new Set(filteredData.map(d => d.realName));

    // Distribuição bruta para gráficos
    const rawSectorDist = Array.from(sectorsSet).map(sec => ({
        name: sec,
        value: filteredData.filter(d => d.realSector === sec).length
    }));

    const rawRoleDist = Array.from(rolesSet).map(role => ({
        name: role,
        value: filteredData.filter(d => d.realRole === role).length
    }));

    // Agrupamento Top 5 + Outros
    const sectorDistribution = aggregateDonutData(rawSectorDist);
    const roleDistribution = aggregateDonutData(rawRoleDist);

    // Agrupar avaliações por pessoa e calcular média (não repetir pessoas)
    const employeeScoresMap = new Map<string, {
      name: string;
      scores: number[];
      evaluationCount: number;
      totalScore: number;
      averageScore: number;
      firstEvaluation: any; // Primeira avaliação encontrada para pegar dados do funcionário
      hasDestaque: boolean; // Se tem pelo menos um destaque por seleção
    }>();
    
    filteredData.forEach(item => {
      const key = item.realName || item.employeeName || '';
      if (!key) return;
      
      if (!employeeScoresMap.has(key)) {
        employeeScoresMap.set(key, {
          name: key,
          scores: [],
          evaluationCount: 0,
          totalScore: 0,
          averageScore: 0,
          firstEvaluation: item,
          hasDestaque: false
        });
      }
      
      const employeeData = employeeScoresMap.get(key)!;
      employeeData.scores.push(item.score || 0);
      employeeData.evaluationCount++;
      employeeData.totalScore += item.score || 0;
      
      // Verificar se tem destaque por seleção
      const value = item.funcionarioMes || item.funcionario_mes;
      if (value === true || value === 'true' || value === 'Sim' || value === 'sim' || value === 'SIM') {
        employeeData.hasDestaque = true;
      }
    });
    
    // Calcular média de cada pessoa
    employeeScoresMap.forEach((data, key) => {
      data.averageScore = data.evaluationCount > 0 ? data.totalScore / data.evaluationCount : 0;
    });
    
    // Converter para array e ordenar por média (maior para menor)
    const performanceList = Array.from(employeeScoresMap.values())
      .map(data => {
        const item = data.firstEvaluation;
        return {
          ...item,
          realName: data.name,
          score: data.averageScore, // Usar a média calculada
          evaluationCount: data.evaluationCount, // Número de avaliações
          funcionarioMes: data.hasDestaque ? 'Sim' : 'Não',
          employeeStatus: item.employeeStatus || item.status || 'Ativo' // Garantir que o status seja incluído
        };
      })
      .sort((a, b) => b.score - a.score); // Ordenar por média (maior para menor)
    
    // Top employee é o primeiro da lista (maior média)
    const topEmployee = performanceList[0];
    
    // Destaques por Seleção (funcionário do mês) - top 5 por média
    const highlightedBySelection = performanceList
      .filter(item => item.funcionarioMes === 'Sim')
      .slice(0, 5)
      .map(item => ({
        ...item,
        highlightCount: item.evaluationCount || 1
      }));
    
    // Destaques por Pontuação (top 5 por média)
    const highlightedByScore = performanceList
      .slice(0, 5)
      .map(item => ({
        ...item,
        highlightCount: item.evaluationCount || 1
      }));

    // Análise de Perfil Comportamental (DISC) por Setor e Cargo
    const discBySector: Record<string, Record<string, { sum: number; count: number }>> = {};
    const discByRole: Record<string, Record<string, { sum: number; count: number }>> = {};
    
    filteredData.forEach((item: any) => {
      const discProfile = item.realDiscProfile;
      if (!discProfile) return;
      
      const sector = item.realSector;
      const role = item.realRole;
      
      // Por Setor
      if (!discBySector[sector]) discBySector[sector] = {};
      if (!discBySector[sector][discProfile]) {
        discBySector[sector][discProfile] = { sum: 0, count: 0 };
      }
      discBySector[sector][discProfile].sum += item.score;
      discBySector[sector][discProfile].count += 1;
      
      // Por Cargo
      if (!discByRole[role]) discByRole[role] = {};
      if (!discByRole[role][discProfile]) {
        discByRole[role][discProfile] = { sum: 0, count: 0 };
      }
      discByRole[role][discProfile].sum += item.score;
      discByRole[role][discProfile].count += 1;
    });
    
    // Calcular médias e ordenar
    const discPerformanceBySector = Object.entries(discBySector).map(([sector, profiles]) => {
      const profileData = Object.entries(profiles).map(([profile, data]) => ({
        profile,
        average: data.count > 0 ? data.sum / data.count : 0,
        count: data.count
      })).sort((a, b) => b.average - a.average);
      
      return {
        sector,
        topProfile: profileData[0]?.profile || 'N/A',
        topAverage: profileData[0]?.average || 0,
        profiles: profileData
      };
    });
    
    const discPerformanceByRole = Object.entries(discByRole).map(([role, profiles]) => {
      const profileData = Object.entries(profiles).map(([profile, data]) => ({
        profile,
        average: data.count > 0 ? data.sum / data.count : 0,
        count: data.count
      })).sort((a, b) => b.average - a.average);
      
      return {
        role,
        topProfile: profileData[0]?.profile || 'N/A',
        topAverage: profileData[0]?.average || 0,
        profiles: profileData
      };
    });

    // Calcular ranking por cargo (similar ao ranking por setor)
    const roleScores: Record<string, { sum: number; count: number; level?: string }> = {};
    filteredData.forEach((item: any) => {
      const role = item.realRole || 'Geral';
      if (!roleScores[role]) {
        roleScores[role] = { sum: 0, count: 0, level: item.realType || item.type || 'Operacional' };
      }
      roleScores[role].sum += item.score || 0;
      roleScores[role].count += 1;
    });
    
    const roleRanking = Object.entries(roleScores)
      .map(([name, data]) => ({
        name,
        average: data.count > 0 ? data.sum / data.count : 0,
        count: data.count,
        level: data.level || 'Operacional'
      }))
      .sort((a, b) => b.average - a.average);

    return {
        healthScore: avg,
        totalEvaluations: totalEvaluations,
        uniqueEmployeesEvaluated: uniqueEmployeesCount,
        activeSectorsCount: sectorsSet.size,
        activeRolesCount: rolesSet.size,
        activeEmployeesCount: employeesSet.size,
        sectorDistribution,
        roleDistribution,
        topEmployee,
        performanceList,
        highlightedByScore, // Top 5 por pontuação
        highlightedBySelection, // Top 5 por seleção (destaque do mês)
        discPerformanceBySector, // Performance DISC por setor
        discPerformanceByRole, // Performance DISC por cargo
        roleRanking // Ranking de performance por cargo
    };
  }, [filteredData]);

  // 4. Análise de Competências e Evolução (Aba 2)
  const competenceMetrics = useMemo(() => {
    const compMatrix: Record<string, Record<string, { sum: number, count: number }>> = {};
    const allCriteria = new Set<string>();
    
    // Criar mapa de critérios do banco de dados (prioridade)
    const criteriaTypeMapFromDB: Record<string, string> = {};
    if (criteriaList && criteriaList.length > 0) {
      criteriaList.forEach((crit: any) => {
        if (crit.name) {
          criteriaTypeMapFromDB[crit.name] = crit.type || 'Operacional';
        }
      });
    }
    
    const criteriaTypeMap: Record<string, string> = {}; // Mapa de critério -> tipo (nível)
    
    // Mapa para evolução mensal por nível (Estratégico, Tático, Operacional)
    // Chave: YYYY-MM para ordenação
    const timelineMap: Record<string, { 
      label: string, 
      estrategicoSum: number, estrategicoCount: number,
      taticoSum: number, taticoCount: number,
      operacionalSum: number, operacionalCount: number
    }> = {};
    
    // Mapa para evolução por setor
    const sectorTimelineMap: Record<string, Record<string, { sum: number, count: number }>> = {};

    filteredData.forEach(ev => {
        // Matriz
        if (ev.details) {
            Object.entries(ev.details).forEach(([criteria, value]: [string, any]) => {
                const numericValue = Number(value) || 0;
                allCriteria.add(criteria);
                
                // Prioriza nível do banco de dados, senão usa o tipo da avaliação
                if (!criteriaTypeMap[criteria]) {
                    criteriaTypeMap[criteria] = criteriaTypeMapFromDB[criteria] || ev.realType || ev.type || 'Operacional';
                }
                
                if (!compMatrix[criteria]) compMatrix[criteria] = {};
                if (!compMatrix[criteria][ev.realSector]) compMatrix[criteria][ev.realSector] = { sum: 0, count: 0 };
                
                compMatrix[criteria][ev.realSector].sum += numericValue;
                compMatrix[criteria][ev.realSector].count += 1;
            });
        }

        // Evolução Mensal por Nível
        const dateKey = ev.dateRaw ? ev.dateRaw.substring(0, 7) : null; // YYYY-MM
        if (dateKey) {
            if (!timelineMap[dateKey]) {
                timelineMap[dateKey] = { 
                    label: formatMonthYear(ev.dateRaw), // Rótulo visual (jan/24)
                    estrategicoSum: 0, estrategicoCount: 0,
                    taticoSum: 0, taticoCount: 0,
                    operacionalSum: 0, operacionalCount: 0
                };
            }
            
            const nivel = ev.realType || ev.type || 'Operacional';
            
            if (nivel === 'Estratégico') {
                timelineMap[dateKey].estrategicoSum += ev.score;
                timelineMap[dateKey].estrategicoCount++;
            } else if (nivel === 'Tático') {
                timelineMap[dateKey].taticoSum += ev.score;
                timelineMap[dateKey].taticoCount++;
            } else {
                timelineMap[dateKey].operacionalSum += ev.score;
                timelineMap[dateKey].operacionalCount++;
            }
            
            // Evolução por Setor
            if (!sectorTimelineMap[dateKey]) {
                sectorTimelineMap[dateKey] = {};
            }
            if (!sectorTimelineMap[dateKey][ev.realSector]) {
                sectorTimelineMap[dateKey][ev.realSector] = { sum: 0, count: 0 };
            }
            sectorTimelineMap[dateKey][ev.realSector].sum += ev.score;
            sectorTimelineMap[dateKey][ev.realSector].count += 1;
        }
    });

    // Formatar Matriz para Tabela
    const matrixData = Array.from(allCriteria).map(criteria => {
        const row: any = { 
            criteria,
            type: criteriaTypeMap[criteria] || 'Operacional' // Adiciona o nível do critério
        };
        let totalSum = 0;
        let totalCount = 0;
        
        Object.keys(compMatrix[criteria] || {}).forEach(sector => {
            const { sum, count } = compMatrix[criteria][sector];
            row[sector] = sum / count;
            totalSum += sum;
            totalCount += count;
        });
        row['average'] = totalCount > 0 ? totalSum / totalCount : 0;
        return row;
    });

    // Formatar Evolução por Nível (Ordenado por YYYY-MM mas exibindo MMM/YY)
    const evolutionData = Object.entries(timelineMap).sort().map(([_, vals]) => {
      const totalSum = vals.estrategicoSum + vals.taticoSum + vals.operacionalSum;
      const totalCount = vals.estrategicoCount + vals.taticoCount + vals.operacionalCount;
      
      return {
        date: vals.label, // Usa o rótulo formatado (jan/24)
        Estratégico: vals.estrategicoCount ? Number((vals.estrategicoSum / vals.estrategicoCount).toFixed(1)) : 0,
        Tático: vals.taticoCount ? Number((vals.taticoSum / vals.taticoCount).toFixed(1)) : 0,
        Operacional: vals.operacionalCount ? Number((vals.operacionalSum / vals.operacionalCount).toFixed(1)) : 0,
        'Média Geral': totalCount > 0 ? Number((totalSum / totalCount).toFixed(1)) : 0,
        Meta: goalValue
      };
    });
    
    // Formatar Evolução por Setor
    const allSectorsList = Array.from(new Set(filteredData.map(d => d.realSector)));
    const sectorEvolutionData = Object.entries(sectorTimelineMap).sort().map(([dateKey, sectorData]) => {
      const dateLabel = formatMonthYear(dateKey + '-01');
      const result: any = { date: dateLabel };
      
      allSectorsList.forEach(sector => {
        if (sectorData[sector]) {
          result[sector] = Number((sectorData[sector].sum / sectorData[sector].count).toFixed(1));
        } else {
          result[sector] = 0;
        }
      });
      
      return result;
    });

    // allSectors deve usar os setores originais (não agrupados) para filtros
    // O agrupamento "Outros" é apenas para visualização no gráfico
    const allSectorsOriginal = Array.from(new Set(filteredData.map(d => d.realSector))).sort();
    
    return { 
      matrixData, 
      evolutionData, 
      sectorEvolutionData,
      allSectors: allSectorsOriginal // Usa setores originais, não os agrupados
    };
  }, [filteredData, generalMetrics]);

  // 5. Comparativo (Aba 3)
  const comparativeMetrics = useMemo(() => {
     const sectorAverages: Record<string, number> = {};
     // Usamos filteredData para calcular médias do setor baseadas no filtro atual
     const sectors = new Set(filteredData.map(d => d.realSector));
     
     sectors.forEach(sec => {
        const sectorEvs = filteredData.filter(e => e.realSector === sec);
        const sum = sectorEvs.reduce((a, b) => a + b.score, 0);
        sectorAverages[sec] = sectorEvs.length ? sum / sectorEvs.length : 0;
     });

     const companyAvg = generalMetrics.healthScore;

     const individualData = filteredData.map(ev => {
        const individualScore = Number(ev.score.toFixed(2));
        const sectorAvg = Number((sectorAverages[ev.realSector] || 0).toFixed(2));
        const diffSector = individualScore - sectorAvg;
        const diffCompany = individualScore - companyAvg;
        
        return {
          name: ev.realName,
          metric: 'Nota Geral',
          individualScore,
          sectorAvg,
          companyAvg: Number(companyAvg.toFixed(2)),
          sector: ev.realSector,
          role: ev.realRole,
          type: ev.realType || ev.type || 'Operacional',
          date: ev.dateRaw || ev.date || '',
          monthYear: ev.monthYear || formatMonthYear(ev.dateRaw || ev.date || ''),
          belowSectorAvg: diffSector < 0,
          belowCompanyAvg: diffCompany < 0,
          diffSector: Number(diffSector.toFixed(2)),
          diffCompany: Number(diffCompany.toFixed(2))
        };
     });

     // Dados para comparação percentual mês a mês
     // Agrupa avaliações por funcionário e mês
     const employeeMonthlyMap: Record<string, Array<{ month: string; score: number; date: string }>> = {};
     
     filteredData.forEach(ev => {
       const key = ev.realName;
       if (!employeeMonthlyMap[key]) {
         employeeMonthlyMap[key] = [];
       }
       const monthKey = ev.dateRaw ? ev.dateRaw.substring(0, 7) : '';
       if (monthKey) {
         employeeMonthlyMap[key].push({
           month: monthKey,
           score: ev.score,
           date: ev.dateRaw || ev.date || ''
         });
       }
     });
     
     // Calcula variação percentual mês a mês
     const comparisonData: Array<{
       name: string;
       sector: string;
       role: string;
       type: string;
       months: Array<{ month: string; monthKey: string; score: number; change?: number; changePercent?: number }>;
     }> = [];
     
     Object.entries(employeeMonthlyMap).forEach(([name, months]) => {
       const sortedMonths = months.sort((a, b) => a.month.localeCompare(b.month));
       const firstEv = filteredData.find(e => e.realName === name);
       
       const monthData = sortedMonths.map((month, idx) => {
         let change = 0;
         let changePercent = 0;
         
         if (idx > 0) {
           const prevScore = sortedMonths[idx - 1].score;
           change = month.score - prevScore;
           changePercent = prevScore > 0 ? (change / prevScore) * 100 : 0;
         }
         
         return {
           month: formatMonthYear(month.date),
           monthKey: month.month,
           score: month.score,
           change: idx > 0 ? change : undefined,
           changePercent: idx > 0 ? changePercent : undefined
         };
       });
       
       comparisonData.push({
         name,
         sector: firstEv?.realSector || 'Geral',
         role: firstEv?.realRole || 'Não definido',
         type: firstEv?.realType || firstEv?.type || 'Operacional',
         months: monthData
       });
     });
     
     const monthlyComparison = comparisonData;

     return { individualData, monthlyComparison };
  }, [filteredData, generalMetrics]);

  return {
    filteredData,
    generalMetrics,
    competenceMetrics,
    comparativeMetrics
  };
};