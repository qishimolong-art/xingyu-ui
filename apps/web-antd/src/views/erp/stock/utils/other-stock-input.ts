import { reactive } from 'vue';

import {
  formatStockNaturalNumber,
  parseStockDocumentDecimal,
} from './document-number';
import { stockDecimal } from './stock-decimal';

/** Session-only input text is never attached to business rows or save payloads. */
export function useOtherStockDecimalInputs(
  rowKey: (row: any) => string,
  changed: (row: any) => void,
) {
  const texts = reactive(new Map<string, string>());
  const decimalErrors = reactive<Record<string, boolean>>({});
  const decimalKey = (row: any, field: string) => `${rowKey(row)}:${field}`;
  function decimalValue(row: any, field: string) {
    const original = row[field];
    return (
      texts.get(decimalKey(row, field)) ??
      (original === null || original === undefined
        ? ''
        : formatStockNaturalNumber(original))
    );
  }
  function decimalInput(row: any, field: string, value: string) {
    const key = decimalKey(row, field);
    // Keep the last valid text if a key/paste includes forbidden syntax.
    const pattern = /^\d*(\.\d*)?$/;
    if (!pattern.test(value)) {
      decimalErrors[key] = true;
      return;
    }
    texts.set(key, value);
    Reflect.deleteProperty(decimalErrors, key);
    // Update linked values only for a complete positive number; keep text intact.
    if (value && value !== '.' && stockDecimal(value).gt(0)) {
      const numeric = parseStockDocumentDecimal(
        value,
        field === 'productPrice',
      );
      if (row[field] !== numeric) {
        row[field] = numeric;
        changed(row);
      }
    }
  }
  function commitDecimal(row: any, field: 'count' | 'productPrice') {
    const key = decimalKey(row, field);
    if (!texts.has(key)) return;
    try {
      const value = parseStockDocumentDecimal(
        texts.get(key),
        field === 'productPrice',
      );
      Reflect.deleteProperty(decimalErrors, key);
      if (row[field] !== value) {
        row[field] = value;
        changed(row);
      }
    } catch (error) {
      decimalErrors[key] = true;
      throw error;
    }
  }
  function resetDecimalRow(row: any) {
    for (const field of ['count', 'productPrice']) {
      const key = decimalKey(row, field);
      texts.delete(key);
      Reflect.deleteProperty(decimalErrors, key);
    }
  }
  return {
    resetDecimalRow,
    decimalValue,
    decimalInput,
    commitDecimal,
    decimalErrors,
    decimalKey,
  };
}
