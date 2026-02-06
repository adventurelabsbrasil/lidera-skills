import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../services/firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import { Database, Plus, Search, Edit, Trash, Save, Loader2, Filter, ArrowUp, ArrowDown, ArrowUpDown, Tag as TagIcon, X, CheckSquare, Square, ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useCompany } from '../../contexts/CompanyContext';
import { toast } from '../../utils/toast';
import { ErrorHandler } from '../../utils/errorHandler';
import { usePagination } from '../../hooks/usePagination';
import { fetchCollectionPaginated } from '../../services/firebase';
import { formatShortName } from '../../utils/nameFormatter';
import { useAuditLogger } from '../../utils/auditLogger';
import { useAuth } from '../../contexts/AuthContext';

interface ColumnConfig {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'email' | 'select' | 'multi-select-companies' | 'image';
  options?: string[]; 
  linkedCollection?: string; 
  linkedField?: string;
  hiddenInTable?: boolean;
}

export const GenericDatabaseView = ({ collectionName, title, columns, modalColumnOrder }: { collectionName: string, title: string, columns: ColumnConfig[], modalColumnOrder?: string[] }) => {
  const { currentCompany, companies } = useCompany();
  const { user } = useAuth();
  const { logAction } = useAuditLogger();
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado para Ordenação e Filtros
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  
  // Seleção em Massa
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Paginação tradicional
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<any>({});
  const [linkedOptions, setLinkedOptions] = useState<Record<string, string[]>>({});
  const [openLinkedSelect, setOpenLinkedSelect] = useState<string | null>(null);
  const [linkedSelectSearch, setLinkedSelectSearch] = useState<Record<string, string>>({});

  // Lógica de coleções universais
  const isUniversalCollection = 
    collectionName === 'sectors' || 
    collectionName === 'roles' || 
    collectionName === 'companies' ||
    collectionName === 'evaluation_criteria';

  // Hook de paginação (para carregar todos os dados)
  const pagination = usePagination({ pageSize: 100, initialLoad: 100 });
  const observerTarget = useRef<HTMLDivElement>(null);

  // Função para buscar dados paginados
  const fetchPaginatedData = useCallback(async () => {
    if (!currentCompany && !isUniversalCollection) {
      pagination.reset();
      return;
    }

    const companyId = isUniversalCollection ? null : (currentCompany?.id === 'all' ? null : currentCompany?.id);
    
    await pagination.loadMore(async (lastDoc, limit) => {
      return await fetchCollectionPaginated(collectionName, companyId || undefined, lastDoc, limit);
    });
  }, [collectionName, currentCompany, isUniversalCollection, pagination]);

  // Reset e recarregar quando mudar empresa ou coleção
  useEffect(() => {
    pagination.reset();
    setCurrentPage(1); // Reset para primeira página
    fetchPaginatedData();
  }, [collectionName, currentCompany?.id]);

  // Carregar mais dados quando necessário (scroll infinito para carregar todos os dados em background)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && pagination.hasMore && !pagination.loading) {
          fetchPaginatedData();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [pagination.hasMore, pagination.loading, fetchPaginatedData]);

  // Fechar dropdown de linked select ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-linked-select]')) {
        setOpenLinkedSelect(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Carregar dados vinculados (opções para selects)
  useEffect(() => {
    const loadLinkedData = async () => {
      const newLinkedOptions: Record<string, string[]> = {};
      for (const col of columns) {
        if (col.linkedCollection) {
          try {
            const q = collection(db, col.linkedCollection);
            const snap = await getDocs(q);
            const field = col.linkedField || 'name';
            const opts = snap.docs.map(d => d.data()[field]).filter(Boolean);
            newLinkedOptions[col.key] = [...new Set(opts)].sort((a, b) => String(a).localeCompare(String(b)));
          } catch (error) {
            console.error(`Erro ao carregar dados vinculados de ${col.linkedCollection}:`, error);
          }
        }
      }
      setLinkedOptions(newLinkedOptions);
    };
    loadLinkedData();
  }, [columns]);

  const handleSave = async () => {
    if (!isUniversalCollection && (!currentCompany || currentCompany.id === 'all')) {
      if (!currentItem.companyId) {
         toast.warning("Por favor, selecione a empresa vinculada a este registro.");
         return;
      }
    }
    
    try {
      let itemToSave: any = { ...currentItem };
      delete itemToSave.id;

      if (!isUniversalCollection && !itemToSave.companyId && currentCompany && currentCompany.id !== 'all') {
         itemToSave.companyId = currentCompany.id;
      }

      // Verificação de duplicatas para setores, cargos e critérios (apenas ao criar, não ao editar)
      if (!currentItem.id && (collectionName === 'sectors' || collectionName === 'roles' || collectionName === 'evaluation_criteria')) {
        const nameField = 'name';
        const nameValue = itemToSave[nameField];
        
        if (nameValue) {
          // Busca por nome (e tipo para critérios)
          let duplicateQuery;
          if (collectionName === 'evaluation_criteria') {
            // Para critérios, verifica nome + tipo
            duplicateQuery = query(
              collection(db, collectionName),
              where('name', '==', nameValue),
              where('type', '==', itemToSave.type || 'Geral')
            );
          } else {
            // Para setores e cargos, verifica apenas nome
            duplicateQuery = query(
              collection(db, collectionName),
              where('name', '==', nameValue)
            );
          }
          
          const duplicateSnap = await getDocs(duplicateQuery);
          
          if (!duplicateSnap.empty) {
            const duplicate = duplicateSnap.docs[0].data();
            const duplicateId = duplicateSnap.docs[0].id;
            
            // Duplicata encontrada - oferece editar o existente
            const confirmEdit = window.confirm(
              `Já existe um ${collectionName === 'sectors' ? 'setor' : collectionName === 'roles' ? 'cargo' : 'critério'} com o nome "${nameValue}". Deseja editar o registro existente?`
            );
            
            if (confirmEdit) {
              setCurrentItem({ ...duplicate, id: duplicateId });
              setIsModalOpen(true);
              return;
            } else {
              return; // Cancela a criação
            }
          }
        }
      }

      if (currentItem.id) {
        // Capturar mudanças para o audit log (apenas para employees)
        let changes: Record<string, { old?: any; new?: any }> = {};
        if (collectionName === 'employees' && user) {
          // Buscar dados antigos da lista atual para comparar
          const oldData = pagination.items.find((item: any) => item.id === currentItem.id);
          if (oldData) {
            Object.keys(itemToSave).forEach(key => {
              if (oldData[key] !== itemToSave[key]) {
                changes[key] = {
                  old: oldData[key],
                  new: itemToSave[key]
                };
              }
            });
          }
        }
        
        await updateDoc(doc(db, collectionName, currentItem.id), itemToSave);
        
        // Log de auditoria para employees
        if (collectionName === 'employees' && user && Object.keys(changes).length > 0) {
          await logAction('update', 'employee', currentItem.id, {
            entityName: itemToSave.name || 'Funcionário',
            changes
          });
        }
        
        toast.success("Registro atualizado com sucesso!");
      } else {
        const docRef = await addDoc(collection(db, collectionName), itemToSave);
        
        // Log de auditoria para employees
        if (collectionName === 'employees' && user) {
          await logAction('create', 'employee', docRef.id, {
            entityName: itemToSave.name || 'Funcionário'
          });
        }
        
        toast.success("Registro criado com sucesso!");
      }
      setIsModalOpen(false);
      setCurrentItem({});
      // Adiciona o novo item ao início da lista ou atualiza se já existe
      if (currentItem.id) {
        pagination.updateItem(currentItem.id, itemToSave);
      } else {
        pagination.prependItem({ id: 'temp-' + Date.now(), ...itemToSave });
        // Recarrega para obter o ID real do Firestore
        setTimeout(() => {
          pagination.reset();
          fetchPaginatedData();
        }, 500);
      }
    } catch (error) {
      ErrorHandler.handleFirebaseError(error);
      toast.handleError(error, 'GenericDatabaseView.handleSave');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este registro?")) return;
    try {
      // Buscar dados antes de excluir para o audit log
      let entityName = 'Registro';
      if (collectionName === 'employees' && user) {
        const itemToDelete = pagination.items.find((item: any) => item.id === id);
        if (itemToDelete) {
          entityName = itemToDelete.name || 'Funcionário';
        }
      }
      
      await deleteDoc(doc(db, collectionName, id));
      
      // Log de auditoria para employees
      if (collectionName === 'employees' && user) {
        await logAction('delete', 'employee', id, {
          entityName
        });
      }
      
      toast.success("Registro excluído com sucesso!");
      pagination.removeItem(id);
    } catch (error) {
      toast.handleError(error, 'GenericDatabaseView.handleDelete');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Tem certeza que deseja excluir ${selectedIds.size} registros selecionados?`)) return;

    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const ref = doc(db, collectionName, id);
        batch.delete(ref);
      });
      await batch.commit();
      toast.success(`${selectedIds.size} registro(s) excluído(s) com sucesso!`);
      // Remove itens da lista
      selectedIds.forEach(id => pagination.removeItem(id));
      setSelectedIds(new Set());
    } catch (error) {
      toast.handleError(error, 'GenericDatabaseView.handleBulkDelete');
    }
  };

  const handleSelectAll = () => {
    // Seleciona/deseleciona apenas os itens da página atual
    const pageIds = new Set(paginatedData.map(d => d.id));
    const allPageSelected = paginatedData.every(d => selectedIds.has(d.id));
    
    if (allPageSelected) {
      // Desmarca todos da página atual
      const newSet = new Set(selectedIds);
      pageIds.forEach(id => newSet.delete(id));
      setSelectedIds(newSet);
    } else {
      // Marca todos da página atual
      const newSet = new Set(selectedIds);
      pageIds.forEach(id => newSet.add(id));
      setSelectedIds(newSet);
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const columnOptions = useMemo(() => {
    const options: Record<string, string[]> = {};
    columns.forEach(col => {
      if (col.hiddenInTable) return;
      const values = Array.from(new Set(pagination.items.map(item => item[col.key]).filter(val => val !== undefined && val !== ''))).sort();
      options[col.key] = values as string[];
    });
    return options;
  }, [pagination.items, columns]);

  const filteredData = useMemo(() => {
    let processed = pagination.items.filter(item => {
      const matchesSearch = Object.values(item).some(val => 
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      );
      const matchesFilters = Object.entries(activeFilters).every(([key, filterVal]) => {
        if (!filterVal) return true;
        return String(item[key]) === filterVal;
      });
      return matchesSearch && matchesFilters;
    });

    if (!sortConfig && collectionName === 'employees') {
      processed.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    } else if (sortConfig) {
      processed.sort((a, b) => {
        const valA = a[sortConfig.key] ? String(a[sortConfig.key]).toLowerCase() : '';
        const valB = b[sortConfig.key] ? String(b[sortConfig.key]).toLowerCase() : '';
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return processed;
  }, [pagination.items, searchTerm, activeFilters, sortConfig, collectionName]);

  // Dados paginados para exibição
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, itemsPerPage]);

  // Cálculo de páginas
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startItem = filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, filteredData.length);

  // Reset para primeira página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeFilters, sortConfig]);

  // Ordenar colunas no modal conforme modalColumnOrder (para funcionários: empresa, id, status, nome, email, nível, setor, cargo, etc.)
  const modalColumns = useMemo(() => {
    if (!modalColumnOrder || modalColumnOrder.length === 0) return columns;
    const orderMap = new Map(modalColumnOrder.map((k, i) => [k, i]));
    return [...columns].sort((a, b) => {
      const idxA = orderMap.has(a.key) ? orderMap.get(a.key)! : 9999;
      const idxB = orderMap.has(b.key) ? orderMap.get(b.key)! : 9999;
      return idxA - idxB;
    });
  }, [columns, modalColumnOrder]);

  const renderInput = (col: ColumnConfig) => {
    const value = currentItem[col.key] || '';
    
    // Multi-Select para Empresas
    if (col.type === 'multi-select-companies') {
        const selectedCompanyIds: string[] = currentItem[col.key] || [];
        return (
            <div className="border rounded dark:border-gray-700 p-2 max-h-40 overflow-y-auto bg-gray-50 dark:bg-black">
                {companies.map(comp => (
                    <label key={comp.id} className="flex items-center gap-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded cursor-pointer">
                        <input 
                            type="checkbox"
                            checked={selectedCompanyIds.includes(comp.id)}
                            onChange={(e) => {
                                let newIds;
                                if (e.target.checked) {
                                    newIds = [...selectedCompanyIds, comp.id];
                                } else {
                                    newIds = selectedCompanyIds.filter(id => id !== comp.id);
                                }
                                setCurrentItem({...currentItem, [col.key]: newIds});
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{comp.name}</span>
                    </label>
                ))}
            </div>
        );
    }

    if (col.type === 'select' || col.linkedCollection) {
      const optionsList = col.linkedCollection ? (linkedOptions[col.key] || []) : (col.options || []);
      const searchTerm = linkedSelectSearch[col.key] || '';
      const filteredOptions = col.linkedCollection
        ? optionsList.filter((opt: string) => String(opt).toLowerCase().includes(searchTerm.toLowerCase()))
        : optionsList;

      // Select pesquisável para linkedCollection (setor, cargo, etc.)
      if (col.linkedCollection) {
        const isOpen = openLinkedSelect === col.key;
        return (
          <div data-linked-select className="relative">
            <div className="relative">
              <input
                type="text"
                className="w-full p-2 pl-9 pr-8 rounded border bg-white dark:bg-lidera-dark dark:border-gray-700"
                placeholder="Buscar ou selecione..."
                value={isOpen ? searchTerm : (value || '')}
                onChange={(e) => setLinkedSelectSearch({ ...linkedSelectSearch, [col.key]: e.target.value })}
                onFocus={() => setOpenLinkedSelect(col.key)}
                readOnly={!isOpen}
              />
              <Search className="absolute left-2.5 top-2.5 text-gray-400" size={16} />
              <button
                type="button"
                onClick={() => setOpenLinkedSelect(isOpen ? null : col.key)}
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
              >
                {isOpen ? <X size={14} /> : <span className="text-xs">▼</span>}
              </button>
            </div>
            {isOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-[#1E1E1E] border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentItem({ ...currentItem, [col.key]: '' });
                    setLinkedSelectSearch({ ...linkedSelectSearch, [col.key]: '' });
                    setOpenLinkedSelect(null);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                >
                  Selecione...
                </button>
                {filteredOptions.map((opt: string, idx: number) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setCurrentItem({ ...currentItem, [col.key]: opt });
                      setLinkedSelectSearch({ ...linkedSelectSearch, [col.key]: '' });
                      setOpenLinkedSelect(null);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${value === opt ? 'bg-blue-50 dark:bg-blue-900/20 font-medium' : ''}`}
                  >
                    {opt}
                  </button>
                ))}
                {filteredOptions.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-500">Nenhum resultado</div>
                )}
              </div>
            )}
          </div>
        );
      }

      // Select nativo para options fixos
      return (
        <select
          className="w-full p-2 rounded border bg-white dark:bg-lidera-dark dark:border-gray-700"
          value={value}
          onChange={(e) => setCurrentItem({...currentItem, [col.key]: e.target.value})}
        >
          <option value="">Selecione...</option>
          {optionsList.map((opt, idx) => (
            <option key={idx} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    if (col.type === 'image') {
      return (
        <div className="space-y-2">
          <input 
            type="url"
            className="w-full p-2 rounded border bg-white dark:bg-lidera-dark dark:border-gray-700"
            placeholder="https://exemplo.com/foto.jpg"
            value={value}
            onChange={(e) => setCurrentItem({...currentItem, [col.key]: e.target.value})}
          />
          {value && (
            <div className="mt-2">
              <img 
                src={value} 
                alt="Preview" 
                className="w-24 h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
      );
    }

    return (
      <input 
        type={col.type || "text"}
        className="w-full p-2 rounded border bg-white dark:bg-lidera-dark dark:border-gray-700"
        value={value}
        onChange={(e) => setCurrentItem({...currentItem, [col.key]: e.target.value})}
      />
    );
  };

  return (
    <> 
      <div className="space-y-6 animate-fadeIn">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-[#1E1E1E] p-6 rounded-lg shadow-sm border border-gray-200 dark:border-[#121212]">
          <div className="flex items-center gap-4">
             <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Database size={24} className="text-blue-600" /> {title}
             </h2>
             {selectedIds.size > 0 && (
                <button onClick={handleBulkDelete} className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold hover:bg-red-200 transition-colors flex items-center gap-1">
                   <Trash size={12}/> Excluir ({selectedIds.size})
                </button>
             )}
          </div>
          <button onClick={() => { setCurrentItem({}); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow-md transition-all">
             <Plus size={16} /> Novo Registro
          </button>
        </div>

        <div className="bg-white dark:bg-[#1E1E1E] rounded-lg shadow-lg border border-gray-200 dark:border-[#121212] overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-4">
             <div className="relative w-full">
               <Search className="absolute left-3 top-3 text-gray-400" size={18} />
               <input 
                  type="text" 
                  placeholder="Buscar..." 
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-[#121212] border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 ring-blue-500/50 outline-none transition-all"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
               />
             </div>
             
             <div className="flex gap-2 w-full overflow-x-auto pb-2 scrollbar-thin">
               {columns.map(col => {
                  if (col.hiddenInTable) return null;
                   const options = columnOptions[col.key] || [];
                   if(options.length === 0 && !activeFilters[col.key]) return null;

                   return (
                     <div key={col.key} className="relative min-w-[140px]">
                        <Filter size={12} className="absolute left-2 top-3 text-gray-400" />
                        <select 
                           className={`w-full pl-6 pr-2 py-2 text-sm border rounded-lg outline-none cursor-pointer appearance-none transition-colors ${
                             activeFilters[col.key] 
                               ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300' 
                               : 'bg-gray-50 dark:bg-[#121212] dark:border-gray-700 dark:text-gray-300'
                           }`}
                           value={activeFilters[col.key] || ''}
                           onChange={(e) => setActiveFilters({...activeFilters, [col.key]: e.target.value})}
                        >
                           <option value="">{col.label}: Todos</option>
                           {options.map((opt, idx) => <option key={idx} value={opt}>{opt}</option>)}
                        </select>
                     </div>
                   );
                })}
                {(searchTerm || Object.values(activeFilters).some(Boolean)) && (
                   <button 
                     onClick={() => { setSearchTerm(''); setActiveFilters({}); }}
                     className="text-xs text-red-500 hover:text-red-700 whitespace-nowrap px-2 self-center font-medium"
                   >
                     Limpar Filtros
                   </button>
                )}
             </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-[#121212] text-gray-500 dark:text-gray-400 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4 w-10">
                    <button onClick={handleSelectAll} className="text-gray-400 hover:text-blue-500" title="Selecionar todos da página">
                       {paginatedData.length > 0 && paginatedData.every(d => selectedIds.has(d.id)) ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}
                    </button>
                  </th>
                  <th className="px-6 py-4 whitespace-nowrap w-24">ID</th>
                  {columns.filter(col => !col.hiddenInTable).map((col) => (
                    <th 
                      key={col.key} 
                      className="px-6 py-4 whitespace-nowrap cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group select-none"
                      onClick={() => handleSort(col.key)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{col.label}</span>
                        <span className="text-gray-400 flex items-center">
                          {sortConfig?.key === col.key ? (
                            sortConfig.direction === 'asc' ? (
                              <ArrowUp size={16} className="text-blue-600 dark:text-blue-400" />
                            ) : (
                              <ArrowDown size={16} className="text-blue-600 dark:text-blue-400" />
                            )
                          ) : (
                            <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-60 transition-opacity" />
                          )}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-[#1E1E1E]">
                {pagination.items.length === 0 && pagination.loading ? (
                  <tr><td colSpan={columns.length + 3} className="p-8 text-center text-gray-500"><Loader2 className="animate-spin inline mr-2"/> Carregando dados...</td></tr>
                ) : filteredData.length === 0 ? (
                  <tr><td colSpan={columns.length + 3} className="p-8 text-center text-gray-500">Nenhum registro encontrado.</td></tr>
                ) : paginatedData.map(item => (
                  <tr key={item.id} className={`hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group ${selectedIds.has(item.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                    
                    <td className="px-6 py-4">
                       <button onClick={() => toggleSelect(item.id)} className="text-gray-400 hover:text-blue-500">
                          {selectedIds.has(item.id) ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}
                       </button>
                    </td>

                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded select-all">
                        {item.id.slice(0, 5)}...
                      </span>
                    </td>

                    {columns.filter(col => !col.hiddenInTable).map((col) => (
                      <td key={col.key} className="px-6 py-4 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                         {col.type === 'multi-select-companies' ? (
                            <div className="flex flex-wrap gap-1">
                              {(item[col.key] || []).map((id: string) => {
                                const company = companies.find(c => c.id === id);
                                if (!company) return null;
                                return (
                                  <span 
                                    key={id} 
                                    className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200"
                                  >
                                    {company.name}
                                  </span>
                                );
                              })}
                              {(!item[col.key] || item[col.key].length === 0) && (
                                <span className="text-xs text-gray-400 italic">Todas</span>
                              )}
                            </div>
                         ) : col.key === 'status' ? (
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                               item[col.key] === 'Ativo' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 
                               item[col.key] === 'Inativo' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 
                               'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                               {item[col.key]}
                            </span>
                         ) : col.key === 'name' && collectionName === 'employees' && currentCompany ? (
                            <Link
                              to={`/employee/${currentCompany.id}/${item.id}`}
                              className="font-medium hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                            >
                              {formatShortName(item[col.key] || '-')}
                            </Link>
                         ) : (
                            <span className="font-medium">{item[col.key] || '-'}</span>
                         )}
                      </td>
                    ))}
                    <td className="px-6 py-4 flex justify-end gap-2">
                      <button onClick={() => { setCurrentItem(item); setIsModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded transition-colors"><Edit size={16} /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"><Trash size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Paginação tradicional */}
          {filteredData.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#121212] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Mostrando <span className="font-semibold text-gray-900 dark:text-white">{startItem}</span> a <span className="font-semibold text-gray-900 dark:text-white">{endItem}</span> de <span className="font-semibold text-gray-900 dark:text-white">{filteredData.length}</span> registros
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1E1E1E] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Página anterior"
                >
                  <ChevronLeft size={18} />
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`min-w-[36px] px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'bg-white dark:bg-[#1E1E1E] text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1E1E1E] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Próxima página"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
          
          {/* Indicador de carregamento em background (invisível) */}
          <div ref={observerTarget} className="h-1">
            {pagination.loading && pagination.hasMore && (
              <div className="text-xs text-gray-400 text-center py-2">
                <Loader2 className="animate-spin inline mr-1" size={12} />
                Carregando mais dados...
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentItem.id ? "Editar Registro" : "Novo Registro"}>
         <div className="space-y-4">
            {!isUniversalCollection && (
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wide">Vinculado à Empresa</label>
                    <select 
                        className="w-full p-2 bg-white dark:bg-black border rounded text-sm"
                        value={currentItem.companyId || (currentCompany?.id !== 'all' ? currentCompany?.id : '')}
                        onChange={e => setCurrentItem({...currentItem, companyId: e.target.value})}
                    >
                        <option value="">Selecione a empresa...</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {modalColumns.map((col) => (
                <div key={col.key} className={col.type === 'email' || col.type === 'multi-select-companies' || col.label.includes('Nome') ? 'md:col-span-2' : ''}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{col.label}</label>
                    {renderInput(col)}
                </div>
                ))}
            </div>
            
            {/* Sistema de Tags */}
            <div className="pt-4 border-t dark:border-gray-700 mt-4">
               <h4 className="font-bold mb-2 text-sm text-gray-500 flex items-center gap-2">
                 <TagIcon size={14}/> Tags / Categorias
               </h4>
               
               <div className="flex gap-2 mb-3">
                  <input 
                    id="newTagInput" 
                    placeholder="Adicionar tag (ex: Proativo, SQL, Inglês)..." 
                    className="flex-1 p-2 border rounded dark:bg-[#121212] dark:border-gray-700 text-sm outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = e.currentTarget.value.trim();
                        if (val) {
                          const currentTags = currentItem.tags || [];
                          if (!currentTags.includes(val)) {
                            setCurrentItem({...currentItem, tags: [...currentTags, val]});
                          }
                          e.currentTarget.value = '';
                        }
                      }
                    }}
                  />
                  <button 
                    type="button" 
                    onClick={() => {
                        const input = document.getElementById('newTagInput') as HTMLInputElement;
                        const val = input.value.trim();
                        if (val) {
                          const currentTags = currentItem.tags || [];
                          if (!currentTags.includes(val)) {
                            setCurrentItem({...currentItem, tags: [...currentTags, val]});
                          }
                          input.value = '';
                        }
                    }} 
                    className="bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded text-xs font-bold hover:bg-gray-200 transition-colors"
                  >
                    + Add
                  </button>
               </div>

               <div className="flex flex-wrap gap-2 min-h-[30px]">
                 {(currentItem.tags || []).map((tag: string, idx: number) => (
                   <span key={idx} className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                     {tag}
                     <button 
                       type="button"
                       onClick={() => {
                         const newTags = currentItem.tags.filter((t: string) => t !== tag);
                         setCurrentItem({...currentItem, tags: newTags});
                       }}
                       className="hover:text-red-500"
                     >
                       <X size={12} />
                     </button>
                   </span>
                 ))}
               </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setIsModalOpen(false); setCurrentItem({}); setOpenLinkedSelect(null); setLinkedSelectSearch({}); }}
                className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold rounded-lg flex justify-center items-center gap-2 transition-all"
              >
                Cancelar
              </button>
              <button onClick={handleSave} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex justify-center items-center gap-2 transition-all shadow-md">
                <Save size={18} /> Salvar Registro
              </button>
            </div>
         </div>
      </Modal>
    </>
  );
};