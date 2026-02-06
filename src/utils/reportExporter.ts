import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';

/**
 * Exporta dados do dashboard para PDF
 */
export const exportToPDF = async (
  title: string,
  content: HTMLElement | null,
  filename: string = `relatorio_${new Date().toISOString().split('T')[0]}.pdf`
) => {
  if (!content) {
    throw new Error('Elemento de conteúdo não encontrado');
  }

  try {
    const canvas = await html2canvas(content, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    // Adiciona título
    pdf.setFontSize(18);
    pdf.text(title, 105, 15, { align: 'center' });
    pdf.setFontSize(10);
    pdf.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 105, 22, { align: 'center' });

    // Adiciona primeira página
    pdf.addImage(imgData, 'PNG', 0, 30, imgWidth, imgHeight);
    heightLeft -= pageHeight - 30;

    // Adiciona páginas adicionais se necessário
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
    return true;
  } catch (error) {
    console.error('Erro ao exportar PDF:', error);
    throw error;
  }
};

/**
 * Exporta dados tabulares para Excel
 */
export const exportToExcel = (
  data: any[],
  sheetName: string = 'Dados',
  filename: string = `relatorio_${new Date().toISOString().split('T')[0]}.xlsx`
) => {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, filename);
    return true;
  } catch (error) {
    console.error('Erro ao exportar Excel:', error);
    throw error;
  }
};

/**
 * Exporta múltiplas planilhas para Excel
 */
export const exportMultipleSheetsToExcel = (
  sheets: Array<{ name: string; data: any[] }>,
  filename: string = `relatorio_${new Date().toISOString().split('T')[0]}.xlsx`
) => {
  try {
    const workbook = XLSX.utils.book_new();
    
    sheets.forEach(({ name, data }) => {
      const worksheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, name);
    });

    XLSX.writeFile(workbook, filename);
    return true;
  } catch (error) {
    console.error('Erro ao exportar Excel:', error);
    throw error;
  }
};

/**
 * Gera relatório completo do dashboard em Excel
 */
export const exportDashboardToExcel = (
  generalMetrics: any,
  competenceMetrics: any,
  comparativeMetrics: any,
  companyName: string = 'Empresa',
  filename?: string
) => {
  const sheets = [];

  // Sheet 1: Resumo Geral
  sheets.push({
    name: 'Resumo Geral',
    data: [
      { Métrica: 'Score de Saúde', Valor: generalMetrics.healthScore?.toFixed(2) || '0.00' },
      { Métrica: 'Total de Avaliações', Valor: generalMetrics.totalEvaluations || 0 },
      { Métrica: 'Setores Ativos', Valor: generalMetrics.activeSectorsCount || 0 },
      { Métrica: 'Cargos Ativos', Valor: generalMetrics.activeRolesCount || 0 },
      { Métrica: 'Colaboradores Ativos', Valor: generalMetrics.activeEmployeesCount || 0 },
    ]
  });

  // Sheet 2: Top Colaboradores
  if (generalMetrics.performanceList && generalMetrics.performanceList.length > 0) {
    sheets.push({
      name: 'Top Colaboradores',
      data: generalMetrics.performanceList.map((item: any, index: number) => ({
        'Ranking': index + 1,
        'Nome': item.realName || item.employeeName,
        'Setor': item.realSector || item.sector,
        'Cargo': item.realRole || item.role,
        'Nível': item.realType || item.type,
        'Score': item.score?.toFixed(2) || '0.00',
        'Funcionário do Mês': item.funcionarioMes || 'Não'
      }))
    });
  }

  // Sheet 3: Distribuição por Setor
  if (generalMetrics.sectorDistribution && generalMetrics.sectorDistribution.length > 0) {
    sheets.push({
      name: 'Distribuição Setores',
      data: generalMetrics.sectorDistribution.map((item: any) => ({
        'Setor': item.name,
        'Quantidade': item.value
      }))
    });
  }

  // Sheet 4: Matriz de Competências
  if (competenceMetrics.matrixData && competenceMetrics.matrixData.length > 0) {
    const matrixData = competenceMetrics.matrixData.map((row: any) => {
      const result: any = {
        'Competência': row.criteria,
        'Nível': row.type,
        'Média Geral': row.average?.toFixed(2) || '0.00'
      };
      
      // Adiciona colunas de setores
      Object.keys(row).forEach(key => {
        if (key !== 'criteria' && key !== 'type' && key !== 'average') {
          result[`Setor: ${key}`] = typeof row[key] === 'number' ? row[key].toFixed(2) : row[key];
        }
      });
      
      return result;
    });
    
    sheets.push({
      name: 'Matriz Competências',
      data: matrixData
    });
  }

  // Sheet 5: Evolução Temporal
  if (competenceMetrics.evolutionData && competenceMetrics.evolutionData.length > 0) {
    sheets.push({
      name: 'Evolução Temporal',
      data: competenceMetrics.evolutionData.map((item: any) => ({
        'Período': item.date,
        'Estratégico': item.Estratégico || 0,
        'Tático': item.Tático || 0,
        'Operacional': item.Operacional || 0,
        'Média Geral': item['Média Geral'] || 0,
        'Meta': item.Meta || 9.0
      }))
    });
  }

  // Sheet 6: Comparativo Individual
  if (comparativeMetrics.individualData && comparativeMetrics.individualData.length > 0) {
    sheets.push({
      name: 'Comparativo Individual',
      data: comparativeMetrics.individualData.map((item: any) => ({
        'Nome': item.name,
        'Setor': item.sector,
        'Cargo': item.role,
        'Nível': item.type,
        'Score Individual': item.individualScore?.toFixed(2) || '0.00',
        'Média Setor': item.sectorAvg?.toFixed(2) || '0.00',
        'Média Empresa': item.companyAvg?.toFixed(2) || '0.00',
        'Diferença vs Setor': item.diffSector?.toFixed(2) || '0.00',
        'Diferença vs Empresa': item.diffCompany?.toFixed(2) || '0.00'
      }))
    });
  }

  const finalFilename = filename || `relatorio_dashboard_${companyName}_${new Date().toISOString().split('T')[0]}.xlsx`;
  exportMultipleSheetsToExcel(sheets, finalFilename);
  return finalFilename;
};

export interface RankingExportRow {
  name: string;
  employeeId: string;
  sector: string;
  role: string;
  level: string;
  totalScore: number;
  averageScore: number;
  evaluationCount: number;
  highlights: { bySelection: number; byScore: number };
}

/**
 * Exporta tabela de ranking para Excel
 */
export const exportRankingToExcel = (
  data: RankingExportRow[],
  sheetName: string = 'Ranking',
  filename: string = `ranking_${new Date().toISOString().split('T')[0]}.xlsx`
) => {
  const rows = data.map((row, idx) => ({
    Posição: idx + 1,
    Nome: row.name,
    Setor: row.sector,
    Cargo: row.role,
    Nível: row.level,
    'Pontuação Acumulada': row.totalScore.toFixed(2),
    Média: row.averageScore.toFixed(2),
    Avaliações: row.evaluationCount,
    'Destaques (seleção)': row.highlights.bySelection,
    'Destaques (pontuação)': row.highlights.byScore,
  }));
  exportToExcel(rows, sheetName, filename);
  return filename;
};

export interface RankingPDFOptions {
  includeTable?: boolean;
  includeChart?: boolean;
  chartImageData?: string;
}

/**
 * Exporta ranking para PDF respeitando seções selecionadas (tabela, gráfico).
 * Tema claro com contraste adequado para leitura.
 */
export const exportRankingToPDF = (
  data: RankingExportRow[],
  title: string = 'Ranking de Pontuação',
  companyName: string = 'Empresa',
  options: RankingPDFOptions = {},
  filename?: string
) => {
  const { includeTable = true, includeChart = false, chartImageData } = options;
  const finalFilename = filename || `ranking_${(companyName || 'Empresa').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

  const pdf = new jsPDF('l', 'mm', 'a4'); // Paisagem para melhor distribuição
  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 12;
  const rowHeight = 6;
  const headerHeight = 12;

  // Cores tema claro com contraste adequado
  const colors = {
    text: '#1a1a1a',
    textSecondary: '#333333',
    headerBg: '#e8e8e8',
    headerText: '#0d0d0d',
    border: '#999999',
    rowBorder: '#cccccc',
  };

  const setTextColor = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    pdf.setTextColor(r, g, b);
  };

  let yPos = 20;
  let hasContent = false;

  // Seção: Tabela de ranking
  if (includeTable && data.length > 0) {
    hasContent = true;
    setTextColor(colors.text);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${companyName} - Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 14;

    const cols = ['Pos', 'Nome', 'Setor', 'Cargo', 'Nível', 'Pont.Acum', 'Aval.'];
    const colWidths = [12, 80, 45, 45, 35, 28, 20]; // Larguras maiores para nomes (Paisagem)
    const tableEndX = margin + colWidths.reduce((a, b) => a + b, 0);

    data.forEach((row, idx) => {
      if (yPos > pageHeight - 35) {
        pdf.addPage();
        yPos = 20;
      }

      let colStart = margin;

      // Cabeçalho repetido em nova página
      if (yPos === 20 && idx > 0) {
        pdf.setFillColor(232, 232, 232); // #e8e8e8
        pdf.rect(margin, yPos - 6, tableEndX - margin, headerHeight, 'F');
        setTextColor(colors.headerText);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        cols.forEach((col, i) => {
          pdf.text(col, colStart + 1, yPos + 2);
          colStart += colWidths[i];
        });
        yPos += headerHeight + 2;
        colStart = margin;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        setTextColor(colors.text);
      }

      // Primeira página: cabeçalho da tabela
      if (idx === 0) {
        pdf.setFillColor(232, 232, 232);
        pdf.rect(margin, yPos - 6, tableEndX - margin, headerHeight, 'F');
        setTextColor(colors.headerText);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        cols.forEach((col, i) => {
          pdf.text(col, colStart + 1, yPos + 2);
          colStart += colWidths[i];
        });
        yPos += headerHeight + 2;
        colStart = margin;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        setTextColor(colors.text);
      }

      const nameStr = row.name || '-';
      const sectorStr = row.sector || '-';
      const roleStr = row.role || '-';
      const nameLines = pdf.splitTextToSize(nameStr, colWidths[1] - 2);
      const sectorLines = pdf.splitTextToSize(sectorStr, colWidths[2] - 2);
      const roleLines = pdf.splitTextToSize(roleStr, colWidths[3] - 2);
      const maxLines = Math.max(nameLines.length, sectorLines.length, roleLines.length, 1);

      for (let ln = 0; ln < maxLines; ln++) {
        let x = margin;
        const vals = [
          ln === 0 ? String(idx + 1) : '',
          nameLines[ln] ?? '',
          sectorLines[ln] ?? '',
          roleLines[ln] ?? '',
          ln === 0 ? (row.level || '-') : '',
          ln === 0 ? row.totalScore.toFixed(1) : '',
          ln === 0 ? String(row.evaluationCount) : '',
        ];
        vals.forEach((val, i) => {
          if (val) pdf.text(val, x + 1, yPos);
          x += colWidths[i];
        });
        yPos += rowHeight;
      }

      if (idx < data.length - 1) {
        pdf.setDrawColor(204, 204, 204);
        pdf.line(margin, yPos - 2, tableEndX, yPos - 2);
      }
    });
    yPos += 15;
  }

  // Seção: Gráfico de evolução (quando checkbox marcado e imagem disponível)
  if (includeChart && chartImageData) {
    hasContent = true;
    if (yPos > 60 || (includeTable && data.length > 0)) {
      pdf.addPage();
      yPos = 20;
    }
    setTextColor(colors.text);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Evolução Temporal - Top 10', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text(`${companyName} - ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 12;

    const imgWidth = pageWidth - 2 * margin;
    const imgHeight = 160;
    pdf.addImage(chartImageData, 'PNG', margin, yPos, imgWidth, imgHeight);
  }

  if (!hasContent) {
    setTextColor(colors.text);
    pdf.setFontSize(12);
    pdf.text('Nenhum dado para exportar.', pageWidth / 2, pageHeight / 2, { align: 'center' });
  }

  pdf.save(finalFilename);
  return finalFilename;
};

export interface OverviewSectionOptions {
  scorecards?: boolean;
  rankings?: boolean;
  health?: boolean;
  distributions?: boolean;
  performance?: boolean;
  highlights?: boolean;
  employees?: boolean;
  disc?: boolean;
}

/**
 * Exporta Overview (Saúde da Empresa) para Excel respeitando seções selecionadas.
 * Tema claro, sem quebrar conteúdo.
 */
export const exportOverviewToExcel = (
  generalMetrics: any,
  competenceMetrics: any,
  companyName: string = 'Empresa',
  sections: OverviewSectionOptions = {}
) => {
  const sheets: Array<{ name: string; data: any[] }> = [];
  const safe = (v: any) => v ?? '-';

  if (sections.scorecards !== false) {
    sheets.push({
      name: 'Resumo Geral',
      data: [
        { Métrica: 'Score de Saúde', Valor: generalMetrics.healthScore?.toFixed(2) || '0.00' },
        { Métrica: 'Total de Avaliações', Valor: generalMetrics.totalEvaluations || 0 },
        { Métrica: 'Setores Ativos', Valor: generalMetrics.activeSectorsCount || 0 },
        { Métrica: 'Cargos Ativos', Valor: generalMetrics.activeRolesCount || 0 },
        { Métrica: 'Colaboradores Ativos', Valor: generalMetrics.activeEmployeesCount || 0 },
      ],
    });
  }

  if ((sections.performance !== false || sections.rankings !== false) && generalMetrics.performanceList?.length > 0) {
    sheets.push({
      name: 'Ranking Colaboradores',
      data: generalMetrics.performanceList.map((item: any, idx: number) => ({
        Ranking: idx + 1,
        Nome: safe(item.realName || item.employeeName),
        Setor: safe(item.realSector || item.sector),
        Cargo: safe(item.realRole || item.role),
        Nível: safe(item.realType || item.type),
        Score: item.score?.toFixed(2) || '0.00',
        'Func. Mês': item.funcionarioMes || 'Não',
      })),
    });
  }

  if (sections.distributions !== false && generalMetrics.sectorDistribution?.length > 0) {
    sheets.push({
      name: 'Distribuição Setores',
      data: generalMetrics.sectorDistribution.map((item: any) => ({
        Setor: safe(item.name),
        Quantidade: item.value,
      })),
    });
  }

  if (sections.distributions !== false && generalMetrics.roleDistribution?.length > 0) {
    sheets.push({
      name: 'Distribuição Cargos',
      data: generalMetrics.roleDistribution.map((item: any) => ({
        Cargo: safe(item.name),
        Quantidade: item.value,
      })),
    });
  }

  if (competenceMetrics?.matrixData?.length > 0) {
    sheets.push({
      name: 'Matriz Competências',
      data: competenceMetrics.matrixData.map((row: any) => ({
        Competência: safe(row.criteria),
        Nível: safe(row.type),
        'Média Geral': row.average?.toFixed(2) || '0.00',
      })),
    });
  }

  const filename = `overview_${(companyName || 'empresa').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  if (sheets.length === 0) {
    exportToExcel([{ Mensagem: 'Nenhum dado selecionado para exportar.' }], 'Vazio', filename);
  } else {
    exportMultipleSheetsToExcel(sheets, filename);
  }
  return filename;
};

/**
 * Exporta Overview (Saúde da Empresa) para PDF com tema claro e contraste.
 * Respeita seções selecionadas. Usa paginação para evitar conteúdo quebrado.
 */
export const exportOverviewToPDF = (
  generalMetrics: any,
  companyName: string = 'Empresa',
  sections: OverviewSectionOptions = {}
) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const colors = { text: '#1a1a1a', header: '#0d0d0d', headerBg: '#e8e8e8', border: '#cccccc' };

  const setColor = (hex: string) => {
    pdf.setTextColor(
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255
    );
  };

  let yPos = 25;
  const maxY = pageHeight - 25;

  const addPageIfNeeded = (needSpace: number) => {
    if (yPos + needSpace > maxY) {
      pdf.addPage();
      yPos = 25;
    }
  };

  setColor(colors.text);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text('Saúde da Empresa', pageWidth / 2, 20, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.text(`${companyName} - ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, 28, { align: 'center' });
  yPos = 38;

  if (sections.scorecards !== false) {
    addPageIfNeeded(40);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    setColor(colors.header);
    pdf.text('Resumo Geral', margin, yPos);
    yPos += 8;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    setColor(colors.text);
    const rows = [
      ['Score de Saúde', generalMetrics.healthScore?.toFixed(2) || '0.00'],
      ['Total de Avaliações', String(generalMetrics.totalEvaluations || 0)],
      ['Setores Ativos', String(generalMetrics.activeSectorsCount || 0)],
      ['Cargos Ativos', String(generalMetrics.activeRolesCount || 0)],
      ['Colaboradores Ativos', String(generalMetrics.activeEmployeesCount || 0)],
    ];
    rows.forEach(([k, v]) => {
      pdf.text(`${k}: ${v}`, margin, yPos);
      yPos += 7;
    });
    yPos += 8;
  }

  if ((sections.performance !== false || sections.rankings !== false) && generalMetrics.performanceList?.length > 0) {
    addPageIfNeeded(50);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    setColor(colors.header);
    pdf.text('Ranking de Colaboradores', margin, yPos);
    yPos += 10;

    const perfList = generalMetrics.performanceList;
    const colWidths = [10, 55, 35, 35, 28, 18];
    const headers = ['#', 'Nome', 'Setor', 'Cargo', 'Nível', 'Score'];
    pdf.setFillColor(232, 232, 232);
    pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 8, 'F');
    pdf.setFontSize(9);
    setColor(colors.header);
    pdf.setFont('helvetica', 'bold');
    let colStart = margin;
    headers.forEach((h, i) => {
      pdf.text(h, colStart + 1, yPos + 1);
      colStart += colWidths[i];
    });
    yPos += 10;
    pdf.setFont('helvetica', 'normal');
    setColor(colors.text);

    const rowHeight = 6;
    for (let i = 0; i < perfList.length; i++) {
      addPageIfNeeded(rowHeight + 5);
      const item = perfList[i];
      const row = [
        String(i + 1),
        (item.realName || item.employeeName || '-').toString().slice(0, 25),
        (item.realSector || item.sector || '-').toString().slice(0, 18),
        (item.realRole || item.role || '-').toString().slice(0, 18),
        (item.realType || item.type || '-').toString().slice(0, 12),
        (item.score?.toFixed(1) || '-'),
      ];
      colStart = margin;
      row.forEach((val, j) => {
        pdf.text(val, colStart + 1, yPos);
        colStart += colWidths[j];
      });
      yPos += rowHeight;
    }
    yPos += 12;
  }

  if (sections.distributions !== false && generalMetrics.sectorDistribution?.length > 0) {
    addPageIfNeeded(40);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    setColor(colors.header);
    pdf.text('Distribuição por Setor', margin, yPos);
    yPos += 10;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    setColor(colors.text);
    generalMetrics.sectorDistribution.forEach((item: any) => {
      addPageIfNeeded(6);
      pdf.text(`• ${item.name || '-'}: ${item.value || 0}`, margin, yPos);
      yPos += 6;
    });
    yPos += 8;
  }

  const filename = `overview_${(companyName || 'empresa').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(filename);
  return filename;
};
