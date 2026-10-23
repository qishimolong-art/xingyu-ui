import { stockInput, stockNatural } from '../../utils/stock-decimal';
export type StockCheckDecimalField =
  | 'actualCount'
  | 'count'
  | 'productPrice'
  | 'totalPrice';
export function parseStockCheckDecimal(
  text: string,
  field: StockCheckDecimalField,
) {
  return stockInput(text, {
    signed: field === 'count',
    allowZero: true,
    label: {
      count: '调整数',
      actualCount: '实际库存',
      productPrice: '单价',
      totalPrice: '金额',
    }[field],
  });
}
export function formatStockCheckDecimal(
  value: null | number | string | undefined,
  _field: StockCheckDecimalField,
) {
  return stockNatural(value, '');
}
