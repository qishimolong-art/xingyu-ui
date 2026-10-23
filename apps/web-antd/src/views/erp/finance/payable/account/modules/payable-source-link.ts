import type { ErpPayableAccountApi } from '#/api/erp/finance/payable/account';

export function getPayableSourceTarget(
  row: ErpPayableAccountApi.PayableDetail,
  readonly: boolean,
  hasAccessByCodes: (codes: string[]) => boolean,
) {
  if (readonly || !row.sourceNo?.trim() || !row.sourceId || row.sourceId <= 0) {
    return;
  }
  let permission: string;
  switch (row.sourceType) {
    case 'FINANCE_PAYMENT': {
      permission = 'erp:finance-payment:query';
      break;
    }
    case 'PURCHASE_ORDER': {
      permission = 'erp:purchase-order:query';
      break;
    }
    default: {
      return;
    }
  }
  if (hasAccessByCodes([permission])) {
    return { id: row.sourceId, type: row.sourceType };
  }
}
