import { stockInput, stockNatural } from './stock-decimal';

export function formatStockNaturalNumber(value: unknown) {
  return stockNatural(value as null | number | string | undefined);
}
export function parseStockDocumentDecimal(text: unknown, price = false) {
  return stockInput(text, { label: price ? '单价' : '数量' });
}
