# 📊 Lidera Skills - Visão Geral do Aplicativo

## 🎯 Sobre o Sistema

O **Lidera Skills** é uma plataforma SaaS multi-tenant desenvolvida para gestão e análise de avaliações de desempenho de colaboradores e líderes. O sistema permite que empresas gerenciem de forma completa o ciclo de avaliações, desde o cadastro de critérios até análises avançadas de desempenho.

### Características Principais

- ✅ **Multi-tenant**: Suporte a múltiplas empresas com isolamento completo de dados
- ✅ **Sistema de Roles**: Controle de acesso baseado em permissões (Master, Admin, Gestor, Líder, Colaborador)
- ✅ **Interface Moderna**: Design responsivo com suporte a modo escuro/claro
- ✅ **Performance Otimizada**: Paginação e scroll infinito para grandes volumes de dados
- ✅ **Importação em Massa**: Importação de dados via CSV com mapeamento de colunas
- ✅ **Análises Avançadas**: Dashboards interativos com gráficos e métricas em tempo real
- ✅ **Perfis de Colaboradores**: Páginas dedicadas com edição inline e histórico completo
- ✅ **Audit Logs**: Rastreamento completo de alterações
- ✅ **Gestão de Fotos**: Upload e compressão automática de fotos de colaboradores

---

## 🏗️ Arquitetura do Sistema

### Stack Tecnológica

- **Frontend**: React 18 + TypeScript
- **Estilização**: Tailwind CSS
- **Backend**: Firebase (Firestore + Authentication + Storage)
- **Gráficos**: Recharts
- **Notificações**: Sonner (Toast)
- **Build**: Vite

### Estrutura de Dados

O sistema utiliza Firebase Firestore com as seguintes coleções principais:

- `companies` - Empresas clientes
- `employees` - Funcionários (com suporte a fotos e perfil DISC)
- `evaluation_criteria` - Critérios de avaliação (universais)
- `evaluations` - Avaliações realizadas (com preservação de dados históricos)
- `sectors` - Setores organizacionais
- `roles` - Cargos/Funções
- `user_roles` - Permissões e roles dos usuários
- `audit_logs` - Histórico de alterações

---

## 📱 Módulos e Funcionalidades

### 1. 🏠 Dashboard Principal

O dashboard é o centro de análise do sistema, oferecendo múltiplas visões com filtros avançados em painel colapsável:

#### 1.1 Saúde da Empresa
Visão geral consolidada com métricas principais:

- **Checkboxes no Sidebar**: Controle de visibilidade de seções (scorecards, rankings, saúde, distribuições, performance, destaques, funcionários, DISC)
- **Exportação Excel/PDF**: Botões no sidebar para exportar o overview com tema claro para impressão
- **Score de Saúde Geral**: Indicador numérico da saúde organizacional
- **Distribuição por Setores**: Gráfico de rosca mostrando distribuição de avaliações por setor
- **Distribuição por Cargos**: Visualização da distribuição por nível hierárquico
- **Top 10 Colaboradores**: Ranking dos melhores desempenhos com destaque visual (🏆)
- **Ranking Completo**: Lista completa de todos os colaboradores (com botão "ver mais")
- **Heatmap de Critérios**: Visualização em treemap/heatmap das pontuações por critério
- **Ranking de Cargos**: Gráfico de barras com evolução temporal
- **Funcionários Inativos**: Aparecem acinzentados mas mantêm histórico nas análises

#### 1.2 Análise de Desempenho
Análise detalhada por competências e evolução temporal:

- **Matriz de Competências**: Visualização por setor mostrando desempenho em cada competência
- **Evolução Temporal**: Gráfico de linha comparando:
  - Líderes vs Colaboradores
  - Desempenho Geral
  - Meta de desempenho (configurável)
- **Interatividade**: Possibilidade de mostrar/ocultar linhas clicando na legenda
- **Filtros**: Por período, setor e colaborador

#### 1.3 Ranking de Pontuação
Visualização de rankings e evolução:

- **Ranking Completo**: Lista de todos os colaboradores (ordenado por nome por padrão)
- **Evolução Temporal - Top 10**: Gráfico de linhas cumulativas mostrando evolução mensal
- **Exportação com Checkboxes**: Painel de exportação permite selecionar: dados filtrados, tabela de ranking, gráfico de evolução (Excel e PDF com tema claro)
- **Filtros**: Por período e setor

#### 1.4 Comparativo Individual
Análise comparativa de desempenho individual:

- **Comparação Individual vs Setor**: Gráfico de barras mostrando desempenho do colaborador vs média do setor
- **Comparação Individual vs Empresa**: Comparação com a média geral da empresa
- **Tabela Detalhada**: Lista de todos os colaboradores com suas métricas
- **Ordenação**: Por nome, setor ou desempenho

#### 1.5 Perfil Comportamental
Análise de perfis DISC:

- **Visualização de Perfis**: Distribuição de perfis comportamentais
- **Filtros**: Por setor e período

#### Filtros do Dashboard (Painel Colapsável)

- **Busca por Nome**: Busca em tempo real por nome do colaborador
- **Filtro por Setor**: Dropdown com múltipla seleção de setores
- **Filtro por Status**: Ativo/Inativo
- **Filtros de Período**:
  - Últimos 30 dias
  - Últimos 3 meses
  - Este ano
  - Todo o período
  - Intervalo personalizado (data inicial e final)
- **Persistência**: Filtros são salvos no localStorage
- **Toggle**: Botão para expandir/recolher o painel de filtros

---

### 2. 👤 Perfil de Colaborador

Página dedicada para cada colaborador (`/employee/:companyId/:employeeId`) com duas abas principais:

#### 2.1 Dashboard do Colaborador

**Informações Básicas:**
- Foto do colaborador (ou iniciais se não houver foto)
- Nome completo, cargo, setor
- Perfil DISC (se cadastrado)
- Status (Ativo/Inativo)

**Evolução Temporal:**
- Gráfico de área mostrando evolução das notas ao longo do tempo
- Visualização mês a mês

**Métricas Detalhadas:**
- Tabela expansível com todas as avaliações
- Detalhamento por critério de cada avaliação
- Ordenação por:
  - Mês de referência
  - Critério
  - Nota
- Visualização detalhada ao expandir cada linha

**Scorecards:**
- Resumo visual das avaliações
- Destaques de performance

#### 2.2 Edição de Cadastro

**Formulário Completo Inline:**
- Todos os campos editáveis diretamente na página (não em popup)
- Responsivo para desktop e mobile
- Validação de campos obrigatórios
- Feedback visual de salvamento

**Campos Editáveis:**
- Dados básicos (nome, email, telefone)
- Dados organizacionais (setor, cargo, nível, gestor)
- Dados de vínculo (tipo de contrato, status, datas)
- Perfil DISC
- Foto (upload com compressão automática)

**Upload de Foto:**
- Formatos suportados: JPG, PNG, WEBP
- Compressão automática para tamanho de avatar
- Acesso via ícone de lápis no avatar ou botão na página
- Validação de tamanho e formato

**Histórico de Alterações:**
- Seção no final da página (carregada sob demanda)
- Log completo de todas as alterações
- Informações de quem alterou, quando e o que foi alterado
- Comparação de valores antigos vs novos

**Nota Importante:**
- Alterações em setor, cargo ou nível **não afetam** dados históricos
- Dados históricos preservam o contexto da época da avaliação
- Alterações aparecem apenas em registros futuros

---

### 3. ✍️ Avaliações

Módulo para criação e gestão de avaliações de desempenho.

#### 3.1 Criação de Avaliações

- **Seleção de Empresa**: Escolha da empresa (para usuários master)
- **Seleção de Funcionário**: Dropdown com funcionários ativos
- **Tipo de Avaliação**: 
  - Líderes (Estratégico/Tático)
  - Colaboradores (Operacional)
- **Mês de Referência**: Seletor de mês/ano com visualização formatada (mmm/yyyy)
- **Critérios Dinâmicos**: 
  - Critérios filtrados automaticamente por tipo e empresa
  - Notas de 0 a 10 para cada critério
  - Cálculo automático da média
  - Validação de campos obrigatórios
- **Salvamento**: Persistência no Firestore com feedback visual

#### 3.2 Tabela de Avaliações

- **Visualização Tabular**: Lista de todas as avaliações
- **Nomes Clicáveis**: Nomes de colaboradores são links para o perfil
- **Filtros** (painel colapsável):
  - Por nome do funcionário
  - Por setor
- **Ações Individuais**: Edição e exclusão de avaliações
- **Ordenação**: Por data, nome ou setor

**Nota**: A página "Nova Avaliação" é a padrão e aparece primeiro.

---

### 4. 📜 Histórico

Visualização hierárquica e detalhada do histórico de avaliações.

#### 4.1 Visualização em 3 Níveis

- **Nível 1 - Períodos**: Agrupamento por mês/ano (mês de referência)
  - Contagem de avaliações
  - Média geral do período
- **Nível 2 - Funcionários**: Lista de funcionários avaliados no período
  - Nome e cargo (clicável para perfil)
  - Nota média
- **Nível 3 - Detalhes**: Detalhamento completo da avaliação
  - Data da avaliação
  - Todas as notas por critério
  - Média calculada
  - Tipo de avaliação

#### 4.2 Filtros

- Painel colapsável (mesmo padrão do dashboard)
- Filtros por período, setor e status
- Nomes de colaboradores são clicáveis

#### 4.3 Importação de Histórico Legado

- **Importação CSV**: Upload de arquivos CSV com histórico antigo
- **Mapeamento de Colunas**: Interface para mapear colunas do CSV para campos do sistema
- **Processamento Automático**:
  - Criação automática de setores e cargos se não existirem
  - Vinculação de funcionários
  - Criação de avaliações agrupadas por funcionário e mês

---

### 5. 📊 Relatórios Analíticos e Resumidos

Página dedicada de relatórios (`/reports`) com exportação em CSV, Excel e PDF.

#### 5.1 Tipos de Relatório

- **Geral**: Resumo executivo + todas as seções (Empresas, Setores, Cargos, Colaboradores, Critérios, Histórico, DISC, Ranking)
- **Empresas**: Lista de empresas cadastradas
- **Setores**: Lista de setores
- **Cargos**: Lista de cargos
- **Níveis**: Distribuição por nível hierárquico (jobLevel)
- **Colaboradores**: Lista de funcionários
- **Critérios de Avaliação**: Lista de critérios (filtro por tipo Líder/Colaborador)
- **Histórico das Avaliações**: Avaliações realizadas
- **Perfil DISC**: Colaboradores com perfil DISC cadastrado
- **Ranking por Pontuação**: Ranking ordenado por média
- **Ranking por Destaque**: Ranking ordenado por quantidade de destaques

#### 5.2 Filtros Avançados (estilo Sienge)

- Período (presets: Todo o período, Este mês, Mês passado, Este trimestre, Este ano)
- Setores (multi-select)
- Cargos (multi-select)
- Status (Ativo, Inativo, Férias, Afastado)
- Colaboradores (busca e multi-select para Histórico)
- Tipo de critério (para Critérios)
- Filtros aplicados **antes** da exportação para evitar downloads grandes

#### 5.3 Exportação

- **CSV**: Dados tabulares (exceto Relatório Geral)
- **Excel (XLS)**: Planilha única ou múltiplas abas (Relatório Geral)
- **PDF**: Tabela com tema claro para impressão; Relatório Geral com resumo + páginas separadas por seção
- **Prévia**: Tabela paginada (50 registros por página) antes de exportar

---

### 6. ⚙️ Configurações

Módulo completo de cadastros e configurações do sistema.

#### 6.1 Critérios de Avaliação

- **Cadastro Universal**: Critérios podem ser compartilhados entre empresas
- **Campos**:
  - Nome da competência/pergunta
  - Nível alvo (Estratégico, Tático, Operacional, Colaborador, Líder)
  - Seção/Categoria (ex: Liderança, Comportamental)
  - Descrição
  - Empresas vinculadas (para usuários master)
- **Importação CSV**: Template disponível para importação em massa
- **Paginação**: Scroll infinito para grandes volumes

#### 6.2 Setores

- **Cadastro**: Nome do setor e gerente responsável
- **Select Pesquisável**: Em formulários (ex: funcionários), o campo setor usa combobox pesquisável com ordenação alfabética
- **Importação CSV**: Suporte a importação em massa
- **Vínculo com Empresa**: Setores são específicos por empresa

#### 6.3 Cargos

- **Cadastro**: Nome do cargo e nível hierárquico
- **Select Pesquisável**: Em formulários (ex: funcionários), o campo cargo usa combobox pesquisável com ordenação alfabética
- **Níveis Suportados**: Estratégico, Tático, Operacional
- **Importação CSV**: Template disponível
- **Vínculo com Empresa**: Cargos são específicos por empresa

#### 6.4 Funcionários

**Visualização e Gestão:**
- Tabela com todos os funcionários (ordenada por nome por padrão)
- **Nível Hierárquico**: Dropdown com opções: Estratégico, Tático, Operacional, Colaborador, Líder
- **Modal de Edição**: Ordem configurável dos campos, botão Cancelar além de Salvar, selects pesquisáveis para setor e cargo
- **Nomes Clicáveis**: Nomes são links para o perfil do colaborador
- Visualização de foto (ou iniciais)
- Filtros e busca

**Nota Importante:**
- A **edição completa** de funcionários foi movida para a página de perfil individual
- A tabela em Configurações serve principalmente para visualização e navegação
- Clique no nome para acessar o perfil completo com edição

**Campos Disponíveis:**
- Dados básicos (ID, nome, email, telefone)
- Dados organizacionais (setor, cargo, nível, gestor)
- Dados de vínculo (tipo de contrato, status, datas)
- Perfil DISC
- Foto

#### 6.5 Usuários

- **Gestão de Usuários**: Cadastro e edição de usuários do sistema
- **Permissões**: Vinculação a empresas e definição de roles

#### 6.6 Empresas (Apenas Master)

- **Cadastro de Empresas Clientes**: Criação e gestão de empresas
- **Isolamento de Dados**: Cada empresa tem seus próprios dados

#### 6.7 Importar Histórico

- **Importação de Dados Legados**: Interface dedicada para importação de histórico
- **Suporte a Múltiplos Formatos**: CSV com diferentes estruturas

---

## 🔐 Sistema de Segurança e Permissões

### Roles Disponíveis

1. **Master**: Acesso total ao sistema
   - Pode gerenciar empresas
   - Pode criar critérios universais
   - Acesso a todas as empresas

2. **Admin**: Administrador de empresa
   - Gestão completa dos dados da empresa
   - Acesso a todas as funcionalidades da empresa

3. **Gestor**: Gestor de setor
   - Acesso limitado ao seu setor
   - Pode criar avaliações

4. **Líder**: Líder de equipe
   - Acesso a avaliações da sua equipe
   - Pode criar avaliações

5. **Colaborador**: Acesso básico
   - Visualização de próprias avaliações

### Autenticação

- **Login por Email e Senha**: Método principal
- **Login com Google**: Alternativa via OAuth
- Credenciais padrão do admin: `admin@somoslidera.com.br` / `admin123`

### Firestore Security Rules

O sistema implementa regras de segurança robustas:

- Verificação de autenticação obrigatória
- Isolamento de dados por empresa
- Controle de acesso baseado em roles
- Validação de permissões no backend

---

## 📊 Funcionalidades de Análise

### Métricas Calculadas

- **Score Normalizado**: Cálculo automático de scores normalizados (0-10)
- **Médias por Setor**: Agregação de médias por setor organizacional
- **Médias por Cargo**: Agregação por nível hierárquico
- **Evolução Temporal**: Cálculo de tendências ao longo do tempo
- **Comparativos**: Comparação individual vs setor e vs empresa
- **Preservação Histórica**: Dados históricos mantêm contexto da época (setor/cargo/role no momento da avaliação)

### Visualizações

- **Gráficos de Rosca**: Distribuição de dados categóricos
- **Gráficos de Linha**: Evolução temporal com múltiplas séries
- **Gráficos de Barras**: Comparativos e rankings
- **Gráficos de Área**: Evolução temporal de colaboradores
- **Heatmaps/Treemaps**: Visualização de pontuações por critério
- **Tabelas Interativas**: Ordenação, filtros e busca

---

## 🚀 Performance e Otimizações

### Paginação e Scroll Infinito

- **Carregamento Paginado**: 20 registros por vez
- **Scroll Infinito**: Carregamento automático ao fazer scroll
- **Otimização de Consultas**: Uso de `limit()` e `startAfter()` do Firestore
- **Indicadores Visuais**: Loading states e mensagens de fim de lista

### Cache e Estado

- **Persistência Local**: LocalStorage para preferências do usuário e filtros
- **Estado Global**: Context API para gerenciamento de estado
- **Memoização**: Uso de `useMemo` e `useCallback` para otimização
- **Carregamento Sob Demanda**: Audit logs e dados detalhados carregados apenas quando necessário

---

## 🎨 Interface e Experiência do Usuário

### Design System

- **Modo Escuro/Claro**: Alternância automática ou manual
- **Responsividade**: Layout adaptável para mobile, tablet e desktop
- **Feedback Visual**: Toast notifications para todas as ações
- **Loading States**: Indicadores de carregamento em todas as operações
- **Animações**: Transições suaves entre estados
- **Painéis Colapsáveis**: Filtros em painel lateral colapsável

### Componentes Reutilizáveis

- **Modal**: Componente de modal genérico
- **GenericDatabaseView**: Tabela genérica para CRUD
- **DataImporter**: Importador CSV genérico
- **Toaster**: Sistema de notificações
- **ThemeToggle**: Alternador de tema
- **Card**: Componente de card padronizado
- **EmployeeLink**: Componente de link para perfil de colaborador

### Navegação

- **Nomes Clicáveis**: Todos os nomes de colaboradores são links para o perfil
- **Logo Clicável**: Logo "Lidera Skills" no header leva à página inicial
- **Breadcrumbs**: Navegação clara entre páginas
- **Títulos Dinâmicos**: Títulos e subtítulos que mudam conforme a aba selecionada

---

## 📥 Importação de Dados

### Tipos de Importação Suportados

1. **Critérios de Avaliação**
2. **Setores**
3. **Cargos**
4. **Funcionários** (com mapeamento de colunas)
5. **Avaliações** (histórico legado)

### Características da Importação

- **Templates CSV**: Download de templates para cada tipo
- **Mapeamento de Colunas**: Interface para mapear colunas do CSV
- **Validação**: Validação de dados antes da importação
- **Processamento em Lote**: Importação de múltiplos registros
- **Criação Automática**: Criação de dependências (setores, cargos) se não existirem
- **Feedback**: Mensagens de sucesso/erro detalhadas

---

## 🔄 Fluxo de Trabalho Típico

### 1. Configuração Inicial

1. Usuário master cria empresa cliente
2. Cadastra setores e cargos (ou importa via CSV)
3. Cadastra critérios de avaliação
4. Vincula critérios às empresas desejadas
5. Importa funcionários (ou cadastra manualmente)
6. Configura fotos e perfis DISC dos colaboradores

### 2. Operação Diária

1. Acessa o dashboard para visualizar métricas
2. Cria novas avaliações na aba "Avaliações"
3. Visualiza histórico detalhado na aba "Histórico"
4. Acessa perfis de colaboradores para editar informações
5. Gerencia cadastros na aba "Configurações"

### 3. Análise e Relatórios

1. Utiliza filtros do dashboard para análises específicas
2. Compara desempenho entre setores e períodos
3. Identifica colaboradores com melhor/menor desempenho
4. Acompanha evolução temporal das métricas
5. Acessa perfis individuais para análise detalhada

---

## 🛠️ Manutenção e Suporte

### Logs e Monitoramento

- **Tratamento Centralizado de Erros**: Classe `ErrorHandler` para gestão de erros
- **Logging**: Logs estruturados para debugging
- **Toast Notifications**: Feedback visual de todas as operações
- **Audit Logs**: Rastreamento completo de alterações

### Backup e Recuperação

- **Firebase Firestore**: Backup automático pelo Firebase
- **Exportação**: Possibilidade de exportar dados via CSV
- **Preservação Histórica**: Dados históricos não são alterados por mudanças atuais

---

## 📈 Roadmap e Melhorias Futuras

### Implementado ✅

- ✅ Paginação e scroll infinito
- ✅ Sistema de roles e segurança
- ✅ Toast notifications
- ✅ Tratamento centralizado de erros
- ✅ Perfis de colaboradores com edição inline
- ✅ Upload e gestão de fotos
- ✅ Audit logs
- ✅ Filtros colapsáveis
- ✅ Preservação de dados históricos
- ✅ Nomes clicáveis em todo o sistema
- ✅ Formatação inteligente de nomes

### Planejado

- **PDI (Plano de Desenvolvimento Individual)**: Criação de planos de ação baseados em notas baixas
- **Exportação de Relatórios**: PDF/Excel dos dashboards
- **Notificações**: Alertas para avaliações pendentes
- **Metas Personalizadas**: Configuração de metas por setor/cargo
- **Dashboard Executivo**: Visão resumida para C-level
- **Comparativo de Evolução Individual**: Gráfico de linha mostrando evolução do colaborador vs média

---

## 📞 Suporte e Documentação

### Documentação Disponível

- `README.md`: Guia de instalação e configuração
- `ROADMAP.md`: Roadmap técnico e melhorias
- `README_ENV.md`: Configuração de variáveis de ambiente
- `README_ADMIN_LOGIN.md`: Como criar usuário admin
- `VERCEL_ENV_SETUP.md`: Configuração de deploy no Vercel
- `TROUBLESHOOTING_EMPRESAS.md`: Solução de problemas comuns
- `firestore.rules`: Regras de segurança do Firestore

### Contato

Para suporte e dúvidas, entre em contato através dos canais oficiais da Lidera.

---

**Versão do Documento**: 2.0  
**Última Atualização**: 2024  
**Status**: Sistema em Produção
