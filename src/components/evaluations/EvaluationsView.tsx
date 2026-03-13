import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, FileText, Search, Download, Filter, Save, 
  Calendar, Loader2, CheckSquare, Square, Edit, X, Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Star, ArrowUpDown, ArrowUp, ArrowDown, Users
} from 'lucide-react';
import { collection, addDoc, getDocs, query, where, writeBatch, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useCompany } from '../../contexts/CompanyContext';
import Papa from 'papaparse';
import { Modal } from '../ui/Modal';
import { toast } from '../../utils/toast';
import { useAuditLogger } from '../../utils/auditLogger';
import { formatShortName } from '../../utils/nameFormatter';
import { getMonthKey, getYearFromDateStr, formatDateOnlyPtBR, getDateOnlyTimestamp } from '../../utils/date';

// --- Interfaces para Tipagem ---
interface Employee {
  id: string;
  name: string;
  role: string;
  sector: string;
  companyId: string;
  status?: string;
  jobLevel?: string;
}

interface Role {
  id: string;
  name: string;
  level: 'Estratégico' | 'Tático' | 'Operacional' | 'Colaborador' | 'Líder';
}

interface Criteria {
  id: string;
  name: string;
  type: string;
  description?: string;
}

interface EvaluationData {
  id: string;
  employeeName: string;
  employeeId?: string;
  role: string;
  sector: string;
  type: string;
  date: string;
  average: number;
  details: Record<string, number>;
}

// --- Subcomponente: Formulário de Avaliação (Mantido igual, apenas tipos ajustados) ---
const EvaluationForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const { currentCompany, companies } = useCompany();
  const { logAction } = useAuditLogger();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [criteriaList, setCriteriaList] = useState<Criteria[]>([]);
  
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [formType, setFormType] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [observations, setObservations] = useState('');
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [highlightReason, setHighlightReason] = useState('');
  
  const [evalMonth, setEvalMonth] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().slice(0, 7); 
  });

  const [loading, setLoading] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(currentCompany?.id === 'all' ? '' : currentCompany?.id || '');
  const [sortOrder, setSortOrder] = useState<'name' | 'sector'>('sector');
  const [searchTerm, setSearchTerm] = useState('');
  const [existingEvaluations, setExistingEvaluations] = useState<Set<string>>(new Set());

  // Carregar avaliações existentes para o mês selecionado
  useEffect(() => {
    const loadExistingEvaluations = async () => {
      if (!selectedCompanyId || !evalMonth) {
        setExistingEvaluations(new Set());
        return;
      }
      
      try {
        const monthStart = `${evalMonth}-01`;
        const monthEnd = `${evalMonth}-31`;
        
        const evalQuery = query(
          collection(db, 'evaluations'),
          where("companyId", "==", selectedCompanyId),
          where("date", ">=", monthStart),
          where("date", "<=", monthEnd)
        );
        
        const evalSnap = await getDocs(evalQuery);
        const evaluatedEmployeeIds = new Set<string>();
        
        evalSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.employeeId) {
            evaluatedEmployeeIds.add(data.employeeId);
          } else if (data.employeeName) {
            // Fallback: usar nome se não tiver ID
            const emp = employees.find(e => e.name === data.employeeName);
            if (emp) evaluatedEmployeeIds.add(emp.id);
          }
        });
        
        setExistingEvaluations(evaluatedEmployeeIds);
      } catch (error) {
        console.error("Erro ao carregar avaliações existentes", error);
      }
    };
    
    loadExistingEvaluations();
  }, [selectedCompanyId, evalMonth, employees]);

  useEffect(() => {
    const loadAux = async () => {
      try {
        const [roleSnap] = await Promise.all([
          getDocs(collection(db, 'roles'))
        ]);
        
        setRoles(roleSnap.docs.map(d => ({ id: d.id, ...d.data() } as Role)));
        
        if (selectedCompanyId) {
          const empQuery = query(collection(db, 'employees'), where("companyId", "==", selectedCompanyId));
          const empSnap = await getDocs(empQuery);
          
          const allEmployees = empSnap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
          // Filtrar: mostrar apenas Ativos, Férias e Afastados (não mostrar Inativos)
          const availableEmployees = allEmployees.filter(emp => {
            const status = emp.status || 'Ativo';
            return status !== 'Inativo';
          });
          setEmployees(availableEmployees);

          const critSnap = await getDocs(collection(db, 'evaluation_criteria'));
          const allCriteria = critSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

          const filteredCriteria = allCriteria.filter((crit: any) => {
            const ids: string[] = crit.companyIds || [];
            if (!ids || ids.length === 0) return true;
            return ids.includes(selectedCompanyId);
          });

          setCriteriaList(filteredCriteria as Criteria[]);
        } else {
          setEmployees([]);
          setCriteriaList([]);
        }
      } catch (error) {
        console.error("Erro ao carregar dados auxiliares", error);
      }
    };
    loadAux();
  }, [selectedCompanyId]);

  useEffect(() => {
    if (!selectedEmployeeId) {
      setCurrentEmployee(null);
      setFormType(null);
      setScores({});
      return;
    }
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (emp) {
      setCurrentEmployee(emp);
      const roleData = roles.find(r => r.name === emp.role);
      // Prioriza nível do colaborador (jobLevel); aceita também "nivel"/"level" por compatibilidade
      const rawLevel = emp.jobLevel ?? (emp as unknown as Record<string, unknown>).nivel ?? (emp as unknown as Record<string, unknown>).level;
      const employeeLevel = typeof rawLevel === 'string' ? rawLevel.trim() || undefined : undefined;
      setFormType(employeeLevel || roleData?.level || 'Operacional');
      setScores({});
    }
  }, [selectedEmployeeId, employees, roles]);

  const activeCriteria = useMemo(() => {
    if (!formType) return [];
    return criteriaList.filter(c => c.type === formType);
  }, [formType, criteriaList]);

  // Filtrar e ordenar funcionários (mostra todos, mas marca os já avaliados)
  const availableEmployees = useMemo(() => {
    let filtered = [...employees]; // Mostra todos os funcionários
    
    // Busca por nome
    if (searchTerm) {
      filtered = filtered.filter(emp => 
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.sector.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Ordenação
    if (sortOrder === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOrder === 'sector') {
      filtered.sort((a, b) => {
        const sectorCompare = a.sector.localeCompare(b.sector);
        if (sectorCompare !== 0) return sectorCompare;
        return a.name.localeCompare(b.name);
      });
    }
    
    return filtered;
  }, [employees, searchTerm, sortOrder]);
  
  // Funcionários já avaliados (para desabilitar)
  const evaluatedEmployees = useMemo(() => {
    return new Set(availableEmployees.filter(emp => existingEvaluations.has(emp.id)).map(emp => emp.id));
  }, [availableEmployees, existingEvaluations]);

  const currentAverage = useMemo(() => {
    const values = Object.values(scores);
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return sum / values.length;
  }, [scores]);

  const handleSubmit = async () => {
    if (!currentEmployee || !evalMonth || !selectedCompanyId) {
      toast.warning("Por favor, selecione uma empresa e um funcionário antes de salvar.");
      return;
    }
    
    // Verificar se já existe avaliação para este funcionário neste mês
    if (existingEvaluations.has(currentEmployee.id)) {
      const confirmMessage = `O funcionário ${currentEmployee.name} já possui uma avaliação para o mês ${evalMonth}.\n\nDeseja criar uma nova avaliação mesmo assim?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }
    
    if (activeCriteria.length > 0 && Object.keys(scores).length !== activeCriteria.length) {
      if(!window.confirm("Alguns critérios estão sem nota (serão considerados 0). Deseja continuar?")) return;
    }

    setLoading(true);
    try {
      const payload = {
        companyId: selectedCompanyId,
        employeeId: currentEmployee.id,
        employeeName: currentEmployee.name,
        role: currentEmployee.role,
        sector: currentEmployee.sector,
        type: formType,
        date: `${evalMonth}-01`,
        average: Number(currentAverage.toFixed(2)),
        details: scores,
        observations: observations.trim(),
        funcionarioMes: isHighlighted ? 'Sim' : 'Não',
        highlightReason: isHighlighted ? highlightReason.trim() : '',
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'evaluations'), payload);
      toast.success("Avaliação salva com sucesso!");
      
      // Log de auditoria
      await logAction('create', 'evaluation', docRef.id, {
        entityName: `${currentEmployee.name} - ${evalMonth}`,
        metadata: { average: payload.average, type: formType }
      });
      
      // Adiciona o funcionário à lista de já avaliados
      setExistingEvaluations(prev => new Set([...prev, currentEmployee.id]));
      
      // Limpa seleção para facilitar próxima avaliação
      setSelectedEmployeeId('');
      setScores({});
      setObservations('');
      setIsHighlighted(false);
      setHighlightReason('');
      
      onSuccess();
    } catch (error) {
      toast.handleError(error, 'EvaluationsView.handleSubmit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-navy-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-navy-700 max-w-4xl mx-auto">
      <h3 className="text-xl font-bold mb-6 text-gray-800 dark:text-white flex items-center gap-2">
        <FileText className="text-blue-600" /> Nova Avaliação de Desempenho
      </h3>

      {/* Controles de Filtro e Ordenação */}
      {selectedCompanyId && (
        <div className="bg-gray-50 dark:bg-navy-900 p-4 rounded-lg mb-4 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex-1 w-full sm:w-auto">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Buscar Colaborador</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Nome, cargo ou setor..."
                  className="w-full pl-10 pr-3 py-2 text-sm border rounded dark:bg-navy-800 dark:border-gray-700 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 ring-blue-500/20"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Ordenar por</label>
              <select
                className="w-full sm:w-40 px-3 py-2 text-sm border rounded dark:bg-navy-800 dark:border-gray-700 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 ring-blue-500/20"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'name' | 'sector')}
              >
                <option value="sector">Setor → Nome</option>
                <option value="name">Nome (A-Z)</option>
              </select>
            </div>
            {existingEvaluations.size > 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 pt-6 sm:pt-0">
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {existingEvaluations.size} já avaliado{existingEvaluations.size !== 1 ? 's' : ''}
                </span>
                {' '}neste mês
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Mês de Referência - PRIMEIRO CAMPO */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Mês de Referência <span className="text-red-500">*</span>
          </label>
          <input 
            type="month" 
            className="w-full p-2 border rounded dark:bg-navy-900 dark:border-gray-700 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 ring-blue-500/20"
            value={evalMonth}
            onChange={(e) => {
              setEvalMonth(e.target.value);
              setSelectedEmployeeId(''); // Limpa seleção ao mudar mês
            }}
          />
          {existingEvaluations.size > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {existingEvaluations.size} funcionário{existingEvaluations.size !== 1 ? 's' : ''} já avaliado{existingEvaluations.size !== 1 ? 's' : ''} neste mês
            </p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Empresa <span className="text-red-500">*</span></label>
          <select 
            className="w-full p-2 border rounded dark:bg-navy-900 dark:border-gray-700 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 ring-blue-500/20"
            value={selectedCompanyId}
            onChange={(e) => {
              setSelectedCompanyId(e.target.value);
              setSelectedEmployeeId('');
              setCriteriaList([]);
              setScores({});
              setSearchTerm('');
            }}
            disabled={!evalMonth}
          >
            <option value="">{evalMonth ? "Selecione uma empresa..." : "Selecione o mês primeiro"}</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Colaborador 
            <span className="text-xs text-gray-500 ml-2">
              ({availableEmployees.filter(e => !evaluatedEmployees.has(e.id)).length} disponível{availableEmployees.filter(e => !evaluatedEmployees.has(e.id)).length !== 1 ? 'eis' : ''})
            </span>
          </label>
          <div className="relative">
            <select 
              className="w-full p-2 pr-24 border rounded dark:bg-navy-900 dark:border-gray-700 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              disabled={!selectedCompanyId || !evalMonth}
            >
              <option value="">
                  {!evalMonth
                    ? "Selecione o mês primeiro"
                    : !selectedCompanyId 
                    ? "Selecione a empresa primeiro"
                    : availableEmployees.length > 0 
                    ? "Selecione um funcionário..." 
                    : "Nenhum funcionário disponível"}
              </option>
              {availableEmployees.map(e => {
                const isEvaluated = evaluatedEmployees.has(e.id);
                const status = e.status || 'Ativo';
                const statusDisplay = status === 'Férias' ? ' 🏖️ Férias' : status === 'Afastado' ? ' 🏥 Afastado' : '';
                return (
                  <option 
                    key={e.id} 
                    value={e.id}
                    disabled={isEvaluated}
                    className={isEvaluated ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500' : ''}
                  >
                    {isEvaluated ? '✓ ' : ''}{sortOrder === 'sector' ? `[${e.sector}] ` : ''}{e.name} - {e.role}{statusDisplay}{isEvaluated ? ' (Já avaliado)' : ''}
                  </option>
                );
              })}
            </select>
            {/* Indicador visual de status ao lado do select */}
            {selectedEmployeeId && (() => {
              const selectedEmp = availableEmployees.find(e => e.id === selectedEmployeeId);
              if (!selectedEmp) return null;
              const status = selectedEmp.status || 'Ativo';
              if (status === 'Férias' || status === 'Afastado') {
                return (
                  <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded pointer-events-none ${
                    status === 'Férias' 
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' 
                      : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                  }`}>
                    {status === 'Férias' ? '🏖️' : '🏥'} {status}
                  </div>
                );
              }
              return null;
            })()}
          </div>
          {/* Indicador de status abaixo do select */}
          {selectedEmployeeId && (() => {
            const selectedEmp = availableEmployees.find(e => e.id === selectedEmployeeId);
            if (!selectedEmp) return null;
            const status = selectedEmp.status || 'Ativo';
            const isEvaluated = evaluatedEmployees.has(selectedEmp.id);
            
            return (
              <div className="mt-1 flex flex-wrap gap-2">
                {isEvaluated && (
                  <div className="text-xs font-medium px-2 py-1 rounded inline-flex items-center gap-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    ✓ Já avaliado neste mês
                  </div>
                )}
                {status === 'Férias' || status === 'Afastado' ? (
                  <div className={`text-xs font-medium px-2 py-1 rounded inline-flex items-center gap-1 ${
                    status === 'Férias' 
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' 
                      : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                  }`}>
                    {status === 'Férias' ? '🏖️' : '🏥'} Status: {status}
                  </div>
                ) : null}
              </div>
            );
          })()}
        </div>
      </div>

      {currentEmployee && (
        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg mb-6 flex flex-wrap gap-4 text-sm text-gray-700 dark:text-gray-300 border border-blue-100 dark:border-blue-800">
          <div><span className="font-bold">Cargo:</span> {currentEmployee.role}</div>
          <div><span className="font-bold">Setor:</span> {currentEmployee.sector}</div>
          <div>
            <span className="font-bold">Nível:</span>{' '}
            <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {formType}
            </span>
          </div>
        </div>
      )}

      {formType && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {activeCriteria.length > 0 ? (
              activeCriteria.map(crit => (
                <div key={crit.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="mb-2 md:mb-0 md:w-2/3">
                    <p className="font-medium text-gray-800 dark:text-gray-200">{crit.name}</p>
                    {crit.description && <p className="text-xs text-gray-500">{crit.description}</p>}
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" min="0" max="10" step="1"
                      className="w-32 accent-blue-600"
                      value={scores[crit.name] || 0}
                      onChange={(e) => setScores({...scores, [crit.name]: parseInt(e.target.value)})}
                    />
                    <div className="relative">
                      <input 
                        type="number" min="0" max="10" step="1"
                        className="w-16 p-2 text-center border rounded font-bold dark:bg-navy-900 dark:border-gray-700 text-gray-800 dark:text-white"
                        value={scores[crit.name] || 0}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if(val >= 0 && val <= 10) setScores({...scores, [crit.name]: val});
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-100 dark:border-yellow-800">
                Nenhum critério encontrado para o nível "{formType}" nesta empresa. <br/>
                Vá em <strong>Configurações &gt; Critérios</strong> e cadastre novos itens.
              </div>
            )}
          </div>

          {/* Campos de Observações e Destaque */}
          <div className="space-y-4 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Observações
              </label>
              <textarea
                rows={3}
                className="w-full p-3 border rounded-lg dark:bg-navy-900 dark:border-navy-700 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 ring-blue-500/20 resize-none"
                placeholder="Adicione observações sobre a avaliação..."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
              />
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isHighlighted}
                  onChange={(e) => setIsHighlighted(e.target.checked)}
                  className="w-5 h-5 accent-yellow-600 dark:accent-yellow-500 rounded"
                />
                <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <span className="text-yellow-600 dark:text-yellow-400">⭐</span>
                  Destaque do Mês
                </span>
              </label>
              
              {isHighlighted && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Motivo do Destaque
                  </label>
                  <textarea
                    rows={2}
                    className="w-full p-3 border rounded-lg dark:bg-navy-900 dark:border-gray-700 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 ring-yellow-500/20 resize-none"
                    placeholder="Explique o motivo pelo qual este colaborador se destacou..."
                    value={highlightReason}
                    onChange={(e) => setHighlightReason(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center bg-gray-100 dark:bg-gray-800 p-6 rounded-lg mt-6 border border-gray-200 dark:border-gray-700">
            <div className="text-lg text-gray-800 dark:text-gray-200 mb-4 md:mb-0">
              Média Final: <span className={`font-bold text-3xl ml-2 ${currentAverage >= 8 ? 'text-green-600' : currentAverage >= 6 ? 'text-yellow-600' : 'text-red-600'}`}>{currentAverage.toFixed(2)}</span>
            </div>
            <button 
              onClick={handleSubmit}
              disabled={loading || activeCriteria.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto justify-center"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              {loading ? 'Salvando...' : 'Salvar Avaliação'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Subcomponente: Tabela de Avaliações com Edição em Massa ---
const EvaluationsTable = () => {
  const { currentCompany } = useCompany();
  const [data, setData] = useState<EvaluationData[]>([]);
  const [filteredData, setFilteredData] = useState<EvaluationData[]>([]);
  const [filterName, setFilterName] = useState('');
  const [filterSector, setFilterSector] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterScoreRange, setFilterScoreRange] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent');
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // Estado para modal de resumo
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationData | null>(null);
  const [criteriaList, setCriteriaList] = useState<Criteria[]>([]);
  
  // Estado para ordenação da tabela
  const [tableSort, setTableSort] = useState<{field: string | null, direction: 'asc' | 'desc'}>({field: null, direction: 'asc'});

  // Estados para seleção em massa
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkLevel, setBulkLevel] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Estado para grupos expandidos/colapsados (inicia com todos expandidos)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Estado para menu de filtros lateral
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  
  // Estados para edição individual
  const [editingEvaluation, setEditingEvaluation] = useState<EvaluationData | null>(null);
  const [editScores, setEditScores] = useState<Record<string, number>>({});
  const [editObservations, setEditObservations] = useState('');
  const [editIsHighlighted, setEditIsHighlighted] = useState(false);
  const [editHighlightReason, setEditHighlightReason] = useState('');

  // Carrega dados
  const loadData = React.useCallback(async () => {
    if (!currentCompany) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      let q;
      if (currentCompany.id === 'all') {
          q = collection(db, 'evaluations');
      } else {
          q = query(collection(db, 'evaluations'), where("companyId", "==", currentCompany.id));
      }
      
      const snap = await getDocs(q);
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() } as EvaluationData));
      raw.sort((a, b) => getDateOnlyTimestamp(b.date) - getDateOnlyTimestamp(a.date));
      setData(raw);
      setFilteredData(raw);
    } catch (err) {
      console.error('Erro ao carregar avaliações:', err);
      setData([]);
      setFilteredData([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentCompany]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Carregar critérios para o modal
  useEffect(() => {
    const loadCriteria = async () => {
      try {
        const critSnap = await getDocs(collection(db, 'evaluation_criteria'));
        const allCriteria = critSnap.docs.map(d => ({ id: d.id, ...d.data() } as Criteria));
        setCriteriaList(allCriteria);
      } catch (error) {
        console.error('Erro ao carregar critérios:', error);
      }
    };
    loadCriteria();
  }, []);

  useEffect(() => {
    let res = [...data];
    
    // Filtros
    if (filterName) res = res.filter(d => d.employeeName.toLowerCase().includes(filterName.toLowerCase()));
    if (filterSector) res = res.filter(d => d.sector === filterSector);
    if (filterRole) res = res.filter(d => d.role === filterRole);
    if (filterLevel) res = res.filter(d => d.type === filterLevel);
    if (filterScoreRange) {
      const [min, max] = filterScoreRange.split('-').map(Number);
      res = res.filter(d => {
        const score = typeof d.average === 'number' ? d.average : parseFloat(String(d.average));
        return score >= min && score <= max;
      });
    }
    if (filterMonth) {
      res = res.filter(d => {
        const key = getMonthKey(d.date);
        return key && key.slice(5) === filterMonth && (!filterYear || key.slice(0, 4) === filterYear);
      });
    }
    if (filterYear) {
      res = res.filter(d => getYearFromDateStr(d.date) === filterYear);
    }
    
    // Ordenação (usa timestamp sem timezone para datas YYYY-MM-DD)
    if (sortOrder === 'recent') {
      res.sort((a, b) => getDateOnlyTimestamp(b.date) - getDateOnlyTimestamp(a.date));
    } else {
      res.sort((a, b) => getDateOnlyTimestamp(a.date) - getDateOnlyTimestamp(b.date));
    }
    
    setFilteredData(res);
    setCurrentPage(1); // Reset para primeira página quando filtros mudam
  }, [filterName, filterSector, filterRole, filterLevel, filterScoreRange, filterMonth, filterYear, sortOrder, data]);
  
  // Função para mostrar resumo (usada no onClick do nome)
  const handleShowSummary = React.useCallback((ev: EvaluationData) => {
    setSelectedEvaluation(ev);
    setSummaryModalOpen(true);
  }, []);

  // Paginação
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  // Ordenação da tabela
  const handleTableSort = (field: string) => {
    setTableSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };
  
  const sortedTableData = useMemo(() => {
    if (!tableSort.field) return paginatedData;
    
    const sorted = [...paginatedData];
    sorted.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (tableSort.field) {
        case 'date':
          aVal = getDateOnlyTimestamp(a.date);
          bVal = getDateOnlyTimestamp(b.date);
          break;
        case 'employeeName':
          aVal = a.employeeName.toLowerCase();
          bVal = b.employeeName.toLowerCase();
          break;
        case 'role':
          aVal = a.role.toLowerCase();
          bVal = b.role.toLowerCase();
          break;
        case 'sector':
          aVal = a.sector.toLowerCase();
          bVal = b.sector.toLowerCase();
          break;
        case 'type':
          aVal = a.type.toLowerCase();
          bVal = b.type.toLowerCase();
          break;
        case 'average':
          aVal = typeof a.average === 'number' ? a.average : parseFloat(String(a.average));
          bVal = typeof b.average === 'number' ? b.average : parseFloat(String(b.average));
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return tableSort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return tableSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [paginatedData, tableSort]);

  // Handlers de Seleção
  const handleSelectAll = () => {
    if (selectedIds.length === filteredData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredData.map(d => d.id));
    }
  };

  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Handler de Edição em Massa
  const handleBulkUpdate = async () => {
    if (!bulkLevel) return;
    setIsUpdating(true);
    try {
      const batch = writeBatch(db);
      
      selectedIds.forEach(id => {
        const docRef = doc(db, 'evaluations', id);
        batch.update(docRef, { type: bulkLevel });
      });

      await batch.commit();
      
      // Atualiza localmente para feedback instantâneo
      const updatedData = data.map(item => 
        selectedIds.includes(item.id) ? { ...item, type: bulkLevel } : item
      );
      setData(updatedData);
      
      setSelectedIds([]);
      setIsBulkEditOpen(false);
      setBulkLevel('');
      toast.success(`${selectedIds.length} avaliações atualizadas para o nível "${bulkLevel}".`);
    } catch (error) {
      console.error("Erro na atualização em massa:", error);
      toast.handleError(error, 'EvaluationsView.handleBulkUpdate');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir esta avaliação?')) return;
    try {
      await deleteDoc(doc(db, 'evaluations', id));
      setData(data.filter(d => d.id !== id));
      toast.success('Avaliação excluída com sucesso!');
    } catch (error) {
      toast.handleError(error, 'EvaluationsView.handleDelete');
    }
  };

  const handleEdit = (ev: EvaluationData) => {
    setEditingEvaluation(ev);
    setEditScores(ev.details || {});
    setEditObservations((ev as any).observations || '');
    setEditIsHighlighted((ev as any).funcionarioMes === 'Sim' || (ev as any).funcionarioMes === true);
    setEditHighlightReason((ev as any).highlightReason || '');
  };

  const handleSaveEdit = async () => {
    if (!editingEvaluation) return;
    
    const newAverage = Object.values(editScores).length > 0
      ? Object.values(editScores).reduce((a, b) => a + b, 0) / Object.values(editScores).length
      : editingEvaluation.average;

    try {
      await updateDoc(doc(db, 'evaluations', editingEvaluation.id), {
        details: editScores,
        average: Number(newAverage.toFixed(2)),
        observations: editObservations.trim(),
        funcionarioMes: editIsHighlighted ? 'Sim' : 'Não',
        highlightReason: editIsHighlighted ? editHighlightReason.trim() : '',
        updatedAt: new Date().toISOString()
      });
      
      // Atualiza localmente
      setData(data.map(d => 
        d.id === editingEvaluation.id 
          ? { ...d, details: editScores, average: newAverage, observations: editObservations, funcionarioMes: editIsHighlighted ? 'Sim' : 'Não', highlightReason: editHighlightReason }
          : d
      ));
      
      setEditingEvaluation(null);
      toast.success('Avaliação atualizada com sucesso!');
    } catch (error) {
      toast.handleError(error, 'EvaluationsView.handleSaveEdit');
    }
  };

  const handleExportCSV = () => {
    if (filteredData.length === 0) return;
    const csv = Papa.unparse(filteredData.map(d => ({
      Nome: d.employeeName,
      Cargo: d.role,
      Setor: d.sector,
      Nível: d.type,
      Data: d.date,
      Nota_Final: typeof d.average === 'number' ? d.average.toFixed(2) : d.average,
      ...d.details
    })));
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `avaliacoes_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const uniqueYears = Array.from(new Set(data.map(d => getYearFromDateStr(d.date)).filter(Boolean))).sort((a, b) => parseInt(b) - parseInt(a));

  const sectors = Array.from(new Set(data.map(d => d.sector))).sort();
  const roles = Array.from(new Set(data.map(d => d.role))).sort();
  const levels = Array.from(new Set(data.map(d => d.type))).sort();

  // Agrupar dados paginados por mês/ano
  const groupedTableData = useMemo(() => {
    const grouped: Record<string, EvaluationData[]> = {};
    
    sortedTableData.forEach((ev) => {
      const monthKey = getMonthKey(ev.date);
      if (!monthKey) return;
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(ev);
    });

    // Ordenar avaliações dentro de cada grupo por data (mais recente primeiro)
    Object.values(grouped).forEach(group => {
      group.sort((a, b) => getDateOnlyTimestamp(b.date) - getDateOnlyTimestamp(a.date));
    });

    // Ordenar grupos por data (mais recente primeiro)
    const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
      return b.localeCompare(a); // Mais recente primeiro
    });

    return sortedGroups;
  }, [sortedTableData]);

  // Expandir automaticamente o primeiro grupo se nenhum estiver expandido
  useEffect(() => {
    if (groupedTableData.length > 0 && expandedGroups.size === 0) {
      setExpandedGroups(new Set([groupedTableData[0][0]]));
    }
  }, [groupedTableData]);

  // Função para expandir/colapsar grupo
  const toggleGroup = (monthKey: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  // Função para formatar mês/ano
  const formatMonthYear = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-4 relative">
      {/* Overlay quando menu está aberto */}
      {isFilterPanelOpen && (
        <div
          onClick={() => setIsFilterPanelOpen(false)}
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-30"
        />
      )}

      {/* Botão Toggle do Menu de Filtros */}
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

      {/* Menu de Filtros Lateral */}
      <div
        className={`fixed right-0 top-0 h-full bg-white dark:bg-navy-800 border-l border-gray-200 dark:border-navy-700 shadow-2xl z-40 transition-transform duration-300 ease-in-out overflow-y-auto ${
          isFilterPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: '380px', paddingTop: '20px' }}
      >
        <div className="p-6 space-y-6">
          {/* Cabeçalho */}
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

          {/* Filtro Nome */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nome do Funcionário</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por nome..."
                className="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-lg outline-none text-gray-700 dark:text-gray-300 focus:ring-2 ring-blue-500/20 text-sm"
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
              />
              <Search className="absolute left-3 top-2.5 text-gray-400 z-10" size={18} />
            </div>
          </div>

          {/* Filtro Setor */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Setor</label>
            <div className="relative">
              <select 
                className="w-full pl-10 pr-8 py-2 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-lg outline-none text-gray-700 dark:text-gray-300 appearance-none cursor-pointer hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors text-sm"
                value={filterSector}
                onChange={e => setFilterSector(e.target.value)}
              >
                <option value="">Todos Setores</option>
                {sectors.map((s: string) => <option key={s} value={s}>{s}</option>)}
              </select>
              <Filter className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" size={18} />
            </div>
          </div>

          {/* Filtro Cargo */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cargo</label>
            <div className="relative">
              <select 
                className="w-full px-3 py-2 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-lg outline-none text-gray-700 dark:text-gray-300 appearance-none cursor-pointer hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors text-sm"
                value={filterRole}
                onChange={e => setFilterRole(e.target.value)}
              >
                <option value="">Todos Cargos</option>
                {roles.map((r: string) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* Filtro Nível */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nível</label>
            <div className="relative">
              <select 
                className="w-full px-3 py-2 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-lg outline-none text-gray-700 dark:text-gray-300 appearance-none cursor-pointer hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors text-sm"
                value={filterLevel}
                onChange={e => setFilterLevel(e.target.value)}
              >
                <option value="">Todos Níveis</option>
                {levels.map((l: string) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Filtro Mês/Ano */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mês de Referência</label>
            <div className="relative">
              <input
                type="month"
                className="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-lg outline-none text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors text-sm"
                value={filterMonth && filterYear ? `${filterYear}-${filterMonth}` : ''}
                onChange={e => {
                  const value = e.target.value;
                  if (value) {
                    const [year, month] = value.split('-');
                    setFilterYear(year);
                    setFilterMonth(month);
                  } else {
                    setFilterYear('');
                    setFilterMonth('');
                  }
                }}
              />
              <Calendar className="absolute left-3 top-2.5 text-gray-400 pointer-events-none" size={18} />
            </div>
          </div>

          {/* Filtro Ano */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Ano</label>
            <div className="relative">
              <select 
                className="w-full px-3 py-2 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-lg outline-none text-gray-700 dark:text-gray-300 appearance-none cursor-pointer hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors text-sm"
                value={filterYear}
                onChange={e => setFilterYear(e.target.value)}
              >
                <option value="">Todos Anos</option>
                {uniqueYears.map((y: string) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Filtro Faixa de Nota */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Faixa de Nota</label>
            <div className="relative">
              <select 
                className="w-full px-3 py-2 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-lg outline-none text-gray-700 dark:text-gray-300 appearance-none cursor-pointer hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors text-sm"
                value={filterScoreRange}
                onChange={e => setFilterScoreRange(e.target.value)}
              >
                <option value="">Todas Notas</option>
                <option value="0-4">0-4 (Ruim)</option>
                <option value="5-6">5-6 (Regular)</option>
                <option value="7-8">7-8 (Bom)</option>
                <option value="9-10">9-10 (Excelente)</option>
              </select>
            </div>
          </div>

          {/* Ordenação */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Ordenação</label>
            <div className="relative">
              <select 
                className="w-full px-3 py-2 bg-gray-50 dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-lg outline-none text-gray-700 dark:text-gray-300 appearance-none cursor-pointer hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors text-sm"
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value as 'recent' | 'oldest')}
              >
                <option value="recent">Mais Recente</option>
                <option value="oldest">Mais Antigo</option>
              </select>
            </div>
          </div>

          {/* Botão Limpar Filtros */}
          <div className="pt-4 border-t border-gray-200 dark:border-navy-700">
            <button
              onClick={() => {
                setFilterName('');
                setFilterSector('');
                setFilterRole('');
                setFilterLevel('');
                setFilterScoreRange('');
                setFilterMonth('');
                setFilterYear('');
                setSortOrder('recent');
              }}
              className="w-full px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-200 dark:border-red-800"
            >
              Limpar todos os filtros
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Ações */}
      <div 
        className={`bg-white dark:bg-navy-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-navy-700 transition-all duration-300 ${
          isFilterPanelOpen ? 'mr-[380px]' : 'mr-0'
        }`}
      >
        <div className="flex flex-wrap gap-2 justify-between items-center">
          <div className="flex gap-2">
            {selectedIds.length > 0 && (
              <button
                onClick={() => setIsBulkEditOpen(true)}
                className="flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-700 font-bold px-4 py-2 rounded-lg transition-colors shadow-sm text-sm"
              >
                <Edit size={18} /> Editar ({selectedIds.length})
              </button>
            )}
            <button 
              onClick={handleExportCSV} 
              disabled={filteredData.length === 0}
              className="flex items-center gap-2 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-bold px-4 py-2 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <Download size={18} /> Exportar
            </button>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {filteredData.length} avaliação(ões) encontrada(s)
          </div>
        </div>
      </div>

      {/* Informação sobre avaliações vs funcionários avaliados */}
      {data.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Total de Avaliações</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.length}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Todas as avaliações realizadas ao longo do tempo</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Funcionários Únicos Avaliados</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{new Set(data.map((d: EvaluationData) => d.employeeId || d.employeeName)).size}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Colaboradores que receberam pelo menos uma avaliação</p>
            </div>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div 
        className={`bg-white dark:bg-navy-800 rounded-lg shadow-sm border border-gray-200 dark:border-navy-700 overflow-hidden transition-all duration-300 ${
          isFilterPanelOpen ? 'mr-[380px]' : 'mr-0'
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-navy-900 text-gray-500 uppercase font-medium border-b dark:border-navy-700">
              <tr>
                <th className="p-4 w-10">
                  <button onClick={handleSelectAll} className="text-gray-400 hover:text-blue-500">
                    {selectedIds.length > 0 && selectedIds.length === filteredData.length ? <CheckSquare size={20} /> : <Square size={20} />}
                  </button>
                </th>
                <th className="p-4">
                  <button onClick={() => handleTableSort('date')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-gold-400 transition-colors">
                    Data
                    {tableSort.field === 'date' ? (
                      tableSort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </button>
                </th>
                <th className="p-4">
                  <button onClick={() => handleTableSort('employeeName')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-gold-400 transition-colors">
                    Colaborador
                    {tableSort.field === 'employeeName' ? (
                      tableSort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </button>
                </th>
                <th className="p-4">
                  <button onClick={() => handleTableSort('role')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-gold-400 transition-colors">
                    Cargo
                    {tableSort.field === 'role' ? (
                      tableSort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </button>
                </th>
                <th className="p-4">
                  <button onClick={() => handleTableSort('sector')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-gold-400 transition-colors">
                    Setor
                    {tableSort.field === 'sector' ? (
                      tableSort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </button>
                </th>
                <th className="p-4">
                  <button onClick={() => handleTableSort('type')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-gold-400 transition-colors">
                    Nível
                    {tableSort.field === 'type' ? (
                      tableSort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </button>
                </th>
                <th className="p-4 text-right">
                  <button onClick={() => handleTableSort('average')} className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-gold-400 transition-colors ml-auto">
                    Nota Média
                    {tableSort.field === 'average' ? (
                      tableSort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    ) : <ArrowUpDown size={14} className="opacity-30" />}
                  </button>
                </th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500"><Loader2 className="animate-spin inline mr-2"/> Carregando histórico...</td></tr>
              ) : groupedTableData.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">Nenhum registro encontrado.</td></tr>
              ) : groupedTableData.map(([monthKey, evaluations]) => {
                const isExpanded = expandedGroups.has(monthKey);
                const uniqueEmployees = new Set(evaluations.map(ev => ev.employeeId || ev.employeeName)).size;
                const monthYear = formatMonthYear(monthKey);
                
                return (
                  <React.Fragment key={monthKey}>
                    {/* Cabeçalho do Grupo */}
                    <tr className="bg-gray-100 dark:bg-navy-900 border-b-2 border-gray-300 dark:border-navy-700 hover:bg-gray-200 dark:hover:bg-navy-800 transition-colors">
                      <td colSpan={8} className="p-4">
                        <button
                          onClick={() => toggleGroup(monthKey)}
                          className="w-full flex items-center justify-between text-left group"
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronUp size={20} className="text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-gold-400 transition-colors" />
                            ) : (
                              <ChevronDown size={20} className="text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-gold-400 transition-colors" />
                            )}
                            <div>
                              <span className="text-lg font-bold text-gray-800 dark:text-white capitalize">
                                {monthYear}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                  <Users size={14} />
                                  {uniqueEmployees} {uniqueEmployees === 1 ? 'funcionário avaliado' : 'funcionários avaliados'} em {evaluations.length} {evaluations.length === 1 ? 'avaliação' : 'avaliações'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {isExpanded ? 'Ocultar' : 'Expandir'}
                          </span>
                        </button>
                      </td>
                    </tr>
                    {/* Avaliações do Grupo */}
                    {isExpanded && evaluations.map((ev) => (
                      <tr key={ev.id} className={`hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors ${selectedIds.includes(ev.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                        <td className="p-4">
                          <button onClick={() => handleSelectOne(ev.id)} className="text-gray-400 hover:text-blue-500">
                            {selectedIds.includes(ev.id) ? <CheckSquare size={20} className="text-blue-500" /> : <Square size={20} />}
                          </button>
                        </td>
                        <td className="p-4 text-gray-500 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                              <Calendar size={14}/> 
                              {formatDateOnlyPtBR(ev.date, { month: 'long', year: 'numeric' })}
                          </div>
                        </td>
                        <td className="p-4">
                          {ev.employeeId && currentCompany ? (
                            <Link
                              to={`/employee/${currentCompany.id}/${ev.employeeId}`}
                              className="font-bold text-gray-800 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer text-left"
                            >
                              {formatShortName(ev.employeeName)}
                            </Link>
                          ) : (
                            <button
                              onClick={() => handleShowSummary(ev)}
                              className="font-bold text-gray-800 dark:text-white hover:text-blue-600 dark:hover:text-gold-400 transition-colors cursor-pointer text-left"
                            >
                              {formatShortName(ev.employeeName)}
                            </button>
                          )}
                        </td>
                        <td className="p-4 text-gray-600 dark:text-gray-400">{ev.role}</td>
                        <td className="p-4 text-gray-600 dark:text-gray-400">{ev.sector}</td>
                        <td className="p-4">
                          <span className={`text-xs px-2 py-1 rounded border font-medium 
                              ${ev.type === 'Estratégico' ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800' : 
                                ev.type === 'Tático' ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' :
                                'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                              }`}>
                            {ev.type}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <span className={`font-bold px-3 py-1 rounded-full ${
                            (typeof ev.average === 'number' ? ev.average : parseFloat(String(ev.average)) || 0) >= 8 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 
                            (typeof ev.average === 'number' ? ev.average : parseFloat(String(ev.average)) || 0) >= 6 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          }`}>
                            {typeof ev.average === 'number' ? ev.average.toFixed(2) : parseFloat(String(ev.average || 0)).toFixed(2)}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(ev)}
                              className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                              title="Editar avaliação"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(ev.id)}
                              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Excluir avaliação"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Paginação */}
        {(totalPages > 1 || filteredData.length > 0) && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-gray-200 dark:border-navy-700 bg-gray-50 dark:bg-navy-900">
            <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-400">
              <span className="font-medium">
                Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, filteredData.length)} de {filteredData.length} avaliações
              </span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 bg-white dark:bg-navy-800 border border-gray-300 dark:border-navy-700 rounded-lg text-gray-700 dark:text-gray-300 outline-none text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors font-medium"
              >
                <option value={10}>10 por página</option>
                <option value={20}>20 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
              </select>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 bg-white dark:bg-navy-800 border border-gray-300 dark:border-navy-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors text-gray-700 dark:text-gray-300"
                  title="Página anterior"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-navy-800 border border-gray-300 dark:border-navy-700 rounded-lg">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 bg-white dark:bg-navy-800 border border-gray-300 dark:border-navy-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-navy-700 transition-colors text-gray-700 dark:text-gray-300"
                  title="Próxima página"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Resumo da Avaliação */}
      <Modal isOpen={summaryModalOpen} onClose={() => setSummaryModalOpen(false)} title="Resumo da Avaliação">
        {selectedEvaluation && (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-2">{selectedEvaluation.employeeName}</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Cargo:</span>
                  <span className="ml-2 font-medium text-gray-800 dark:text-white">{selectedEvaluation.role}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Setor:</span>
                  <span className="ml-2 font-medium text-gray-800 dark:text-white">{selectedEvaluation.sector}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Nível:</span>
                  <span className="ml-2 font-medium text-gray-800 dark:text-white">{selectedEvaluation.type}</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Data:</span>
                  <span className="ml-2 font-medium text-gray-800 dark:text-white">
                    {formatDateOnlyPtBR(selectedEvaluation.date, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-3">Notas por Critério</h4>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-navy-900 text-gray-500 font-medium">
                    <tr>
                      <th className="p-2 text-left">Critério</th>
                      <th className="p-2 text-right">Nota</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-navy-700">
                    {Object.entries(selectedEvaluation.details || {}).map(([criteriaId, score]) => {
                      // Tentar encontrar o critério pelo ID ou pelo nome
                      const criterion = criteriaList.find(c => c.id === criteriaId || c.name === criteriaId);
                      const criteriaName = criterion?.name || criteriaId;
                      return (
                        <tr key={criteriaId} className="hover:bg-gray-50 dark:hover:bg-navy-800">
                          <td className="p-2 text-gray-700 dark:text-gray-300">{criteriaName}</td>
                          <td className="p-2 text-right font-bold text-gray-800 dark:text-white">{Number(score).toFixed(1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-gray-100 dark:bg-navy-900 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold text-gray-700 dark:text-gray-300">Média Final:</span>
                <span className={`text-2xl font-bold ${
                  (typeof selectedEvaluation.average === 'number' ? selectedEvaluation.average : parseFloat(String(selectedEvaluation.average)) || 0) >= 8 ? 'text-green-600 dark:text-green-400' :
                  (typeof selectedEvaluation.average === 'number' ? selectedEvaluation.average : parseFloat(String(selectedEvaluation.average)) || 0) >= 6 ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {typeof selectedEvaluation.average === 'number' ? selectedEvaluation.average.toFixed(2) : parseFloat(String(selectedEvaluation.average || 0)).toFixed(2)}
                </span>
              </div>
            </div>

            {(selectedEvaluation as any).observations && (
              <div>
                <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-2">Observações</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-navy-900 p-3 rounded-lg">
                  {(selectedEvaluation as any).observations}
                </p>
              </div>
            )}

            {((selectedEvaluation as any).funcionarioMes === 'Sim' || (selectedEvaluation as any).funcionarioMes === true) && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Star size={20} className="text-yellow-600 dark:text-yellow-400 fill-yellow-600 dark:fill-yellow-400" />
                  <span className="font-bold text-gray-800 dark:text-white">Funcionário Destaque do Mês</span>
                </div>
                {(selectedEvaluation as any).highlightReason && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {(selectedEvaluation as any).highlightReason}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setSummaryModalOpen(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Edição Individual Completa */}
      <Modal isOpen={!!editingEvaluation} onClose={() => setEditingEvaluation(null)} title="Editar Avaliação">
        {editingEvaluation && (
          <div className="space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg">
              <p className="font-bold text-gray-800 dark:text-white">{editingEvaluation.employeeName}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{editingEvaluation.role} - {editingEvaluation.sector}</p>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-gray-700 dark:text-gray-300">Critérios e Notas</h4>
              {Object.entries(editScores).map(([criteria, score]) => (
                <div key={criteria} className="flex items-center justify-between p-3 border rounded-lg dark:border-gray-700">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{criteria}</span>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="1"
                      className="w-32 accent-blue-600"
                      value={score}
                      onChange={(e) => setEditScores({...editScores, [criteria]: parseInt(e.target.value)})}
                    />
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="1"
                      className="w-16 p-2 text-center border rounded font-bold dark:bg-navy-900 dark:border-gray-700"
                      value={score}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val >= 0 && val <= 10) setEditScores({...editScores, [criteria]: val});
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Observações</label>
              <textarea
                rows={3}
                className="w-full p-3 border rounded-lg dark:bg-navy-900 dark:border-navy-700 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 ring-blue-500/20 resize-none"
                value={editObservations}
                onChange={(e) => setEditObservations(e.target.value)}
              />
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsHighlighted}
                  onChange={(e) => setEditIsHighlighted(e.target.checked)}
                  className="w-5 h-5 accent-yellow-600 dark:accent-yellow-500 rounded"
                />
                <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <span className="text-yellow-600 dark:text-yellow-400">⭐</span>
                  Destaque do Mês
                </span>
              </label>
              
              {editIsHighlighted && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Motivo do Destaque
                  </label>
                  <textarea
                    rows={2}
                    className="w-full p-3 border rounded-lg dark:bg-navy-900 dark:border-gray-700 text-gray-700 dark:text-gray-300 outline-none focus:ring-2 ring-yellow-500/20 resize-none"
                    value={editHighlightReason}
                    onChange={(e) => setEditHighlightReason(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={handleSaveEdit}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold flex justify-center gap-2"
              >
                <Save size={18} />
                Salvar Alterações
              </button>
              <button
                onClick={() => setEditingEvaluation(null)}
                className="px-4 py-2 border border-gray-300 dark:border-navy-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-navy-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Edição em Massa */}
      <Modal isOpen={isBulkEditOpen} onClose={() => setIsBulkEditOpen(false)} title={`Editar ${selectedIds.length} Itens Selecionados`}>
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            Selecione o novo nível de cargo para aplicar a todas as avaliações selecionadas:
          </p>
          
          <div className="grid gap-2">
            {['Colaborador', 'Líder', 'Operacional', 'Tático', 'Estratégico'].map(level => (
              <label key={level} className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 dark:border-gray-700">
                <input 
                  type="radio" 
                  name="bulkLevel" 
                  value={level} 
                  checked={bulkLevel === level} 
                  onChange={(e) => setBulkLevel(e.target.value)}
                  className="accent-blue-600 w-4 h-4"
                />
                <span className="text-gray-800 dark:text-gray-200 font-medium">{level}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-2 pt-4">
            <button 
              onClick={handleBulkUpdate}
              disabled={!bulkLevel || isUpdating}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold disabled:opacity-50 flex justify-center gap-2"
            >
              {isUpdating ? <Loader2 className="animate-spin" /> : <Save size={18} />}
              Confirmar Alteração
            </button>
            <button 
              onClick={() => setIsBulkEditOpen(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export const EvaluationsView = () => {
  const [activeTab, setActiveTab] = useState<'new' | 'list'>('new');

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-navy-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-navy-700">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Gestão de Avaliações</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Central de lançamento e histórico de desempenho.</p>
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg mt-4 md:mt-0">
          <button
            onClick={() => setActiveTab('new')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'new' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <Plus size={16} /> Nova Avaliação
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${
              activeTab === 'list' 
              ? 'bg-white dark:bg-navy-900 text-blue-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Histórico Completo
          </button>
        </div>
      </div>

      <div className="mt-6">
        {activeTab === 'new' ? (
          <EvaluationForm onSuccess={() => setActiveTab('list')} />
        ) : (
          <EvaluationsTable />
        )}
      </div>
    </div>
  );
};