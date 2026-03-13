/**
 * Utilitários para datas no formato YYYY-MM-DD (apenas data, sem timezone).
 * Evita que new Date("YYYY-MM-DD") seja interpretado como UTC e desloque o mês no fuso local (ex: Brasil).
 */

/**
 * Retorna a chave de mês "YYYY-MM" a partir de uma string "YYYY-MM-DD".
 */
export function getMonthKey(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) return '';
  return dateStr.slice(0, 7);
}

/**
 * Retorna o ano como string a partir de "YYYY-MM-DD".
 */
export function getYearFromDateStr(dateStr: string): string {
  if (!dateStr || dateStr.length < 4) return '';
  return dateStr.slice(0, 4);
}

/**
 * Formata uma string "YYYY-MM-DD" em pt-BR usando UTC para evitar deslocamento de timezone.
 * Útil para exibir mês/ano ou data completa sem que o dia 1 vire o mês anterior no fuso local.
 */
export function formatDateOnlyPtBR(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' }
): string {
  if (!dateStr || dateStr.length < 10) return 'N/A';
  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('pt-BR', {
    ...options,
    timeZone: 'UTC',
  });
}

/**
 * Retorna timestamp para ordenação de strings "YYYY-MM-DD" sem deslocamento de timezone.
 * Usa meio-dia local para evitar edge cases em fusos.
 */
export function getDateOnlyTimestamp(dateStr: string): number {
  if (!dateStr || dateStr.length < 10) return 0;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}
