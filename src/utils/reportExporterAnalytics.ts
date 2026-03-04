import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { ReportType } from '../components/reports/ReportTypeSelector';

const COLORS = {
  text: '#1a1a1a',
  textSecondary: '#333333',
  headerBg: '#e8e8e8',
  headerText: '#0d0d0d',
  border: '#999999',
};

function setPdfTextColor(pdf: jsPDF, hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  pdf.setTextColor(r, g, b);
}

function getFilename(reportType: ReportType, extension: string): string {
  const base = `relatorio_${reportType}_${new Date().toISOString().split('T')[0]}`;
  return `${base}.${extension}`;
}

function flattenRow(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  Object.entries(row).forEach(([k, v]) => {
    out[k] = v != null ? String(v) : '';
  });
  return out;
}

/**
 * Exporta dados para CSV
 */
export function exportReportToCSV(
  data: Record<string, unknown>[],
  filename?: string,
  reportType: ReportType = 'colaboradores'
): string {
  const finalFilename = filename || getFilename(reportType, 'csv');
  const flat = data.map(flattenRow);
  const csv = Papa.unparse(flat);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFilename;
  a.click();
  URL.revokeObjectURL(url);
  return finalFilename;
}

/**
 * Larguras de colunas para Excel (wch = largura em caracteres)
 * Colunas de nome recebem 30+ caracteres para caber nomes completos
 */
function getExcelColumnWidths(columns: string[]): { wch: number }[] {
  const NOME_COLS = ['name', 'Nome', 'employeeName', 'realName'];
  return columns.map((col) => {
    const isNome = NOME_COLS.some((n) => col === n || col.toLowerCase().includes('nome'));
    return { wch: isNome ? 35 : 18 };
  });
}

/**
 * Exporta dados para Excel (XLS) com colunas largas para nomes
 */
export function exportReportToXLS(
  data: Record<string, unknown>[],
  sheetName: string = 'Dados',
  filename?: string,
  reportType: ReportType = 'colaboradores'
): string {
  const finalFilename = filename || getFilename(reportType, 'xlsx');
  const flat = data.map(flattenRow);
  const worksheet = XLSX.utils.json_to_sheet(flat);
  const cols = flat.length > 0 ? Object.keys(flat[0]) : [];
  if (cols.length > 0) {
    worksheet['!cols'] = getExcelColumnWidths(cols);
  }
  const workbook = XLSX.utils.book_new();
  const safeName = sheetName.slice(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, safeName);
  XLSX.writeFile(workbook, finalFilename);
  return finalFilename;
}

/** Colunas de nome precisam de mais largura para caber nomes completos */
const NOME_COLUMN_NAMES = ['name', 'Nome', 'employeeName', 'realName'];

/**
 * Distribui larguras de colunas (mais espaço para nomes)
 */
function getColumnWidths(columns: string[], totalWidth: number): number[] {
  const weights = columns.map((col) => {
    const isNome = NOME_COLUMN_NAMES.some((n) => col === n || col.toLowerCase().includes('nome'));
    return isNome ? 2.5 : 1;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (w / sum) * totalWidth);
}

/**
 * Quebra texto em linhas que cabem na largura
 */
function wrapText(pdf: jsPDF, text: string, maxWidth: number): string[] {
  return pdf.splitTextToSize(text || '-', Math.max(maxWidth - 2, 10));
}

/**
 * Exporta dados tabulares para PDF (tema claro, Paisagem, quebras de linha)
 */
export function exportReportToPDF(
  data: Record<string, unknown>[],
  title: string,
  columns: string[],
  filename?: string,
  reportType: ReportType = 'colaboradores'
): string {
  const finalFilename = filename || getFilename(reportType, 'pdf');
  const pdf = new jsPDF('l', 'mm', 'a4'); // Paisagem
  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 12;
  const headerHeight = 12;
  const lineHeight = 5;
  const tableWidth = pageWidth - 2 * margin;

  setPdfTextColor(pdf, COLORS.text);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, pageWidth / 2, 12, { align: 'center' });
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, 18, { align: 'center' });

  const colWidths = getColumnWidths(columns, tableWidth);
  const tableEndX = margin + colWidths.reduce((a, b) => a + b, 0);

  const drawHeader = (y: number) => {
    pdf.setFillColor(232, 232, 232);
    pdf.rect(margin, y - 6, tableEndX - margin, headerHeight, 'F');
    setPdfTextColor(pdf, COLORS.headerText);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    let x = margin;
    columns.forEach((col, i) => {
      const lines = wrapText(pdf, col, colWidths[i]);
      pdf.text(lines[0], x + 1, y + 2);
      x += colWidths[i];
    });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    setPdfTextColor(pdf, COLORS.text);
  };

  let yPos = 28;
  drawHeader(yPos);
  yPos += headerHeight + 4;

  data.forEach((row) => {
    let rowHeight = lineHeight;
    const cellLines: string[][] = [];
    columns.forEach((col, i) => {
      const val = row[col] != null ? String(row[col]) : '-';
      const lines = wrapText(pdf, val, colWidths[i]);
      cellLines.push(lines);
      rowHeight = Math.max(rowHeight, lines.length * lineHeight);
    });

    if (yPos + rowHeight > pageHeight - 15) {
      pdf.addPage('l') // landscape (keeps current format, e.g. A4);
      yPos = 15;
      drawHeader(yPos);
      yPos += headerHeight + 4;
    }

    const maxLines = Math.max(...cellLines.map((l) => l.length));
    for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
      let x = margin;
      columns.forEach((col, i) => {
        const lines = cellLines[i];
        const line = lines[lineIdx] ?? '';
        if (line) pdf.text(line, x + 1, yPos + 2);
        x += colWidths[i];
      });
      yPos += lineHeight;
    }
    yPos += 2;
  });

  pdf.save(finalFilename);
  return finalFilename;
}

export interface GeneralReportData {
  summary?: {
    healthScore?: number;
    totalEvaluations?: number;
    activeSectorsCount?: number;
    activeRolesCount?: number;
    activeEmployeesCount?: number;
    performanceList?: Record<string, unknown>[];
  };
  sections?: {
    companies?: Record<string, unknown>[];
    sectors?: Record<string, unknown>[];
    roles?: Record<string, unknown>[];
    employees?: Record<string, unknown>[];
    criteria?: Record<string, unknown>[];
    evaluations?: Record<string, unknown>[];
    disc?: Record<string, unknown>[];
    ranking?: Record<string, unknown>[];
  };
}

/**
 * Exporta Relatório Geral para PDF (resumo + páginas separadas por seção, Paisagem)
 */
export function exportGeneralReportToPDF(
  generalData: GeneralReportData,
  companyName: string = 'Empresa',
  filename?: string
): string {
  const finalFilename = filename || `relatorio_geral_${new Date().toISOString().split('T')[0]}.pdf`;
  const pdf = new jsPDF('p', 'mm', 'a4'); // Resumo em retrato
  const pageWidth = 210;
  const margin = 15;

  const addTitle = (title: string, y: number) => {
    setPdfTextColor(pdf, COLORS.text);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, margin, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
  };

  let yPos = 20;
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Relatório Geral', pageWidth / 2, yPos, { align: 'center' });
  yPos += 6;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${companyName} - Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 20;

  const s = generalData.summary;
  if (s) {
    addTitle('Resumo Executivo', yPos);
    yPos += 10;
    const lines = [
      `Score de Saúde: ${s.healthScore?.toFixed(2) ?? '0.00'}`,
      `Total de Avaliações: ${s.totalEvaluations ?? 0}`,
      `Setores Ativos: ${s.activeSectorsCount ?? 0}`,
      `Cargos Ativos: ${s.activeRolesCount ?? 0}`,
      `Colaboradores Ativos: ${s.activeEmployeesCount ?? 0}`,
    ];
    lines.forEach((line) => {
      pdf.text(line, margin, yPos);
      yPos += 8;
    });
    yPos += 10;
  }

  const sections = generalData.sections;
  if (sections) {
    const sectionConfigs: { key: string; title: string; cols: string[] }[] = [
      { key: 'companies', title: 'Empresas', cols: ['id', 'name'] },
      { key: 'sectors', title: 'Setores', cols: ['id', 'name', 'manager'] },
      { key: 'roles', title: 'Cargos', cols: ['id', 'name', 'level'] },
      { key: 'employees', title: 'Colaboradores', cols: ['name', 'sector', 'role', 'status'] },
      { key: 'criteria', title: 'Critérios', cols: ['name', 'type', 'description'] },
      { key: 'evaluations', title: 'Histórico Avaliações', cols: ['employeeName', 'date', 'type', 'average'] },
      { key: 'disc', title: 'Perfil DISC', cols: ['name', 'sector', 'role', 'discProfile'] },
      { key: 'ranking', title: 'Ranking', cols: ['realName', 'realSector', 'realRole', 'realType', 'score'] },
    ];

    const secPageWidth = 297; // Paisagem para tabelas
    const secPageHeight = 210;
    const secMargin = 12;
    const lineHeight = 5;
    const secTableWidth = secPageWidth - 2 * secMargin;

    sectionConfigs.forEach(({ key, title, cols }) => {
      const arr = sections[key as keyof typeof sections];
      if (!arr || !Array.isArray(arr) || arr.length === 0) return;

      pdf.addPage('l') // landscape (keeps current format, e.g. A4); // Nova página em Paisagem para tabelas
      yPos = 15;
      setPdfTextColor(pdf, COLORS.text);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, secMargin, yPos);
      yPos += 10;

      const data = arr as Record<string, unknown>[];
      const colWidths = getColumnWidths(cols, secTableWidth);
      const headerHeight = 10;
      const tableEndX = secMargin + colWidths.reduce((a, b) => a + b, 0);

      pdf.setFillColor(232, 232, 232);
      pdf.rect(secMargin, yPos - 6, tableEndX - secMargin, headerHeight, 'F');
      setPdfTextColor(pdf, COLORS.headerText);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      let x = secMargin;
      cols.forEach((col, i) => {
        const lines = wrapText(pdf, col, colWidths[i]);
        pdf.text(lines[0], x + 1, yPos + 2);
        x += colWidths[i];
      });
      yPos += headerHeight + 4;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      setPdfTextColor(pdf, COLORS.text);

      data.slice(0, 30).forEach((row) => {
        let rowHeight = lineHeight;
        const cellLines: string[][] = [];
        cols.forEach((col, i) => {
          const val = row[col] != null ? String(row[col]) : '-';
          const lines = wrapText(pdf, val, colWidths[i]);
          cellLines.push(lines);
          rowHeight = Math.max(rowHeight, lines.length * lineHeight);
        });

        if (yPos + rowHeight > secPageHeight - 12) {
          pdf.addPage('l') // landscape (keeps current format, e.g. A4);
          yPos = 15;
        }

        const maxLines = Math.max(...cellLines.map((l) => l.length));
        for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
          x = secMargin;
          cols.forEach((col, i) => {
            const lines = cellLines[i];
            const line = lines[lineIdx] ?? '';
            if (line) pdf.text(line, x + 1, yPos + 2);
            x += colWidths[i];
          });
          yPos += lineHeight;
        }
        yPos += 2;
      });
      if (data.length > 30) {
        pdf.text(`... e mais ${data.length - 30} registros`, secMargin, yPos + 4);
      }
    });
  }

  pdf.save(finalFilename);
  return finalFilename;
}

/**
 * Exporta Relatório Geral para Excel (resumo + abas separadas)
 */
export function exportGeneralReportToExcel(
  generalData: GeneralReportData,
  companyName: string = 'Empresa',
  filename?: string
): string {
  const finalFilename = filename || `relatorio_geral_${companyName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  const sheets: Array<{ name: string; data: Record<string, unknown>[] }> = [];
  const s = generalData.summary;

  if (s) {
    sheets.push({
      name: 'Resumo',
      data: [
        { Métrica: 'Score de Saúde', Valor: s.healthScore?.toFixed(2) ?? '0.00' },
        { Métrica: 'Total de Avaliações', Valor: s.totalEvaluations ?? 0 },
        { Métrica: 'Setores Ativos', Valor: s.activeSectorsCount ?? 0 },
        { Métrica: 'Cargos Ativos', Valor: s.activeRolesCount ?? 0 },
        { Métrica: 'Colaboradores Ativos', Valor: s.activeEmployeesCount ?? 0 },
      ],
    });
  }

  const sections = generalData.sections;
  if (sections) {
    const sectionConfigs: { key: string; name: string }[] = [
      { key: 'companies', name: 'Empresas' },
      { key: 'sectors', name: 'Setores' },
      { key: 'roles', name: 'Cargos' },
      { key: 'employees', name: 'Colaboradores' },
      { key: 'criteria', name: 'Critérios' },
      { key: 'evaluations', name: 'Histórico' },
      { key: 'disc', name: 'Perfil DISC' },
      { key: 'ranking', name: 'Ranking' },
    ];
    sectionConfigs.forEach(({ key, name }) => {
      const arr = sections[key as keyof typeof sections];
      if (arr && Array.isArray(arr) && arr.length > 0) {
        sheets.push({ name: name.slice(0, 31), data: (arr as Record<string, unknown>[]).map(flattenRow) });
      }
    });
  }

  const workbook = XLSX.utils.book_new();
  sheets.forEach(({ name, data }) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const cols = data.length > 0 ? Object.keys(data[0]) : [];
    if (cols.length > 0) {
      worksheet['!cols'] = getExcelColumnWidths(cols);
    }
    XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31));
  });
  XLSX.writeFile(workbook, finalFilename);
  return finalFilename;
}

/**
 * Obtém as colunas para cada tipo de relatório (para PDF)
 */
export function getReportColumns(reportType: ReportType): string[] {
  switch (reportType) {
    case 'empresas':
      return ['id', 'name'];
    case 'setores':
      return ['id', 'name', 'manager'];
    case 'cargos':
      return ['id', 'name', 'level'];
    case 'niveis':
      return ['Nível', 'Quantidade', 'Setores'];
    case 'colaboradores':
      return ['name', 'email', 'sector', 'role', 'status', 'jobLevel'];
    case 'criterios':
      return ['name', 'type', 'description'];
    case 'historico':
      return ['employeeName', 'date', 'type', 'average', 'sector'];
    case 'disc':
      return ['name', 'sector', 'role', 'discProfile'];
    case 'ranking-pontuacao':
      return ['Posição', 'Nome', 'Setor', 'Cargo', 'Nível', 'Pontuação', 'Avaliações'];
    case 'ranking-destaque':
      return ['Posição', 'Nome', 'Setor', 'Cargo', 'Pontuação', 'Destaques'];
    default:
      return [];
  }
}
