import React, { useState, useEffect } from 'react';
import { Book, ChevronRight, Home, FileText, BarChart3, Settings, Shield, Zap, Code, Palette, Download, FileCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Section {
  id: string;
  title: string;
  icon: React.ReactNode;
  subsections: {
    id: string;
    title: string;
    content: string[];
  }[];
}

const DocumentationView = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string>('');

  useEffect(() => {
    // Detectar seção ativa baseado no scroll
    const handleScroll = () => {
      const sections = document.querySelectorAll('[data-section]');
      const scrollPosition = window.scrollY + 200;

      sections.forEach((section) => {
        const element = section as HTMLElement;
        const top = element.offsetTop;
        const bottom = top + element.offsetHeight;

        if (scrollPosition >= top && scrollPosition < bottom) {
          setActiveSection(element.id);
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Verificar na montagem

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100; // Offset para o header fixo
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      setActiveSection(id);
    }
  };

  const sections: Section[] = [
    {
      id: 'sobre',
      title: 'Sobre o Sistema',
      icon: <FileText size={18} />,
      subsections: [
        {
          id: 'sobre-sistema',
          title: 'O que é o Lidera Skills',
          content: [
            'O Lidera Skills é uma plataforma SaaS multi-empresa desenvolvida para gestão e análise de avaliações de desempenho de colaboradores e líderes. O sistema permite que empresas gerenciem de forma completa o ciclo de avaliações, desde o cadastro de critérios até análises avançadas de desempenho.',
            'Características principais: Multi-empresa com isolamento completo de dados, Sistema de roles com controle de acesso baseado em permissões, Interface moderna e responsiva com suporte a modo escuro/claro, Performance otimizada com paginação e scroll infinito, Importação em massa via CSV com mapeamento de colunas, Análises avançadas com dashboards interativos e gráficos em tempo real.'
          ]
        },
        {
          id: 'arquitetura',
          title: 'Arquitetura e Tecnologias',
          content: [
            'Stack Tecnológica: Frontend React 18 com TypeScript, Estilização com Tailwind CSS, Backend Firebase (Firestore + Authentication), Gráficos com Recharts, Notificações com Sonner (Toast), Validação com Zod + React Hook Form, Build com Vite.',
            'Estrutura de Dados: O sistema utiliza Firebase Firestore com coleções principais: companies (empresas clientes), employees (funcionários), evaluation_criteria (critérios de avaliação universais), evaluations (avaliações realizadas), sectors (setores organizacionais), roles (cargos/funções), user_roles (permissões e roles dos usuários).'
          ]
        }
      ]
    },
    {
      id: 'dashboard',
      title: 'Dashboard Principal',
      icon: <BarChart3 size={18} />,
      subsections: [
        {
          id: 'saude-empresa',
          title: 'Saúde da Empresa',
          content: [
            'Visão geral consolidada com métricas principais: Score de Saúde Geral (indicador numérico da saúde organizacional), Distribuição por Setores (gráfico de rosca mostrando distribuição de avaliações por setor), Distribuição por Cargos (visualização da distribuição por nível hierárquico), Top 10 Colaboradores (ranking dos melhores desempenhos), Funcionário do Mês (destaque do colaborador com melhor performance).',
            'Destaques Especiais: Sistema de destaques por pontuação (top 5 por nota) e por seleção (top 5 escolhidos pelo avaliador com destaque dourado). Visualização dos 3 funcionários mais novos e 3 mais antigos baseado na data de admissão.'
          ]
        },
        {
          id: 'analise-desempenho',
          title: 'Análise de Desempenho',
          content: [
            'Análise detalhada por competências e evolução temporal: Matriz de Competências (visualização por setor mostrando desempenho em cada competência), Evolução Temporal (gráfico de linha comparando Líderes vs Colaboradores, Desempenho Geral e Meta de desempenho configurável), Análise de Gaps (visualização de gaps de performance com gradientes e transparência para destacar áreas de melhoria), Interatividade (possibilidade de mostrar/ocultar linhas clicando na legenda).',
            'Filtros Avançados: Por período (meses, trimestres, semestres, anos), Por setor, Por colaborador, Por status de funcionário (Ativo, Inativo, Férias, Afastado).'
          ]
        },
        {
          id: 'comparativo-individual',
          title: 'Comparativo Individual',
          content: [
            'Análise comparativa de desempenho individual: Comparação Individual vs Setor (gráfico de barras mostrando desempenho do colaborador vs média do setor), Comparação Individual vs Empresa (comparação com a média geral da empresa), Tabela Detalhada (lista de todos os colaboradores com suas métricas e cores indicativas de performance), Sistema de Cores (vermelho para abaixo da média da empresa, laranja para abaixo da média do setor, azul/verde para acima da média).',
            'Ordenação disponível por nome, setor ou desempenho.'
          ]
        },
        {
          id: 'perfil-comportamental',
          title: 'Análise de Perfil Comportamental (DISC)',
          content: [
            'Dashboard especializado mostrando quais perfis DISC estão performando melhor: Performance por Setor (análise de quais perfis DISC têm melhor desempenho em cada setor), Performance por Cargo (análise de quais perfis DISC têm melhor desempenho em cada cargo), Top 3 Perfis (ranking dos 3 perfis DISC com melhor performance em cada categoria), Métricas Detalhadas (média de notas e quantidade de avaliações por perfil).'
          ]
        }
      ]
    },
    {
      id: 'avaliacoes',
      title: 'Módulo de Avaliações',
      icon: <FileCheck size={18} />,
      subsections: [
        {
          id: 'criacao-avaliacoes',
          title: 'Criação de Avaliações',
          content: [
            'Sistema completo para criação e gestão de avaliações: Seleção de Mês de Referência (primeiro campo obrigatório), Seleção de Empresa (para usuários master), Seleção de Funcionário (dropdown com funcionários ativos, mostrando em cinza os já avaliados no mês), Tipo de Avaliação (Líderes Estratégico/Tático ou Colaboradores Operacional), Critérios Dinâmicos (filtrados automaticamente por tipo e empresa, notas de 0 a 10, cálculo automático da média).',
            'Campos Adicionais: Observações (campo de texto livre), Destaque do Mês (checkbox para marcar funcionário como destaque), Motivo do Destaque (campo de texto explicando o motivo), Data de Criação (automática para histórico).',
            'Validação: Sistema impede duplicatas (funcionários já avaliados no mês aparecem desabilitados), Validação de campos obrigatórios, Confirmação antes de criar avaliação duplicada.'
          ]
        },
        {
          id: 'gestao-avaliacoes',
          title: 'Gestão de Avaliações',
          content: [
            'Tabela completa de avaliações com: Visualização Tabular (lista de todas as avaliações), Filtros (por nome do funcionário, setor, mês/ano de avaliação), Paginação (20 itens por página), Edição Completa (edição de todos os campos da avaliação incluindo critérios, notas, observações e destaques), Exclusão (opção de excluir avaliações criadas por engano), Ordenação (por data, nome ou setor).',
            'Busca e Filtros: Busca em tempo real por nome, Filtro por setor, Filtro por mês/ano de avaliação.'
          ]
        }
      ]
    },
    {
      id: 'configuracoes',
      title: 'Configurações e Cadastros',
      icon: <Settings size={18} />,
      subsections: [
        {
          id: 'criterios',
          title: 'Critérios de Avaliação',
          content: [
            'Cadastro Universal: Critérios podem ser compartilhados entre empresas. Campos disponíveis: Nome da competência/pergunta, Nível alvo (Estratégico, Tático, Operacional, Colaborador, Líder), Seção/Categoria (ex: Liderança, Comportamental), Descrição, Empresas vinculadas (para usuários master).',
            'Recursos: Importação CSV com template disponível, Paginação com scroll infinito, Prevenção de duplicatas automática, Edição e exclusão de critérios.'
          ]
        },
        {
          id: 'setores',
          title: 'Setores',
          content: [
            'Gestão de setores organizacionais: Cadastro com nome do setor, gerente responsável e unidade/filial, Importação CSV com suporte a importação em massa, Vínculo com Empresa (setores são universais mas podem ser vinculados a empresas), Prevenção de duplicatas (sistema evita criar setores com mesmo nome).'
          ]
        },
        {
          id: 'cargos',
          title: 'Cargos',
          content: [
            'Gestão de cargos e funções: Cadastro com nome do cargo, nível hierárquico (Estratégico, Tático, Operacional, Colaborador, Líder) e unidade/filial, Níveis suportados definem qual formulário de avaliação será usado, Importação CSV com template disponível, Vínculo com Empresa (cargos são universais mas podem ser vinculados a empresas), Prevenção de duplicatas automática.'
          ]
        },
        {
          id: 'funcionarios',
          title: 'Funcionários',
          content: [
            'Cadastro completo de funcionários com: Dados Básicos (ID/Matrícula, Nome completo, Email, Telefone), Dados Organizacionais (Setor, Área de Atuação, Cargo, Função, Senioridade, Nível de Cargo, Gestor Imediato, Unidade/Filial, Centro de Custo), Dados de Vínculo (Tipo de Vínculo CLT/PJ/Estagiário, Status Ativo/Inativo/Férias/Afastado, Data de Admissão, Data de Desligamento), Dados Comportamentais (Perfil DISC).',
            'Importação CSV: Template completo disponível, Mapeamento de colunas personalizado, Criação automática de setores e cargos se não existirem, Vinculação automática à empresa atual.'
          ]
        },
        {
          id: 'usuarios',
          title: 'Usuários do Sistema',
          content: [
            'Gestão de usuários e permissões: Cadastro e edição de usuários do sistema, Vinculação a empresas, Definição de roles (Master, Admin, Gestor, Líder, Colaborador), Controle de acesso baseado em permissões.'
          ]
        },
        {
          id: 'empresas',
          title: 'Empresas (Apenas Master)',
          content: [
            'Gestão de empresas clientes: Cadastro de empresas clientes, Isolamento completo de dados (cada empresa tem seus próprios dados), Seletor visual de empresa no header, Criação rápida de novas empresas.'
          ]
        },
        {
          id: 'metas',
          title: 'Metas de Desempenho',
          content: [
            'Sistema configurável de metas: Metas por Empresa (meta geral para toda a empresa), Metas por Setor (meta específica para cada setor), Metas por Cargo (meta específica para cada cargo), Metas por Nível (meta para níveis Estratégico, Tático, Operacional), Visualização no Dashboard (metas aparecem como linha de referência nos gráficos de evolução).'
          ]
        }
      ]
    },
    {
      id: 'importacao',
      title: 'Importação de Dados',
      icon: <Download size={18} />,
      subsections: [
        {
          id: 'tipos-importacao',
          title: 'Tipos de Importação',
          content: [
            'Sistema robusto de importação CSV com suporte para: Critérios de Avaliação, Setores, Cargos, Funcionários, Histórico de Avaliações (Líderes e Colaboradores separados).',
            'Recursos da Importação: Validação de duplicidade por empresa, Processamento em lote, Feedback visual de sucesso/erro, Tratamento de dados com vírgula decimal, Mapeamento de colunas personalizado, Criação automática de dependências (setores e cargos se não existirem).'
          ]
        },
        {
          id: 'formatos-csv',
          title: 'Formatos CSV Suportados',
          content: [
            'Templates disponíveis na pasta exemplos/: Critérios (ID_Avaliacao, Categoria_Avaliacao), Setores (Nome_Setor), Cargos (Nome_Cargo, Nível), Funcionários (formato completo com todos os campos), Avaliações (formato com histórico completo incluindo todas as métricas).',
            'Validação: Sistema valida formato antes de importar, Tratamento de erros com mensagens claras, Suporte a diferentes separadores decimais (vírgula ou ponto).'
          ]
        }
      ]
    },
    {
      id: 'seguranca',
      title: 'Segurança e Permissões',
      icon: <Shield size={18} />,
      subsections: [
        {
          id: 'roles',
          title: 'Sistema de Roles',
          content: [
            'Controle de acesso baseado em permissões: Master (acesso total ao sistema, pode gerenciar empresas, criar critérios universais, acesso a todas as empresas), Company (usuário por empresa: vê e avalia apenas a empresa vinculada ao seu usuário; não vê outras empresas nem opções "Todas as Empresas" ou "Nova Empresa"), Admin (administrador de empresa, gestão completa dos dados da empresa), Gestor (gestor de setor, acesso limitado ao seu setor, pode criar avaliações), Líder (líder de equipe, acesso a avaliações da sua equipe, pode criar avaliações), Colaborador (acesso básico, visualização de próprias avaliações).'
          ]
        },
        {
          id: 'adicionar-usuario-permissoes',
          title: 'Como adicionar usuário e dar permissões específicas',
          content: [
            'Para dar a um usuário acesso somente à empresa dele (role Company): 1) Crie o usuário no Firebase Authentication (Authentication > Users > Add user) e anote o UID. 2) No Firestore, coleção companies, anote o ID do documento da empresa. 3) Na coleção user_roles, crie um documento com Document ID = UID do usuário e os campos: userId (mesmo UID), email, role = "company", companyId = ID da empresa, createdAt e updatedAt (datas em ISO).',
            'Documento completo com passo a passo, exemplos e scripts está em README_USUARIOS_E_PERMISSOES.md na raiz do projeto. Apenas usuários Master (ou sem documento em user_roles) podem criar empresas e alterar documentos em user_roles.'
          ]
        },
        {
          id: 'firestore-rules',
          title: 'Regras de Segurança Firestore',
          content: [
            'Sistema implementa regras de segurança robustas: Verificação de autenticação obrigatória, Isolamento de dados por empresa, Controle de acesso baseado em roles, Validação de permissões no backend, Prevenção de acesso não autorizado a dados de outras empresas.'
          ]
        },
        {
          id: 'audit-logs',
          title: 'Audit Logs',
          content: [
            'Rastreamento de ações: Registro histórico de quem criou, editou ou excluiu registros, Essencial para compliance em grandes empresas, Logs estruturados para debugging, Trilha de auditoria completa.'
          ]
        }
      ]
    },
    {
      id: 'relatorios',
      title: 'Relatórios e Exportação',
      icon: <FileText size={18} />,
      subsections: [
        {
          id: 'exportacao',
          title: 'Exportação de Dados',
          content: [
            'Sistema de exportação completo: Exportação para CSV (dados tabulares), Exportação para PDF (relatórios formatados com gráficos), Exportação para Excel (planilhas com múltiplas abas), Dados do Dashboard (exportação de todas as métricas e análises), Histórico de Avaliações (exportação completa do histórico).'
          ]
        }
      ]
    },
    {
      id: 'performance',
      title: 'Performance e Otimizações',
      icon: <Zap size={18} />,
      subsections: [
        {
          id: 'paginação',
          title: 'Paginação e Scroll Infinito',
          content: [
            'Otimizações implementadas: Carregamento paginado (20 registros por vez), Scroll infinito (carregamento automático ao fazer scroll), Otimização de consultas (uso de limit() e startAfter() do Firestore), Indicadores visuais (loading states e mensagens de fim de lista).'
          ]
        },
        {
          id: 'cache',
          title: 'Cache e Estado',
          content: [
            'Gerenciamento de estado otimizado: Persistência local (LocalStorage para preferências do usuário), Estado global (Context API para gerenciamento de estado), Memoização (uso de useMemo e useCallback para otimização), Redução de re-renders desnecessários.'
          ]
        }
      ]
    },
    {
      id: 'interface',
      title: 'Interface e Experiência',
      icon: <Palette size={18} />,
      subsections: [
        {
          id: 'design-system',
          title: 'Design System',
          content: [
            'Interface moderna e profissional: Modo Escuro/Claro (alternância automática ou manual), Responsividade (layout adaptável para mobile, tablet e desktop), Feedback Visual (Toast notifications para todas as ações), Loading States (indicadores de carregamento em todas as operações), Animações (transições suaves entre estados), Gradientes (efeitos visuais sofisticados em dashboards e botões), Cores Douradas (substituição de amarelos por tons dourados elegantes).'
          ]
        },
        {
          id: 'componentes',
          title: 'Componentes Reutilizáveis',
          content: [
            'Biblioteca de componentes: Modal (componente de modal genérico), GenericDatabaseView (tabela genérica para CRUD), DataImporter (importador CSV genérico), Toaster (sistema de notificações), ThemeToggle (alternador de tema), Card (componentes de card reutilizáveis).'
          ]
        },
        {
          id: 'navegacao',
          title: 'Navegação e UX',
          content: [
            'Recursos de navegação: ESC para fechar modais, Backspace para voltar, Rotas sem erro no refresh (configuração SPA), Popups responsivos que permanecem visíveis mesmo com scroll, Menu lateral fixo com navegação por âncoras.'
          ]
        }
      ]
    },
    {
      id: 'desenvolvimento',
      title: 'Desenvolvimento e Deploy',
      icon: <Code size={18} />,
      subsections: [
        {
          id: 'instalacao',
          title: 'Instalação e Configuração',
          content: [
            'Pré-requisitos: Node.js versão 18 ou superior, npm ou yarn (gerenciador de pacotes), Conta no Firebase (para configuração do backend).',
            'Instalação: Clone o repositório, Instale as dependências com npm install, Configure o Firebase (veja seção Configuração), Inicie o servidor de desenvolvimento com npm run dev, Acesse a aplicação em http://localhost:5173.'
          ]
        },
        {
          id: 'configuracao-firebase',
          title: 'Configuração do Firebase',
          content: [
            'Passos para configuração: Crie um projeto no Firebase Console, Configure o Firestore (ative o Firestore Database e configure as regras de segurança), Configure a Autenticação (ative o método de autenticação Google e configure os domínios autorizados), Atualize as credenciais no arquivo src/services/firebase.ts ou use variáveis de ambiente.',
            'Variáveis de Ambiente: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID.'
          ]
        },
        {
          id: 'deploy-vercel',
          title: 'Deploy no Vercel',
          content: [
            'Configuração para Vercel: Configure as variáveis de ambiente no painel do Vercel, Configure vercel.json para SPA routing (rewrites), Execute npm run build para testar o build localmente, Faça push para o repositório conectado ao Vercel.',
            'Validação: Pre-commit hooks validam TypeScript e ESLint, Pre-push hooks validam build completo, Scripts de validação disponíveis (npm run validate, npm run pre-commit).'
          ]
        },
        {
          id: 'scripts',
          title: 'Scripts Disponíveis',
          content: [
            'Comandos npm: npm run dev (inicia servidor de desenvolvimento), npm run build (cria build de produção), npm run preview (visualiza build de produção localmente), npm run lint (executa o linter), npm run type-check (verifica erros TypeScript), npm run validate (validação completa), npm run pre-commit (validação completa antes do commit).'
          ]
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#121212]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-[#1E1E1E] border-b border-gray-200 dark:border-[#121212] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <Home size={20} />
                <span className="font-medium">Voltar ao Sistema</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Book className="text-blue-600 dark:text-blue-400" size={24} />
              <h1 className="text-xl font-bold text-gray-800 dark:text-white">Documentação Lidera Skills</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Menu Lateral Fixo */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24 bg-white dark:bg-[#1E1E1E] rounded-lg border border-gray-200 dark:border-[#121212] p-4 shadow-sm max-h-[calc(100vh-8rem)] overflow-y-auto">
              <nav className="space-y-2">
                {sections.map((section) => (
                  <div key={section.id} className="space-y-1">
                    <button
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeSection === section.id
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      {section.icon}
                      <span className="flex-1 text-left">{section.title}</span>
                    </button>
                    {section.subsections.map((subsection) => (
                      <button
                        key={subsection.id}
                        onClick={() => scrollToSection(subsection.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 pl-8 rounded-lg text-sm transition-colors ${
                          activeSection === subsection.id
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <ChevronRight size={14} />
                        <span className="flex-1 text-left">{subsection.title}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </nav>
            </div>
          </aside>

          {/* Conteúdo Principal */}
          <main className="flex-1 min-w-0">
            <div className="bg-white dark:bg-[#1E1E1E] rounded-lg border border-gray-200 dark:border-[#121212] shadow-sm p-8 space-y-12">
              {sections.map((section) => (
                <div key={section.id} id={section.id} data-section className="scroll-mt-24">
                  <div className="flex items-center gap-3 mb-6">
                    {section.icon}
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{section.title}</h2>
                  </div>

                  {section.subsections.map((subsection) => (
                    <div key={subsection.id} id={subsection.id} data-section className="scroll-mt-24 mb-8">
                      <h3 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-4">{subsection.title}</h3>
                      <div className="space-y-4">
                        {subsection.content.map((paragraph, idx) => (
                          <p key={idx} className="text-gray-600 dark:text-gray-400 leading-relaxed">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default DocumentationView;
