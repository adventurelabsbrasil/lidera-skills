import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Calendar, Briefcase, Award, User, TrendingUp, 
  ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronUp, Edit, Save, X, BarChart3, Upload, Image as ImageIcon
} from 'lucide-react';
import { 
  Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../services/firebase';
import { useCompany } from '../../contexts/CompanyContext';
import { Card } from '../ui/Card';
import { toast } from '../../utils/toast';
import { getAuditLogs, AuditLog } from '../../services/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useAuditLogger } from '../../utils/auditLogger';
import { getInitials } from '../../utils/nameFormatter';
import { formatDateOnlyPtBR, getDateOnlyTimestamp } from '../../utils/date';

interface Evaluation {
  id: string;
  date: string;
  score: number;
  average: number;
  details: Record<string, number>;
  type: string;
  observations?: string;
  isHighlighted?: boolean;
  highlightReason?: string;
  discProfile?: string;
  sector?: string;
  role?: string;
  employeeId?: string;
  employeeName?: string;
}

interface Employee {
  id: string;
  name: string;
  role: string;
  sector: string;
  admissionDate?: string;
  status?: string;
  discProfile?: string;
  companyId?: string;
  photoUrl?: string;
  employeeCode?: string;
  email?: string;
  contractType?: string;
  managerName?: string;
  unit?: string;
  costCenter?: string;
  phone?: string;
  area?: string;
  function?: string;
  seniority?: string;
  jobLevel?: string;
  terminationDate?: string;
}

export const EmployeeProfile = () => {
  const { companyId, employeeId } = useParams<{ companyId: string; employeeId: string }>();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableSort, setTableSort] = useState<{field: string | null, direction: 'asc' | 'desc'}>({field: null, direction: 'asc'});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [criteriaList, setCriteriaList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'edit'>('dashboard');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Employee>>({});
  const [saving, setSaving] = useState(false);
  const [sectors, setSectors] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const { user } = useAuth();
  const { logAction } = useAuditLogger();

  // Função para comprimir e redimensionar imagem
  const compressImage = (file: File, maxWidth: number = 400, maxHeight: number = 400, quality: number = 0.8): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calcular novas dimensões mantendo proporção
          if (width > height) {
            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = (width * maxHeight) / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Não foi possível criar contexto do canvas'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Falha ao comprimir imagem'));
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (file: File) => {
    if (!employee || !currentCompany) return;

    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Formato inválido. Use JPG, PNG ou WEBP.');
      return;
    }

    // Validar tamanho (máximo 5MB antes da compressão)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('Arquivo muito grande. Máximo: 5MB.');
      return;
    }

    setUploadingPhoto(true);
    try {
      // Comprimir imagem
      const compressedBlob = await compressImage(file, 400, 400, 0.8);
      
      // Criar referência no Storage
      const photoRef = ref(storage, `employees/${currentCompany.id}/${employee.id}/photo.jpg`);
      
      // Upload
      await uploadBytes(photoRef, compressedBlob);
      
      // Obter URL
      const photoUrl = await getDownloadURL(photoRef);
      
      // Atualizar no Firestore
      const employeeRef = doc(db, 'employees', employee.id);
      await updateDoc(employeeRef, { photoUrl });
      
      // Atualizar estado local
      setEmployee({ ...employee, photoUrl } as Employee);
      setEditForm({ ...editForm, photoUrl });
      
      // Log da alteração
      if (user) {
        await logAction('update', 'employee', employee.id, {
          entityName: employee.name,
          changes: { photoUrl: { old: employee.photoUrl, new: photoUrl } }
        });
      }
      
      toast.success('Foto atualizada com sucesso!');
      setShowPhotoUpload(false);
    } catch (error) {
      console.error('Erro ao fazer upload da foto:', error);
      toast.error('Erro ao fazer upload da foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Carregar dados do colaborador
  useEffect(() => {
    const loadEmployeeData = async () => {
      if (!companyId || !employeeId) return;
      
      setLoading(true);
      try {
        // Carregar dados do colaborador
        const employeesRef = collection(db, 'employees');
        const employeeQuery = query(
          employeesRef,
          where('companyId', '==', companyId)
        );
        const employeeSnap = await getDocs(employeeQuery);
        
        // Encontrar o colaborador pelo ID
        const empDoc = employeeSnap.docs.find(doc => doc.id === employeeId || doc.data().id === employeeId);
        if (empDoc) {
          const empData = { id: empDoc.id, ...empDoc.data() } as Employee;
          setEmployee(empData);
        }

        // Carregar avaliações do colaborador
        const evaluationsRef = collection(db, 'evaluations');
        const evalQuery = query(
          evaluationsRef,
          where('companyId', '==', companyId)
        );
        const evalSnap = await getDocs(evalQuery);
        
        // Filtrar avaliações do colaborador (pode ser por employeeId ou employeeName)
        const evals = evalSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Evaluation))
          .filter(ev => {
            // Verificar se corresponde ao colaborador por ID ou nome
            const empData = empDoc?.data();
            return ev.employeeId === employeeId || 
                   (empData && ev.employeeName === empData.name);
          })
          .sort((a, b) => getDateOnlyTimestamp(b.date) - getDateOnlyTimestamp(a.date));
        
        setEvaluations(evals);
      } catch (error) {
        console.error('Erro ao carregar dados do colaborador:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEmployeeData();
  }, [companyId, employeeId]);

  // Carregar critérios para exibir nomes das métricas
  useEffect(() => {
    const loadCriteria = async () => {
      try {
        const criteriaRef = collection(db, 'evaluation_criteria');
        const criteriaSnap = await getDocs(criteriaRef);
        const criteria = criteriaSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCriteriaList(criteria);
      } catch (error) {
        console.error('Erro ao carregar critérios:', error);
      }
    };
    loadCriteria();
  }, []);

  // Carregar setores e cargos para o formulário
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [sectorsSnap, rolesSnap] = await Promise.all([
          getDocs(collection(db, 'sectors')),
          getDocs(collection(db, 'roles'))
        ]);
        setSectors(sectorsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setRoles(rolesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error('Erro ao carregar opções:', error);
      }
    };
    loadOptions();
  }, []);

  // Inicializar formulário de edição quando entrar no modo de edição
  useEffect(() => {
    if (isEditing && employee) {
      setEditForm({ ...employee });
    }
  }, [isEditing, employee]);

  const handleSave = async () => {
    if (!employee || !currentCompany) return;
    
    setSaving(true);
    try {
      const employeeRef = doc(db, 'employees', employee.id);
      
      // Capturar mudanças para o audit log
      const changes: Record<string, { old?: any; new?: any }> = {};
      Object.keys(editForm).forEach(key => {
        if (editForm[key as keyof Employee] !== employee[key as keyof Employee]) {
          changes[key] = {
            old: employee[key as keyof Employee],
            new: editForm[key as keyof Employee]
          };
        }
      });

      await updateDoc(employeeRef, {
        ...editForm,
        companyId: currentCompany.id
      });
      
      // Log da alteração
      if (user && Object.keys(changes).length > 0) {
        await logAction('update', 'employee', employee.id, {
          entityName: employee.name,
          changes
        });
      }
      
      setEmployee({ ...employee, ...editForm } as Employee);
      setIsEditing(false);
      setActiveTab('dashboard');
      toast.success('Dados do colaborador atualizados com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar dados do colaborador');
    } finally {
      setSaving(false);
    }
  };

  const loadAuditLogs = async () => {
    if (!employee || !currentCompany || loadingAuditLogs) return;
    
    setLoadingAuditLogs(true);
    try {
      const logs = await getAuditLogs(currentCompany.id, {
        entityType: 'employee',
        entityId: employee.id,
        limit: 100
      });
      setAuditLogs(logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      toast.error('Erro ao carregar histórico de alterações');
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  const DISC_OPTIONS = [
    'D', 'I', 'S', 'C',
    'D/I', 'D/S', 'D/C', 'I/D', 'I/S', 'I/C', 'S/D', 'S/I', 'S/C', 'C/D', 'C/I', 'C/S',
    'D/I/S', 'D/I/C', 'D/S/C', 'I/D/S', 'I/D/C', 'I/S/C', 'S/D/I', 'S/D/C', 'S/I/C', 'C/D/I', 'C/D/S', 'C/I/S',
    'D/I/S/C'
  ];

  const toggleRowExpansion = (evaluationId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(evaluationId)) {
        newSet.delete(evaluationId);
      } else {
        newSet.add(evaluationId);
      }
      return newSet;
    });
  };

  const getCriteriaName = (criteriaId: string): string => {
    const criterion = criteriaList.find(c => c.id === criteriaId || c.name === criteriaId);
    return criterion?.name || criteriaId;
  };

  // Processar dados para gráficos (formatação sem deslocamento de timezone)
  const chartData = useMemo(() => {
    return evaluations.map(ev => ({
      month: formatDateOnlyPtBR(ev.date, { month: 'short', year: 'numeric' }),
      monthYear: formatDateOnlyPtBR(ev.date, { month: 'long', year: 'numeric' }),
      score: ev.average || ev.score || 0,
      date: ev.date
    })).reverse(); // Mais antigo primeiro para o gráfico
  }, [evaluations]);

  // Métricas resumidas
  const metrics = useMemo(() => {
    if (evaluations.length === 0) {
      return {
        totalEvaluations: 0,
        averageScore: 0,
        bestScore: 0,
        worstScore: 0,
        lastScore: 0,
        trend: 'stable' as 'up' | 'down' | 'stable'
      };
    }

    const scores = evaluations.map(e => e.average || e.score || 0);
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    const best = Math.max(...scores);
    const worst = Math.min(...scores);
    const last = scores[0] || 0;
    const previous = scores[1] || last;
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (last > previous) trend = 'up';
    else if (last < previous) trend = 'down';

    return {
      totalEvaluations: evaluations.length,
      averageScore: average,
      bestScore: best,
      worstScore: worst,
      lastScore: last,
      trend
    };
  }, [evaluations]);

  // Tabela dinâmica ordenável
  const sortedTableData = useMemo(() => {
    let sorted = [...evaluations];
    
    if (tableSort.field) {
      sorted.sort((a, b) => {
        let aVal: any, bVal: any;
        
        switch (tableSort.field) {
          case 'date':
            aVal = getDateOnlyTimestamp(a.date);
            bVal = getDateOnlyTimestamp(b.date);
            break;
          case 'score':
            aVal = a.average || a.score || 0;
            bVal = b.average || b.score || 0;
            break;
          case 'type':
            aVal = a.type || '';
            bVal = b.type || '';
            break;
          default:
            return 0;
        }
        
        if (tableSort.direction === 'asc') {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
          return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
      });
    }
    
    return sorted;
  }, [evaluations, tableSort]);

  const handleTableSort = (field: string) => {
    setTableSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando dados do colaborador...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Colaborador não encontrado</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Cabeçalho */}
      <div className="bg-white dark:bg-navy-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-navy-700">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div className="relative group">
            {employee.photoUrl ? (
              <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-gray-200 dark:border-navy-700 shadow-lg">
                <img 
                  src={employee.photoUrl} 
                  alt={employee.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-4 border-gray-200 dark:border-navy-700 shadow-lg">
                <span className="text-3xl font-bold text-white">
                  {getInitials(employee.name)}
                </span>
              </div>
            )}
            <button
              onClick={() => setShowPhotoUpload(true)}
              className="absolute bottom-0 right-0 w-7 h-7 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors opacity-0 group-hover:opacity-100"
              title="Alterar foto"
            >
              <Edit size={14} />
            </button>
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{employee.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Perfil e histórico de avaliações</p>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-navy-700">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'dashboard'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => {
              setActiveTab('edit');
              setIsEditing(true);
            }}
            className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'edit'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Edit size={16} />
            Editar Cadastro
          </button>
        </div>
      </div>

      {/* Modal de Upload de Foto */}
      {showPhotoUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowPhotoUpload(false)}>
          <div className="bg-white dark:bg-navy-800 p-6 rounded-xl shadow-lg max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">Alterar Foto</h3>
              <button
                onClick={() => setShowPhotoUpload(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-navy-700 rounded transition-colors"
              >
                <X size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <label className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-gray-300 dark:border-navy-700 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-colors">
                <ImageIcon size={48} className="text-gray-400 dark:text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {uploadingPhoto ? 'Enviando...' : 'Clique para escolher uma foto'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  JPG, PNG ou WEBP (máx. 5MB)
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handlePhotoUpload(file);
                    }
                  }}
                  disabled={uploadingPhoto}
                />
              </label>
              {uploadingPhoto && (
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Processando e enviando foto...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo das Abas */}
      {activeTab === 'dashboard' ? (
        <>

        {/* Dados do Cadastro */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Briefcase size={18} />
            <span className="text-sm">{employee.sector || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Award size={18} />
            <span className="text-sm">{employee.role || 'N/A'}</span>
          </div>
          {employee.admissionDate && (
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Calendar size={18} />
              <span className="text-sm">
                {new Date(employee.admissionDate).toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}
          {employee.status && (
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded ${
                employee.status === 'Ativo' 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}>
                {employee.status}
              </span>
            </div>
          )}
        </div>

      {/* Scorecards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card 
          title="Total de Avaliações" 
          value={metrics.totalEvaluations} 
          icon={TrendingUp}
          className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20"
        />
        <Card 
          title="Média Geral" 
          value={metrics.averageScore.toFixed(1)} 
          icon={BarChart3}
          className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20"
        />
        <Card 
          title="Melhor Nota" 
          value={metrics.bestScore.toFixed(1)} 
          icon={TrendingUp}
          className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20"
        />
        <Card 
          title="Última Nota" 
          value={metrics.lastScore.toFixed(1)} 
          icon={BarChart3}
          className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20"
        />
        {employee.discProfile && (
          <Card 
            title="Perfil DISC" 
            value={employee.discProfile} 
            icon={User}
            className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20"
          />
        )}
      </div>

      {/* Seção de Perfil DISC Detalhado */}
      {employee.discProfile && (
        <div className="bg-white dark:bg-navy-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-navy-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Perfil Comportamental DISC</h2>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-3xl font-bold text-white">{employee.discProfile}</span>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">
                O perfil DISC ajuda a entender o estilo comportamental e de comunicação do colaborador.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Perfil: <span className="font-semibold">{employee.discProfile}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Evolução Mês a Mês */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-navy-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-navy-700">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Evolução Mês a Mês</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="month" 
                stroke="#6b7280"
                tick={{ fill: '#6b7280' }}
              />
              <YAxis 
                domain={[0, 10]}
                stroke="#6b7280"
                tick={{ fill: '#6b7280' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="score" 
                stroke="#3B82F6" 
                fillOpacity={1} 
                fill="url(#colorScore)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela Dinâmica */}
      {evaluations.length > 0 && (
        <div className="bg-white dark:bg-navy-800 rounded-xl shadow-sm border border-gray-200 dark:border-navy-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-navy-700">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Métricas Detalhadas</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Clique nos cabeçalhos para ordenar
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-navy-900">
                <tr>
                  <th className="p-4 text-left">
                    <button
                      onClick={() => handleTableSort('date')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      Mês de Referência
                      {tableSort.field === 'date' ? (
                        tableSort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : <ArrowUpDown size={14} className="opacity-30" />}
                    </button>
                  </th>
                  <th className="p-4 text-left">
                    <button
                      onClick={() => handleTableSort('type')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      Nível
                      {tableSort.field === 'type' ? (
                        tableSort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : <ArrowUpDown size={14} className="opacity-30" />}
                    </button>
                  </th>
                  <th className="p-4 text-left">Métricas</th>
                  <th className="p-4 text-center">Ações</th>
                  <th className="p-4 text-right">
                    <button
                      onClick={() => handleTableSort('score')}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ml-auto"
                    >
                      Nota Média
                      {tableSort.field === 'score' ? (
                        tableSort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : <ArrowUpDown size={14} className="opacity-30" />}
                    </button>
                  </th>
                  {evaluations.some(e => e.isHighlighted) && (
                    <th className="p-4 text-center">Destaque</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sortedTableData.map((evaluation) => {
                  const monthYear = formatDateOnlyPtBR(evaluation.date, { month: 'long', year: 'numeric' });
                  const score = evaluation.average || evaluation.score || 0;
                  const metricsCount = Object.keys(evaluation.details || {}).length;
                  const displayLevel = employee?.jobLevel || evaluation.type;
                  
                  return (
                    <React.Fragment key={evaluation.id}>
                      <tr className="hover:bg-gray-50 dark:hover:bg-navy-700/50 transition-colors">
                        <td className="p-4 text-gray-700 dark:text-gray-300 capitalize">{monthYear}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            displayLevel === 'Estratégico' 
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                              : displayLevel === 'Tático'
                              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          }`}>
                            {displayLevel}
                          </span>
                        </td>
                        <td className="p-4 text-gray-600 dark:text-gray-400">
                          {metricsCount} métrica{metricsCount !== 1 ? 's' : ''}
                        </td>
                        <td className="p-4 text-center">
                          {metricsCount > 0 && (
                            <button
                              onClick={() => toggleRowExpansion(evaluation.id)}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-navy-700 rounded transition-colors"
                              title={expandedRows.has(evaluation.id) ? 'Ocultar métricas' : 'Mostrar métricas'}
                            >
                              {expandedRows.has(evaluation.id) ? (
                                <ChevronUp size={16} className="text-gray-600 dark:text-gray-400" />
                              ) : (
                                <ChevronDown size={16} className="text-gray-600 dark:text-gray-400" />
                              )}
                            </button>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <span className={`font-bold px-3 py-1 rounded-full ${
                            score >= 8 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                              : score >= 6
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          }`}>
                            {score.toFixed(2)}
                          </span>
                        </td>
                        {evaluations.some(e => e.isHighlighted) && (
                          <td className="p-4 text-center">
                            {evaluation.isHighlighted && (
                              <span className="text-yellow-500" title={evaluation.highlightReason || 'Destaque'}>
                                ⭐
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                      {/* Linha expandida com métricas detalhadas em formato de tabela */}
                      {expandedRows.has(evaluation.id) && evaluation.details && (
                        <tr className="bg-gray-50 dark:bg-navy-900/50">
                          <td colSpan={evaluations.some(e => e.isHighlighted) ? 6 : 5} className="p-4">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-100 dark:bg-navy-800">
                                  <tr>
                                    <th className="p-3 text-left text-gray-700 dark:text-gray-300 font-semibold">Métrica</th>
                                    <th className="p-3 text-right text-gray-700 dark:text-gray-300 font-semibold">Nota</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-navy-700">
                                  {Object.entries(evaluation.details).map(([criteriaId, score]) => {
                                    const criteriaName = getCriteriaName(criteriaId);
                                    const scoreNum = typeof score === 'number' ? score : parseFloat(String(score)) || 0;
                                    const colorInfo = scoreNum >= 8 
                                      ? { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' }
                                      : scoreNum >= 6
                                      ? { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' }
                                      : { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' };
                                    
                                    return (
                                      <tr key={criteriaId} className="hover:bg-gray-100 dark:hover:bg-navy-800/50">
                                        <td className="p-3 text-gray-700 dark:text-gray-300 font-medium">{criteriaName}</td>
                                        <td className="p-3 text-right">
                                          <span className={`inline-block px-3 py-1 rounded-full font-bold ${colorInfo.bg} ${colorInfo.text}`}>
                                            {scoreNum.toFixed(1)}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {evaluations.length === 0 && (
        <div className="bg-white dark:bg-navy-800 p-10 rounded-xl shadow-sm border border-gray-200 dark:border-navy-700 text-center">
          <p className="text-gray-500 dark:text-gray-400">Nenhuma avaliação encontrada para este colaborador.</p>
        </div>
      )}

      {/* Histórico de Alterações */}
      <div className="bg-white dark:bg-navy-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-navy-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Histórico de Alterações</h2>
          <button
            onClick={() => {
              if (!showAuditLogs) {
                loadAuditLogs();
              }
              setShowAuditLogs(!showAuditLogs);
            }}
            className="px-4 py-2 bg-gray-100 dark:bg-navy-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-navy-600 transition-colors flex items-center gap-2"
          >
            {showAuditLogs ? (
              <>
                <ChevronUp size={16} />
                Ocultar Histórico
              </>
            ) : (
              <>
                <ChevronDown size={16} />
                Ver Histórico
              </>
            )}
          </button>
        </div>
        
        {showAuditLogs && (
          <div className="mt-4">
            {loadingAuditLogs ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-500 dark:text-gray-400">Carregando histórico...</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>Nenhuma alteração registrada para este colaborador.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {auditLogs.map((log) => {
                  const date = new Date(log.timestamp);
                  const actionLabels: Record<string, string> = {
                    'create': 'Criado',
                    'update': 'Atualizado',
                    'delete': 'Excluído',
                    'view': 'Visualizado',
                    'export': 'Exportado',
                    'import': 'Importado'
                  };
                  
                  return (
                    <div 
                      key={log.id} 
                      className="p-4 bg-gray-50 dark:bg-navy-900/50 rounded-lg border border-gray-200 dark:border-navy-700"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              log.action === 'create' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                              log.action === 'update' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                              log.action === 'delete' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                              'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                            }`}>
                              {actionLabels[log.action] || log.action}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              por {log.userName || log.userEmail}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {date.toLocaleDateString('pt-BR', { 
                              day: '2-digit', 
                              month: 'long', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      
                      {log.changes && Object.keys(log.changes).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-navy-700">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Alterações:</p>
                          <div className="space-y-1">
                            {Object.entries(log.changes).map(([field, change]) => {
                              const changeData = change as { old?: any; new?: any };
                              return (
                                <div key={field} className="text-xs text-gray-600 dark:text-gray-400">
                                  <span className="font-medium capitalize">{field}:</span>{' '}
                                  <span className="line-through text-red-500">{changeData.old !== undefined ? String(changeData.old) : 'N/A'}</span>
                                  {' → '}
                                  <span className="text-green-600 dark:text-green-400">{changeData.new !== undefined ? String(changeData.new) : 'N/A'}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
        </>
      ) : (
        /* Formulário de Edição */
        <div className="bg-white dark:bg-navy-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Editar Cadastro do Colaborador</h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setActiveTab('dashboard');
                }}
                className="px-4 py-2 border border-gray-300 dark:border-navy-700 rounded-lg hover:bg-gray-50 dark:hover:bg-navy-700 transition-colors flex items-center gap-2"
              >
                <X size={16} />
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Nome Completo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome Completo *
              </label>
              <input
                type="text"
                value={editForm.name || ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full p-2 rounded-lg border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-gray-800 dark:text-gray-200"
                required
              />
            </div>

            {/* ID Funcionário */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ID Funcionário
              </label>
              <input
                type="text"
                value={editForm.employeeCode || ''}
                onChange={(e) => setEditForm({ ...editForm, employeeCode: e.target.value })}
                className="w-full p-2 rounded-lg border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-gray-800 dark:text-gray-200"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Corporativo
              </label>
              <input
                type="email"
                value={editForm.email || ''}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full p-2 rounded-lg border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-gray-800 dark:text-gray-200"
              />
            </div>

            {/* Setor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Setor
              </label>
              <select
                value={editForm.sector || ''}
                onChange={(e) => setEditForm({ ...editForm, sector: e.target.value })}
                className="w-full p-2 rounded-lg border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-gray-800 dark:text-gray-200"
              >
                <option value="">Selecione...</option>
                {sectors.map((sector) => (
                  <option key={sector.id} value={sector.name}>
                    {sector.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Cargo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cargo
              </label>
              <select
                value={editForm.role || ''}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                className="w-full p-2 rounded-lg border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-gray-800 dark:text-gray-200"
              >
                <option value="">Selecione...</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.name}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={editForm.status || ''}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full p-2 rounded-lg border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-gray-800 dark:text-gray-200"
              >
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
                <option value="Férias">Férias</option>
                <option value="Afastado">Afastado</option>
              </select>
            </div>

            {/* Data de Admissão */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Data de Admissão
              </label>
              <input
                type="date"
                value={editForm.admissionDate ? (typeof editForm.admissionDate === 'string' ? editForm.admissionDate.split('T')[0] : new Date(editForm.admissionDate).toISOString().split('T')[0]) : ''}
                onChange={(e) => setEditForm({ ...editForm, admissionDate: e.target.value })}
                className="w-full p-2 rounded-lg border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-gray-800 dark:text-gray-200"
              />
            </div>

            {/* Data de Desligamento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Data de Desligamento
              </label>
              <input
                type="date"
                value={editForm.terminationDate ? (typeof editForm.terminationDate === 'string' ? editForm.terminationDate.split('T')[0] : new Date(editForm.terminationDate).toISOString().split('T')[0]) : ''}
                onChange={(e) => setEditForm({ ...editForm, terminationDate: e.target.value })}
                className="w-full p-2 rounded-lg border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-gray-800 dark:text-gray-200"
              />
            </div>

            {/* Tipo de Vínculo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tipo de Vínculo
              </label>
              <select
                value={editForm.contractType || ''}
                onChange={(e) => setEditForm({ ...editForm, contractType: e.target.value })}
                className="w-full p-2 rounded-lg border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-gray-800 dark:text-gray-200"
              >
                <option value="">Selecione...</option>
                <option value="CLT">CLT</option>
                <option value="PJ">PJ</option>
                <option value="Estagiário">Estagiário</option>
                <option value="Trainee">Trainee</option>
                <option value="Temporário">Temporário</option>
              </select>
            </div>

            {/* Telefone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Telefone
              </label>
              <input
                type="tel"
                value={editForm.phone || ''}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full p-2 rounded-lg border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-gray-800 dark:text-gray-200"
              />
            </div>

            {/* Gestor Imediato */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Gestor Imediato
              </label>
              <input
                type="text"
                value={editForm.managerName || ''}
                onChange={(e) => setEditForm({ ...editForm, managerName: e.target.value })}
                className="w-full p-2 rounded-lg border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-gray-800 dark:text-gray-200"
              />
            </div>

            {/* Perfil DISC */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Perfil DISC
              </label>
              <select
                value={editForm.discProfile || ''}
                onChange={(e) => setEditForm({ ...editForm, discProfile: e.target.value })}
                className="w-full p-2 rounded-lg border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-gray-800 dark:text-gray-200"
              >
                <option value="">Selecione...</option>
                {DISC_OPTIONS.map((disc) => (
                  <option key={disc} value={disc}>
                    {disc}
                  </option>
                ))}
              </select>
            </div>

            {/* Upload de Foto */}
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Foto do Colaborador
              </label>
              <div className="space-y-3">
                {/* Botão de Upload */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors">
                    <Upload size={16} />
                    {uploadingPhoto ? 'Enviando...' : 'Escolher Foto'}
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handlePhotoUpload(file);
                        }
                      }}
                      disabled={uploadingPhoto}
                    />
                  </label>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    JPG, PNG ou WEBP (máx. 5MB)
                  </span>
                </div>

                {/* Preview da Foto Atual */}
                {editForm.photoUrl && (
                  <div className="relative inline-block">
                    <img 
                      src={editForm.photoUrl} 
                      alt="Preview" 
                      className="w-32 h-32 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-700"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <button
                      onClick={() => {
                        setEditForm({ ...editForm, photoUrl: '' });
                      }}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs"
                      title="Remover foto"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* Campo de URL (alternativa) */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Ou cole uma URL da foto:
                  </label>
                  <input
                    type="url"
                    value={editForm.photoUrl || ''}
                    onChange={(e) => setEditForm({ ...editForm, photoUrl: e.target.value })}
                    className="w-full p-2 rounded-lg border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-gray-800 dark:text-gray-200 text-sm"
                    placeholder="https://exemplo.com/foto.jpg"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Histórico de Alterações */}
      <div className="bg-white dark:bg-navy-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-navy-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">Histórico de Alterações</h2>
          <button
            onClick={() => {
              if (!showAuditLogs) {
                loadAuditLogs();
              }
              setShowAuditLogs(!showAuditLogs);
            }}
            className="px-4 py-2 bg-gray-100 dark:bg-navy-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-navy-600 transition-colors flex items-center gap-2"
          >
            {showAuditLogs ? (
              <>
                <ChevronUp size={16} />
                Ocultar Histórico
              </>
            ) : (
              <>
                <ChevronDown size={16} />
                Ver Histórico
              </>
            )}
          </button>
        </div>
        
        {showAuditLogs && (
          <div className="mt-4">
            {loadingAuditLogs ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-500 dark:text-gray-400">Carregando histórico...</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>Nenhuma alteração registrada para este colaborador.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {auditLogs.map((log) => {
                  const date = new Date(log.timestamp);
                  const actionLabels: Record<string, string> = {
                    'create': 'Criado',
                    'update': 'Atualizado',
                    'delete': 'Excluído',
                    'view': 'Visualizado',
                    'export': 'Exportado',
                    'import': 'Importado'
                  };
                  
                  return (
                    <div 
                      key={log.id} 
                      className="p-4 bg-gray-50 dark:bg-navy-900/50 rounded-lg border border-gray-200 dark:border-navy-700"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              log.action === 'create' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                              log.action === 'update' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                              log.action === 'delete' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                              'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                            }`}>
                              {actionLabels[log.action] || log.action}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              por {log.userName || log.userEmail}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {date.toLocaleDateString('pt-BR', { 
                              day: '2-digit', 
                              month: 'long', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                      
                      {log.changes && Object.keys(log.changes).length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-navy-700">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Alterações:</p>
                          <div className="space-y-1">
                            {Object.entries(log.changes).map(([field, change]) => {
                              const changeData = change as { old?: any; new?: any };
                              return (
                                <div key={field} className="text-xs text-gray-600 dark:text-gray-400">
                                  <span className="font-medium capitalize">{field}:</span>{' '}
                                  <span className="line-through text-red-500">{changeData.old !== undefined ? String(changeData.old) : 'N/A'}</span>
                                  {' → '}
                                  <span className="text-green-600 dark:text-green-400">{changeData.new !== undefined ? String(changeData.new) : 'N/A'}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
