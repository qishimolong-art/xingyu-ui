import { formatPurchaseDecimal, purchaseDecimalDivide } from './decimal';

function parseFiniteNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

export function formatPurchaseItemPieceCount(row: {
  count?: number | string;
  packageQty?: number | string;
}) {
  const count = parseFiniteNumber(row.count);
  const packageQty = parseFiniteNumber(row.packageQty);
  if (count === undefined || packageQty === undefined || packageQty <= 0) {
    return '-';
  }
  return formatPurchaseDecimal(purchaseDecimalDivide(count, packageQty)) || '-';
}

export function purchaseItemPieceCountColumnFormatter({ row }: { row: any }) {
  return formatPurchaseItemPieceCount(row);
}
