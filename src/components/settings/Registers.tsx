import { GenericDatabaseView } from './GenericDatabaseView';
import { DataImporter } from './DataImporter';
import { useCompany } from '../../contexts/CompanyContext';
import { FileSpreadsheet, AlertTriangle } from 'lucide-react';

// Lista de perfis DISC
const DISC_OPTIONS = [
  'D', 'I', 'S', 'C',
  'D/I', 'D/S', 'D/C', 'I/D', 'I/S', 'I/C', 'S/D', 'S/I', 'S/C', 'C/D', 'C/I', 'C/S',
  'D/I/S', 'D/I/C', 'D/S/C', 'I/D/S', 'I/D/C', 'I/S/C', 'S/D/I', 'S/D/C', 'S/I/C', 'C/D/I', 'C/D/S', 'C/I/S',
  'D/I/S/C'
];

// --- 1. Critérios de Avaliação (Universais com Seleção de Empresas) ---
export const CriteriaView = () => {
  const { isMaster } = useCompany();

  const columns: any[] = [
    { key: 'name', label: 'Competência / Pergunta' },
    { 
      key: 'type', 
      label: 'Nível Alvo', 
      type: 'select', 
      options: ['Estratégico', 'Tático', 'Operacional', 'Colaborador', 'Líder'] 
    },
    { key: 'section', label: 'Seção / Categoria (ex: Liderança, Comportamental)', hiddenInTable: true },
    { key: 'description', label: 'Descrição da Competência' }
  ];

  if (isMaster) {
    columns.push({
      key: 'companyIds',
      label: 'Disponível nas Empresas',
      type: 'multi-select-companies'
    });
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
        <h3 className="font-bold text-blue-800 dark:text-blue-300">Configuração de Critérios</h3>
        <p className="text-sm text-blue-600 dark:text-blue-400">
          Defina as perguntas que aparecerão no formulário, agrupando por nível de cargo e por seções (ex: Técnicos, Comportamentais, Liderança).
        </p>
      </div>
      <DataImporter target="criteria" />
      <GenericDatabaseView 
        collectionName="evaluation_criteria" 
        title="Critérios de Avaliação (Universais)"
        columns={columns}
      />
    </div>
  );
};

// --- 2. Setores (Universal com Seleção de Empresas) ---
export const SectorsView = () => {
  const { isMaster } = useCompany();
  
  const columns: any[] = [
     { key: 'name', label: 'Nome do Setor' },
     { key: 'manager', label: 'Gerente Responsável' },
     { key: 'unit', label: 'Unidade/Filial' }
  ];

  if (isMaster) {
     columns.push({ 
        key: 'companyIds', 
        label: 'Disponível nas Empresas', 
        type: 'multi-select-companies' 
     });
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
        <h3 className="font-bold text-blue-800 dark:text-blue-300">Gerenciamento de Setores</h3>
        <p className="text-sm text-blue-600 dark:text-blue-400">
          Setores são universais e podem ser vinculados a múltiplas empresas. O sistema evita duplicatas automaticamente.
        </p>
      </div>
      <DataImporter target="sectors" />
      <GenericDatabaseView 
        collectionName="sectors" 
        title="Gerenciar Setores (Universal)"
        columns={columns}
      />
    </div>
  );
};

// --- 3. Cargos (Universal com Seleção de Empresas) ---
export const RolesView = () => {
  const { isMaster } = useCompany();

  const columns: any[] = [
      { key: 'name', label: 'Título do Cargo' },
      { 
        key: 'level', 
        label: 'Nível Hierárquico', 
        type: 'select', 
        options: ['Estratégico', 'Tático', 'Operacional', 'Colaborador', 'Líder'] 
      },
      { key: 'unit', label: 'Unidade/Filial' }
  ];

  if (isMaster) {
     columns.push({ 
        key: 'companyIds', 
        label: 'Disponível nas Empresas', 
        type: 'multi-select-companies' 
     });
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
        <h3 className="font-bold text-blue-800 dark:text-blue-300">Gerenciamento de Cargos</h3>
        <p className="text-sm text-blue-600 dark:text-blue-400">
          Cargos são universais e podem ser vinculados a múltiplas empresas. O sistema evita duplicatas automaticamente. O <strong>"Nível Hierárquico"</strong> define qual formulário de avaliação será usado.
        </p>
      </div>
      <DataImporter target="roles" />
      <GenericDatabaseView 
        collectionName="roles" 
        title="Gerenciar Cargos (Universal)"
        columns={columns}
      />
    </div>
  );
};

// --- 4. Funcionários ---
export const EmployeesView = () => (
  <div className="space-y-6 animate-fadeIn">
    <DataImporter target="employees" />
    <GenericDatabaseView 
      collectionName="employees" 
      title="Gerenciar Funcionários"
      modalColumnOrder={['employeeCode', 'status', 'name', 'email', 'jobLevel', 'sector', 'role', 'contractType', 'managerName', 'unit', 'costCenter', 'phone', 'area', 'function', 'seniority', 'admissionDate', 'terminationDate', 'discProfile', 'photoUrl']}
      columns={[
        { key: 'employeeCode', label: 'ID Funcionário' },
        { key: 'name', label: 'Nome Completo' },
        { key: 'email', label: 'Email Corporativo', type: 'email' },
        { key: 'contractType', label: 'Tipo de Vínculo', type: 'select', options: ['CLT', 'PJ', 'Estagiário', 'Trainee', 'Temporário'] },
        { key: 'managerName', label: 'Gestor Imediato' },
        { key: 'unit', label: 'Unidade/Filial' },
        { key: 'costCenter', label: 'Centro de Custo' },
        { key: 'phone', label: 'Telefone' },
        { key: 'sector', label: 'Setor', linkedCollection: 'sectors', linkedField: 'name', type: 'select' },
        { key: 'area', label: 'Área de Atuação' },
        { key: 'role', label: 'Cargo', linkedCollection: 'roles', linkedField: 'name', type: 'select' },
        { key: 'function', label: 'Função' },
        { key: 'seniority', label: 'Senioridade' },
        { key: 'jobLevel', label: 'Nível de Cargo', type: 'select', options: ['Estratégico', 'Tático', 'Operacional', 'Colaborador', 'Líder'] },
        { key: 'admissionDate', label: 'Data de Admissão', type: 'date' },
        { key: 'terminationDate', label: 'Data de Desligamento', type: 'date' },
        { key: 'status', label: 'Status', type: 'select', options: ['Ativo', 'Inativo', 'Férias', 'Afastado'] },
        // Perfil DISC Adicionado
        { key: 'discProfile', label: 'Perfil DISC', type: 'select', options: DISC_OPTIONS },
        { key: 'photoUrl', label: 'URL da Foto', type: 'image' }
      ]}
    />
  </div>
);

// --- 5. Importação de Histórico (NOVA TELA) ---
export const HistoryImportView = () => {
  const { currentCompany } = useCompany();

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-lg border border-indigo-100 dark:border-indigo-800">
        <h3 className="text-xl font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
          <FileSpreadsheet /> Importação de Histórico Completo
        </h3>
        <p className="mt-2 text-indigo-700 dark:text-indigo-400">
          Utilize esta ferramenta para importar planilhas de avaliações passadas (ex: Clientes novos como Gomes).
        </p>
        
        {!currentCompany || currentCompany.id === 'all' ? (
          <div className="mt-4 p-4 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 rounded-md flex items-center gap-2">
            <AlertTriangle size={20} />
            <strong>Atenção:</strong> Selecione uma empresa específica no topo da página antes de importar.
          </div>
        ) : (
          <div className="mt-4 text-sm text-indigo-600 dark:text-indigo-400">
            <p>Empresa selecionada para importação: <strong className="text-lg">{currentCompany.name}</strong></p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>O sistema irá criar automaticamente os Funcionários, Setores e Cargos se não existirem.</li>
              <li>As notas serão agrupadas por mês e colaborador.</li>
              <li>Datas como "/ago./25" serão convertidas automaticamente.</li>
            </ul>
          </div>
        )}
      </div>

      {currentCompany && currentCompany.id !== 'all' && (
        <div className="p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <h4 className="font-bold mb-4 text-gray-700 dark:text-gray-300">Selecione o arquivo CSV (Layout Gomes)</h4>
          <DataImporter target="evaluations_gomes" />
        </div>
      )}
    </div>
  );
};

// --- 6. Usuários ---
export const UsersView = () => (
  <GenericDatabaseView 
    collectionName="users" 
    title="Usuários com Acesso ao Sistema"
    columns={[
      { key: 'name', label: 'Nome' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'role', label: 'Permissão', type: 'select', options: ['Admin', 'Gestor', 'Líder'] }
    ]}
  />
);

// --- 7. Gestão de Empresas ---
export const CompaniesView = () => (
  <GenericDatabaseView 
    collectionName="companies" 
    title="Gerenciar Empresas (Clientes)"
    columns={[
      { key: 'name', label: 'Nome da Empresa' },
      { key: 'cnpj', label: 'CNPJ (Opcional)' },
      { key: 'plan', label: 'Plano', type: 'select', options: ['Básico', 'Pro', 'Enterprise'] }
    ]}
  />
);

// --- 8. Metas de Desempenho ---
export { GoalsView } from './GoalsView';