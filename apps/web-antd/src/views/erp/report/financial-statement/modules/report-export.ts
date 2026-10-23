export interface ReportExportColumn {
  field: string;
  formatter?: (value: unknown, row: Record<string, any>) => string;
  title: string;
}

function normalizeCsvValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join('；');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function escapeCsv(value: unknown): string {
  const text = normalizeCsvValue(value);
  if (
    text.includes(',') ||
    text.includes('"') ||
    text.includes('\r') ||
    text.includes('\n')
  ) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function buildCsvBlob(
  rows: Array<Record<string, any>>,
  columns: ReportExportColumn[],
) {
  const header = columns.map((column) => escapeCsv(column.title)).join(',');
  const body = rows.map((row) =>
    columns
      .map((column) =>
        escapeCsv(
          column.formatter
            ? column.formatter(row[column.field], row)
            : row[column.field],
        ),
      )
      .join(','),
  );
  return new Blob([`﻿${[header, ...body].join('\n')}`], {
    type: 'text/csv;charset=utf-8',
  });
}
