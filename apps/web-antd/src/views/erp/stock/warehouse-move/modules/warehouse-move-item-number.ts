import { formatStockNaturalNumber } from '../../utils/document-number';
import { stockInput, stockNatural } from '../../utils/stock-decimal';

export type WarehouseMoveCountParseResult =
  | { message: string; ok: false }
  | { ok: true; value: string };

/**
 * Parse the independent text state used by the warehouse-move quantity input.
 * An unfinished trailing decimal is accepted so blur and submit share the same
 * behavior as the sale-cart text input.
 */
export function parseWarehouseMoveCountText(
  text: unknown,
  fieldLabel = '移货数量',
): WarehouseMoveCountParseResult {
  const value = String(text ?? '').trim();
  if (!value) {
    return { message: `${fieldLabel}不能为空`, ok: false };
  }
  if (!/^\d+(\.\d*)?$/.test(value)) {
    return { message: `${fieldLabel}必须为数字`, ok: false };
  }
  try {
    return { ok: true, value: stockInput(value, { label: fieldLabel }) };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

export function normalizeWarehouseMoveCount(value: number | string) {
  return stockNatural(value);
}

/** Remove meaningless trailing zeros after initialization or blur. */
export function formatWarehouseMoveCountInput(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  return formatStockNaturalNumber(value);
}
