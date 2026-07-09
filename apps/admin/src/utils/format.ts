const numberFormatter = new Intl.NumberFormat('en-US');

/**
 * Format a number with thousand separators.
 * Replaces numeral(val).format('0,0')
 */
export const formatNumber = (val: number | string): string => {
  const parsed = Number(val);
  return Number.isFinite(parsed) ? numberFormatter.format(parsed) : '';
};

/**
 * Format a number as yuan currency string.
 * Replaces `¥ ${numeral(val).format('0,0')}`
 */
export const formatYuan = (val: number | string) => `¥ ${formatNumber(val)}`;

/**
 * Safely format a date value to locale string.
 * Returns fallback (default '—') when value is null/undefined/empty or invalid.
 */
export const formatDate = (
  val: string | number | Date | null | undefined,
  opts?: { fallback?: string; unix?: boolean },
): string => {
  if (val == null || val === '') return opts?.fallback ?? '—';
  const d = opts?.unix
    ? new Date(Number(val) * 1000)
    : new Date(val);
  const ts = d.getTime();
  if (!Number.isFinite(ts)) return opts?.fallback ?? '—';
  return d.toLocaleString();
};

/** 安全地 CSV-escape 一个单元格值 */
const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = String(v).replace(/"/g, '""');
  if (/[",\n\r]/.test(s)) return `"${s}"`;
  return s;
};

/**
 * 前端导出 CSV。
 * @param rows     数据数组
 * @param columns  [{ key: 'field', label: 'Header' }, ...]
 * @param filename 下载文件名（不含 .csv）
 */
export const exportToCsv = (
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[],
  filename: string,
): void => {
  const header = columns.map((c) => csvCell(c.label)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => csvCell(row[c.key])).join(','),
  );
  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
