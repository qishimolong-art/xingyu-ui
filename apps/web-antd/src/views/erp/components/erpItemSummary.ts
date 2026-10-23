export interface ErpSummaryField<T = Record<string, any>> {
  field: keyof T | string;
  label: string;
  digits?: number;
  formatter?: (value: number, rows: T[]) => string | number;
}

export interface ErpTableSummaryColumn<T = Record<string, any>> {
  field: keyof T | string;
  digits?: number;
  label?: string;
  sum?: boolean;
  formatter?: (value: number, rows: T[]) => string | number;
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function sumErpField<T extends Record<string, any>>(
  rows: T[],
  field: keyof T | string,
) {
  return (rows || []).reduce((total, row) => total + toNumber(row[field]), 0);
}

export function buildErpItemSummary<T extends Record<string, any>>(
  rows: T[],
  fields: ErpSummaryField<T>[],
) {
  return fields.map((field) => {
    const value = sumErpField(rows, field.field);
    const digits = field.digits ?? 2;
    return {
      field: field.field,
      label: field.label,
      rawValue: value,
      value: field.formatter
        ? field.formatter(value, rows)
        : Number(value.toFixed(digits)),
    };
  });
}

export function buildErpTableSummaryRow<T extends Record<string, any>>(
  rows: T[],
  columns: ErpTableSummaryColumn<T>[],
  options: {
    title?: string;
    titleField?: keyof T | string;
  } = {},
) {
  const summaryRow: Record<string, string | number> = {};
  const titleField = options.titleField || columns[0]?.field;
  if (titleField) {
    summaryRow[String(titleField)] = options.title || '\u5408\u8ba1';
  }
  columns.forEach((column) => {
    if (!column.sum) {
      return;
    }
    const value = sumErpField(rows, column.field);
    const field = String(column.field);
    summaryRow[field] = column.formatter
      ? column.formatter(value, rows)
      : Number(value.toFixed(column.digits ?? 2));
  });
  return summaryRow;
}
