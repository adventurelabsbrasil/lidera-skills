import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ArrowLeft, Calendar, User, FileText, TrendingUp, Upload } from 'lucide-react';
import { fetchCollection } from '../../services/firebase';
import { DataImporter } from '../settings/DataImporter';
import { useCompany } from '../../contexts/CompanyContext';
import { formatShortName } from '../../utils/nameFormatter';
import { formatDateOnlyPtBR, getDateOnlyTimestamp } from '../../utils/date';

// Interface Unificada
interface Evaluation {
  id: string;
  employeeId?: string;
  employeeName: string;
  role?: string;
  sector?: string;
  type?: 'Líder' | 'Colaborador';
  tipo?: string; // <--- ADICIONADO PARA CORRIGIR O ERRO
  date: string; // YYYY-MM-DD
  average?: number;
  notaFinal?: string; // Fallback para dados antigos
  detalhes?: Record<string, number>;
}

interface Employee {
  id: string;
  name: string;
  role: string;
  sector: string;
}

export const EvaluationHistory = () => {
  const { currentCompany } = useCompany();
  const [viewLevel, setViewLevel] = useState<1 | 2 | 3>(1);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<any | null>(null);
  
  // Dados Brutos
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showImporter, setShowImporter] = useState(false);

  // Carrega dados iniciais
  useEffect(() => {
    if (!currentCompany) return;
    const loadData = async () => {
      try {
        // Avaliações são filtradas por empresa, funcionários são gerais
        const evs = await fetchCollection('evaluations', currentCompany.id);
        const emps = await fetchCollection('employees'); // Sem filtro de empresa
        // Histórico mostra TODOS os funcionários (ativos e inativos)
        setEvaluations(evs as any[]);
        setEmployees(emps as any[]);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      }
    };
    loadData();
  }, [currentCompany]);

  // --- Processamento e Mesclagem de Dados ---
  const processedEvaluations = useMemo(() => {
    // Mapa para busca rápida de funcionário por Nome ou ID
    const empMapByName = new Map(employees.map(e => [e.name.toLowerCase().trim(), e]));
    const empMapById = new Map(employees.map(e => [e.id, e]));

    return evaluations.map(ev => {
      // Tenta encontrar o cadastro oficial
      let officialEmp = empMapById.get(ev.employeeId || '');
      if (!officialEmp && ev.employeeName) {
        officialEmp = empMapByName.get(ev.employeeName.toLowerCase().trim());
      }

      // Normaliza a nota
      let finalScore = ev.average;
      if (finalScore === undefined && ev.notaFinal) {
        finalScore = parseFloat(ev.notaFinal.replace(',', '.'));
      }

      return {
        ...ev,
        // Prioriza dados do cadastro oficial (atualizados), senão usa o do histórico
        displayName: officialEmp?.name || ev.employeeName || 'Colaborador Desconhecido',
        displayId: officialEmp?.id || ev.employeeId || 'N/A',
        displayRole: officialEmp?.role || ev.role || '-',
        displaySector: officialEmp?.sector || ev.sector || '-',
        normalizedScore: finalScore || 0
      };
    }).sort((a, b) => getDateOnlyTimestamp(b.date) - getDateOnlyTimestamp(a.date));
  }, [evaluations, employees]);

  // --- Camada 1: Resumo por Período ---
  const summaryData = useMemo(() => {
    const groups: Record<string, { count: number; totalScore: number; rawDate: string }> = {};

    processedEvaluations.forEach(item => {
      if (!item.date || item.date.length < 10) return;

      const periodKey = formatDateOnlyPtBR(item.date, { month: 'long', year: 'numeric' });

      if (!groups[periodKey]) {
        groups[periodKey] = { count: 0, totalScore: 0, rawDate: item.date };
      }
      groups[periodKey].count += 1;
      groups[periodKey].totalScore += item.normalizedScore;
    });

    return Object.entries(groups)
      .map(([period, data]) => ({
        period,
        count: data.count,
        average: (data.totalScore / data.count).toFixed(1).replace('.', ','),
        rawDate: data.rawDate
      }))
      .sort((a, b) => getDateOnlyTimestamp(b.rawDate) - getDateOnlyTimestamp(a.rawDate));
  }, [processedEvaluations]);

  // --- Camada 2: Filtro da Lista ---
  const filteredList = useMemo(() => {
    if (!selectedPeriod) return [];
    return processedEvaluations.filter(item => {
      if (!item.date) return false;
      const itemPeriod = formatDateOnlyPtBR(item.date, { month: 'long', year: 'numeric' });
      return itemPeriod === selectedPeriod;
    });
  }, [selectedPeriod, processedEvaluations]);

  // --- Ações ---
  const handleBack = () => {
    if (viewLevel === 3) {
      setViewLevel(2);
      setSelectedEvaluation(null);
    } else if (viewLevel === 2) {
      setViewLevel(1);
      setSelectedPeriod(null);
    }
  };

  return (
    <div className="bg-white dark:bg-[#1E1E1E] shadow-md rounded-lg p-6 w-full max-w-6xl mx-auto border dark:border-[#121212] animate-fadeIn">
      
      {/* Botão de Importação */}
      {viewLevel === 1 && (
        <div className="mb-6">
          <button 
            onClick={() => setShowImporter(!showImporter)}
            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-4 transition-colors"
          >
            <Upload size={16} /> 
            {showImporter ? 'Ocultar Importação' : 'Importar Histórico (CSV)'}
          </button>
          
          {showImporter && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn bg-gray-50 dark:bg-[#121212] p-4 rounded-lg border border-gray-200 dark:border-gray-800">
              <DataImporter target="evaluations_leaders" />
              <DataImporter target="evaluations_collaborators" />
            </div>
          )}
        </div>
      )}

      {/* Cabeçalho de Navegação */}
      <div className="flex items-center justify-between mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
        <div className="flex items-center gap-2">
          {viewLevel > 1 && (
            <button onClick={handleBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors mr-2">
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          )}
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            {viewLevel === 1 && "Histórico de Avaliações"}
            {viewLevel === 2 && `Avaliações de ${selectedPeriod}`}
            {viewLevel === 3 && (
              <div className="flex flex-col">
                <span>Detalhes da Avaliação</span>
                <span className="text-xs font-normal text-gray-500 mt-1">ID: {selectedEvaluation?.displayId}</span>
              </div>
            )}
          </h2>
        </div>
      </div>

      {/* Nível 1: Resumo dos Meses */}
      {viewLevel === 1 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#121212] text-gray-600 dark:text-gray-400 text-sm uppercase tracking-wider">
                <th className="p-4 rounded-tl-lg">Período</th>
                <th className="p-4">Volume</th>
                <th className="p-4">Média da Empresa</th>
                <th className="p-4 rounded-tr-lg text-right">Ver Lista</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {summaryData.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-gray-500">Nenhum histórico encontrado.</td></tr>
              ) : (
                summaryData.map((row) => (
                  <tr key={row.period} onClick={() => { setSelectedPeriod(row.period); setViewLevel(2); }} className="hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors group">
                    <td className="p-4 font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-500" /> {row.period}
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">{row.count} avaliações</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        parseFloat(row.average.replace(',','.')) >= 8 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>{row.average}</span>
                    </td>
                    <td className="p-4 text-right">
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 inline-block" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Nível 2: Lista de Funcionários do Mês */}
      {viewLevel === 2 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#121212] text-gray-600 dark:text-gray-400 text-sm uppercase tracking-wider">
                <th className="p-4 rounded-tl-lg">Colaborador</th>
                <th className="p-4">Cargo / Setor</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Nota</th>
                <th className="p-4 rounded-tr-lg text-right">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredList.map((ev) => (
                <tr key={ev.id} onClick={() => { setSelectedEvaluation(ev); setViewLevel(3); }} className="hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-full text-gray-500"><User size={18} /></div>
                      <div>
                        {currentCompany && ev.employeeId ? (
                          <Link
                            to={`/employee/${currentCompany.id}/${ev.employeeId}`}
                            className="font-bold text-gray-800 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {formatShortName(ev.displayName)}
                          </Link>
                        ) : (
                          <div className="font-bold text-gray-800 dark:text-gray-200">{formatShortName(ev.displayName)}</div>
                        )}
                        <div className="text-xs text-gray-400 font-mono">ID: {ev.displayId}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-600 dark:text-gray-400">
                    <div className="text-sm font-medium">{ev.displayRole}</div>
                    <div className="text-xs text-gray-400">{ev.displaySector}</div>
                  </td>
                  <td className="p-4">
                    <span className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                      {ev.type || ev.tipo}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-gray-800 dark:text-gray-200">
                    {ev.normalizedScore.toFixed(1).replace('.', ',')}
                  </td>
                  <td className="p-4 text-right">
                    <FileText className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Nível 3: Detalhes Individuais */}
      {viewLevel === 3 && selectedEvaluation && (
        <div className="animate-fade-in">
          <div className="bg-gray-50 dark:bg-[#121212] p-6 rounded-lg mb-6 flex flex-col md:flex-row justify-between items-center border border-gray-100 dark:border-gray-800">
            <div>
              {currentCompany && selectedEvaluation.employeeId ? (
                <Link
                  to={`/employee/${currentCompany.id}/${selectedEvaluation.employeeId}`}
                  className="text-xl font-bold text-gray-800 dark:text-white mb-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                >
                  {formatShortName(selectedEvaluation.displayName)}
                </Link>
              ) : (
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-1">{formatShortName(selectedEvaluation.displayName)}</h3>
              )}
              <div className="flex gap-4 text-sm text-gray-500">
                <span>{selectedEvaluation.displayRole}</span>
                <span>•</span>
                <span>{selectedEvaluation.displaySector}</span>
              </div>
            </div>
            <div className="mt-4 md:mt-0 text-center bg-white dark:bg-[#1E1E1E] px-8 py-4 rounded-lg shadow-sm border dark:border-gray-700">
              <span className="block text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">Nota Final</span>
              <span className={`text-4xl font-bold ${selectedEvaluation.normalizedScore >= 8 ? 'text-green-600' : 'text-blue-600'}`}>
                {selectedEvaluation.normalizedScore.toFixed(1).replace('.', ',')}
              </span>
            </div>
          </div>

          <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Critérios Avaliados
          </h4>

          <div className="border dark:border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-left">
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-[#1E1E1E]">
                {selectedEvaluation.detalhes ? (
                  Object.entries(selectedEvaluation.detalhes).map(([key, value]: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-4 text-gray-700 dark:text-gray-300">{key}</td>
                    <td className="p-4 text-right font-medium text-gray-800 dark:text-gray-200">
                        {typeof value === 'number' ? value.toFixed(1).replace('.', ',') : value}
                    </td>
                    </tr>
                  ))
                ) : (
                  <tr><td className="p-4 text-center text-gray-500">Sem detalhes disponíveis.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
