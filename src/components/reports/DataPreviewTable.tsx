import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { ReportType } from './ReportTypeSelector';

const PAGE_SIZE = 50;

interface ColumnConfig {
  key: string;
  label: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

const REPORT_COLUMNS: Partial<Record<ReportType, ColumnConfig[]>> = {
  empresas: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nome' },
  ],
  setores: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nome' },
    { key: 'manager', label: 'Gerente' },
  ],
  cargos: [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nome' },
    { key: 'level', label: 'Nível' },
  ],
  niveis: [
    { key: 'Nível', label: 'Nível' },
    { key: 'Quantidade', label: 'Quantidade' },
    { key: 'Setores', label: 'Setores' },
  ],
  colaboradores: [
    { key: 'name', label: 'Nome' },
    { key: 'email', label: 'Email' },
    { key: 'sector', label: 'Setor' },
    { key: 'role', label: 'Cargo' },
    { key: 'status', label: 'Status' },
    { key: 'jobLevel', label: 'Nível' },
  ],
  criterios: [
    { key: 'name', label: 'Nome' },
    { key: 'type', label: 'Tipo' },
    { key: 'description', label: 'Descrição' },
  ],
  historico: [
    { key: 'employeeName', label: 'Colaborador' },
    { key: 'date', label: 'Data' },
    { key: 'type', label: 'Tipo' },
    { key: 'average', label: 'Média' },
    { key: 'sector', label: 'Setor' },
  ],
  disc: [
    { key: 'name', label: 'Nome' },
    { key: 'sector', label: 'Setor' },
    { key: 'role', label: 'Cargo' },
    { key: 'discProfile', label: 'Perfil DISC' },
  ],
  'ranking-pontuacao': [
    { key: 'Posição', label: 'Pos' },
    { key: 'Nome', label: 'Nome' },
    { key: 'Setor', label: 'Setor' },
    { key: 'Cargo', label: 'Cargo' },
    { key: 'Nível', label: 'Nível' },
    { key: 'Pontuação', label: 'Pontuação' },
    { key: 'Avaliações', label: 'Aval.' },
  ],
  'ranking-destaque': [
    { key: 'Posição', label: 'Pos' },
    { key: 'Nome', label: 'Nome' },
    { key: 'Setor', label: 'Setor' },
    { key: 'Cargo', label: 'Cargo' },
    { key: 'Pontuação', label: 'Pontuação' },
    { key: 'Destaques', label: 'Destaques' },
  ],
};

interface DataPreviewTableProps {
  data: Record<string, unknown>[] | unknown;
  reportType: ReportType | null;
  loading?: boolean;
  error?: string | null;
  totalCount?: number;
}

export const DataPreviewTable: React.FC<DataPreviewTableProps> = ({
  data,
  reportType,
  loading = false,
  error = null,
  totalCount = 0,
}) => {
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return data as Record<string, unknown>[];
  }, [data]);

  const columns = reportType ? REPORT_COLUMNS[reportType] : [];
  const defaultColumns = columns?.length
    ? columns
    : rows.length > 0
      ? Object.keys(rows[0]).map((k) => ({ key: k, label: k }))
      : [];

  const paginatedRows = useMemo(() => {
    const start = page * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

  const totalPages = Math.ceil(rows.length / PAGE_SIZE) || 1;
  const startItem = page * PAGE_SIZE + 1;
  const endItem = Math.min((page + 1) * PAGE_SIZE, rows.length);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (reportType === 'geral' || (!Array.isArray(data) && typeof data === 'object')) {
    return (
      <div className="bg-white dark:bg-lidera-gray rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
        <p className="text-gray-600 dark:text-gray-400">
          O relatório Geral possui múltiplas seções. Use os botões de exportação para gerar PDF ou Excel com resumo e
          abas separadas.
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white dark:bg-lidera-gray rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-12 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          Nenhum registro encontrado com os filtros atuais.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-lidera-gray rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Exibindo {startItem} a {endItem} de {rows.length} registros
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Página {page + 1} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-navy-900">
              {defaultColumns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, idx) => (
              <tr
                key={(row.id as string) || idx}
                className="border-t border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                {defaultColumns.map((col) => {
                  const val = row[col.key];
                  const cfg = col as ColumnConfig;
                  const rendered = cfg.render ? cfg.render(val, row) : val;
                  return (
                    <td
                      key={col.key}
                      className="px-4 py-3 text-gray-800 dark:text-gray-200"
                    >
                      {rendered != null ? String(rendered) : '-'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
