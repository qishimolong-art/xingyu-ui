import { stockDecimal, stockDivide, stockNatural } from './stock-decimal';
export function formatStockItemPieceCount(row: {
  count?: null | number | string;
  packageQty?: null | number | string;
}) {
  if (
    row.count == null ||
    row.packageQty == null ||
    row.count === '****' ||
    row.packageQty === '****'
  )
    return row.count === '****' || row.packageQty === '****' ? '****' : '-';
  try {
    return stockDecimal(row.packageQty).gt(0)
      ? stockNatural(stockDivide(row.count, row.packageQty))
      : '-';
  } catch {
    return '-';
  }
}
export function stockItemPieceCountColumnFormatter({ row }: { row: any }) {
  return formatStockItemPieceCount(row);
}
