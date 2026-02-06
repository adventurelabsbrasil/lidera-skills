# 🚀 Lidera Skills - Sistema de Gestão de Avaliações de Desempenho

Sistema web completo para gestão e análise de avaliações de desempenho de colaboradores e líderes, desenvolvido com React, TypeScript e Firebase.

## 📋 Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Funcionalidades](#funcionalidades)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Como Usar](#como-usar)
- [Estrutura de Dados](#estrutura-de-dados)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Usuários e Permissões](#usuários-e-permissões)
- [Arquitetura](#arquitetura)
- [Contribuindo](#contribuindo)

## 🎯 Sobre o Projeto

O **Lidera Skills** é uma plataforma SaaS multi-tenant desenvolvida para empresas gerenciarem avaliações de desempenho de seus colaboradores e líderes. O sistema permite:

- Importação de dados históricos via CSV
- Análise visual de desempenho com gráficos e métricas
- Gestão completa de cadastros (critérios, setores, cargos, funcionários)
- Comparativos individuais e por setor
- Histórico detalhado de avaliações
- Perfis individuais de colaboradores com edição inline
- Suporte a múltiplas empresas (multi-tenant)
- Sistema de autenticação por email/senha e Google
- Upload e gestão de fotos de colaboradores
- Audit logs para rastreamento de alterações

## ✨ Funcionalidades

### 📊 Dashboard Principal

O dashboard oferece uma visão completa da saúde organizacional com filtros avançados em painel colapsável:

#### Abas do Dashboard:

- **Saúde da Empresa**: Visão geral com métricas consolidadas
  - Checkboxes no sidebar para mostrar/ocultar seções (scorecards, rankings, saúde, distribuições, performance, destaques, funcionários, DISC)
  - Exportação Excel/PDF no sidebar com tema claro para impressão
  - Score de saúde geral da empresa
  - Distribuição por setores e cargos (gráficos de rosca)
  - Top 10 colaboradores em desempenho com destaque visual
  - Ranking completo de todos os colaboradores
  - Heatmap de pontuação por critério de avaliação
  - Ranking de cargos com evolução temporal
  - Funcionários inativos aparecem acinzentados mas mantêm histórico

- **Análise de Desempenho**: Análise detalhada por competências
  - Matriz de competências por setor
  - Evolução temporal (Líderes vs Colaboradores)
  - Gráficos de linha mostrando tendências
  - Meta de desempenho configurável

- **Ranking de Pontuação**: Visualização de rankings e evolução
  - Ranking completo de colaboradores (ordenado por nome por padrão)
  - Evolução temporal do Top 10 (gráfico cumulativo)
  - Exportação com checkboxes: dados filtrados, tabela de ranking, gráfico de evolução (Excel e PDF com tema claro)
  - Filtros por período e setor

- **Comparativo Individual**: Análise comparativa
  - Comparação individual vs média do setor
  - Comparação individual vs média da empresa
  - Visualização em gráficos de barras

- **Perfil Comportamental**: Análise de perfis DISC
  - Visualização de perfis comportamentais
  - Distribuição por perfil DISC

#### Filtros Avançados (Painel Colapsável)

- Busca por nome de colaborador
- Filtro por setor (múltipla seleção)
- Filtro por status (Ativo/Inativo)
- Filtros de período:
  - Últimos 30 dias
  - Últimos 3 meses
  - Este ano
  - Todo o período
  - Intervalo personalizado (data inicial e final)
- Persistência de filtros no localStorage

### 👤 Perfil de Colaborador

Página dedicada para cada colaborador (`/employee/:companyId/:employeeId`) com:

#### Dashboard do Colaborador:
- **Informações Básicas**: Nome, cargo, setor, foto (ou iniciais)
- **Perfil DISC**: Exibição do perfil comportamental cadastrado
- **Evolução Temporal**: Gráfico de área mostrando evolução das notas ao longo do tempo
- **Métricas Detalhadas**: Tabela expansível com todas as avaliações e notas por critério
  - Ordenação por mês de referência, critério ou nota
  - Visualização detalhada de cada avaliação
- **Scorecards de Performance**: Resumo visual das avaliações

#### Edição de Cadastro:
- Formulário inline completo (não em popup)
- Edição de todos os campos do colaborador
- Upload de foto com compressão automática (JPG, PNG, WEBP)
- Alteração de foto via ícone de lápis no avatar ou botão na página
- Validação de campos obrigatórios
- Histórico de alterações (audit log) carregado sob demanda

**Nota**: A edição de colaboradores foi movida da página de Configurações para o perfil individual, proporcionando uma experiência mais integrada.

### 📜 Histórico de Avaliações

- Visualização hierárquica em 3 níveis:
  1. **Resumo por Período**: Lista de meses com volume e média (mostra apenas mês de referência)
  2. **Lista do Período**: Todas as avaliações do mês selecionado
  3. **Detalhes Individuais**: Detalhamento completo da avaliação
- Filtros em painel colapsável (mesmo padrão do dashboard)
- Nomes de colaboradores são clicáveis e levam ao perfil

### 📊 Relatórios Analíticos e Resumidos

Página dedicada de relatórios (`/reports`) com exportação em CSV, Excel e PDF:

- **Tipos de Relatório**: Geral, Empresas, Setores, Cargos, Níveis, Colaboradores, Critérios de Avaliação, Histórico das Avaliações, Perfil DISC, Ranking por Pontuação, Ranking por Destaque
- **Filtros Avançados** (estilo Sienge): Período, setores, cargos, status, colaboradores — aplicados antes da exportação para evitar downloads grandes
- **Prévia de Dados**: Tabela paginada antes de exportar (50 registros por página)
- **Relatório Geral**: Resumo executivo + seções separadas (PDF: páginas; Excel: abas)
- **Exportação**: CSV, Excel (XLS) e PDF com tema claro para impressão

### ✍️ Avaliações

- **Criação de Avaliações**: Formulário completo com validação
  - Seleção de funcionário (apenas ativos)
  - Tipo de avaliação (Líder/Colaborador)
  - Mês de referência
  - Critérios dinâmicos baseados no tipo
  - Cálculo automático da média
- **Tabela de Avaliações**: Lista completa com filtros
  - Nomes clicáveis para acesso ao perfil
  - Edição e exclusão individual
  - Filtros por nome e setor

### ⚙️ Configurações e Cadastros

#### Cadastros Gerais
- **Critérios de Avaliação**: Definição de critérios para Líderes e Colaboradores
- **Setores**: Gestão de departamentos/setores da empresa (select pesquisável em formulários)
- **Cargos**: Cadastro de funções e níveis hierárquicos (select pesquisável em formulários)

#### Pessoas
- **Funcionários**: Visualização e gestão
  - Ordenação padrão por nome dos colaboradores
  - Nível hierárquico em dropdown (Estratégico, Tático, Operacional, Colaborador, Líder)
  - Selects pesquisáveis para setor e cargo em formulários de edição
  - Ordem dos campos configurável no modal de edição
  - Botão Cancelar no modal de edição (além de Salvar)
  - Nomes clicáveis que levam ao perfil do colaborador
  - Status "Ativo" ou "Inativo"
  - Funcionários inativos não aparecem no formulário de novas avaliações
  - Funcionários inativos continuam visíveis no histórico (preservação de dados)
  - **Nota**: A edição completa foi movida para a página de perfil do colaborador

- **Usuários do Sistema**: Gestão de usuários e permissões

**Recursos de Edição:**
- Todos os cadastros são **editáveis** e **excluíveis**
- Edição inline com modal (com botão Cancelar)
- Selects vinculados (setor, cargo) pesquisáveis e ordenados alfabeticamente
- Validação de campos obrigatórios
- Suporte a campos customizados (campos extras)

### 📥 Importação de Dados

Sistema robusto de importação CSV com suporte para:
- Critérios de avaliação
- Setores
- Cargos
- Funcionários
- Histórico de avaliações (Líderes)
- Histórico de avaliações (Colaboradores)

**Recursos da importação:**
- Validação de duplicidade por empresa
- Processamento em lote
- Feedback visual de sucesso/erro
- Tratamento de dados com vírgula decimal

### 📁 Arquivos de Exemplo

Arquivos CSV de exemplo estão disponíveis na pasta `exemplos/`:
- `criterios_exemplo.csv` - 10 critérios (5 para Líderes, 5 para Colaboradores)
- `setores_exemplo.csv` - 10 setores diferentes
- `cargos_exemplo.csv` - 15 cargos (6 líderes, 9 colaboradores)
- `funcionarios_exemplo.csv` - 20 funcionários distribuídos pelos setores
- `avaliacoes_lideres_exemplo.csv` - Histórico de 4 meses para 6 líderes
- `avaliacoes_colaboradores_exemplo.csv` - Histórico de 4 meses para 14 colaboradores

Consulte `exemplos/LEIA-ME.md` para instruções detalhadas de uso.

### 🏢 Multi-Tenancy

- Suporte a múltiplas empresas clientes
- Isolamento completo de dados por empresa
- Seletor visual de empresa no header
- Criação rápida de novas empresas
- Persistência da empresa selecionada (localStorage)
- Todos os cadastros e avaliações são filtrados automaticamente por empresa
- Dados de uma empresa não são visíveis para outras empresas

### 🔐 Autenticação

- **Login por Email e Senha**: Método principal de autenticação
- **Login com Google**: Alternativa via OAuth
- Sistema de roles (Master, Admin, Gestor, Líder, Colaborador)
- Controle de acesso baseado em permissões

### 📸 Gestão de Fotos

- Upload de fotos de colaboradores
- Compressão automática de imagens (JPG, PNG, WEBP)
- Redimensionamento para tamanho de avatar
- Exibição de iniciais quando não há foto
- Armazenamento no Firebase Storage

### 📝 Audit Logs

- Rastreamento de todas as alterações em dados de colaboradores
- Histórico completo de quem alterou, quando e o que foi alterado
- Visualização no perfil do colaborador
- Carregamento sob demanda para performance

### 🎨 Interface Moderna

- Design responsivo (mobile-first)
- Modo escuro/claro com detecção automática
- Animações suaves
- UI/UX intuitiva
- Ícones Lucide React
- Painéis colapsáveis para filtros
- Navegação fluida entre páginas

## 🛠 Tecnologias Utilizadas

### Frontend
- **React 18.2.0** - Biblioteca JavaScript para construção de interfaces
- **TypeScript 5.2.2** - Superset JavaScript com tipagem estática
- **Vite 5.2.0** - Build tool e dev server ultra-rápido
- **React Router DOM 7.9.6** - Roteamento para aplicações React

### Estilização
- **Tailwind CSS 3.4.17** - Framework CSS utility-first
- **PostCSS 8.4.38** - Processador CSS
- **Autoprefixer 10.4.19** - Adiciona prefixos CSS automaticamente

### Backend & Banco de Dados
- **Firebase 10.8.1** - Plataforma completa
  - **Firestore** - Banco de dados NoSQL
  - **Authentication** - Autenticação com Email/Senha e Google
  - **Storage** - Armazenamento de arquivos (fotos)

### Bibliotecas de Gráficos
- **Recharts 2.12.0** - Biblioteca de gráficos React

### Utilitários
- **PapaParse 5.5.3** - Parser CSV robusto
- **Lucide React 0.344.0** - Ícones modernos
- **Sonner** - Toast notifications

### Desenvolvimento
- **ESLint 8.57.0** - Linter para JavaScript/TypeScript
- **TypeScript** - Compilador e verificador de tipos
- **Husky** - Git hooks para validação

## 📁 Estrutura do Projeto

```
lidera-skills/
├── public/                 # Arquivos estáticos
├── src/
│   ├── assets/            # Imagens e recursos
│   ├── components/         # Componentes React
│   │   ├── dashboard/     # Componentes do dashboard
│   │   │   ├── tabs/      # Abas do dashboard
│   │   │   │   ├── CompanyOverview.tsx
│   │   │   │   ├── PerformanceAnalysis.tsx
│   │   │   │   ├── IndividualAnalysis.tsx
│   │   │   │   ├── RankingView.tsx
│   │   │   │   └── BehavioralProfile.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   └── EvaluationHistory.tsx
│   │   ├── employee/      # Perfil de colaborador
│   │   │   └── EmployeeProfile.tsx
│   │   ├── evaluations/   # Avaliações
│   │   │   └── EvaluationsView.tsx
│   │   ├── layout/        # Componentes de layout
│   │   │   └── CompanySelector.tsx
│   │   ├── reports/       # Página de relatórios analíticos
│   │   │   ├── ReportsView.tsx
│   │   │   ├── ReportTypeSelector.tsx
│   │   │   ├── AdvancedReportFilters.tsx
│   │   │   ├── DataPreviewTable.tsx
│   │   │   └── ReportExporter.tsx
│   │   ├── settings/      # Componentes de configuração
│   │   │   ├── DataImporter.tsx
│   │   │   ├── GenericDatabaseView.tsx
│   │   │   ├── Registers.tsx
│   │   │   └── GoalsView.tsx
│   │   └── ui/            # Componentes UI reutilizáveis
│   │       ├── Card.tsx
│   │       ├── Modal.tsx
│   │       ├── Toaster.tsx
│   │       └── ThemeToggle.tsx
│   ├── contexts/          # Context API do React
│   │   ├── AuthContext.tsx
│   │   └── CompanyContext.tsx
│   ├── hooks/             # Custom hooks
│   │   ├── useDashboardAnalytics.ts
│   │   ├── useReportData.ts
│   │   ├── usePagination.ts
│   │   └── usePerformanceGoals.ts
│   ├── services/          # Serviços e integrações
│   │   └── firebase.ts
│   ├── utils/             # Utilitários
│   │   ├── auditLogger.ts
│   │   ├── errorHandler.ts
│   │   ├── nameFormatter.ts
│   │   ├── employeeLink.ts
│   │   ├── reportExporter.ts         # Exportação Excel/PDF de dashboards e rankings
│   │   ├── reportExporterAnalytics.ts # Exportação CSV/XLS/PDF de relatórios analíticos
│   │   └── toast.ts
│   ├── App.tsx            # Componente principal
│   ├── main.tsx           # Ponto de entrada
│   └── index.css          # Estilos globais
├── scripts/               # Scripts utilitários
│   ├── create-admin-user.ts
│   ├── set-user-role-company.ts   # Atribui role 'company' a um usuário (requer Admin SDK)
│   └── pre-commit-check.js
├── exemplos/              # Arquivos CSV de exemplo
├── .gitignore
├── eslint.config.js       # Configuração ESLint
├── index.html
├── package.json
├── postcss.config.js      # Configuração PostCSS
├── tailwind.config.js     # Configuração Tailwind
├── tsconfig.json          # Configuração TypeScript
├── vite.config.ts         # Configuração Vite
└── vercel.json            # Configuração Vercel
```

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** (versão 18 ou superior)
- **npm** ou **yarn** (gerenciador de pacotes)
- Conta no **Firebase** (para configuração do backend)

## 🚀 Instalação

1. **Clone o repositório**
   ```bash
   git clone https://github.com/somoslidera/lidera-skills.git
   cd lidera-skills
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure o Firebase** (veja seção [Configuração](#configuração))

4. **Inicie o servidor de desenvolvimento**
   ```bash
   npm run dev
   ```

5. **Acesse a aplicação**
   - Abra seu navegador em `http://localhost:5173` (ou a porta indicada no terminal)

## ⚙️ Configuração

### Configuração do Firebase

1. **Crie um projeto no Firebase Console**
   - Acesse [Firebase Console](https://console.firebase.google.com/)
   - Crie um novo projeto ou use um existente

2. **Configure o Firestore**
   - Ative o Firestore Database
   - Configure as regras de segurança (veja `firestore.rules`)

3. **Configure a Autenticação**
   - Ative o método de autenticação "Email/Password"
   - Ative o método de autenticação "Google"
   - Configure os domínios autorizados

4. **Configure o Storage**
   - Ative o Firebase Storage
   - Configure as regras de segurança para upload de fotos

5. **Atualize as credenciais**
   - Configure as variáveis de ambiente (veja `README_ENV.md`)
   - Ou edite o arquivo `src/services/firebase.ts` com suas credenciais (apenas desenvolvimento)

### Criar Usuário Admin

Consulte `README_ADMIN_LOGIN.md` para instruções detalhadas sobre como criar o usuário admin inicial.

### Regras de Segurança do Firestore

As regras de segurança estão no arquivo `firestore.rules`. Consulte a documentação do Firebase para fazer o deploy das regras.

## 📖 Como Usar

### Primeiro Acesso

1. **Faça Login**
   - Use email/senha ou login com Google
   - O primeiro usuário deve ser criado como "master" (veja `README_ADMIN_LOGIN.md`)

2. **Selecione ou Crie uma Empresa**
   - Ao acessar o sistema, você verá a tela de boas-vindas
   - Selecione uma empresa existente ou crie uma nova

3. **Importe Dados Iniciais** (Opcional)
   - Acesse a aba "Configurações"
   - Use os importadores CSV para carregar:
     - Critérios de avaliação
     - Setores
     - Cargos
     - Funcionários
     - Histórico de avaliações

4. **Explore o Dashboard**
   - Acesse a aba "Painel" para ver as análises
   - Use os filtros (painel colapsável à direita) para refinar os dados
   - Navegue entre as abas: Saúde da Empresa, Análise de Desempenho, Ranking, etc.

### Navegação

- **Nomes de Colaboradores**: Clique em qualquer nome de colaborador em qualquer lugar do sistema para acessar seu perfil completo
- **Relatórios**: Acesse a aba "Relatórios" no menu principal para exportar relatórios analíticos em CSV, Excel ou PDF com filtros avançados
- **Logo "Lidera Skills"**: Clique no logo no header para voltar à página inicial
- **Filtros**: Use o botão de filtros no dashboard para expandir/recolher o painel de filtros

## 🗄 Estrutura de Dados

### Collections do Firestore

#### `companies`
```typescript
{
  id: string;
  name: string;
  createdAt: string;
}
```

#### `evaluation_criteria`
```typescript
{
  id: string;
  name: string;
  type: 'Líder' | 'Colaborador';
  description?: string;
  companyId?: string; // Opcional para critérios universais
}
```

#### `sectors`
```typescript
{
  id: string;
  name: string;
  manager?: string;
  companyId: string;
}
```

#### `roles`
```typescript
{
  id: string;
  name: string;
  level: string;
  companyId: string;
}
```

#### `employees`
```typescript
{
  id: string;
  name: string;
  email?: string;
  sector: string;
  role: string;
  status: 'Ativo' | 'Inativo';
  photoUrl?: string;
  discProfile?: string;
  admissionDate?: string;
  employeeCode?: string;
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
  companyId: string;
}
```

#### `evaluations`
```typescript
{
  id: string;
  employeeName: string;
  employeeId?: string;
  role?: string;
  sector?: string;
  type: 'Líder' | 'Colaborador';
  date: string; // YYYY-MM-DD
  referenceMonth?: string; // YYYY-MM
  average: number;
  details: {
    [criteriaName: string]: number;
  };
  companyId: string;
  importedAt?: string;
}
```

#### `user_roles`
```typescript
{
  id: string; // userId
  userId: string;
  email: string;
  role: 'master' | 'admin' | 'gestor' | 'lider' | 'colaborador';
  companyIds?: string[];
  createdAt: string;
  updatedAt: string;
}
```

#### `audit_logs`
```typescript
{
  id: string;
  collection: string;
  documentId: string;
  action: 'create' | 'update' | 'delete';
  userId: string;
  userEmail: string;
  timestamp: Timestamp;
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  metadata?: Record<string, any>;
}
```

## 📜 Scripts Disponíveis

```bash
# Inicia o servidor de desenvolvimento
npm run dev

# Cria build de produção
npm run build

# Visualiza o build de produção localmente
npm run preview

# Executa o linter
npm run lint

# Validação completa (TypeScript + ESLint + Build)
npm run validate
```

## 👥 Usuários e Permissões

Para **adicionar um novo usuário** e dar **permissões específicas** (por exemplo, acesso só à empresa dele para ver e fazer avaliações), use o guia completo:

**[README_USUARIOS_E_PERMISSOES.md](./README_USUARIOS_E_PERMISSOES.md)**

Resumo: criar o usuário no Firebase Authentication, anotar o UID e o ID da empresa no Firestore (coleção `companies`), e criar um documento na coleção `user_roles` com `role: 'company'` e `companyId` da empresa. O script `scripts/set-user-role-company.ts` pode ser usado em ambiente com Admin SDK; no dia a dia, o documento costuma ser criado manualmente no Firestore Console.

## 🏗 Arquitetura

### Contextos (State Management)

- **AuthContext**: Gerencia autenticação do usuário via Firebase Auth e roles
- **CompanyContext**: Gerencia empresa selecionada e lista de empresas

### Hooks Customizados

- **useDashboardAnalytics**: Processa e calcula todas as métricas do dashboard
  - Normalização de dados
  - Aplicação de filtros
  - Cálculo de métricas gerais
  - Análise de competências
  - Comparativos individuais
  - Preservação de dados históricos (setor/cargo/role no momento da avaliação)

- **usePerformanceGoals**: Gerencia metas de desempenho
- **usePagination**: Gerencia paginação de dados

### Componentes Principais

- **App.tsx**: Componente raiz com roteamento e providers
- **Dashboard**: Componente principal com filtros colapsáveis e abas
- **EmployeeProfile**: Página completa de perfil do colaborador com edição
- **EvaluationHistory**: Visualização hierárquica do histórico
- **EvaluationsView**: Criação e gestão de avaliações
- **DataImporter**: Componente genérico para importação CSV
- **GenericDatabaseView**: Visualização e edição genérica de collections

### Fluxo de Dados

1. Usuário seleciona empresa → `CompanyContext`
2. Dados são carregados do Firestore filtrados por `companyId`
3. Dados são processados pelo hook `useDashboardAnalytics`
4. Componentes recebem dados processados e renderizam visualizações
5. Alterações são registradas em `audit_logs`

## 🎨 Personalização

### Tema e Cores

As cores podem ser personalizadas no arquivo `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      lidera: {
        dark: '#121212',
        gray: '#1E1E1E',
        gold: '#D4AF37',
      },
      skills: {
        light: '#F8FAFC',
        white: '#FFFFFF',
        blue: {
          primary: '#0F52BA',
          secondary: '#4CA1AF',
        }
      }
    }
  }
}
```

### Modo Escuro

O modo escuro é ativado automaticamente via classe CSS `dark`. O sistema detecta a preferência do sistema operacional ou permite alternância manual.

## 🤝 Contribuindo

Contribuições são bem-vindas! Para contribuir:

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### Padrões de Código

- Use TypeScript para todos os arquivos
- Siga as convenções do ESLint configurado
- Mantenha componentes pequenos e reutilizáveis
- Adicione comentários quando necessário
- Use nomes descritivos para variáveis e funções
- Evite o uso de `any` - use tipos específicos

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 📞 Suporte

Para suporte, abra uma issue no repositório ou entre em contato com a equipe de desenvolvimento.

---

**Desenvolvido por Lidera para facilitar a gestão de avaliações de desempenho**

## 📚 Documentação Adicional

- **[Visão Geral do Sistema](VISAO_GERAL.md)** - Documentação completa das funcionalidades
- **[Roadmap Técnico](ROADMAP.md)** - Planejamento e melhorias futuras
- **[Documentação Arquivada](docs/archived/README.md)** - Fases concluídas e solicitações implementadas
- **[Configuração de Ambiente](README_ENV.md)** - Guia de variáveis de ambiente
- **[Login Admin](README_ADMIN_LOGIN.md)** - Como criar usuário admin
- **[Configuração Vercel](VERCEL_ENV_SETUP.md)** - Deploy no Vercel
- **[Troubleshooting](TROUBLESHOOTING_EMPRESAS.md)** - Solução de problemas comuns
