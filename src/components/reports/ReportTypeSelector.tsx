import React from 'react';
import {
  FileBarChart,
  Building,
  Layers,
  Briefcase,
  Hash,
  Users,
  ClipboardList,
  History,
  Brain,
  Trophy,
  Star,
  type LucideIcon,
} from 'lucide-react';

export type ReportType =
  | 'geral'
  | 'empresas'
  | 'setores'
  | 'cargos'
  | 'niveis'
  | 'colaboradores'
  | 'criterios'
  | 'historico'
  | 'disc'
  | 'ranking-pontuacao'
  | 'ranking-destaque';

export interface ReportTypeOption {
  id: ReportType;
  label: string;
  icon: LucideIcon;
  description?: string;
}

export const REPORT_TYPES: ReportTypeOption[] = [
  { id: 'geral', label: 'Geral', icon: FileBarChart, description: 'Resumo executivo + todas as seções' },
  { id: 'empresas', label: 'Empresas', icon: Building },
  { id: 'setores', label: 'Setores', icon: Layers },
  { id: 'cargos', label: 'Cargos', icon: Briefcase },
  { id: 'niveis', label: 'Níveis', icon: Hash },
  { id: 'colaboradores', label: 'Colaboradores', icon: Users },
  { id: 'criterios', label: 'Critérios de Avaliação', icon: ClipboardList },
  { id: 'historico', label: 'Histórico das Avaliações', icon: History },
  { id: 'disc', label: 'Perfil DISC', icon: Brain },
  { id: 'ranking-pontuacao', label: 'Ranking por Pontuação', icon: Trophy },
  { id: 'ranking-destaque', label: 'Ranking por Destaque', icon: Star },
];

interface ReportTypeSelectorProps {
  selectedType: ReportType | null;
  onSelect: (type: ReportType) => void;
}

export const ReportTypeSelector: React.FC<ReportTypeSelectorProps> = ({ selectedType, onSelect }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">Tipo de Relatório</h3>
      <div className="space-y-1">
        {REPORT_TYPES.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedType === option.id;
          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all text-sm font-medium ${
                isSelected
                  ? 'bg-brand-gradient text-white dark:text-black shadow-md'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              <Icon size={18} />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
