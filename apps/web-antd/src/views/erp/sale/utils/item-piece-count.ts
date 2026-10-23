import { erpCountInputFormatter } from '@vben/utils';

function parseFiniteNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

export function formatSaleItemPieceCount(
  row: {
    count?: number | string;
    outCount?: number | string;
    packageQty?: number | string;
  },
  countField: 'count' | 'outCount' = 'count',
) {
  const count = parseFiniteNumber(row[countField]);
  const packageQty = parseFiniteNumber(row.packageQty);
  if (count === undefined || packageQty === undefined || packageQty <= 0) {
    return '-';
  }
  return erpCountInputFormatter(count / packageQty) || '-';
}

export function saleItemPieceCountColumnFormatter({ row }: { row: any }) {
  return formatSaleItemPieceCount(row);
}

export function salePriceAdjustPieceCountColumnFormatter({
  row,
}: {
  row: any;
}) {
  return formatSaleItemPieceCount(row, 'outCount');
}
