import {
  getPurchaseCostItems,
  type PurchaseCostApi,
} from '#/api/erp/purchase/cost-confirmation';

export const costStatusLabels: Record<
  PurchaseCostApi.Header['status'],
  string
> = {
  NONE: '尚未确认',
  CONFIRMED: '已确认',
  STALE: '原单已变更，需重新确认',
  CONSUMED: '已用于过账',
  SCHEMA_MISSING: '核算配置尚未就绪',
};

interface AmountFormatterInfo {
  input: string;
  userTyping: boolean;
}

/**
 * Format a decimal string as money without converting it to Number. Cost
 * confirmation deliberately keeps six decimal places in the saved value, and
 * can legally exceed Number.MAX_SAFE_INTEGER, so display formatting must not
 * change the underlying value or lose integer digits.
 */
export function formatCostAmountDisplay(value: unknown) {
  if (typeof value !== 'string' || !/^-?\d+(\.\d+)?$/u.test(value)) {
    return undefined;
  }
  const negative = value.startsWith('-');
  const unsigned = negative ? value.slice(1) : value;
  const [integer = '0', fraction = ''] = unsigned.split('.');
  let cents = BigInt(integer || '0') * 100n;
  cents += BigInt((fraction + '00').slice(0, 2));
  if ((fraction[2] ?? '0') >= '5') cents += 1n;
  const roundedInteger = cents / 100n;
  const roundedFraction = String(cents % 100n).padStart(2, '0');
  const prefix = negative && cents !== 0n ? '-' : '';
  return `${prefix}${roundedInteger}.${roundedFraction}`;
}

export function formatCostAmountInput(
  value: null | number | string | undefined,
  info?: AmountFormatterInfo,
) {
  if (info?.userTyping) return info.input;
  if (value === null || value === undefined || value === '') return '';
  return formatCostAmountDisplay(String(value)) ?? '';
}

export function costText(value: unknown, masked = false) {
  if (masked) return '****';
  return formatCostAmountDisplay(value) ?? '不可用';
}
/** 独立读取完整来源快照，不能把业务详情当前页当成全部明细。 */
export async function loadCompleteCostItems(header: PurchaseCostApi.Header) {
  if (
    !Number.isSafeInteger(header.sourceItemCount) ||
    header.sourceItemCount <= 0
  )
    throw new Error('没有可确认的来源明细');
  const items: PurchaseCostApi.Item[] = [];
  const ids = new Set<number>();
  for (let pageNo = 1; items.length < header.sourceItemCount; pageNo++) {
    const page = await getPurchaseCostItems(
      header.purchaseInId,
      header.sourceSignature,
      pageNo,
      100,
    );
    if (page.total !== header.sourceItemCount || page.list.length === 0)
      throw new Error('来源明细已变更，请关闭后重新核对');
    for (const row of page.list) {
      if (row.sourceSignature !== header.sourceSignature)
        throw new Error('来源明细签名不一致，请重新核对');
      if (!Number.isSafeInteger(row.sourceItemId) || ids.has(row.sourceItemId))
        throw new Error('来源明细重复或无效，请重新核对');
      ids.add(row.sourceItemId);
      items.push(row);
    }
    if (items.length > header.sourceItemCount)
      throw new Error('来源明细数量不一致，请重新核对');
  }
  return items;
}
export function validateCostConfirmation(
  items: PurchaseCostApi.Item[],
  evidence: string,
  feeTreatment: string,
) {
  if (items.length === 0) return '没有可确认的来源明细';
  if (!evidence.trim() || evidence.trim().length > 1000)
    return '请填写核对依据（1至1000字）';
  if (!feeTreatment.trim() || feeTreatment.trim().length > 1000)
    return '请说明费用及折扣处理（1至1000字），未发生也需明确说明';
  if (
    items.some(
      (row) =>
        typeof row.confirmedNetTotalAmount !== 'string' ||
        !/^\d{1,18}(\.\d{1,6})?$/.test(row.confirmedNetTotalAmount),
    )
  )
    return '每条明细必须明确填写非负未税成本总额，最多18位整数6位小数';
  if (items.some((row) => (row.evidence?.length ?? 0) > 1000))
    return '明细依据最多1000字';
  return undefined;
}
